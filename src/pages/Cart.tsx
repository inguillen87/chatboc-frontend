import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ApiError, NetworkError, apiFetch, getErrorMessage } from '@/utils/api';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Link, useNavigate } from 'react-router-dom';
import { ProductDetails } from '@/components/product/ProductCard'; // Usar la misma interfaz detallada
import { toast } from '@/components/ui/use-toast';
import { formatCurrency } from '@/utils/currency';
import { Loader2, ShoppingCart, AlertTriangle, Trash2, PlusCircle, MinusCircle, ArrowLeft } from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { useTenant } from '@/context/TenantContext';
import {
  buildProductMap,
  getProductPlaceholderImage,
  normalizeCartPayload,
  normalizeProductsPayload,
} from '@/utils/cartPayload';
import { getLocalCartProducts, setLocalCartItemQuantity, setLocalCartSnapshot } from '@/utils/localCart';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { getDemoLoyaltySummary } from '@/utils/demoLoyalty';
import usePointsBalance from '@/hooks/usePointsBalance';
import UploadOrderFromFile from '@/components/cart/UploadOrderFromFile';
import { useUser } from '@/hooks/useUser';
import { buildTenantApiPath, buildTenantPath } from '@/utils/tenantPaths';
import { Badge } from '@/components/ui/badge';
import GuestContactDialog, { GuestContactValues } from '@/components/cart/GuestContactDialog';
import { loadGuestContact, saveGuestContact } from '@/utils/guestContact';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { safeLocalStorage } from '@/utils/safeLocalStorage';

