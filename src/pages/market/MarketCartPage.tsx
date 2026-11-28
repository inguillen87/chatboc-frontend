import ProductPlaceholder from '@/components/market/ProductPlaceholder';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Copy, Loader2, MessageCircle, QrCode, Search, Share2, ShoppingBag, Sparkles, Tag } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import ProductCard from '@/components/market/ProductCard';
import CartSummary from '@/components/market/CartSummary';
import CheckoutDialog from '@/components/market/CheckoutDialog';
import CommercialStateCard from '@/components/market/CommercialStateCard';
import {
  addMarketItem,
  clearMarketCart,
  fetchMarketCart,
  fetchMarketCatalog,
  fetchRewardsProfile,
  previewPaymentCheckout,
  removeMarketItem,
  redeemReward,
  startMarketCheckout,
} from '@/api/market';
import { MarketCartItem, MarketProduct } from '@/types/market';
import { loadMarketContact, saveMarketContact, subscribeMarketCartChanges } from '@/utils/marketStorage';
import { toast } from '@/components/ui/use-toast';
import { Badge } from '@/components/ui/badge';
import { useUser } from '@/hooks/useUser';
import { Input } from '@/components/ui/input';
import { AlertDialog, AlertDialogAction, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { displayMarketPrice, formatCurrency } from '@/utils/currency';
import { getValidStoredToken } from '@/utils/authTokens';
import { hasPersistedClerkSession } from '@/utils/sessionLogout';
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ApiError, getErrorMessage } from '@/utils/api';
import { getMarketCommercialValidation } from '@/utils/marketValidation';
import { buildTenantPath } from '@/utils/tenantPaths';
import { isBackofficeRole } from '@/utils/roles';

type ContactInfo = {
  name?: string;
  phone?: string;
};

const buildRewardIdempotencyKey = (tenantSlug: string, rewardId: string) => {
  const suffix =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return `reward:${tenantSlug}:${rewardId}:${suffix}`;
};

