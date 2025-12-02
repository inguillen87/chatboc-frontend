import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ShoppingBag, Share2, Loader2, ExternalLink, Copy, QrCode, MessageCircle } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import ProductCard from '@/components/market/ProductCard';
import CartSummary from '@/components/market/CartSummary';
import CheckoutDialog from '@/components/market/CheckoutDialog';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import {
  CartSummarySkeleton,
  MarketCatalogSkeleton,
  MarketHeaderSkeleton,
} from '@/components/market/MarketSkeletons';
import { addMarketItem, fetchMarketCart, fetchMarketCatalog, startMarketCheckout } from '@/api/market';
import { MarketCartItem, MarketCatalogResponse, MarketCartResponse, MarketProduct } from '@/types/market';
import { loadMarketContact, saveMarketContact } from '@/utils/marketStorage';
import { toast } from '@/components/ui/use-toast';
import { Badge } from '@/components/ui/badge';
import { useUser } from '@/hooks/useUser';
import { cn } from '@/lib/utils';
import { safeLocalStorage } from '@/utils/safeLocalStorage';

type ContactInfo = {
  name?: string;
  phone?: string;
};

export default function MarketCartPage() {
  const { tenantSlug = '' } = useParams<{ tenantSlug: string }>();
  const queryClient = useQueryClient();
  const { user } = useUser();
  const navigate = useNavigate();
  const cartSummaryRef = useRef<HTMLDivElement | null>(null);

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
  const [qrError, setQrError] = useState<string | null>(null);
  const [contact, setContact] = useState<ContactInfo>(() => {
    const stored = loadMarketContact(tenantSlug);
    return {
      name: stored.name ?? userName,
      phone: stored.phone ?? normalizedUserPhone,
    };
  });
  const [showLoginPrompt, setShowLoginPrompt] = useState(false);
  const [showQrModal, setShowQrModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    const stored = loadMarketContact(tenantSlug);
    setContact((prev) => ({
      name: stored.name ?? prev.name ?? userName,
      phone: stored.phone ?? prev.phone ?? normalizedUserPhone,
    }));
    setConfirmation(null);
  }, [tenantSlug, userName, normalizedUserPhone]);

  const shareUrl = useMemo(() => {
    if (typeof window === 'undefined' || !tenantSlug) return '';
    const url = new URL(window.location.href);
    url.pathname = `/market/${tenantSlug}/cart`;
    url.search = '';
    return url.toString();
  }, [tenantSlug]);

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
    refetchInterval: 15000,
  });

  const shareTitle = useMemo(
    () => catalogQuery.data?.tenantName ?? 'Catálogo',
    [catalogQuery.data?.tenantName],
  );

  const qrShareUrl = useMemo(() => {
    if (!shareUrl) return '';
    return `https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(shareUrl)}`;
  }, [shareUrl]);

  const addMutation = useMutation({
    mutationFn: (productId: string) => addMarketItem(tenantSlug, { productId, quantity: 1 }),
    onMutate: async (productId: string) => {
      await queryClient.cancelQueries({ queryKey: ['marketCart', tenantSlug] });
      const previousCart = queryClient.getQueryData<MarketCartResponse>(['marketCart', tenantSlug]);
      const catalog = queryClient.getQueryData<MarketCatalogResponse>(['marketCatalog', tenantSlug]);
      const product = catalog?.products.find((item) => item.id === productId);

      queryClient.setQueryData<MarketCartResponse | undefined>(['marketCart', tenantSlug], (current) => {
        const items = current?.items ? [...current.items] : [];
        const existingIndex = items.findIndex((item) => item.id === productId);
        if (existingIndex >= 0) {
          items[existingIndex] = { ...items[existingIndex], quantity: items[existingIndex].quantity + 1 };
        } else if (product) {
          items.push({
            id: product.id,
            name: product.name,
            quantity: 1,
            price: product.price,
            points: product.points,
            imageUrl: product.imageUrl,
          });
        }

        const totalAmount =
          (current?.totalAmount ?? 0) +
          (product?.price ??
            (existingIndex >= 0 ? items[existingIndex]?.price ?? 0 : 0));
        const totalPoints =
          (current?.totalPoints ?? 0) +
          (product?.points ?? (existingIndex >= 0 ? items[existingIndex]?.points ?? 0 : 0));

        return {
          ...(current ?? {}),
          items,
          totalAmount,
          totalPoints,
        };
      });
      setCartPulse(true);
      return { previousCart };
    },
    onSuccess: (data) => {
      queryClient.setQueryData(['marketCart', tenantSlug], data);
      toast({
        title: 'Agregado al carrito',
        description: 'Actualizamos tu carrito.',
      });
    },
    onError: (_error, _variables, context) => {
      if (context?.previousCart) {
        queryClient.setQueryData(['marketCart', tenantSlug], context.previousCart);
      }
      toast({
        title: 'No se pudo agregar el producto',
        description: 'Intentá nuevamente en unos segundos.',
        variant: 'destructive',
      });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['marketCart', tenantSlug] });
    },
  });

  const checkoutMutation = useMutation({
    mutationFn: (payload: { name?: string; phone: string }) => startMarketCheckout(tenantSlug, payload),
    onSuccess: (response, variables) => {
      saveMarketContact(tenantSlug, variables);
      setContact(variables);
      setConfirmation(response?.message ?? 'Pedido registrado. Te contactaremos a la brevedad.');
      queryClient.setQueryData<MarketCartResponse>(['marketCart', tenantSlug], {
        items: [],
        totalAmount: 0,
        totalPoints: 0,
        availableAmount: null,
        availablePoints: null,
      });
      queryClient.invalidateQueries({ queryKey: ['marketCart', tenantSlug] });
    },
    onError: () => {
      toast({
        title: 'No pudimos iniciar el checkout',
        description: 'Revisa tu conexión o vuelve a intentarlo.',
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
    if (!cartQuery.data?.items.length) {
      toast({
        title: 'Tu carrito está vacío',
        description: 'Agrega productos para continuar.',
      });
      return;
    }

    if (!tenantSlug) {
      toast({
        title: 'No encontramos el catálogo',
        description: 'Revisa el enlace o escanea nuevamente el código QR.',
        variant: 'destructive',
      });
      return;
    }

    const sessionToken =
      safeLocalStorage.getItem('authToken') || safeLocalStorage.getItem('chatAuthToken');

    if (!sessionToken && !user) {
      setShowLoginPrompt(true);
      return;
    }

    if (phone) {
      checkoutMutation.mutate({ name: resolvedName, phone });
      return;
    }

    setShowContactDialog(true);
  };

  const submitContact = (payload: { name?: string; phone: string }) => {
    setShowContactDialog(false);
    checkoutMutation.mutate(payload);
  };

  const fallbackCatalog = useMemo(() => buildDemoMarketCatalog(tenantSlug).catalog, [tenantSlug]);
  const catalogData = catalogQuery.data ?? (catalogQuery.isError ? fallbackCatalog : undefined);
  const catalogProducts: MarketProduct[] = catalogData?.products ?? [];
  const cartItems: MarketCartItem[] = cartQuery.data?.items ?? [];
  const catalogErrorMessage = catalogQuery.error instanceof Error ? catalogQuery.error.message : null;
  const cartErrorMessage = cartQuery.error instanceof Error ? cartQuery.error.message : null;
  const isDemoCatalog = Boolean(catalogData?.isDemo || (!catalogQuery.data && catalogQuery.isError));
  const canCopy = Boolean(shareUrl && navigator?.clipboard);
  const canShareWhatsApp = Boolean(shareMessage);

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

    const computedCatalogSections = catalogData?.sections?.length ? catalogData.sections : MARKET_DEMO_SECTIONS;

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
      heroImage:
        catalogData?.heroImageUrl ??
        'https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=1200&q=80',
      heroSubtitle:
        catalogData?.heroSubtitle ??
        'Demostración pública del catálogo multi-tenant con fotos, canjes, carrito y buscador listo para compartir.',
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
    return product.priceText ?? formatPriceValue(product.price, product.currency ?? 'ARS') ?? 'Consultar';
  };

  const buildSectionSubtitle = (product: MarketProduct): string | null =>
    product.category ?? product.descriptionShort ?? product.description ?? null;

  const itemsCount = cartItems.reduce((acc, item) => acc + item.quantity, 0);
  const hasSession = useMemo(() => {
    const authToken = getValidStoredToken('authToken');
    const chatToken = getValidStoredToken('chatAuthToken');
    return Boolean(user?.token || authToken || chatToken);
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

  const filteredProducts = useMemo(() => {
    if (!searchTerm.trim()) return catalogProducts;
    const query = searchTerm.toLowerCase();
    return catalogProducts.filter(
      (product) =>
        product.name.toLowerCase().includes(query) ||
        (product.description ? product.description.toLowerCase().includes(query) : false),
    );
  }, [catalogProducts, searchTerm]);

  const scrollToSummary = () => {
    cartSummaryRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    setCartPulse(true);
  };

  useEffect(() => {
    if (!itemsCount) return;
    const timeout = setTimeout(() => setCartPulse(false), 350);
    return () => clearTimeout(timeout);
  }, [itemsCount]);

  const HeaderContent = (
    <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
      <div className="flex items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-xl bg-primary/10 text-primary">
          {catalogQuery.data?.tenantLogoUrl ? (
            <img
              src={catalogQuery.data.tenantLogoUrl}
              alt={catalogQuery.data?.tenantName ?? tenantSlug}
              className="h-full w-full object-cover"
            />
          ) : (
            <ShoppingBag className="h-6 w-6" />
          )}
        </div>
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Catálogo</p>
          <h1 className="text-lg font-semibold leading-tight sm:text-xl">
            {catalogQuery.data?.tenantName ?? tenantSlug}
          </h1>
          {catalogQuery.data?.tenantName ? (
            <p className="text-xs text-muted-foreground">Ruta única: /market/{tenantSlug}/cart</p>
          ) : null}
        </div>
      </div>

      <div className="flex items-center gap-2">
        <div className="hidden md:flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleShare}
            disabled={!canShare}
            className="transition hover:scale-[1.01]"
          >
            <Share2 className="mr-2 h-4 w-4" />
            Compartir
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={async () => {
              if (!shareUrl) return;
              await navigator.clipboard.writeText(shareUrl);
              toast({ title: 'Enlace copiado', description: 'Listo para compartir.' });
            }}
            disabled={!shareUrl}
          >
            <Copy className="mr-2 h-4 w-4" />
            Copiar enlace
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              window.open(
                `https://wa.me/?text=${encodeURIComponent(
                  `Mirá el catálogo: ${shareUrl}`,
                )}`,
                '_blank',
              )
            }
            disabled={!shareUrl}
          >
            <MessageCircle className="mr-2 h-4 w-4" />
            Compartir por WhatsApp
          </Button>
          <Dialog open={showQrModal} onOpenChange={setShowQrModal}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm">
                <QrCode className="mr-2 h-4 w-4" />
                Ver QR
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-sm">
              <DialogHeader>
                <DialogTitle>Escaneá para abrir el catálogo</DialogTitle>
                <DialogDescription>Comparte esta tienda con un enlace único.</DialogDescription>
              </DialogHeader>
              <div className="flex flex-col items-center gap-3">
                {qrShareUrl ? (
                  <div className="rounded-xl bg-white p-4 shadow-inner">
                    <img src={qrShareUrl} alt="QR del catálogo" className="h-56 w-56" />
                  </div>
                ) : null}
                <Button
                  variant="secondary"
                  className="w-full"
                  onClick={async () => {
                    if (!shareUrl) return;
                    await navigator.clipboard.writeText(shareUrl);
                    toast({
                      title: 'Enlace del catálogo copiado',
                      description: 'Compartilo por el canal que prefieras.',
                    });
                  }}
                  disabled={!shareUrl}
                >
                  <Copy className="mr-2 h-4 w-4" /> Copiar enlace
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
        <motion.div
          animate={{ scale: cartPulse ? 1.08 : 1 }}
          transition={{ type: 'spring', stiffness: 320, damping: 18 }}
          className="overflow-hidden rounded-full"
        >
          <Badge
            variant="secondary"
            className="flex items-center gap-1 px-3 py-1 text-sm shadow-sm"
          >
            <ShoppingBag className="h-4 w-4" />
            <AnimatePresence mode="popLayout" initial={false}>
              <motion.span
                key={itemsCount}
                initial={{ y: 8, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: -8, opacity: 0 }}
                transition={{ duration: 0.18 }}
              >
                {itemsCount}
              </motion.span>
            </AnimatePresence>
          </Badge>
        </motion.div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white pb-24 sm:pb-12">
      <header className="sticky top-0 z-10 border-b bg-white/80 backdrop-blur">
        <div className="mx-auto flex max-w-5xl flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4 sm:px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-xl bg-primary/10 text-primary">
              {catalogQuery.data?.tenantLogoUrl ? (
                <img
                  src={catalogQuery.data.tenantLogoUrl}
                  alt={catalogQuery.data?.tenantName ?? tenantSlug}
                  className="h-full w-full object-cover"
                />
              ) : (
                <ShoppingBag className="h-6 w-6" />
              )}
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Catálogo</p>
              <h1 className="text-lg font-semibold leading-tight sm:text-xl">
                {catalogQuery.data?.tenantName ?? tenantSlug}
              </h1>
            </div>
          </div>

          <div className="flex flex-1 items-center gap-2 sm:max-w-md">
            <div className="relative w-full">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Buscar productos"
                className="pl-9"
              />
            </div>
            <div className="hidden items-center gap-2 sm:flex">
              <Button variant="outline" size="sm" onClick={handleCopyLink} disabled={!canCopy}>
                <Copy className="mr-2 h-4 w-4" />
                Copiar enlace
              </Button>
              <Button variant="outline" size="sm" onClick={handleShareWhatsApp} disabled={!canShareWhatsApp}>
                <MessageCircle className="mr-2 h-4 w-4" />
                WhatsApp
              </Button>
              <Button variant="outline" size="sm" onClick={handleOpenQr} disabled={!shareUrl}>
                <QrCode className="mr-2 h-4 w-4" />
                Ver QR
              </Button>
              <Badge variant="secondary" className="flex items-center gap-1 px-3 py-1 text-sm">
                <AnimatePresence mode="popLayout" initial={false}>
                  <motion.span
                    key={itemsCount}
                    className="flex items-center gap-1"
                    initial={{ scale: 0.8, opacity: 0, y: -4 }}
                    animate={{ scale: 1, opacity: 1, y: 0 }}
                    exit={{ scale: 0.9, opacity: 0, y: 4 }}
                    transition={{ type: 'spring', stiffness: 240, damping: 18 }}
                  >
                    <ShoppingBag className="h-4 w-4" />
                    {itemsCount}
                  </motion.span>
                </AnimatePresence>
              </Badge>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:hidden">
            <Button variant="outline" size="sm" className="w-full" onClick={handleCopyLink} disabled={!canCopy}>
              <Copy className="mr-2 h-4 w-4" />
              Copiar
            </Button>
            <Button variant="outline" size="sm" className="w-full" onClick={handleShareWhatsApp} disabled={!canShareWhatsApp}>
              <MessageCircle className="mr-2 h-4 w-4" />
              WhatsApp
            </Button>
            <Button variant="outline" size="sm" className="w-full" onClick={handleOpenQr} disabled={!shareUrl}>
              <QrCode className="mr-2 h-4 w-4" />
              QR
            </Button>
            <Badge variant="secondary" className="flex items-center gap-1 px-3 py-2 text-sm">
              <AnimatePresence mode="popLayout" initial={false}>
                <motion.span
                  key={itemsCount}
                  className="flex items-center gap-1"
                  initial={{ scale: 0.9, opacity: 0, y: -2 }}
                  animate={{ scale: 1, opacity: 1, y: 0 }}
                  exit={{ scale: 0.95, opacity: 0, y: 2 }}
                  transition={{ type: 'spring', stiffness: 240, damping: 18 }}
                >
                  <ShoppingBag className="h-4 w-4" />
                  {itemsCount}
                </motion.span>
              </AnimatePresence>
            </Badge>
          </div>
        </div>
      </header>

      <main className="mx-auto flex max-w-5xl flex-col gap-6 px-4 py-6 sm:px-6">
        {confirmation ? (
          <Alert>
            <AlertTitle>Pedido registrado</AlertTitle>
            <AlertDescription>{confirmation}</AlertDescription>
          </Alert>
        ) : null}

        <section className="overflow-hidden rounded-2xl border bg-white shadow-sm">
          <div className="grid gap-0 md:grid-cols-[1.1fr_0.9fr]">
            <div className="space-y-4 p-6 md:p-8">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="secondary">Catálogo público</Badge>
                {isDemoCatalog ? <Badge variant="outline">Modo demo</Badge> : null}
                {catalogQuery.data?.tenantName ? (
                  <Badge variant="outline" className="flex items-center gap-1">
                    <Sparkles className="h-3.5 w-3.5" /> {catalogQuery.data.tenantName}
                  </Badge>
                ) : null}
              </div>
              <div className="space-y-2">
                <h2 className="text-2xl font-semibold leading-tight sm:text-3xl">
                  Marketplace listo para compartir
                </h2>
                <p className="max-w-2xl text-base text-muted-foreground">{heroSubtitle}</p>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
                <div className="rounded-xl border bg-muted/40 p-4">
                  <p className="text-xs uppercase text-muted-foreground">Catálogo</p>
                  <p className="text-xl font-semibold">{catalogProducts.length || 0} ítems</p>
                  <p className="text-xs text-muted-foreground">Fotos, descripciones y filtros por categoría.</p>
                </div>
                <div className="rounded-xl border bg-muted/40 p-4">
                  <p className="text-xs uppercase text-muted-foreground">Canjes</p>
                  <p className="text-xl font-semibold">{catalogProducts.filter((p) => p.points).length} opciones</p>
                  <p className="text-xs text-muted-foreground">Puntos y beneficios en un mismo flujo.</p>
                </div>
                <div className="rounded-xl border bg-muted/40 p-4">
                  <p className="text-xs uppercase text-muted-foreground">Carrito</p>
                  <p className="text-xl font-semibold">/market/{tenantSlug || 'demo'}/cart</p>
                  <p className="text-xs text-muted-foreground">URL lista para QR y WhatsApp.</p>
                </div>
                <div className="rounded-xl border bg-muted/40 p-4">
                  <p className="text-xs uppercase text-muted-foreground">Experiencia</p>
                  <p className="text-xl font-semibold">
                    {averageRating ? `${averageRating} ★` : 'Listo'}
                  </p>
                  <p className="text-xs text-muted-foreground">Animaciones suaves y fichas con puntaje.</p>
                </div>
              </div>

              <div className="flex flex-wrap gap-3">
                <Button size="lg" className="gap-2" onClick={scrollToProducts}>
                  <Sparkles className="h-4 w-4" /> Explorar catálogo
                </Button>
                <Button
                  variant="outline"
                  size="lg"
                  className="gap-2"
                  onClick={() => setShowMobileCart(true)}
                  disabled={!cartItems.length}
                >
                  Seguir comprando
                </Button>
              </div>
            </div>
            <div className="relative hidden min-h-[260px] overflow-hidden bg-muted/50 md:block">
              <div className="absolute inset-0 bg-gradient-to-br from-primary/10 to-transparent" />
              <img
                src={heroImage}
                alt="Portada del catálogo"
                className="h-full w-full object-cover"
                loading="lazy"
              />
            </div>
          </div>
        </section>

        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {sectionsWithItems.map((section) => (
            <div key={section.title} className="rounded-2xl border bg-white/80 p-4 shadow-sm">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase text-muted-foreground">
                <Tag className="h-4 w-4" />
                {section.badge ?? 'Sección'}
              </div>
              <h3 className="mt-2 text-lg font-semibold leading-snug">{section.title}</h3>
              {section.description ? (
                <p className="mt-1 text-sm text-muted-foreground">{section.description}</p>
              ) : null}

              {section.items?.length ? (
                <div className="mt-3 grid grid-cols-2 gap-3">
                  {section.items.slice(0, 4).map((item) => (
                    <div
                      key={item.id}
                      className="group overflow-hidden rounded-xl border bg-muted/30 p-2 transition hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md"
                    >
                      <div className="relative aspect-[4/3] w-full overflow-hidden rounded-lg bg-white">
                        {item.imageUrl ? (
                          <img
                            src={item.imageUrl}
                            alt={item.name}
                            className="h-full w-full object-cover"
                            loading="lazy"
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-muted-foreground">
                            <ShoppingBag className="h-5 w-5" />
                          </div>
                        )}
                        {item.modality ? (
                          <Badge className="absolute left-2 top-2 bg-white/90 text-xs font-semibold text-foreground" variant="secondary">
                            {item.modality}
                          </Badge>
                        ) : null}
                      </div>
                      <p className="mt-2 line-clamp-1 text-sm font-semibold leading-tight">{item.name}</p>
                      {buildSectionSubtitle(item) ? (
                        <p className="line-clamp-2 text-xs text-muted-foreground">{buildSectionSubtitle(item)}</p>
                      ) : null}
                      <div className="mt-1 flex items-center gap-2 text-xs font-semibold text-primary">
                        {buildPriceLabel(item) || 'Consultar'}
                      </div>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          ))}
        </section>

        <section className="grid gap-6 lg:grid-cols-[2fr_1fr]">
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="space-y-1">
                <h2 className="text-xl font-semibold">Productos</h2>
                <p className="text-sm text-muted-foreground">
                  Catálogo público de este tenant. Agrega ítems y confirma en un paso.
                </p>
              </div>
              <div className="flex flex-1 flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
                <Input
                  placeholder="Buscar productos"
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                  className="w-full min-w-[200px] sm:max-w-xs"
                />
                {catalogQuery.isFetching ? (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" /> Sincronizando catálogo...
                  </div>
                ) : null}
              </div>
            </div>

            {isDemoCatalog ? (
              <Alert>
                <AlertTitle>Catálogo de demostración</AlertTitle>
                <AlertDescription>
                  {catalogData?.demoReason || 'Mostramos un catálogo listo para probar mientras se conecta el catálogo en vivo.'}
                </AlertDescription>
              </Alert>
            ) : null}

            {!isDemoCatalog && catalogErrorMessage ? (
              <Alert variant="destructive">
                <AlertTitle>{catalogQuery.data?.isDemo ? 'Catálogo de demostración' : 'No pudimos cargar el catálogo'}</AlertTitle>
                <AlertDescription>
                  {catalogQuery.data?.demoReason ??
                    (catalogErrorMessage ||
                      'Intenta nuevamente desde el enlace o QR.')}
                </AlertDescription>
              </Alert>
            ) : null}

            {isLoadingCatalog ? (
              <MarketCatalogSkeleton cards={4} />
            ) : filteredProducts.length ? (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {filteredProducts.map((product) => (
                  <ProductCard
                    key={product.id}
                    product={product}
                    onAdd={(productId) => addMutation.mutate(productId)}
                    isAdding={addMutation.isPending}
                  />
                ))}
              </div>
            ) : (
              <div className="rounded-lg border bg-white p-6 text-center text-sm text-muted-foreground">
                {catalogQuery.isLoading
                  ? 'Cargando productos...'
                  : searchTerm
                    ? 'No encontramos productos que coincidan con tu búsqueda.'
                    : 'No hay productos disponibles en este catálogo.'}
              </div>
            )}
          </div>

          <div className="lg:sticky lg:top-24">
            <CartSummary
              items={cartItems}
              totalAmount={cartQuery.data?.totalAmount}
              totalPoints={cartQuery.data?.totalPoints}
              onCheckout={handleCheckout}
              isSubmitting={checkoutMutation.isPending}
              onRemoveItem={(productId) => removeMutation.mutate(productId)}
              onClearCart={() => clearMutation.mutate()}
              isUpdating={isUpdatingCart}
            />

            {cartErrorMessage ? (
              <Alert variant="destructive" className="mt-3">
                <AlertTitle>No pudimos actualizar tu carrito</AlertTitle>
                <AlertDescription>
                  {cartErrorMessage || 'Revisa tu conexión e intenta de nuevo.'}
                </AlertDescription>
              </Alert>
            ) : null}

            {(catalogQuery.data?.isDemo || cartQuery.data?.isDemo) && !cartErrorMessage ? (
              <Alert className="mt-3" variant="default">
                <AlertTitle>Modo demo activado</AlertTitle>
                <AlertDescription>
                  Usamos un catálogo de demostración mientras conectamos el backend de este tenant. Puedes compartir el enlace o
                  finalizar un pedido de prueba para mostrar el flujo completo.
                </AlertDescription>
              </Alert>
            ) : null}

            <div className="mt-3 text-xs text-muted-foreground">
              <p>
                Al confirmar, enviaremos el pedido al equipo del comercio. También puedes revisar nuestras
                <Link to="/legal/privacy" className="ml-1 underline">
                  políticas
                </Link>
                .
              </p>
            </div>
          </div>
        </section>
      </main>

      <CheckoutDialog
        open={showContactDialog}
        defaultName={contact.name}
        defaultPhone={contact.phone}
        onClose={() => setShowContactDialog(false)}
        onSubmit={submitContact}
        isSubmitting={checkoutMutation.isPending}
      />

      <Dialog open={showLoginPrompt} onOpenChange={setShowLoginPrompt}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Inicia sesión para finalizar</DialogTitle>
            <DialogDescription>
              Necesitamos que confirmes tu identidad con tu teléfono para completar el pedido.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-3">
            <Button
              className="w-full"
              onClick={() => {
                const redirect = encodeURIComponent(window.location.pathname + window.location.search);
                navigate(`/login?redirect=${redirect}`);
              }}
            >
              Ir a iniciar sesión
            </Button>
            <Button variant="secondary" className="w-full" onClick={() => setShowLoginPrompt(false)}>
              Seguir viendo el catálogo
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
