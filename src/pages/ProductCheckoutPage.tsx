import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import AddressAutocomplete from '@/components/ui/AddressAutocomplete'; // Reutilizar
import { Loader2, AlertTriangle, ArrowLeft, CheckCircle } from 'lucide-react';
import { toast } from '@/components/ui/use-toast';

import { ApiError, NetworkError, apiFetch, getErrorMessage } from '@/utils/api';
import { useUser } from '@/hooks/useUser'; // Para pre-rellenar datos
import { ProductDetails } from '@/components/product/ProductCard'; // Para tipo de producto
import { formatCurrency } from '@/utils/currency';
import { useTenant } from '@/context/TenantContext';
import { safeLocalStorage } from '@/utils/safeLocalStorage';
import {
  buildProductMap,
  normalizeCartPayload,
  normalizeProductsPayload,
} from '@/utils/cartPayload';
import { getLocalCartProducts, clearLocalCart } from '@/utils/localCart';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import usePointsBalance from '@/hooks/usePointsBalance';
import { buildTenantApiPath, buildTenantPath } from '@/utils/tenantPaths';
import { loadGuestContact, saveGuestContact } from '@/utils/guestContact';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';

// Esquema de validación para el formulario de checkout
const checkoutSchema = z.object({
  nombre: z.string().min(3, { message: "El nombre debe tener al menos 3 caracteres." }),
  email: z.string().email({ message: "Ingresa un email válido." }),
  telefono: z.string().min(8, { message: "Ingresa un teléfono válido." }),
  direccion: z.string().min(5, { message: "La dirección es requerida." }),
  referencias: z.string().optional(),
  notasEnvio: z.string().optional(),
  metodoEnvio: z.enum(['delivery', 'pickup']).default('delivery'),
  metodoPago: z.enum(['mercado_pago', 'acordar']).default('mercado_pago'),
});

type CheckoutFormData = z.infer<typeof checkoutSchema>;

interface CartItem extends ProductDetails {
  cantidad: number;
  localCartKey?: string;
}

interface DemoOrderSnapshot {
  createdAt: string;
  payload: unknown;
}

const persistDemoOrder = (snapshot: DemoOrderSnapshot) => {
  try {
    const raw = safeLocalStorage.getItem('chatboc_demo_orders');
    const parsed = raw ? JSON.parse(raw) : [];
    const existing = Array.isArray(parsed) ? parsed : [];
    const next = [snapshot, ...existing].slice(0, 20);
    safeLocalStorage.setItem('chatboc_demo_orders', JSON.stringify(next));
  } catch (err) {
    console.warn('[ProductCheckoutPage] No se pudo guardar el pedido demo', err);
  }
};

