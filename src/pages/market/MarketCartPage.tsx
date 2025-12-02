import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import { ShoppingBag, Share2, Loader2, ExternalLink } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import ProductCard from '@/components/market/ProductCard';
import CartSummary from '@/components/market/CartSummary';
import CheckoutDialog from '@/components/market/CheckoutDialog';
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
import { cn } from '@/utils/cn';

type ContactInfo = {
  name?: string;
  phone?: string;
};

// Flujo público: el cliente llega vía enlace/QR con el slug del tenant, ve el catálogo,
// agrega ítems al carrito y confirma el pedido dejando su nombre/teléfono.
// Los datos mínimos (contacto) se guardan de forma local para reusar en futuros pedidos.
export default function MarketCartPage() {
  const { slug = '' } = useParams<{ slug: string }>();
  const queryClient = useQueryClient();
  const { user } = useUser();
  const cartSummaryRef = useRef<HTMLDivElement | null>(null);

  const userName = user?.name ?? user?.nombre ?? user?.full_name;
  const userPhone = user?.phone ?? user?.telefono ?? user?.telefono_movil ?? user?.celular;
  const normalizedUserPhone =
    typeof userPhone === 'string' ? userPhone.trim() : userPhone ? String(userPhone).trim() : undefined;

  const [showContactDialog, setShowContactDialog] = useState(false);
  const [confirmation, setConfirmation] = useState<string | null>(null);
  const [cartPulse, setCartPulse] = useState(false);
  const [contact, setContact] = useState<ContactInfo>(() => {
    const stored = loadMarketContact(slug);
    return {
      name: stored.name ?? userName,
      phone: stored.phone ?? normalizedUserPhone,
    };
  });

  useEffect(() => {
    const stored = loadMarketContact(slug);
    setContact((prev) => ({
      name: stored.name ?? prev.name ?? userName,
      phone: stored.phone ?? prev.phone ?? normalizedUserPhone,
    }));
    setConfirmation(null);
  }, [slug, userName, normalizedUserPhone]);

  const shareUrl = useMemo(() => {
    if (typeof window === 'undefined' || !slug) return '';
    const url = new URL(window.location.href);
    url.pathname = `/market/${slug}/cart`;
    url.search = '';
    return url.toString();
  }, [slug]);

  const shareTitle = catalogQuery.data?.tenantName ?? 'Catálogo';

  const catalogQuery = useQuery({
    queryKey: ['marketCatalog', slug],
    queryFn: () => fetchMarketCatalog(slug),
    enabled: Boolean(slug),
    staleTime: 1000 * 60, // cache short catalog loads while browsing
  });

  const cartQuery = useQuery({
    queryKey: ['marketCart', slug],
    queryFn: () => fetchMarketCart(slug),
    enabled: Boolean(slug),
    refetchInterval: 15000,
  });

  const addMutation = useMutation({
    mutationFn: (productId: string) => addMarketItem(slug, { productId, quantity: 1 }),
    onMutate: async (productId: string) => {
      await queryClient.cancelQueries({ queryKey: ['marketCart', slug] });
      const previousCart = queryClient.getQueryData<MarketCartResponse>(['marketCart', slug]);
      const catalog = queryClient.getQueryData<MarketCatalogResponse>(['marketCatalog', slug]);
      const product = catalog?.products.find((item) => item.id === productId);

      queryClient.setQueryData<MarketCartResponse | undefined>(['marketCart', slug], (current) => {
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
      queryClient.setQueryData(['marketCart', slug], data);
      toast({
        title: 'Agregado al carrito',
        description: 'Actualizamos tu carrito.',
      });
    },
    onError: (_error, _variables, context) => {
      if (context?.previousCart) {
        queryClient.setQueryData(['marketCart', slug], context.previousCart);
      }
      toast({
        title: 'No se pudo agregar el producto',
        description: 'Intentá nuevamente en unos segundos.',
        variant: 'destructive',
      });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['marketCart', slug] });
    },
  });

  const checkoutMutation = useMutation({
    mutationFn: (payload: { name?: string; phone: string }) => startMarketCheckout(slug, payload),
    onSuccess: (response, variables) => {
      saveMarketContact(slug, variables);
      setContact(variables);
      setConfirmation(response?.message ?? 'Pedido registrado. Te contactaremos a la brevedad.');
      queryClient.setQueryData<MarketCartResponse>(['marketCart', slug], {
        items: [],
        totalAmount: 0,
        totalPoints: 0,
        availableAmount: null,
        availablePoints: null,
      });
      queryClient.invalidateQueries({ queryKey: ['marketCart', slug] });
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

    if (!slug) {
      toast({
        title: 'No encontramos el catálogo',
        description: 'Revisa el enlace o escanea nuevamente el código QR.',
        variant: 'destructive',
      });
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
              alt={catalogQuery.data?.tenantName ?? slug}
              className="h-full w-full object-cover"
            />
          ) : (
            <ShoppingBag className="h-6 w-6" />
          )}
        </div>
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Catálogo</p>
          <h1 className="text-lg font-semibold leading-tight sm:text-xl">
            {catalogQuery.data?.tenantName ?? slug}
          </h1>
          {catalogQuery.data?.tenantName ? (
            <p className="text-xs text-muted-foreground">Ruta única: /market/{slug}/cart</p>
          ) : null}
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={handleShare}
          disabled={!canShare}
          className="transition hover:scale-[1.01]"
        >
          <Share2 className="mr-2 h-4 w-4" />
          Compartir catálogo
        </Button>
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
              <div>
                <h2 className="text-xl font-semibold">Productos</h2>
                <p className="text-sm text-muted-foreground">
                  Catálogo público de este tenant. Agrega ítems y confirma en un paso.
                </p>
              </div>
              {catalogQuery.isFetching ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" /> Sincronizando catálogo...
                </div>
              ) : null}
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
            ) : catalogProducts.length ? (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {catalogProducts.map((product) => (
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
    </div>
  );
}
