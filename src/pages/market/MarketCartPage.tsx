import React, { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import { ShoppingBag, Share2, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import ProductCard from '@/components/market/ProductCard';
import CartSummary from '@/components/market/CartSummary';
import CheckoutDialog from '@/components/market/CheckoutDialog';
import { addMarketItem, fetchMarketCart, fetchMarketCatalog, startMarketCheckout } from '@/api/market';
import { MarketCartItem, MarketProduct } from '@/types/market';
import { loadMarketContact, saveMarketContact } from '@/utils/marketStorage';
import { toast } from '@/components/ui/use-toast';
import { Badge } from '@/components/ui/badge';

type ContactInfo = {
  name?: string;
  phone?: string;
};

export default function MarketCartPage() {
  const { slug = '' } = useParams<{ slug: string }>();
  const queryClient = useQueryClient();

  const [showContactDialog, setShowContactDialog] = useState(false);
  const [confirmation, setConfirmation] = useState<string | null>(null);
  const [contact, setContact] = useState<ContactInfo>(() => loadMarketContact(slug));

  useEffect(() => {
    setContact(loadMarketContact(slug));
    setConfirmation(null);
  }, [slug]);

  const shareUrl = useMemo(() => {
    if (typeof window === 'undefined' || !slug) return '';
    const url = new URL(window.location.href);
    url.pathname = `/market/${slug}/cart`;
    url.search = '';
    return url.toString();
  }, [slug]);

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
  });

  const addMutation = useMutation({
    mutationFn: (productId: string) => addMarketItem(slug, { productId, quantity: 1 }),
    onSuccess: (data) => {
      queryClient.setQueryData(['marketCart', slug], data);
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

  const checkoutMutation = useMutation({
    mutationFn: (payload: { name?: string; phone: string }) =>
      startMarketCheckout(slug, payload),
    onSuccess: (response, variables) => {
      saveMarketContact(slug, variables);
      setContact(variables);
      setConfirmation(response?.message ?? 'Pedido registrado. Te contactaremos a la brevedad.');
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

  const handleCheckout = () => {
    const phone = contact.phone?.trim();
    if (!cartQuery.data?.items.length) {
      toast({
        title: 'Tu carrito está vacío',
        description: 'Agrega productos para continuar.',
      });
      return;
    }

    if (phone) {
      checkoutMutation.mutate({ name: contact.name, phone });
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
  const canShare = Boolean(shareUrl && navigator?.clipboard);

  const itemsCount = cartItems.reduce((acc, item) => acc + item.quantity, 0);

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      <header className="sticky top-0 z-10 border-b bg-white/80 backdrop-blur">
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
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleShare} disabled={!canShare}>
              <Share2 className="mr-2 h-4 w-4" />
              Compartir catálogo
            </Button>
            <Badge variant="secondary" className="flex items-center gap-1 px-3 py-1 text-sm">
              <ShoppingBag className="h-4 w-4" />
              {itemsCount}
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

        <section className="grid gap-6 lg:grid-cols-[2fr_1fr]">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold">Productos</h2>
              {catalogQuery.isLoading ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" /> Cargando catálogo...
                </div>
              ) : null}
            </div>

            {catalogErrorMessage ? (
              <Alert variant="destructive">
                <AlertTitle>No pudimos cargar el catálogo</AlertTitle>
                <AlertDescription>
                  {catalogErrorMessage || 'Intenta nuevamente desde el enlace o QR.'}
                </AlertDescription>
              </Alert>
            ) : null}

            {catalogProducts.length ? (
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
                {catalogQuery.isLoading ? 'Cargando productos...' : 'No hay productos disponibles en este catálogo.'}
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
            />

            {cartErrorMessage ? (
              <Alert variant="destructive" className="mt-3">
                <AlertTitle>No pudimos actualizar tu carrito</AlertTitle>
                <AlertDescription>
                  {cartErrorMessage || 'Revisa tu conexión e intenta de nuevo.'}
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
    </div>
  );
}
