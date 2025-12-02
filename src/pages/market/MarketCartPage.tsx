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

// Flujo público: el cliente llega vía enlace/QR con el slug del tenant, ve el catálogo,
// agrega ítems al carrito y confirma el pedido dejando su nombre/teléfono.
// Los datos mínimos (contacto) se guardan de forma local para reusar en futuros pedidos.
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
  const [confirmation, setConfirmation] = useState<string | null>(null);
  const [cartPulse, setCartPulse] = useState(false);
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

  const handleShare = async () => {
    if (!shareUrl) return;
    const fallbackCopy = async () => {
      await navigator.clipboard.writeText(shareUrl);
      toast({
        title: 'Catálogo listo para compartir',
        description: 'Copiamos el enlace en tu portapapeles.',
      });
    };

    try {
      if (navigator.share) {
        await navigator.share({ url: shareUrl, title: shareTitle });
        toast({
          title: 'Enlace compartido',
          description: 'El catálogo quedó listo para enviar.',
        });
        return;
      }

      if (navigator.clipboard) {
        await fallbackCopy();
        return;
      }

      toast({
        title: 'No pudimos compartir automáticamente',
        description: shareUrl,
        variant: 'destructive',
      });
    } catch (error) {
      console.error('Share/clipboard error', error);
      toast({
        title: 'No se pudo compartir el catálogo',
        description: 'Intenta copiar el enlace manualmente.',
        variant: 'destructive',
      });
    }
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

  const catalogProducts: MarketProduct[] = catalogQuery.data?.products ?? [];
  const cartItems: MarketCartItem[] = cartQuery.data?.items ?? [];
  const catalogErrorMessage = catalogQuery.error instanceof Error ? catalogQuery.error.message : null;
  const cartErrorMessage = cartQuery.error instanceof Error ? cartQuery.error.message : null;
  const isLoadingCatalog = catalogQuery.isLoading && !catalogProducts.length;
  const isLoadingCart = cartQuery.isLoading && !cartItems.length;
  const canShare = Boolean(shareUrl && (navigator?.clipboard || navigator?.share));

  const itemsCount = cartItems.reduce((acc, item) => acc + item.quantity, 0);

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
    <div className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-slate-50">
      <header className="sticky top-0 z-10 border-b bg-white/80 backdrop-blur">
        {isLoadingCatalog ? <MarketHeaderSkeleton /> : HeaderContent}
      </header>

      <main className="mx-auto flex max-w-5xl flex-col gap-6 px-4 py-6 sm:px-6">
        {confirmation ? (
          <Alert>
            <AlertTitle>Pedido registrado</AlertTitle>
            <AlertDescription>{confirmation}</AlertDescription>
          </Alert>
        ) : null}

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

            {catalogErrorMessage ? (
              <Alert variant="destructive">
                <AlertTitle>No pudimos cargar el catálogo</AlertTitle>
                <AlertDescription className="flex items-start justify-between gap-3">
                  <span>{catalogErrorMessage || 'Intenta nuevamente desde el enlace o QR.'}</span>
                  <Button size="sm" variant="secondary" onClick={() => catalogQuery.refetch()}>
                    Reintentar
                  </Button>
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
                No hay productos disponibles en este catálogo.
              </div>
            )}
          </div>

          <div className="lg:sticky lg:top-24" ref={cartSummaryRef}>
            {isLoadingCart ? (
              <CartSummarySkeleton />
            ) : (
              <CartSummary
                items={cartItems}
                totalAmount={cartQuery.data?.totalAmount}
                totalPoints={cartQuery.data?.totalPoints}
                availableAmount={cartQuery.data?.availableAmount}
                availablePoints={cartQuery.data?.availablePoints}
                onCheckout={handleCheckout}
                isSubmitting={checkoutMutation.isPending}
              />
            )}

            {cartErrorMessage ? (
              <Alert variant="destructive" className="mt-3">
                <AlertTitle>No pudimos actualizar tu carrito</AlertTitle>
                <AlertDescription className="flex items-start justify-between gap-3">
                  <span>{cartErrorMessage || 'Revisa tu conexión e intenta de nuevo.'}</span>
                  <Button size="sm" variant="secondary" onClick={() => cartQuery.refetch()}>
                    Reintentar
                  </Button>
                </AlertDescription>
              </Alert>
            ) : null}

            <div className="mt-3 space-y-2 rounded-md bg-muted/40 p-3 text-xs text-muted-foreground">
              <div className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-emerald-500" />
                <span>Checkout simplificado: datos mínimos (nombre + teléfono) por tenant.</span>
              </div>
              {contact.phone ? (
                <div className="flex items-center gap-2 text-foreground">
                  <ExternalLink className="h-3.5 w-3.5" />
                  <span>Guardamos tu contacto para agilizar próximos pedidos en este catálogo.</span>
                </div>
              ) : null}
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

        <div className={cn('fixed inset-x-0 bottom-4 z-20 px-4 sm:px-6 lg:hidden', !itemsCount && 'hidden')}>
          <motion.div
            initial={{ y: 40, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            className="mx-auto flex max-w-md items-center gap-3 rounded-full border bg-white px-4 py-3 shadow-lg"
          >
            <div className="flex flex-1 items-center gap-3">
              <ShoppingBag className="h-5 w-5 text-primary" />
              <div className="leading-tight">
                <p className="text-xs text-muted-foreground">Carrito de este catálogo</p>
                <p className="text-sm font-semibold">{itemsCount} ítem(s)</p>
              </div>
            </div>
            <Button size="sm" onClick={scrollToSummary}>
              Ver resumen
            </Button>
          </motion.div>
        </div>
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