export default function MarketCartPage() {
  const { tenant = '' } = useParams<{ tenant: string }>();
  const tenantSlug = tenant;
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const { user } = useUser();
  const productGridRef = useRef<HTMLDivElement | null>(null);

  const userName = user?.name ?? user?.nombre ?? user?.full_name;
  const userPhone = user?.phone ?? user?.telefono ?? user?.telefono_movil ?? user?.celular;
  const normalizedUserPhone =
    typeof userPhone === 'string' ? userPhone.trim() : userPhone ? String(userPhone).trim() : undefined;

  const [showContactDialog, setShowContactDialog] = useState(false);
  const [showAuthDialog, setShowAuthDialog] = useState(false);
  const [showQrModal, setShowQrModal] = useState(false);
  const [showMobileCart, setShowMobileCart] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeCategory, setActiveCategory] = useState<string>('todos');
  const [confirmation, setConfirmation] = useState<string | null>(null);
  const [checkoutPaymentUrl, setCheckoutPaymentUrl] = useState<string | null>(null);
  const [qrError, setQrError] = useState<string | null>(null);
  const [contact, setContact] = useState<ContactInfo>(() => {
    const stored = loadMarketContact(tenantSlug);
    return {
      name: stored.name ?? userName,
      phone: stored.phone ?? normalizedUserPhone,
    };
  });

  useEffect(() => {
    const stored = loadMarketContact(tenantSlug);
    setContact((prev) => ({
      name: stored.name ?? prev.name ?? userName,
      phone: stored.phone ?? prev.phone ?? normalizedUserPhone,
    }));
    setConfirmation(null);
    setCheckoutPaymentUrl(null);
  }, [tenantSlug, userName, normalizedUserPhone]);

  const catalogQuery = useQuery({
    queryKey: ['marketCatalog', tenantSlug],
    queryFn: () => fetchMarketCatalog(tenantSlug),
    enabled: Boolean(tenantSlug),
    staleTime: 1000 * 60, // cache short catalog loads while browsing
  });

  const cartQuery = useQuery({
    queryKey: ['marketCart', tenantSlug],
    queryFn: () => fetchMarketCart(tenantSlug),
    enabled: Boolean(tenantSlug),
    // The cart is the buyer's live state: always re-read it on arrival.
    staleTime: 0,
    refetchOnMount: 'always',
  });

  // Stay in step with every other cart surface (product page, chat, navbar).
  // A first read can also land before the buyer's anonymous identity settles
  // on a cold load, so read once more shortly after arriving.
  useEffect(() => {
    if (!tenantSlug) return undefined;
    const refresh = () => { void queryClient.invalidateQueries({ queryKey: ['marketCart', tenantSlug] }); };
    const unsubscribe = subscribeMarketCartChanges((change) => {
      if (change.tenantSlug === tenantSlug) refresh();
    });
    const settle = window.setTimeout(refresh, 1500);
    return () => { unsubscribe(); window.clearTimeout(settle); };
  }, [queryClient, tenantSlug]);

  const rewardsQuery = useQuery({
    queryKey: ['marketRewardsProfile', tenantSlug],
    queryFn: () => fetchRewardsProfile(tenantSlug),
    enabled: Boolean(tenantSlug),
    retry: 0,
    staleTime: 30_000,
  });

  const cartItems: MarketCartItem[] = cartQuery.data?.items ?? [];

  const shareUrl = useMemo(() => {
    const backendUrl = cartQuery.data?.cartUrl ?? catalogQuery.data?.publicCartUrl;
    if (backendUrl) return backendUrl;

    if (typeof window === 'undefined' || !tenantSlug) return '';
    const url = new URL(window.location.href);
    url.pathname = buildTenantPath('/cart', tenantSlug);
    url.search = '';
    return url.toString();
  }, [cartQuery.data?.cartUrl, catalogQuery.data?.publicCartUrl, tenantSlug]);

  const shareMessage = useMemo(() => {
    if (catalogQuery.data?.whatsappShareUrl) return catalogQuery.data.whatsappShareUrl;
    if (cartQuery.data?.whatsappShareUrl) return cartQuery.data.whatsappShareUrl;
    if (!shareUrl) return '';
    const tenantName = catalogQuery.data?.tenantName?.trim();
    const prefix = tenantName ? `Mirá el catálogo de ${tenantName}` : 'Mirá este catálogo';
    return `https://wa.me/?text=${encodeURIComponent(`${prefix}: ${shareUrl}`)}`;
  }, [cartQuery.data?.whatsappShareUrl, catalogQuery.data?.tenantName, shareUrl]);

  const qrImageUrl = useMemo(() => {
    if (!shareUrl) return '';
    return `https://quickchart.io/qr?text=${encodeURIComponent(shareUrl)}&margin=12&size=480`;
  }, [shareUrl]);

  const addMutation = useMutation({
    mutationFn: (productId: string) => addMarketItem(tenantSlug, { productId, quantity: 1 }),
    onSuccess: (data) => {
      queryClient.setQueryData(['marketCart', tenantSlug], data);
      toast({
        title: 'Agregado al carrito',
        description: 'Actualizamos tu carrito.',
      });
    },
    onError: () => {
      toast({
        title: 'No se pudo agregar el producto',
        description: 'Intentá nuevamente en unos segundos.',
        variant: 'destructive',
      });
    },
  });

  const removeMutation = useMutation({
    mutationFn: (productId: string) => removeMarketItem(tenantSlug, productId),
    onSuccess: (data) => {
      queryClient.setQueryData(['marketCart', tenantSlug], data);
      toast({
        title: 'Producto quitado',
        description: 'Actualizamos tu carrito.',
      });
    },
    onError: () => {
      toast({
        title: 'No se pudo actualizar el carrito',
        description: 'Revisá tu conexión e intentá nuevamente.',
        variant: 'destructive',
      });
    },
  });

  const clearMutation = useMutation({
    mutationFn: () => clearMarketCart(tenantSlug),
    onSuccess: (data) => {
      queryClient.setQueryData(['marketCart', tenantSlug], data);
    },
    onError: () => {
      toast({
        title: 'No pudimos vaciar el carrito',
        description: 'Intentá nuevamente en unos segundos.',
        variant: 'destructive',
      });
    },
  });

  const checkoutMutation = useMutation({
    mutationFn: async (payload: { name?: string; phone?: string }) => {
      const checkoutPayload = {
        ...payload,
        items: cartItems.map((item) => ({ id: item.id, quantity: item.quantity })),
        customer: {
          ...(payload.name ? { name: payload.name } : {}),
          ...(payload.phone ? { phone: payload.phone } : {}),
        },
      };
      const preview = await previewPaymentCheckout(tenantSlug, checkoutPayload);
      if (preview?.payment_required && preview.payment_ready === false) {
        const previewExperience = preview.checkout_experience ?? preview.checkout_options?.checkout_experience ?? null;
        throw new Error(
          previewExperience?.copy?.customer_pending_gateway ??
            previewExperience?.copy?.customer_locked ??
            preview.next_step_label ??
            preview.checkout_options?.gateway_hint ??
            'El checkout todavía no está listo para recibir pagos.',
        );
      }
      const previewValidation = getMarketCommercialValidation(preview, cartQuery.data, cartQuery.data?.checkout_options);
      if (!previewValidation.canStartCheckout && previewValidation.reason) {
        throw new Error(previewValidation.reason);
      }
      return startMarketCheckout(tenantSlug, checkoutPayload);
    },
    onSuccess: (response, variables) => {
      saveMarketContact(tenantSlug, variables);
      setContact(variables);
      const resolvedMarketOrderId = response?.market_order_id ?? response?.orderId ?? response?.order_id;
      const resolvedPreference = response?.preference_id ?? response?.preferenceId;
      const resolvedStage = response?.commercial_state?.stage ?? response?.estado ?? response?.status;
      const responseValidation = getMarketCommercialValidation(response, response?.order, response?.inventory_policy);
      const resolvedPaymentUrl = responseValidation.canStartCheckout ? response?.checkoutUrl ?? response?.init_point ?? null : null;
      const confirmationParts = [
        response?.message ?? responseValidation.reason ?? 'Solicitud registrada para validación.',
      ];
      if (resolvedMarketOrderId) confirmationParts.push(`Orden operacional #${resolvedMarketOrderId}.`);
      if (resolvedStage) confirmationParts.push(`Estado: ${resolvedStage}.`);
      if (resolvedPreference) confirmationParts.push(`Referencia de pago: ${resolvedPreference}.`);
      setConfirmation(confirmationParts.join(' '));
      setCheckoutPaymentUrl(resolvedPaymentUrl);
      queryClient.invalidateQueries({ queryKey: ['marketCart', tenantSlug] });
    },
    onError: (error) => {
      toast({
        title: 'No pudimos iniciar el checkout',
        description: getErrorMessage(error, 'Revisá tu conexión o volvé a intentarlo.'),
        variant: 'destructive',
      });
    },
  });

  const redeemMutation = useMutation({
    mutationFn: (rewardId: string) =>
      redeemReward(
        tenantSlug,
        { reward_id: rewardId },
        buildRewardIdempotencyKey(tenantSlug, rewardId),
      ),
    onSuccess: (response) => {
      queryClient.invalidateQueries({ queryKey: ['marketRewardsProfile', tenantSlug] });
      queryClient.invalidateQueries({ queryKey: ['marketCart', tenantSlug] });
      toast({
        title: response.duplicate ? 'Canje ya registrado' : 'Canje aplicado',
        description:
          typeof response.balance === 'number'
            ? `Saldo actualizado: ${response.balance.toLocaleString('es-AR')} pts.`
            : 'Actualizamos tus puntos.',
      });
    },
    onError: (error) => {
      toast({
        title: 'No pudimos canjear el beneficio',
        description: getErrorMessage(error, 'Revisá tus puntos disponibles o volvé a intentarlo.'),
        variant: 'destructive',
      });
    },
  });

  const handleCopyLink = async () => {
    try {
      if (!shareUrl) return;
      await navigator.clipboard.writeText(shareUrl);
      toast({
        title: 'Catálogo listo para compartir',
        description: 'Copiamos el enlace en tu portapapeles.',
      });
    } catch (error) {
      console.error('Clipboard error', error);
      toast({
        title: 'No se pudo copiar el enlace',
        description: shareUrl,
        variant: 'destructive',
      });
    }
  };

  const handleShareWhatsApp = () => {
    if (!shareMessage) return;
    const whatsappUrl = shareMessage.startsWith('https://wa.me')
      ? shareMessage
      : `https://wa.me/?text=${encodeURIComponent(shareMessage)}`;
    window.open(whatsappUrl, '_blank', 'noopener,noreferrer');
  };

  const handleOpenQr = () => {
    if (!shareUrl) return;
    setQrError(null);
    setShowQrModal(true);
  };

  const handleCheckout = () => {
    const resolvedName = contact.name ?? userName;
    const phone = contact.phone?.trim() ?? normalizedUserPhone;
    const requiresContactOrAuth = cartQuery.data?.checkout_options?.requires_contact_or_auth ?? true;
    const contactReady = cartQuery.data?.checkout_preview?.contact_ready === true || Boolean(phone);
    if (!cartQuery.data?.items.length) {
      toast({
        title: 'Tu carrito está vacío',
        description: 'Agregá productos para continuar.',
      });
      return;
    }

    if (!tenantSlug) {
      toast({
        title: 'No encontramos el catálogo',
        description: 'Revisá el enlace o escaneá nuevamente el código QR.',
        variant: 'destructive',
      });
      return;
    }

    if (checkoutBlockedReason) {
      toast({
        title: 'Checkout pendiente de validación',
        description: checkoutBlockedReason,
      });
      return;
    }

    if (requiresContactOrAuth && !hasSession && !contactReady) {
      setShowContactDialog(true);
      return;
    }

    checkoutMutation.mutate({ name: resolvedName, ...(phone ? { phone } : {}) });
  };

  const submitContact = (payload: { name?: string; phone: string }) => {
    setShowContactDialog(false);
    checkoutMutation.mutate(payload);
  };

  const catalogData = catalogQuery.data;
  const rawCatalogProducts: MarketProduct[] = catalogData?.products ?? [];
  const catalogProducts = useMemo(() => rawCatalogProducts.filter((product) => product.disponible !== false), [rawCatalogProducts]);
  const catalogServerError = catalogQuery.error instanceof ApiError && catalogQuery.error.status >= 500;
  const cartServerError = cartQuery.error instanceof ApiError && cartQuery.error.status >= 500;
  const catalogErrorMessage = catalogServerError
    ? 'No pudimos cargar el catálogo desde el servidor. Intentá nuevamente en unos segundos.'
    : catalogQuery.error instanceof Error
      ? catalogQuery.error.message
      : null;
  const cartErrorMessage = cartServerError
    ? 'No pudimos cargar tu carrito desde el servidor. Intentá nuevamente en unos segundos.'
    : cartQuery.error instanceof Error
      ? cartQuery.error.message
      : null;
  const canCopy = Boolean(shareUrl && navigator?.clipboard);
  const canShareWhatsApp = Boolean(shareMessage);
  const cartCustomerProfile = cartQuery.data?.customer_profile ?? null;
  const cartCommercialState = cartQuery.data?.commercial_state ?? null;
  const cartContinuity = cartQuery.data?.continuity ?? null;
  const cartSuggestedActions = cartQuery.data?.suggested_actions ?? null;
  const cartRecommendations = cartQuery.data?.recommendations ?? null;
  const cartCheckoutPreview = cartQuery.data?.checkout_preview ?? null;
  const cartCheckoutOptions = cartQuery.data?.checkout_options ?? null;
  const cartValidation = useMemo(
    () => getMarketCommercialValidation(cartQuery.data, cartCheckoutOptions, cartCheckoutPreview, ...cartItems),
    [cartCheckoutOptions, cartCheckoutPreview, cartItems, cartQuery.data],
  );
  const checkoutBlockedReason = cartValidation.canStartCheckout ? null : cartValidation.reason;

  const {
    averageRating,
    catalogSections,
    categories,
    heroImage,
    heroSubtitle,
    paidProducts,
    redeemableProducts,
    sectionsWithItems,
  } = useMemo(() => {
    const computedCategories = [
      'todos',
      ...Array.from(
        new Set(
          catalogProducts
            .map((product) => product.category?.trim())
            .filter((value): value is string => Boolean(value)),
        ),
      ),
    ];

    const computedCatalogSections = catalogData?.sections ?? [];

    const computedPaidProducts = catalogProducts.filter((product) => !product.points);
    const computedRedeemableProducts = catalogProducts.filter(
      (product) => typeof product.points === 'number' && product.points > 0,
    );

    const ratings = catalogProducts
      .map((product) => product.rating)
      .filter((value): value is number => typeof value === 'number');
    const computedAverageRating = ratings.length
      ? Number((ratings.reduce((acc, value) => acc + value, 0) / ratings.length).toFixed(1))
      : null;

    const computedSectionsWithItems = (() => {
      const hasItems = computedCatalogSections.some((section) => section.items?.length);
      if (hasItems) return computedCatalogSections;

      return computedCatalogSections.map((section, index) => {
        if (section.items?.length) return section;
        if (index === 0 && computedPaidProducts.length)
          return { ...section, items: computedPaidProducts.slice(0, 6) };
        if (index === 1 && computedRedeemableProducts.length)
          return { ...section, items: computedRedeemableProducts.slice(0, 6) };
        return section;
      });
    })();

    return {
      averageRating: computedAverageRating,
      catalogSections: computedCatalogSections,
      categories: computedCategories,
      heroImage: catalogData?.heroImageUrl ?? null,
      heroSubtitle: catalogData?.heroSubtitle ?? null,
      paidProducts: computedPaidProducts,
      redeemableProducts: computedRedeemableProducts,
      sectionsWithItems: computedSectionsWithItems,
    };
  }, [catalogData?.heroImageUrl, catalogData?.heroSubtitle, catalogData?.sections, catalogProducts]);

  const formatPriceValue = (value?: number | null, currency = 'ARS'): string => {
    if (typeof value !== 'number' || Number.isNaN(value)) return '';
    return formatCurrency(value, currency);
  };

  const buildPriceLabel = (product: MarketProduct): string => {
    if (product.points) return `${product.points} pts`;
    return displayMarketPrice(product.priceText, product.price, product.currency ?? 'ARS') ?? 'Consultar';
  };

  const buildSectionSubtitle = (product: MarketProduct): string | null =>
    product.category ?? product.descriptionShort ?? product.description ?? null;

  const itemsCount = cartItems.reduce((acc, item) => acc + item.quantity, 0);
  const hasSession = useMemo(() => {
    const authToken = getValidStoredToken('authToken');
    const chatToken = getValidStoredToken('chatAuthToken');
    return Boolean(user && (user.token || authToken || chatToken || hasPersistedClerkSession()));
  }, [user]);

  const filteredProducts = useMemo(() => {
    const matchesSearch = (product: MarketProduct) => {
      if (!searchTerm.trim()) return true;
      const term = searchTerm.toLowerCase();
      const name = product.name?.toLowerCase() ?? '';
      const description = product.description?.toLowerCase() ?? '';
      const shortDescription = product.descriptionShort?.toLowerCase() ?? '';
      const category = product.category?.toLowerCase() ?? '';
      const tagText = (product.tags ?? []).join(' ').toLowerCase();
      return (
        name.includes(term) ||
        description.includes(term) ||
        shortDescription.includes(term) ||
        category.includes(term) ||
        tagText.includes(term)
      );
    };

    const matchesCategory = (product: MarketProduct) => {
      if (activeCategory === 'todos') return true;
      return product.category?.toLowerCase() === activeCategory.toLowerCase();
    };

    return catalogProducts.filter((product) => matchesSearch(product) && matchesCategory(product));
  }, [activeCategory, catalogProducts, searchTerm]);

  const derivedAmount = useMemo(() => {
    if (cartQuery.data?.totalAmount !== undefined && cartQuery.data?.totalAmount !== null) {
      return cartQuery.data.totalAmount;
    }
    return cartItems.reduce((acc, item) => acc + (item.price ?? 0) * item.quantity, 0);
  }, [cartItems, cartQuery.data?.totalAmount]);

  const isUpdatingCart = addMutation.isPending || removeMutation.isPending || clearMutation.isPending;

  const goToLogin = () => {
    const redirectPath = `${location.pathname}${location.search}`;
    navigate('/user/login', { state: { redirectTo: redirectPath } });
  };

  const scrollToProducts = () => {
    if (productGridRef.current) {
      productGridRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-background via-background to-muted/30 pb-24 text-foreground sm:pb-12">
      {/* The cart is only the cart: what the buyer takes, the total and one next step.
          The catalog, sharing tools and store-team context live on their own pages. */}
      <main className="mx-auto flex w-full max-w-xl flex-col gap-4 px-4 py-6 sm:px-6">
        <Link to={buildTenantPath('/market', tenantSlug)} className="inline-flex w-fit items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" aria-hidden /> Seguir comprando
        </Link>
        {confirmation ? (
          <Alert>
            <AlertTitle>Pedido registrado</AlertTitle>
            <AlertDescription className="space-y-3">
              <p>{confirmation}</p>
              {checkoutPaymentUrl ? (
                <Button asChild size="sm">
                  <a href={checkoutPaymentUrl} target="_blank" rel="noreferrer">
                    Continuar al pago
                  </a>
                </Button>
              ) : null}
            </AlertDescription>
          </Alert>
        ) : null}

      <CartSummary
        items={cartItems}
        totalAmount={cartQuery.data?.totalAmount}
        totalPoints={cartQuery.data?.totalPoints}
        onCheckout={handleCheckout}
        isSubmitting={checkoutMutation.isPending}
        onRemoveItem={(productId) => removeMutation.mutate(productId)}
        onClearCart={() => clearMutation.mutate()}
        isUpdating={isUpdatingCart}
        customerProfile={cartCustomerProfile}
        commercialState={cartCommercialState}
        continuity={cartContinuity}
        suggestedActions={cartSuggestedActions}
        recommendations={cartRecommendations}
        promotions={cartQuery.data?.promotions ?? null}
        checkoutPreview={cartCheckoutPreview}
        checkoutOptions={cartCheckoutOptions}
        checkoutBlockedReason={checkoutBlockedReason}
        rewardsProfile={rewardsQuery.data ?? null}
        rewardsLoading={rewardsQuery.isLoading}
        redeemingRewardId={redeemMutation.variables ?? null}
        onRedeemReward={(rewardId) => redeemMutation.mutate(rewardId)}
      />

      {cartServerError ? (
        <Alert variant="destructive" className="mt-3">
          <AlertTitle>No pudimos actualizar tu carrito</AlertTitle>
          <AlertDescription>
            {cartErrorMessage || 'Revisá tu conexión e intentá de nuevo.'}
          </AlertDescription>
        </Alert>
      ) : null}

      <div className="mt-3 text-xs text-muted-foreground">
        <p>
          Al confirmar, enviaremos el pedido al equipo del comercio. También podés revisar nuestras{' '}
          <Link to="/legal/privacy" className="ml-1 underline">
            políticas
          </Link>
          .
        </p>
      </div>
        {!cartItems.length && !cartQuery.isLoading ? (
          <Button asChild size="lg" variant="outline">
            <Link to={buildTenantPath('/market', tenantSlug)}>Ver productos</Link>
          </Button>
        ) : null}
      </main>

      <CheckoutDialog
        open={showContactDialog}
        defaultName={contact.name}
        defaultPhone={contact.phone}
        onClose={() => setShowContactDialog(false)}
        onSubmit={submitContact}
        isSubmitting={checkoutMutation.isPending}
      />

      <Sheet open={showMobileCart} onOpenChange={setShowMobileCart}>
        {itemsCount ? (
          <div className="fixed bottom-4 left-4 right-4 z-20 sm:hidden">
            <div className="flex items-center justify-between gap-3 rounded-full border bg-card/95 px-4 py-3 shadow-lg">
              <div>
                <p className="text-xs text-muted-foreground">{itemsCount} ítem(s)</p>
                <p className="text-base font-semibold">{formatCurrency(derivedAmount, 'ARS')}</p>
              </div>
              <SheetTrigger asChild>
                <Button size="sm" className="rounded-full">
                  Ver carrito
                </Button>
              </SheetTrigger>
            </div>
          </div>
        ) : null}

        <SheetContent side="bottom" className="sm:hidden">
          <SheetHeader>
            <SheetTitle>Tu carrito</SheetTitle>
          </SheetHeader>

          <div className="mt-4 space-y-3 overflow-y-auto">
            {cartItems.length ? (
              cartItems.map((item) => (
                <div key={item.id} className="flex items-start justify-between rounded-lg border p-3">
                  <div className="space-y-1">
                    <p className="font-medium leading-snug">{item.name}</p>
                    <p className="text-xs text-muted-foreground">Cantidad: {item.quantity}</p>
                    {item.modality ? (
                      <span className="text-[11px] uppercase text-muted-foreground">{item.modality}</span>
                    ) : null}
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 text-xs"
                      onClick={() => removeMutation.mutate(item.id)}
                      disabled={isUpdatingCart}
                    >
                      Quitar
                    </Button>
                  </div>
                  <div className="text-right text-sm font-semibold">
                    {item.price
                      ? formatCurrency(item.price * item.quantity, item.currency ?? 'ARS')
                      : item.points
                        ? `${item.points * item.quantity} pts`
                        : '—'}
                  </div>
                </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">Tu carrito está vacío.</p>
            )}
          </div>

          <div className="mt-4 flex items-center justify-between rounded-lg bg-muted/50 px-4 py-3 text-sm">
            <span className="text-muted-foreground">Total estimado</span>
            <span className="text-base font-semibold">{formatCurrency(derivedAmount, 'ARS')}</span>
          </div>

          <Button
            variant="outline"
            className="mt-3 w-full"
            size="sm"
            onClick={() => clearMutation.mutate()}
            disabled={!cartItems.length || isUpdatingCart}
          >
            Vaciar carrito
          </Button>

          <Button
            className="mt-4 w-full"
            size="lg"
            onClick={() => {
              setShowMobileCart(false);
              handleCheckout();
            }}
            disabled={!cartItems.length || checkoutMutation.isPending || Boolean(checkoutBlockedReason)}
          >
            {checkoutMutation.isPending ? 'Procesando...' : 'Finalizar pedido'}
          </Button>
        </SheetContent>
      </Sheet>

      <AlertDialog open={showAuthDialog} onOpenChange={setShowAuthDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Necesitás iniciar sesión</AlertDialogTitle>
            <AlertDialogDescription>
              Ingresá con tu número de teléfono para continuar con el pedido y volveremos a traerte acá.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction onClick={goToLogin}>Ir a iniciar sesión</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={showQrModal} onOpenChange={setShowQrModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Código QR del catálogo</DialogTitle>
            <DialogDescription>Escanealo o compartilo para abrir este catálogo en cualquier dispositivo.</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col items-center gap-4 py-2">
            {qrImageUrl && !qrError ? (
              <img
                src={qrImageUrl}
                alt="QR del catálogo"
                className="w-64 max-w-full rounded-xl border bg-white p-4 shadow-sm"
                onError={() => setQrError('No pudimos generar el código QR automáticamente.')}
              />
            ) : (
              <div className="flex h-52 w-full items-center justify-center rounded-lg border border-dashed text-sm text-muted-foreground">
                {qrError || 'No pudimos cargar el código QR.'}
              </div>
            )}
            {shareUrl ? (
              <div className="w-full rounded-md border bg-muted/40 p-3 text-center text-sm">
                <p className="font-medium text-foreground">Enlace directo</p>
                <p className="mt-1 break-all text-muted-foreground">{shareUrl}</p>
              </div>
            ) : null}
          </div>
          <DialogFooter className="gap-2">
            <DialogClose asChild>
              <Button variant="secondary" className="w-full sm:w-auto">
                Cerrar
              </Button>
            </DialogClose>
            <Button className="w-full sm:w-auto" onClick={handleCopyLink} disabled={!canCopy}>
              <Share2 className="mr-2 h-4 w-4" /> Copiar enlace
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
