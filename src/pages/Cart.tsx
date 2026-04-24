import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ApiError, NetworkError, getErrorMessage } from '@/utils/api';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Link, useNavigate } from 'react-router-dom';
import { ProductDetails } from '@/components/product/ProductCard';
import { toast } from '@/components/ui/use-toast';
import { formatCurrency } from '@/utils/currency';
import { Loader2, ShoppingCart, AlertTriangle, Trash2, PlusCircle, MinusCircle, ArrowLeft, Package, Sparkles } from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { useTenant } from '@/context/TenantContext';
import {
  getProductPlaceholderImage,
} from '@/utils/cartPayload';
import { getLocalCartProducts, setLocalCartItemQuantity, setLocalCartSnapshot } from '@/utils/localCart';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { getDemoLoyaltySummary } from '@/utils/demoLoyalty';
import usePointsBalance from '@/hooks/usePointsBalance';
import UploadOrderFromFile from '@/components/cart/UploadOrderFromFile';
import { useUser } from '@/hooks/useUser';
import { buildTenantPath } from '@/utils/tenantPaths';
import { Badge } from '@/components/ui/badge';
import GuestContactDialog, { GuestContactValues } from '@/components/cart/GuestContactDialog';
import { loadGuestContact, saveGuestContact } from '@/utils/guestContact';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { safeLocalStorage } from '@/utils/safeLocalStorage';
import { motion, AnimatePresence } from 'framer-motion';
import { addMarketItem, fetchMarketCart, fetchMarketCatalog, removeMarketItem } from '@/api/market';
import { MarketCartItem } from '@/types/market';

// Adapting MarketCartItem to the local CartItem interface used in this component
// ideally we should unify these types, but for now we adapt.
interface CartItem extends ProductDetails {
  cantidad: number;
  localCartKey?: string;
}

