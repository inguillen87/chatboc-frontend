import React, { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { Copy, Loader2, MessageCircle, QrCode, Search, Share2, ShoppingBag } from 'lucide-react';
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
import { useUser } from '@/hooks/useUser';
import { Input } from '@/components/ui/input';
import { AlertDialog, AlertDialogAction, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { formatCurrency } from '@/utils/currency';
import { getValidStoredToken } from '@/utils/authTokens';
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { buildDemoMarketCatalog } from '@/data/marketDemo';

type ContactInfo = {
  name?: string;
  phone?: string;
};

export default function MarketCartPage() {
  const { tenantSlug = '' } = useParams<{ tenantSlug: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const { user } = useUser();

  const userName = user?.name ?? user?.nombre ?? user?.full_name;
  const userPhone = user?.phone ?? user?.telefono ?? user?.telefono_movil ?? user?.celular;
  const normalizedUserPhone =
    typeof userPhone === 'string' ? userPhone.trim() : userPhone ? String(userPhone).trim() : undefined;

  const [showContactDialog, setShowContactDialog] = useState(false);
  const [showAuthDialog, setShowAuthDialog] = useState(false);
  const [showQrModal, setShowQrModal] = useState(false);
  const [showMobileCart, setShowMobileCart] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [confirmation, setConfirmation] = useState<string | null>(null);
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
  });

  const shareMessage = useMemo(() => {
    if (!shareUrl) return '';
    const tenantName = catalogQuery.data?.tenantName?.trim();
    const prefix = tenantName ? `Mirá el catálogo de ${tenantName}` : 'Mirá este catálogo';
    return `${prefix}: ${shareUrl}`;
  }, [catalogQuery.data?.tenantName, shareUrl]);

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

  const checkoutMutation = useMutation({
    mutationFn: (payload: { name?: string; phone: string }) =>
      startMarketCheckout(tenantSlug, payload),
    onSuccess: (response, variables) => {
      saveMarketContact(tenantSlug, variables);
      setContact(variables);
      setConfirmation(response?.message ?? 'Pedido registrado. Te contactaremos a la brevedad.');
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
    const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(shareMessage)}`;
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

    if (!hasSession) {
      setShowAuthDialog(true);
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

  const itemsCount = cartItems.reduce((acc, item) => acc + item.quantity, 0);
  const hasSession = useMemo(() => {
    const authToken = getValidStoredToken('authToken');
    const chatToken = getValidStoredToken('chatAuthToken');
    return Boolean(user?.token || authToken || chatToken);
  }, [user]);

  const filteredProducts = useMemo(() => {
    if (!searchTerm.trim()) return catalogProducts;
    const term = searchTerm.toLowerCase();
    return catalogProducts.filter((product) => {
      const name = product.name?.toLowerCase() ?? '';
      const description = product.description?.toLowerCase() ?? '';
      return name.includes(term) || description.includes(term);
    });
  }, [catalogProducts, searchTerm]);

  const derivedAmount = useMemo(() => {
    if (cartQuery.data?.totalAmount !== undefined && cartQuery.data?.totalAmount !== null) {
      return cartQuery.data.totalAmount;
    }
    return cartItems.reduce((acc, item) => acc + (item.price ?? 0) * item.quantity, 0);
  }, [cartItems, cartQuery.data?.totalAmount]);

  const goToLogin = () => {
    const redirectPath = `${location.pathname}${location.search}`;
    navigate('/user/login', { state: { redirectTo: redirectPath } });
  };

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
                <ShoppingBag className="h-4 w-4" />
                {itemsCount}
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
                <AlertTitle>No pudimos cargar el catálogo</AlertTitle>
                <AlertDescription>
                  {catalogErrorMessage || 'Intenta nuevamente desde el enlace o QR.'}
                </AlertDescription>
              </Alert>
            ) : null}

            {filteredProducts.length ? (
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

      <Sheet open={showMobileCart} onOpenChange={setShowMobileCart}>
        {itemsCount ? (
          <div className="fixed bottom-4 left-4 right-4 z-20 sm:hidden">
            <div className="flex items-center justify-between gap-3 rounded-full border bg-white/95 px-4 py-3 shadow-lg">
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
                  <div>
                    <p className="font-medium leading-snug">{item.name}</p>
                    <p className="text-xs text-muted-foreground">Cantidad: {item.quantity}</p>
                  </div>
                  <div className="text-right text-sm font-semibold">
                    {item.price ? formatCurrency(item.price * item.quantity, 'ARS') : '—'}
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
            className="mt-4 w-full"
            size="lg"
            onClick={() => {
              setShowMobileCart(false);
              handleCheckout();
            }}
            disabled={!cartItems.length || checkoutMutation.isPending}
          >
            {checkoutMutation.isPending ? 'Procesando...' : 'Finalizar pedido'}
          </Button>
        </SheetContent>
      </Sheet>

      <AlertDialog open={showAuthDialog} onOpenChange={setShowAuthDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Necesitas iniciar sesión</AlertDialogTitle>
            <AlertDialogDescription>
              Ingresa con tu número de teléfono para continuar con el pedido y volveremos a traerte aquí.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction onClick={goToLogin}>Ir a login</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={showQrModal} onOpenChange={setShowQrModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Código QR del catálogo</DialogTitle>
            <DialogDescription>Escanealo o compártelo para abrir este catálogo en cualquier dispositivo.</DialogDescription>
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