export default function ProductCheckoutPage() {
  const navigate = useNavigate();
  const { user } = useUser(); // Hook para obtener datos del usuario logueado
  const { currentSlug } = useTenant();
  const effectiveTenantSlug = useMemo(
    () => currentSlug ?? user?.tenantSlug ?? safeLocalStorage.getItem('tenantSlug') ?? null,
    [currentSlug, user?.tenantSlug],
  );
  const {
    points: pointsBalance,
    isLoading: isLoadingPoints,
    refresh: refreshPointsBalance,
    adjustOptimistic: adjustPointsBalance,
  } = usePointsBalance({ enabled: !!user, tenantSlug: effectiveTenantSlug });

  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [isLoadingCart, setIsLoadingCart] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [orderPlaced, setOrderPlaced] = useState(false);
  const [showPointsAuthPrompt, setShowPointsAuthPrompt] = useState(false);
  const [checkoutMode, setCheckoutMode] = useState<'api' | 'local'>('api');
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [shippingCoords, setShippingCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [isLocating, setIsLocating] = useState(false);
  const guestDefaults = useMemo(() => loadGuestContact(), []);

  const handleViewOrders = useCallback(() => {
    const destination = '/portal/pedidos';
    if (user) {
      navigate(destination);
      return;
    }

    navigate('/user/login', {
      state: {
        redirectTo: destination,
      },
    });
  }, [navigate, user]);

  const catalogPath = buildTenantPath('/productos', effectiveTenantSlug);
  const cartPath = buildTenantPath('/cart', effectiveTenantSlug);
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
  const checkoutConfirmPath = useMemo(
    () => buildTenantApiPath('/checkout/confirmar', effectiveTenantSlug),
    [effectiveTenantSlug],
  );
  const checkoutPreferencePath = useMemo(
    () => buildTenantApiPath('/checkout/crear-preferencia', effectiveTenantSlug),
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

  const { control, handleSubmit, setValue, formState: { errors } } = useForm<CheckoutFormData>({
    resolver: zodResolver(checkoutSchema),
    defaultValues: {
      nombre: guestDefaults.nombre || '',
      email: guestDefaults.email || '',
      telefono: guestDefaults.telefono || '',
      direccion: '',
      referencias: '',
      notasEnvio: '',
      metodoEnvio: 'delivery',
      metodoPago: 'mercado_pago',
    }
  });

  // Pre-rellenar formulario si el usuario está logueado
  useEffect(() => {
    if (user) {
      setValue('nombre', user.name || '');
      setValue('email', user.email || '');
      setValue('telefono', user.telefono || '');
      // La dirección del perfil podría no ser la de envío, así que la dejamos opcional o para selección
    }
  }, [user, setValue]);

  const shouldUseLocalCart = (err: unknown) => {
    if (err instanceof ApiError) {
      if ([400, 401, 403, 405].includes(err.status)) return true;
      const errorCode = err.body?.code || err.body?.error_code || err.body?.errorCode;
      if (errorCode && String(errorCode).toLowerCase().includes('tenant')) return true;
    }
    return err instanceof NetworkError;
  };

  const loadLocalCart = useCallback(() => {
    const localItems = getLocalCartProducts();
    if (!localItems.length) {
      toast({
        title: 'Carrito demo vacío',
        description: 'Agregá productos para finalizar la simulación.',
        variant: 'destructive',
      });
      navigate(catalogPath);
      return false;
    }
    setCartItems(localItems);
    return true;
  }, [catalogPath, navigate]);

  // Cargar ítems del carrito
  useEffect(() => {
    const loadCart = async () => {
      setIsLoadingCart(true);
      setError(null);

      if (checkoutMode === 'local') {
        loadLocalCart();
        setIsLoadingCart(false);
        return;
      }

      if (!effectiveTenantSlug) {
        setCheckoutMode('local');
        loadLocalCart();
        setError('Selecciona un municipio o inicia sesión para finalizar tu compra.');
        setIsLoadingCart(false);
        return;
      }

      try {
        const [cartApiData, productsApiData] = await Promise.all([
          apiFetch<unknown>(cartApiPath, sharedRequestOptions),
          apiFetch<unknown>(productsApiPath, sharedRequestOptions),
        ]);

        const productMap = buildProductMap(normalizeProductsPayload(productsApiData, 'CheckoutPage'));

        const populatedCartItems: CartItem[] = normalizeCartPayload(cartApiData, 'CheckoutPage')
          .map(([productName, cantidad]) => {
            const productDetail = productMap[productName];
            return productDetail ? { ...productDetail, cantidad } : null;
          })
          .filter((item): item is CartItem => item !== null);

        if (populatedCartItems.length === 0) {
          toast({ title: "Carrito vacío", description: "No hay productos para finalizar la compra.", variant: "destructive" });
          navigate(catalogPath); // Redirigir si el carrito está vacío
        } else {
          setCartItems(populatedCartItems);
        }
      } catch (err) {
        if (shouldUseLocalCart(err)) {
          setCheckoutMode('local');
          loadLocalCart();
          setError(getErrorMessage(err, 'No se pudo cargar el carrito del servidor. Seguimos con el carrito local.'));
          return;
        }

        const errorMessage = getErrorMessage(err, 'No se pudo cargar tu carrito.');

        if (err instanceof ApiError && err.status === 400 && errorMessage.toLowerCase().includes('tenant')) {
           setCheckoutMode('local');
           loadLocalCart();
           return;
        }

        setError(errorMessage);
      } finally {
        setIsLoadingCart(false);
      }
    };
    loadCart();
  }, [catalogPath, cartApiPath, checkoutMode, effectiveTenantSlug, loadLocalCart, navigate, productsApiPath, sharedRequestOptions]);

  const subtotal = useMemo(() => {
    return cartItems.reduce((sum, item) => sum + (item.modalidad === 'puntos' || item.modalidad === 'donacion' ? 0 : item.precio_unitario * item.cantidad), 0);
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

  const missingPoints = useMemo(() => Math.max(pointsTotal - pointsBalance, 0), [pointsBalance, pointsTotal]);

  const hasDonations = useMemo(() => cartItems.some((item) => item.modalidad === 'donacion'), [cartItems]);
  const requiresAuthForPoints = useMemo(
    () => cartItems.some((item) => item.modalidad === 'puntos') && !user,
    [cartItems, user],
  );
  const hasPointsDeficit = checkoutMode !== 'local' && missingPoints > 0;
  const completionLabel = useMemo(
    () => (hasDonations ? 'donación' : pointsTotal > 0 ? 'canje' : 'compra'),
    [hasDonations, pointsTotal],
  );

  const applyPointsAdjustments = useCallback(async () => {
    if (pointsTotal <= 0) return;

    adjustPointsBalance(-pointsTotal);
    try {
      await refreshPointsBalance();
    } catch (err) {
      console.warn('[ProductCheckoutPage] No se pudo refrescar el saldo de puntos después de la operación', err);
    }
  }, [adjustPointsBalance, pointsTotal, refreshPointsBalance]);

  const onSubmit = async (data: CheckoutFormData) => {
    setIsSubmitting(true);
    setError(null);
    setCheckoutError(null);
    saveGuestContact({ nombre: data.nombre, email: data.email, telefono: data.telefono });

    const pedidoData = {
      cliente: {
        nombre: data.nombre,
        email: data.email,
        telefono: data.telefono,
        direccion_envio: data.direccion,
        referencias_envio: data.referencias,
      },
      envio: {
        metodo: data.metodoEnvio,
        direccion: data.direccion,
        referencias: data.referencias,
        notas: data.notasEnvio,
        coordenadas: shippingCoords ?? undefined,
      },
      items: cartItems.map(item => ({
        producto_id: item.id, // Asumiendo que el backend prefiere ID
        nombre_producto: item.nombre, // Enviar nombre por si ID no está en backend aún
        cantidad: item.cantidad,
        precio_unitario: item.precio_unitario,
        modalidad: item.modalidad ?? 'venta',
        precio_puntos: item.precio_puntos ?? undefined,
      })),
      totales: {
        dinero: subtotal,
        puntos: pointsTotal,
      },
      metodo_pago: data.metodoPago,
      // En el futuro: metodo_pago, metodo_envio, notas, etc.
      estado: 'pendiente_confirmacion', // Estado inicial del pedido
    };

    try {
      if (requiresAuthForPoints) {
        const warning = 'Inicia sesión para canjear tus puntos.';
        setCheckoutError(warning);
        toast({ title: 'Necesitas iniciar sesión', description: warning, variant: 'destructive' });
        setIsSubmitting(false);
        return;
      }

      if (hasPointsDeficit) {
        const warning = missingPoints
          ? `Te faltan ${missingPoints} puntos para completar el canje.`
          : 'No tienes puntos suficientes para completar el canje.';
        setCheckoutError(warning);
        setIsSubmitting(false);
        return;
      }

      if (checkoutMode === 'local') {
        persistDemoOrder({ payload: { ...pedidoData, modo: 'demo' }, createdAt: new Date().toISOString() });
        clearLocalCart();
        setCartItems([]);
        setOrderPlaced(true);
        await applyPointsAdjustments();
        toast({
          title: 'Simulación registrada',
          description: 'Guardamos tu pedido demo en este navegador.',
          className: 'bg-green-600 text-white',
        });
        return;
      }

      const shouldSkipMp = data.metodoPago === 'acordar';

      if (subtotal === 0 || shouldSkipMp) {
        await apiFetch(checkoutConfirmPath, {
          ...sharedRequestOptions,
          method: 'POST',
          body: pedidoData,
        });
        setOrderPlaced(true);
        await applyPointsAdjustments();
        toast({
          title: 'Pedido confirmado',
          description: shouldSkipMp
            ? 'Registramos tu pedido. Coordinaremos el pago con el vendedor.'
            : hasDonations
              ? 'Registramos tus donaciones. Recibirás instrucciones de entrega.'
              : 'Registramos tu canje de puntos.',
          className: 'bg-green-600 text-white',
        });
        return;
      }

      const preference = await apiFetch<{ init_point?: string; sandbox_init_point?: string; pedido_id?: string | number }>(
        checkoutPreferencePath,
        {
          ...sharedRequestOptions,
          method: 'POST',
          body: pedidoData,
        },
      );

      const estado = typeof preference === 'object' ? (preference as any)?.estado : undefined;
      if (estado && String(estado).toLowerCase() === 'confirmado') {
        setOrderPlaced(true);
        toast({
          title: 'Pedido confirmado',
          description: hasDonations
            ? 'Registramos tus donaciones sin necesidad de pago adicional.'
            : 'Registramos tu canje de puntos. No necesitas pasar por Mercado Pago.',
          className: 'bg-green-600 text-white',
        });
        return;
      }

      const initPoint = preference?.init_point || preference?.sandbox_init_point;
      if (initPoint) {
        window.location.href = initPoint;
        return;
      }

      setOrderPlaced(true); // fallback si no hay redirección
      toast({
        title: 'Pedido registrado',
        description: `Guardamos tu ${completionLabel}. Te avisaremos por email si faltan pasos para el pago.`,
        className: 'bg-green-600 text-white',
      });

      // await apiFetch('/carrito/vaciar', { method: 'DELETE' }); // Endpoint para vaciar carrito en backend (opcional)
      // O el backend podría vaciar el carrito al crear el pedido.
      // Por ahora, el usuario puede volver al carrito y verlo vacío o la página de catálogo.

    } catch (err) {
      if (err instanceof ApiError) {
        const code = err.body?.code || err.body?.error_code || err.body?.errorCode;
        if (err.status === 401 && code === 'REQUIERE_LOGIN_PUNTOS') {
          const message = 'Para usar tus puntos tenés que iniciar sesión o registrarte.';
          setCheckoutError(message);
          toast({ title: 'Inicia sesión para usar puntos', description: message, variant: 'destructive' });
          setShowPointsAuthPrompt(true);
          setIsSubmitting(false);
          return;
        }
        if (err.status === 400 && code === 'SALDO_INSUFICIENTE') {
          const faltan = err.body?.faltan ?? missingPoints;
          const message = faltan
            ? `Te faltan ${faltan} puntos para completar este canje.`
            : 'No tienes puntos suficientes para completar este canje.';
          setCheckoutError(message);
          setError(message);
          toast({ title: 'Saldo insuficiente', description: message, variant: 'destructive' });
          setIsSubmitting(false);
          return;
        }
      }

      const message = getErrorMessage(err, "No se pudo procesar tu pedido. Intenta nuevamente.");
      setError(message);
      setCheckoutError(message);
      toast({ title: "Error al procesar pedido", description: message, variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (orderPlaced) {
    const demoSuccess = checkoutMode === 'local';
    return (
      <div className="container mx-auto p-4 md:p-8 flex flex-col items-center justify-center min-h-[calc(100vh-200px)] text-center">
        <CheckCircle className="h-16 w-16 text-green-500 mb-6" />
        <h1 className="text-3xl font-bold text-foreground mb-3">
          {demoSuccess ? '¡Pedido demo guardado!' : '¡Gracias por tu compra!'}
        </h1>
        <p className="text-lg text-muted-foreground mb-8">
          {demoSuccess
            ? 'Tu simulación quedó registrada en este navegador para mostrar el flujo completo.'
            : `Tu ${completionLabel} fue recibido y está siendo procesado.`}
        </p>
        <div className="flex gap-4">
          <Button onClick={() => navigate(catalogPath)}>Seguir Comprando</Button>
          <Button variant="outline" onClick={handleViewOrders}>Ver Mis Pedidos</Button>
        </div>
      </div>
    );
  }


  const isDemoMode = checkoutMode === 'local';

  if (isLoadingCart) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-200px)]">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="mt-4 text-muted-foreground">Cargando información del checkout...</p>
      </div>
    );
  }

  if (error && !cartItems.length) { // Si hay error y no se cargó el carrito
    return (
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-200px)] text-destructive">
        <AlertTriangle className="h-12 w-12 mb-4" />
        <p className="text-lg font-semibold">Error al cargar el Checkout</p>
        <p className="mb-4">{error}</p>
        <Button onClick={() => window.location.reload()}>Reintentar</Button>
      </div>
    );
  }

  const pointsAuthDialog = (
    <Dialog open={showPointsAuthPrompt} onOpenChange={setShowPointsAuthPrompt}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Para usar tus puntos tenés que iniciar sesión</DialogTitle>
          <DialogDescription>
            Inicia sesión o regístrate para aplicar tus puntos al pedido. Te llevaremos a la pantalla correspondiente y
            podrás volver para finalizar el checkout.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="flex flex-col sm:flex-row sm:justify-end gap-2">
          <Button variant="outline" onClick={() => navigate(registerPath)}>Registrarme</Button>
          <Button onClick={() => navigate(loginPath)}>Iniciar sesión</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );


  return (
    <div className="container mx-auto p-4 md:p-8">
      {pointsAuthDialog}
      <Button variant="outline" onClick={() => navigate(cartPath)} className="mb-6">
        <ArrowLeft className="mr-2 h-4 w-4" /> Volver al Carrito
      </Button>
      <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-4">Finalizar Compra</h1>

      {!user && (
        <Alert className="mb-6">
          <AlertTitle>Completa tus datos</AlertTitle>
          <AlertDescription>
            Necesitamos nombre, email y teléfono para confirmar tu {completionLabel}. Si quieres sumar puntos más adelante, inicia sesión.
          </AlertDescription>
        </Alert>
      )}

      {isDemoMode && (
        <Alert className="mb-8">
          <AlertTitle>Checkout en modo demo</AlertTitle>
          <AlertDescription>
            Los pedidos se guardan localmente para mostrar el flujo completo sin requerir credenciales del backend.
          </AlertDescription>
        </Alert>
      )}

      {hasPointsDeficit && (
        <Alert variant="destructive" className="mb-6">
          <AlertTitle>Saldo de puntos insuficiente</AlertTitle>
          <AlertDescription>
            Necesitas {pointsTotal} pts pero tu saldo actual es {pointsBalance} pts. Te faltan {missingPoints} pts para confirmar este pedido.
          </AlertDescription>
        </Alert>
      )}
      {requiresAuthForPoints && !hasPointsDeficit && (
        <Alert variant="destructive" className="mb-6">
          <AlertTitle>Inicia sesión para canjear puntos</AlertTitle>
          <AlertDescription>
            Necesitamos asociar tus puntos a tu cuenta antes de confirmar este pedido. Inicia sesión y vuelve a intentar.
          </AlertDescription>
        </Alert>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader><CardTitle>1. Información de Contacto y Envío</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="nombre">Nombre Completo</Label>
                <Controller name="nombre" control={control} render={({ field }) => <Input id="nombre" {...field} />} />
                {errors.nombre && <p className="text-sm text-destructive mt-1">{errors.nombre.message}</p>}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="email">Email</Label>
                  <Controller name="email" control={control} render={({ field }) => <Input id="email" type="email" {...field} />} />
                  {errors.email && <p className="text-sm text-destructive mt-1">{errors.email.message}</p>}
                </div>
                <div>
                  <Label htmlFor="telefono">Teléfono</Label>
                  <Controller name="telefono" control={control} render={({ field }) => <Input id="telefono" {...field} />} />
                  {errors.telefono && <p className="text-sm text-destructive mt-1">{errors.telefono.message}</p>}
                </div>
              </div>
              <div>
                <Label htmlFor="direccion">Dirección de Envío</Label>
                <Controller
                  name="direccion"
                  control={control}
                  render={({ field }) => (
                    <AddressAutocomplete
                      onSelect={(address) => field.onChange(address)}
                      initialValue={field.value} // Para que se muestre si ya hay un valor
                      placeholder="Ingresa tu dirección completa"
                    />
                  )}
                />
                {errors.direccion && <p className="text-sm text-destructive mt-1">{errors.direccion.message}</p>}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="referencias">Referencias para entregar</Label>
                  <Controller
                    name="referencias"
                    control={control}
                    render={({ field }) => (
                      <Input
                        id="referencias"
                        {...field}
                        placeholder="Piso, timbre o punto de referencia"
                      />
                    )}
                  />
                </div>
                <div>
                  <Label htmlFor="notasEnvio">Notas para el repartidor</Label>
                  <Controller
                    name="notasEnvio"
                    control={control}
                    render={({ field }) => (
                      <Input
                        id="notasEnvio"
                        {...field}
                        placeholder="Accesos, horarios, etc."
                      />
                    )}
                  />
                </div>
              </div>
              <div className="flex flex-col gap-2">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                  <Label>Ubicación en el mapa</Label>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      if (!navigator.geolocation) {
                        toast({ title: 'Ubicación no disponible', description: 'Tu navegador no permite obtener la ubicación.', variant: 'destructive' });
                        return;
                      }
                      setIsLocating(true);
                      navigator.geolocation.getCurrentPosition(
                        (pos) => {
                          setIsLocating(false);
                          setShippingCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
                        },
                        (err) => {
                          console.warn('[Checkout] Geolocation error', err);
                          setIsLocating(false);
                          toast({ title: 'No pudimos leer tu ubicación', description: 'Ingresá la dirección manualmente.', variant: 'destructive' });
                        },
                        { enableHighAccuracy: true, timeout: 8000 }
                      );
                    }}
                  >
                    {isLocating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    {isLocating ? 'Obteniendo ubicación...' : 'Usar mi ubicación'}
                  </Button>
                </div>
                {shippingCoords ? (
                  <p className="text-sm text-muted-foreground">
                    Guardaremos las coordenadas para el envío ({shippingCoords.lat.toFixed(5)}, {shippingCoords.lng.toFixed(5)}).
                    {` `}
                    <a
                      className="text-primary underline"
                      href={`https://www.google.com/maps/search/?api=1&query=${shippingCoords.lat},${shippingCoords.lng}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Ver en Google Maps
                    </a>
                  </p>
                ) : (
                  <p className="text-sm text-muted-foreground">Podés adjuntar tu ubicación para agilizar la entrega.</p>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>2. Método de Envío</CardTitle></CardHeader>
            <CardContent>
              <div className="space-y-3">
                <Controller
                  name="metodoEnvio"
                  control={control}
                  render={({ field }) => (
                    <div className="space-y-2">
                      <label className="flex items-center gap-3 cursor-pointer">
                        <input
                          type="radio"
                          value="delivery"
                          checked={field.value === 'delivery'}
                          onChange={() => field.onChange('delivery')}
                        />
                        <div>
                          <p className="font-medium">Envío a domicilio</p>
                          <p className="text-sm text-muted-foreground">Coordinamos la entrega con los datos ingresados.</p>
                        </div>
                      </label>
                      <label className="flex items-center gap-3 cursor-pointer">
                        <input
                          type="radio"
                          value="pickup"
                          checked={field.value === 'pickup'}
                          onChange={() => field.onChange('pickup')}
                        />
                        <div>
                          <p className="font-medium">Retiro en punto de entrega</p>
                          <p className="text-sm text-muted-foreground">Te enviaremos la dirección y horario para retirar.</p>
                        </div>
                      </label>
                    </div>
                  )}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>3. Método de Pago</CardTitle></CardHeader>
            <CardContent>
              <div className="space-y-3">
                <Controller
                  name="metodoPago"
                  control={control}
                  render={({ field }) => (
                    <div className="space-y-2">
                      <label className="flex items-center gap-3 cursor-pointer">
                        <input
                          type="radio"
                          value="mercado_pago"
                          checked={field.value === 'mercado_pago'}
                          onChange={() => field.onChange('mercado_pago')}
                        />
                        <div>
                          <p className="font-medium">Mercado Pago (recomendado)</p>
                          <p className="text-sm text-muted-foreground">Al confirmar te redirigimos para completar el pago seguro.</p>
                        </div>
                      </label>
                      <label className="flex items-center gap-3 cursor-pointer">
                        <input
                          type="radio"
                          value="acordar"
                          checked={field.value === 'acordar'}
                          onChange={() => field.onChange('acordar')}
                        />
                        <div>
                          <p className="font-medium">Acordar con el vendedor</p>
                          <p className="text-sm text-muted-foreground">Registramos el pedido y coordinamos el pago por otro medio.</p>
                        </div>
                      </label>
                    </div>
                  )}
                />
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-1">
          <Card className="sticky top-24 shadow-lg">
            <CardHeader><CardTitle>Resumen del Pedido</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {cartItems.map(item => (
                <div key={item.id || item.nombre} className="flex justify-between items-center text-sm">
                  <div className="flex-1">
                    <p className="font-medium text-foreground">{item.nombre} <span className="text-xs text-muted-foreground">x{item.cantidad}</span></p>
                    {item.presentacion && <p className="text-xs text-muted-foreground">{item.presentacion}</p>}
                  </div>
                  <span className="font-medium text-foreground">
                    {item.modalidad === 'puntos'
                      ? `${(item.precio_puntos ?? item.precio_unitario ?? 0) * item.cantidad} pts`
                      : item.modalidad === 'donacion'
                        ? 'Donación'
                        : formatCurrency(item.precio_unitario * item.cantidad)}
                  </span>
                </div>
              ))}
              <Separator />
              <div className="flex justify-between text-sm text-muted-foreground">
                <span>Total en puntos</span>
                <span>{pointsTotal} pts</span>
              </div>
              <div className="flex justify-between text-sm text-muted-foreground">
                <span>Total en dinero</span>
                <span>{formatCurrency(subtotal)}</span>
              </div>
              {hasDonations && <p className="text-sm text-muted-foreground">Incluye donaciones sin costo monetario.</p>}
              {checkoutError && <p className="text-sm text-destructive mt-2">{checkoutError}</p>}
              {error && <p className="text-sm text-destructive mt-2">{error}</p>}
            </CardContent>
            <CardFooter>
              <Button type="submit" size="lg" className="w-full" disabled={isSubmitting || isLoadingCart || cartItems.length === 0 || hasPointsDeficit || requiresAuthForPoints}>
                {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                {isSubmitting ? 'Procesando Pedido...' : 'Confirmar Pedido'}
              </Button>
            </CardFooter>
          </Card>
        </div>
      </form>
    </div>
  );
}