export default function CartPage() {
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cartMode, setCartMode] = useState<'api' | 'local'>('api');
  const [loyaltySummary] = useState(() => getDemoLoyaltySummary());
  const navigate = useNavigate();
  const { currentSlug, isLoadingTenant } = useTenant();
  const { user } = useUser();
  const effectiveTenantSlug = useMemo(
    () => currentSlug ?? user?.tenantSlug ?? safeLocalStorage.getItem('tenantSlug') ?? null,
    [currentSlug, user?.tenantSlug],
  );
  const { points: pointsBalance, isLoading: isLoadingPoints, requiresAuth: pointsRequireAuth } = usePointsBalance({
    enabled: !!user,
    tenantSlug: effectiveTenantSlug,
  });
  const [showGuestDialog, setShowGuestDialog] = useState(false);
  const [showPointsAuthPrompt, setShowPointsAuthPrompt] = useState(false);

  const catalogPath = buildTenantPath('/productos', effectiveTenantSlug);
  const cartCheckoutPath = buildTenantPath('/checkout-productos', effectiveTenantSlug);
  const loginPath = buildTenantPath('/login', effectiveTenantSlug);
  const registerPath = buildTenantPath('/register', effectiveTenantSlug);

  const refreshLocalCart = useCallback(() => {
    setCartItems(getLocalCartProducts());
  }, []);

  useEffect(() => {
    if (pointsRequireAuth) {
      setShowPointsAuthPrompt(true);
    }
  }, [pointsRequireAuth]);

  const numberFormatter = useMemo(() => new Intl.NumberFormat('es-AR'), []);

  const shouldUseLocalCart = (err: unknown) => {
    return (
      (err instanceof ApiError && [400, 401, 403, 404, 405].includes(err.status)) ||
      err instanceof NetworkError
    );
  };

  const loadCartData = useCallback(async () => {
    setLoading(true);
    setError(null);

    if (cartMode === 'local') {
      refreshLocalCart();
      setLoading(false);
      return;
    }

    if (!effectiveTenantSlug) {
      setCartMode('local');
      refreshLocalCart();
      setLoading(false);
      return;
    }

    try {
      // Use the centralized API functions
      const cartResponse = await fetchMarketCart(effectiveTenantSlug);

      // Convert MarketCartItem[] to CartItem[]
      const populatedCartItems: CartItem[] = cartResponse.items.map((item: MarketCartItem) => ({
        id: item.id,
        nombre: item.name,
        precio_unitario: item.price ?? 0,
        precio_puntos: item.points ?? undefined,
        cantidad: item.quantity,
        imagen_url: item.imageUrl ?? undefined,
        modalidad: item.modality ?? undefined,
        moneda: item.currency ?? undefined,
      }));

      setCartItems(populatedCartItems);

      // Also update local snapshot for redundancy
      if (populatedCartItems.length > 0) {
        setLocalCartSnapshot(populatedCartItems.map((item) => ({ product: item, quantity: item.cantidad })));
      } else {
        // Fallback: If API returns empty but we have local items, rely on local items (Demo/Persistence Fallback)
        const localItems = getLocalCartProducts();
        if (localItems.length > 0) {
           setCartMode('local');
           setCartItems(localItems);
           setLoading(false);
           return;
        }
      }

      if (cartResponse.isDemo) {
        setCartMode('local');
      }

    } catch (err) {
      if (shouldUseLocalCart(err)) {
        setCartMode('local');
        refreshLocalCart();
        return;
      }
      const errorMessage = getErrorMessage(err, 'No se pudo cargar el carrito. Intenta de nuevo.');
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [cartMode, effectiveTenantSlug, refreshLocalCart]);

  useEffect(() => {
    if (!isLoadingTenant) {
      loadCartData();
    }
  }, [isLoadingTenant, loadCartData]);

  const handleUpdateQuantity = async (productName: string, newQuantity: number, productId?: string) => {
    const originalItems = [...cartItems];
    const itemToUpdate = cartItems.find(item => item.nombre === productName); // Fallback to name match
    if (!itemToUpdate) return;

    if (newQuantity <= 0) {
      setCartItems(prevItems => prevItems.filter(item => item.nombre !== productName));
    } else {
      setCartItems(prevItems =>
        prevItems.map(item =>
          item.nombre === productName ? { ...item, cantidad: newQuantity } : item
        )
      );
    }

    try {
      if (cartMode === 'local') {
        const targetKey = productId ?? itemToUpdate.id?.toString() ?? productName;
        const updated = setLocalCartItemQuantity(targetKey || productName, newQuantity);
        setCartItems(updated);
        toast({ description: `Cantidad actualizada.` });
        return;
      }

      if (!effectiveTenantSlug) throw new Error("No tenant context");

      const idToUse = productId ?? itemToUpdate.id ?? productName;

      if (newQuantity <= 0) {
        await removeMarketItem(effectiveTenantSlug, idToUse);
      } else {
        await addMarketItem(effectiveTenantSlug, { productId: idToUse, quantity: newQuantity });
      }
      toast({ description: `Cantidad actualizada.` });
    } catch (err) {
      toast({ title: "Error", description: "No se pudo actualizar la cantidad.", variant: "destructive" });
      setCartItems(originalItems);
    }
  };

  const calculateItemSubtotal = (item: CartItem) => {
    if (item.modalidad === 'puntos' || item.modalidad === 'donacion') return 0;
    // Simple calculation for now
    return item.precio_unitario * item.cantidad;
  };

  const subtotal = useMemo(() => {
    return cartItems.reduce((sum, item) => sum + calculateItemSubtotal(item), 0);
  }, [cartItems]);

  const pointsTotal = useMemo(() => {
    return cartItems.reduce((sum, item) => {
      if (item.modalidad === 'puntos') {
        const unitPoints = item.precio_puntos ?? item.precio_unitario ?? 0;
        return sum + unitPoints * item.cantidad;
      }
      return sum;
    }, 0);
  }, [cartItems]);

  const effectivePointsBalance = cartMode === 'local' ? loyaltySummary.points : pointsBalance;
  const pointsAfterSubtotal = Math.max(effectivePointsBalance - pointsTotal, 0);
  const hasPointsDeficit = pointsTotal > effectivePointsBalance;
  const requiresAuthForPoints = (cartItems.some((item) => item.modalidad === 'puntos') && !user) || pointsRequireAuth;

  const handleNavigateToCheckout = () => {
    if (requiresAuthForPoints) {
      setShowPointsAuthPrompt(true);
      return;
    }
    if (!user) {
      setShowGuestDialog(true);
      return;
    }
    navigate(cartCheckoutPath);
  };

  const handleGuestContactSubmit = (values: GuestContactValues) => {
    saveGuestContact(values);
    setShowGuestDialog(false);
    navigate(cartCheckoutPath);
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-200px)] p-4 text-muted-foreground animate-pulse">
        <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
        <p className="text-lg font-medium">Cargando tu carrito...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-200px)] p-4 text-destructive text-center">
        <AlertTriangle className="h-12 w-12 mb-4" />
        <h2 className="text-2xl font-bold mb-2">Ocurrió un error</h2>
        <p className="text-muted-foreground max-w-md mb-6">{error}</p>
        <div className="flex gap-4">
            <Button onClick={loadCartData}>Reintentar</Button>
            <Button variant="outline" asChild><Link to={catalogPath}>Ir al catálogo</Link></Button>
        </div>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="container mx-auto p-4 md:p-8 max-w-7xl"
    >
      <div className="flex items-center justify-between mb-8">
        <Button variant="ghost" onClick={() => navigate(-1)} className="hover:bg-accent/50 group">
          <ArrowLeft className="mr-2 h-4 w-4 group-hover:-translate-x-1 transition-transform" /> Volver
        </Button>
        <h1 className="text-3xl md:text-4xl font-extrabold text-foreground tracking-tight">Tu Carrito</h1>
      </div>

      {!user && (
        <Alert className="mb-6 bg-muted/40 border-primary/20">
          <Package className="h-4 w-4 text-primary" />
          <AlertTitle className="text-primary font-medium">Finaliza con tus datos</AlertTitle>
          <AlertDescription>
            Te pediremos tus datos de contacto en el siguiente paso.
          </AlertDescription>
        </Alert>
      )}

      {cartMode === 'local' && (
        <Alert className="mb-6 bg-warning/10 border-warning/30 text-warning-foreground">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Modo Demo</AlertTitle>
          <AlertDescription>
            Tus productos se guardan localmente para simular la experiencia.
          </AlertDescription>
        </Alert>
      )}

      {/* Points Summary Card */}
      <motion.div
        initial={{ scale: 0.98, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: 0.1 }}
        className="mb-8 rounded-xl border border-border/60 bg-gradient-to-br from-card to-muted/30 p-5 shadow-sm relative overflow-hidden"
      >
        <div className="absolute top-0 right-0 p-4 opacity-5">
           <Sparkles className="w-24 h-24" />
        </div>
        <div className="flex items-center gap-2 mb-4">
           <Sparkles className="h-5 w-5 text-primary" />
           <p className="text-sm uppercase tracking-wider font-bold text-muted-foreground">Resumen de Puntos</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 relative z-10">
          <div>
            <p className="text-xs text-muted-foreground font-medium uppercase mb-1">Tu Saldo</p>
            <p className="text-2xl font-bold text-foreground">
              {isLoadingPoints ? <Loader2 className="h-5 w-5 animate-spin" /> : `${numberFormatter.format(effectivePointsBalance)} pts`}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground font-medium uppercase mb-1">A usar</p>
            <p className="text-2xl font-bold text-primary">{numberFormatter.format(pointsTotal)} pts</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground font-medium uppercase mb-1">Restante</p>
            <p className={`text-2xl font-bold ${hasPointsDeficit ? 'text-destructive' : 'text-green-600'}`}>
              {numberFormatter.format(pointsAfterSubtotal)} pts
            </p>
          </div>
        </div>

        <AnimatePresence>
            {hasPointsDeficit && (
            <motion.p initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="text-sm text-destructive mt-3 bg-destructive/10 p-2 rounded-md inline-block">
                No tienes puntos suficientes. Ajusta tu carrito.
            </motion.p>
            )}
        </AnimatePresence>
      </motion.div>

      <div className="mb-8">
        <UploadOrderFromFile onCartUpdated={loadCartData} />
      </div>

      {cartItems.length === 0 ? (
        <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="text-center py-20 bg-card/50 border border-dashed border-border rounded-xl"
        >
          <div className="bg-muted/50 rounded-full w-24 h-24 flex items-center justify-center mx-auto mb-6">
             <ShoppingCart className="h-10 w-10 text-muted-foreground" />
          </div>
          <h3 className="text-2xl font-bold text-foreground mb-2">Tu carrito está vacío</h3>
          <p className="text-muted-foreground mb-8 max-w-md mx-auto">Explora nuestro catálogo para encontrar productos, beneficios y recompensas increíbles.</p>
          <Button asChild size="lg" className="rounded-full px-8 shadow-lg shadow-primary/20">
            <Link to={catalogPath}>Explorar Catálogo</Link>
          </Button>
        </motion.div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
          <div className="lg:col-span-2 space-y-4">
            <AnimatePresence mode='popLayout'>
            {cartItems.map((item) => (
              <motion.div
                layout
                key={item.id || item.nombre}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                transition={{ duration: 0.3 }}
              >
                  <Card className="flex flex-col sm:flex-row items-center overflow-hidden border-border/60 hover:border-primary/30 transition-colors group">
                    <div className="w-full sm:w-32 h-32 sm:h-auto aspect-square bg-muted relative overflow-hidden shrink-0">
                         <img
                        src={item.imagen_url || getProductPlaceholderImage(item)}
                        alt={item.nombre}
                        loading="lazy"
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                        onError={(e) => {
                            const target = e.target as HTMLImageElement;
                            target.src = getProductPlaceholderImage(item);
                        }}
                        />
                    </div>

                    <CardContent className="p-4 flex-1 flex flex-col sm:flex-row justify-between items-start sm:items-center w-full gap-4">
                    <div className="flex-1 space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="font-bold text-lg text-foreground leading-tight">{item.nombre}</h3>
                            {item.modalidad && (
                            <Badge
                                variant={item.modalidad === 'donacion' ? 'success' : item.modalidad === 'puntos' ? 'outline' : 'secondary'}
                                className="capitalize text-[10px] h-5"
                            >
                                {item.modalidad === 'donacion' ? 'Donación' : item.modalidad === 'puntos' ? 'Canje' : 'Venta'}
                            </Badge>
                            )}
                        </div>

                        <div className="text-sm text-muted-foreground">
                            {item.presentacion && item.presentacion !== 'NaN' && <span>{item.presentacion} • </span>}
                            <span className="font-medium text-foreground">{formatCurrency(item.precio_unitario)}</span>
                        </div>

                        {item.promocion_activa && (
                        <p className="text-xs font-semibold text-green-600 bg-green-500/10 px-2 py-0.5 rounded-full inline-block">
                             {item.promocion_activa}
                        </p>
                        )}
                    </div>

                    <div className="flex items-center gap-1 bg-muted/40 rounded-lg p-1 border border-border/50">
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleUpdateQuantity(item.nombre, item.cantidad - 1, item.id)} disabled={item.cantidad <= 1}>
                        <MinusCircle className="h-4 w-4" />
                        </Button>
                        <Input
                        type="number"
                        value={item.cantidad}
                        onChange={(e) => {
                            const val = parseInt(e.target.value);
                            if (!isNaN(val) && val >= 0) handleUpdateQuantity(item.nombre, val, item.id);
                        }}
                        className="w-12 h-8 text-center bg-transparent border-none p-0 focus-visible:ring-0"
                        min="0"
                        />
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleUpdateQuantity(item.nombre, item.cantidad + 1, item.id)}>
                        <PlusCircle className="h-4 w-4" />
                        </Button>
                    </div>

                    <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-destructive hover:bg-destructive/10" onClick={() => handleUpdateQuantity(item.nombre, 0, item.id)}>
                        <Trash2 className="h-4 w-4" />
                    </Button>
                    </CardContent>
                </Card>
              </motion.div>
            ))}
            </AnimatePresence>
          </div>

          <div className="lg:col-span-1">
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="sticky top-24"
            >
                <Card className="shadow-lg border-primary/10 overflow-hidden">
                <div className="h-2 bg-gradient-to-r from-primary to-purple-500/50" />
                <CardHeader>
                    <CardTitle className="text-xl">Resumen de Cuenta</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="flex justify-between text-muted-foreground text-sm">
                    <span>Subtotal items</span>
                    <span>{cartItems.reduce((acc, item) => acc + item.cantidad, 0)} u.</span>
                    </div>

                    <div className="flex justify-between text-sm font-medium">
                    <span>Costo monetario</span>
                    <span>{formatCurrency(subtotal)}</span>
                    </div>

                    <div className="flex justify-between text-sm font-medium">
                    <span>Costo en puntos</span>
                    <span>{numberFormatter.format(pointsTotal)} pts</span>
                    </div>

                    <Separator className="bg-border/60" />

                    <div className="space-y-1">
                        <div className="flex justify-between text-lg font-bold text-foreground">
                        <span>Total</span>
                        <span>{formatCurrency(subtotal)}</span>
                        </div>
                        {pointsTotal > 0 && (
                             <div className="flex justify-between text-sm text-primary font-medium">
                                <span>+ Puntos</span>
                                <span>{numberFormatter.format(pointsTotal)} pts</span>
                             </div>
                        )}
                    </div>

                    {requiresAuthForPoints && (
                    <div className="bg-destructive/10 text-destructive text-xs p-2 rounded border border-destructive/20">
                        Inicia sesión para canjear productos con puntos.
                    </div>
                    )}
                </CardContent>
                <CardFooter className="flex-col gap-3 pt-2 pb-6">
                    <Button
                    size="lg"
                    className="w-full font-bold shadow-lg shadow-primary/20 transition-all hover:scale-[1.02]"
                    onClick={handleNavigateToCheckout}
                    disabled={hasPointsDeficit || requiresAuthForPoints}
                    >
                        Confirmar Pedido
                    </Button>
                    <Button variant="outline" asChild className="w-full border-dashed">
                         <Link to={catalogPath}>Agregar más productos</Link>
                    </Button>
                </CardFooter>
                </Card>
            </motion.div>
          </div>
        </div>
      )}

      <Dialog open={showPointsAuthPrompt} onOpenChange={setShowPointsAuthPrompt}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-primary" />
                Inicia sesión
            </DialogTitle>
            <DialogDescription>
              Para canjear beneficios y sumar puntos, necesitas una cuenta activa.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-3 py-4">
             <Button asChild size="lg" className="w-full">
               <Link to={loginPath}>Iniciar sesión</Link>
             </Button>
             <Button asChild variant="outline" size="lg" className="w-full">
               <Link to={registerPath}>Crear cuenta gratis</Link>
             </Button>
          </div>
        </DialogContent>
      </Dialog>

      <GuestContactDialog
        open={showGuestDialog}
        onClose={() => setShowGuestDialog(false)}
        defaultValues={loadGuestContact()}
        reason="checkout"
        onLogin={() => navigate(loginPath)}
        onSubmit={handleGuestContactSubmit}
      />
    </motion.div>
  );
}