// Interfaz para el producto en el carrito, extendiendo ProductDetails y añadiendo cantidad
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
  const [showAuthCta, setShowAuthCta] = useState(false);

  const catalogPath = buildTenantPath('/productos', effectiveTenantSlug);
  const cartCheckoutPath = buildTenantPath('/checkout-productos', effectiveTenantSlug);
  const loginPath = buildTenantPath('/login', effectiveTenantSlug);
  const registerPath = buildTenantPath('/register', effectiveTenantSlug);
  const productsApiPath = useMemo(
    () => buildTenantApiPath('/productos', effectiveTenantSlug),
    [effectiveTenantSlug],
  );
  const cartApiPath = useMemo(
    () => buildTenantApiPath('/carrito', effectiveTenantSlug),
    [effectiveTenantSlug],
  );

  const sharedRequestOptions = useMemo(
    () => ({
      suppressPanel401Redirect: true,
      tenantSlug: effectiveTenantSlug ?? undefined,
      sendAnonId: true,
    }) as const,
    [effectiveTenantSlug],
  );

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
      (err instanceof ApiError && [400, 401, 403, 405].includes(err.status)) ||
      err instanceof NetworkError
    );
  };

  const loadCartData = useCallback(async () => {
    setLoading(true);
    setError(null);
    setShowAuthCta(false);

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
      const [cartApiData, productsApiData] = await Promise.all([
        apiFetch<unknown>(cartApiPath, sharedRequestOptions),
        apiFetch<unknown>(productsApiPath, sharedRequestOptions),
      ]);

      const normalizedProducts = normalizeProductsPayload(productsApiData, 'CartPage');

      const productMap = buildProductMap(normalizedProducts);

      const cartEntries = normalizeCartPayload(cartApiData, 'CartPage');

      const populatedCartItems: CartItem[] = cartEntries
        .map(([productName, cantidad]) => {
          if (cantidad <= 0) {
            return null;
          }

          const productDetail = productMap[productName] ?? {
            id: productName,
            nombre: productName,
            precio_unitario: 0,
          };

          return {
            ...productDetail,
            cantidad,
          };
        })
        .filter((item): item is CartItem => item !== null);

      setCartItems(populatedCartItems);

      if (populatedCartItems.length > 0) {
        setLocalCartSnapshot(populatedCartItems.map((item) => ({ product: item, quantity: item.cantidad })));
      } else {
        const localSnapshot = getLocalCartProducts();
        if (localSnapshot.length > 0) {
          setCartMode('local');
          setCartItems(localSnapshot);
        }
      }

    } catch (err) {
      // Always fallback to local cart on these errors
      if (shouldUseLocalCart(err)) {
        setCartMode('local');
        refreshLocalCart();
        return;
      }

      const errorMessage = getErrorMessage(err, 'No se pudo cargar el carrito. Intenta de nuevo.');

      if (err instanceof ApiError && err.status === 400 && errorMessage.toLowerCase().includes('tenant')) {
        // Fallback to local cart if tenant is missing/invalid
        setCartMode('local');
        refreshLocalCart();
        return;
      }

      setError(errorMessage);
      console.error("Error cargando datos del carrito:", err);
    } finally {
      setLoading(false);
    }
  }, [cartApiPath, cartMode, effectiveTenantSlug, productsApiPath, refreshLocalCart, sharedRequestOptions]);

  useEffect(() => {
    if (!isLoadingTenant) {
      loadCartData();
    }
  }, [isLoadingTenant, loadCartData]);

  const handleUpdateQuantity = async (productName: string, newQuantity: number) => {
    const originalItems = [...cartItems];
    const itemToUpdate = cartItems.find(item => item.nombre === productName);
    if (!itemToUpdate) return;

    // Optimistic update
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
        const targetKey = itemToUpdate.localCartKey ?? itemToUpdate.id?.toString() ?? productName;
        const updated = setLocalCartItemQuantity(targetKey || productName, newQuantity);
        setCartItems(updated);
        toast({ description: `Cantidad de ${productName} actualizada en el carrito demo.` });
        return;
      }

      if (newQuantity <= 0) {
        await apiFetch(cartApiPath, { ...sharedRequestOptions, method: 'DELETE', body: { nombre: productName } });
      } else {
        await apiFetch(cartApiPath, {
          ...sharedRequestOptions,
          method: 'PUT',
          body: { nombre: productName, cantidad: newQuantity },
        });
      }
      // No es necesario llamar a loadCartData() aquí si el backend confirma la acción,
      // la UI ya está actualizada optimisticamente. Si se quiere re-sincronizar:
      // await loadCartData();
      toast({ description: `Cantidad de ${productName} actualizada.`});
    } catch (err) {
      toast({ title: "Error", description: "No se pudo actualizar la cantidad.", variant: "destructive" });
      setCartItems(originalItems); // Revertir en caso de error
    }
  };

  const calculateItemSubtotal = (item: CartItem) => {
    if (item.modalidad === 'puntos' || item.modalidad === 'donacion') {
      return 0;
    }
    if (item.unidades_por_caja && item.unidades_por_caja > 0 && item.precio_por_caja) {
      const cajas = Math.floor(item.cantidad / item.unidades_por_caja);
      const sobrantes = item.cantidad % item.unidades_por_caja;
      return cajas * item.precio_por_caja + sobrantes * item.precio_unitario;
    }
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

  const donationCount = useMemo(() => cartItems.filter((item) => item.modalidad === 'donacion').length, [cartItems]);

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
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-200px)] p-4 text-muted-foreground">
        <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
        <p className="text-lg">Cargando tu carrito...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-200px)] p-4 text-destructive">
        <AlertTriangle className="h-12 w-12 mb-4" />
        <p className="text-lg font-semibold">Ocurrió un error</p>
        <p>{error}</p>
        {showAuthCta ? (
          <div className="flex flex-wrap items-center justify-center gap-3 mt-4">
            <Button onClick={() => navigate(loginPath)}>Iniciar sesión</Button>
            <Button variant="outline" onClick={() => navigate(registerPath)}>Registrarme</Button>
            <Button variant="secondary" asChild>
              <Link to={catalogPath}>Ver catálogo</Link>
            </Button>
          </div>
        ) : (
          <Button onClick={loadCartData} className="mt-4">Reintentar</Button>
        )}
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 md:p-8">
      <Button variant="outline" onClick={() => navigate(-1)} className="mb-6">
        <ArrowLeft className="mr-2 h-4 w-4" /> Volver
      </Button>
      <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-4">Tu Carrito de Compras</h1>

      {!user && (
        <Alert className="mb-6">
          <AlertTitle>Finaliza con tus datos de contacto</AlertTitle>
          <AlertDescription>
            Te pediremos nombre, email y teléfono en el siguiente paso para confirmar la compra o donación.
          </AlertDescription>
        </Alert>
      )}

      {cartMode === 'local' && (
        <Alert className="mb-6">
          <AlertTitle>Carrito demo activo</AlertTitle>
          <AlertDescription>
            Tus productos se guardan únicamente en este navegador para que puedas simular la experiencia completa.
          </AlertDescription>
        </Alert>
      )}

      <div className="mb-6 rounded-xl border border-primary/20 bg-gradient-to-r from-primary/5 via-primary/10 to-transparent p-4 shadow-sm">
        <p className="text-sm uppercase tracking-wide text-primary/80 font-semibold mb-2">Saldo de puntos</p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-center">
          <div>
            <p className="text-sm text-muted-foreground">Disponible</p>
            <p className="text-xl font-bold text-primary">
              {isLoadingPoints ? <Loader2 className="h-4 w-4 animate-spin" /> : `${numberFormatter.format(effectivePointsBalance)} pts`}
            </p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Puntos a usar en este carrito</p>
            <p className="text-lg font-semibold">{numberFormatter.format(pointsTotal)} pts</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Saldo estimado luego del canje</p>
            <p className={`text-lg font-semibold ${hasPointsDeficit ? 'text-destructive' : ''}`}>
              {numberFormatter.format(pointsAfterSubtotal)} pts
            </p>
          </div>
        </div>
        {hasPointsDeficit && (
          <p className="text-sm text-destructive mt-2">No tienes puntos suficientes para todos los canjes. Ajusta cantidades o participa en más actividades.</p>
        )}
        {!hasPointsDeficit && requiresAuthForPoints && (
          <p className="text-sm text-destructive mt-2">Inicia sesión para canjear tus puntos antes de finalizar el pedido.</p>
        )}
      </div>

      <div className="mb-6">
        <UploadOrderFromFile onCartUpdated={loadCartData} />
      </div>

      {cartItems.length === 0 ? (
        <div className="text-center py-12 bg-card border border-border rounded-lg shadow-sm">
          <ShoppingCart className="mx-auto h-16 w-16 text-muted-foreground mb-4" />
          <p className="text-xl text-muted-foreground mb-2">Tu carrito está vacío.</p>
          <p className="text-sm text-muted-foreground mb-6">Parece que no has agregado nada aún.</p>
          <Button asChild>
            <Link to={catalogPath}>Explorar Catálogo</Link>
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-4">
            {cartItems.map((item) => (
              <Card key={item.id || item.nombre} className="flex flex-col sm:flex-row items-center overflow-hidden shadow-sm border-border">
                <img
                  src={item.imagen_url || getProductPlaceholderImage(item)}
                  alt={item.nombre}
                  loading="lazy"
                  onError={(event) => {
                    const fallback = getProductPlaceholderImage(item);
                    if (event.currentTarget.src !== fallback) {
                      event.currentTarget.src = fallback;
                    }
                  }}
                  className="w-full sm:w-32 h-32 sm:h-full object-cover"
                />
                <CardContent className="p-4 flex-1 flex flex-col sm:flex-row justify-between items-start sm:items-center">
                  <div className="flex-1 mb-4 sm:mb-0">
                    <h3 className="font-semibold text-lg text-foreground">{item.nombre}</h3>
                    {item.modalidad && (
                      <Badge
                        variant={item.modalidad === 'donacion' ? 'success' : item.modalidad === 'puntos' ? 'outline' : 'secondary'}
                        className="mt-1 capitalize"
                      >
                        {item.modalidad === 'donacion' ? 'Donación' : item.modalidad === 'puntos' ? 'Canje con puntos' : 'Compra'}
                      </Badge>
                    )}
                    {item.presentacion && item.presentacion !== 'NaN' && (
                      <p className="text-sm text-muted-foreground">{item.presentacion}</p>
                    )}
                    <p className="text-md font-medium text-primary mt-1">{formatCurrency(item.precio_unitario)} c/u</p>
                    {item.precio_por_caja && item.unidades_por_caja && (
                      <p className="text-sm text-muted-foreground">
                        {formatCurrency(item.precio_por_caja)} por {item.unidades_por_caja} unidades
                      </p>
                    )}
                    {item.precio_mayorista && item.cantidad_minima_mayorista && (
                      <p className="text-sm text-muted-foreground">
                        Mayorista desde {item.cantidad_minima_mayorista} cajas: {formatCurrency(item.precio_mayorista)}
                      </p>
                    )}
                    {item.promocion_activa && (
                      <p className="text-sm text-green-600">Promo: {item.promocion_activa}</p>
                    )}
                    {item.unidades_por_caja && item.unidades_por_caja > 0 && (
                      <p className="text-xs text-muted-foreground mt-1">
                        {Math.floor(item.cantidad / item.unidades_por_caja)} caja(s) + {item.cantidad % item.unidades_por_caja} unidad(es)
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 w-full sm:w-auto">
                    <Button variant="outline" size="icon" onClick={() => handleUpdateQuantity(item.nombre, item.cantidad - 1)} disabled={item.cantidad <= 1}>
                      <MinusCircle className="h-4 w-4" />
                    </Button>
                    <Input
                      type="number"
                      value={item.cantidad}
                      onChange={(e) => {
                        const newQty = parseInt(e.target.value);
                        if (!isNaN(newQty) && newQty >= 0) { // Permitir 0 para luego borrar si se quiere
                           handleUpdateQuantity(item.nombre, newQty);
                        } else if (e.target.value === "") {
                           // No hacer nada si está vacío, esperar a que se ingrese un número
                        }
                      }}
                      onBlur={(e) => { // Si se deja vacío y se sale, o es 0, tratar como borrado o 1
                        const currentQty = parseInt(e.target.value);
                        if (isNaN(currentQty) || currentQty <= 0) {
                            handleUpdateQuantity(item.nombre, 0); // Esto lo eliminará
                        }
                      }}
                      className="w-16 h-9 text-center"
                      min="0"
                    />
                    <Button variant="outline" size="icon" onClick={() => handleUpdateQuantity(item.nombre, item.cantidad + 1)}>
                      <PlusCircle className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive/80" onClick={() => handleUpdateQuantity(item.nombre, 0)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
                <CardFooter className="w-full flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 bg-muted/30 border-t">
                  <span className="text-lg font-semibold text-foreground">Subtotal: {formatCurrency(calculateItemSubtotal(item))}</span>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleUpdateQuantity(item.nombre, item.cantidad + 1)}
                    >
                      Añadir 1 unidad
                    </Button>
                    {item.unidades_por_caja && item.unidades_por_caja > 0 && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleUpdateQuantity(item.nombre, item.cantidad + item.unidades_por_caja)}
                      >
                        Añadir 1 caja
                      </Button>
                    )}
                  </div>
                </CardFooter>
              </Card>
            ))}
          </div>

          <div className="lg:col-span-1">
            <Card className="shadow-lg border-border">
              <CardHeader>
                <CardTitle className="text-2xl">Resumen del Pedido</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between text-muted-foreground">
                  <span>Subtotal ({cartItems.reduce((acc, item) => acc + item.cantidad, 0)} items)</span>
                  <span>{formatCurrency(subtotal)}</span>
                </div>
                {/* Aquí podrían ir descuentos, costos de envío en el futuro */}
                <Separator />
                <div className="flex justify-between text-sm text-muted-foreground">
                  <span>Total en puntos</span>
                  <span>{numberFormatter.format(pointsTotal)} pts</span>
                </div>
                <div className="flex justify-between text-sm text-muted-foreground">
                  <span>Saldo luego del canje</span>
                  <span className={hasPointsDeficit ? 'text-destructive font-semibold' : ''}>{numberFormatter.format(pointsAfterSubtotal)} pts</span>
                </div>
                {donationCount > 0 && (
                  <div className="text-sm text-muted-foreground">
                    Incluye {donationCount} ítem(s) de donación sin costo monetario.
                  </div>
                )}
                {requiresAuthForPoints && (
                  <Alert variant="destructive" className="mt-2">
                    <AlertTitle>Necesitas iniciar sesión</AlertTitle>
                    <AlertDescription>
                      Ingresa con tu cuenta para canjear los productos que usan puntos.
                    </AlertDescription>
                  </Alert>
                )}
                <Separator />
                <div className="flex justify-between text-xl font-bold text-foreground">
                  <span>Total estimado</span>
                  <span>
                    {formatCurrency(subtotal)}
                    {pointsTotal > 0 ? ` + ${numberFormatter.format(pointsTotal)} pts` : ''}
                  </span>
                </div>
              </CardContent>
              <CardFooter className="flex-col gap-3">
                <Button
                  size="lg"
                  className="w-full bg-primary hover:bg-primary/90"
                  onClick={handleNavigateToCheckout} // Redirigir a la nueva página de checkout de productos
                  disabled={hasPointsDeficit || requiresAuthForPoints}
                >
                  Continuar Compra
                </Button>
                <Button variant="link" asChild className="text-sm text-muted-foreground">
                  <Link to={catalogPath}>Seguir comprando</Link>
                </Button>
              </CardFooter>
            </Card>
          </div>
        </div>
      )}

      <Dialog open={showPointsAuthPrompt} onOpenChange={setShowPointsAuthPrompt}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Inicia sesión para usar tus puntos</DialogTitle>
            <DialogDescription>
              Para canjear productos con puntos primero debes iniciar sesión o crear una cuenta.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex flex-col sm:flex-row sm:justify-end gap-2">
            <Button asChild variant="default">
              <Link to={loginPath}>Iniciar sesión</Link>
            </Button>
            <Button asChild variant="outline">
              <Link to={registerPath}>Crear cuenta</Link>
            </Button>
          </DialogFooter>
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
    </div>
  );
}