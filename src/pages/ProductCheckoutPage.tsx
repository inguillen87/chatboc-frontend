import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { motion } from 'framer-motion';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import AddressAutocomplete from '@/components/ui/AddressAutocomplete';
import { Loader2, AlertTriangle, ArrowLeft, CheckCircle, CreditCard, MapPin, User, Check } from 'lucide-react';
import { toast } from '@/components/ui/use-toast';

import { ApiError, NetworkError, getErrorMessage } from '@/utils/api';
import { useUser } from '@/hooks/useUser';
import { ProductDetails } from '@/components/product/ProductCard';
import { formatCurrency } from '@/utils/currency';
import { useTenant } from '@/context/TenantContext';
import { safeLocalStorage } from '@/utils/safeLocalStorage';
import { getLocalCartProducts, clearLocalCart } from '@/utils/localCart';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import usePointsBalance from '@/hooks/usePointsBalance';
import { buildTenantPath } from '@/utils/tenantPaths';
import { loadGuestContact, saveGuestContact } from '@/utils/guestContact';
import { fetchMarketCart, startMarketCheckout } from '@/api/market';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

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

const fadeInUp = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5 } }
};

const staggerContainer = {
  hidden: { opacity: 1 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1
    }
  }
};

export default function ProductCheckoutPage() {
  const navigate = useNavigate();
  const { user } = useUser();
  const { currentSlug } = useTenant();

  const effectiveTenantSlug = useMemo(
    () => currentSlug ?? user?.tenantSlug ?? safeLocalStorage.getItem('tenantSlug') ?? null,
    [currentSlug, user?.tenantSlug],
  );

  const {
    points: pointsBalance,
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

  const catalogPath = buildTenantPath('/productos', effectiveTenantSlug);
  const cartPath = buildTenantPath('/cart', effectiveTenantSlug);
  const loginPath = buildTenantPath('/user/login', effectiveTenantSlug);
  const registerPath = buildTenantPath('/user/register', effectiveTenantSlug);
  const portalOrdersPath = buildTenantPath('/portal/pedidos', effectiveTenantSlug);

  const {
    control,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<CheckoutFormData>({
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

  useEffect(() => {
    if (user) {
      setValue('nombre', user.name || '');
      setValue('email', user.email || '');
      setValue('telefono', user.telefono || '');
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
        title: 'Carrito vacío',
        description: 'Agregá productos para finalizar la simulación.',
        variant: 'destructive',
      });
      navigate(catalogPath);
      return false;
    }
    setCartItems(localItems);
    return true;
  }, [catalogPath, navigate]);

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
        const cartData = await fetchMarketCart(effectiveTenantSlug);

        if (!cartData.items || cartData.items.length === 0) {
          // Fallback: If API returns empty but we have local items, rely on local items
          const localItems = getLocalCartProducts();
          if (localItems.length > 0) {
             setCheckoutMode('local');
             setCartItems(localItems);
             setIsLoadingCart(false);
             return;
          }

          toast({
            title: 'Carrito vacío',
            description: 'No hay productos para finalizar la compra.',
            variant: 'destructive',
          });
          navigate(catalogPath);
        } else {
          // Map MarketCartItem to component's CartItem (ProductDetails + cantidad)
          // We need to map the fields correctly as MarketCartItem uses 'price' not 'precio_unitario'
          const mappedItems: CartItem[] = cartData.items.map(item => ({
            id: item.id,
            nombre: item.name,
            descripcion: item.description ?? undefined,
            precio_unitario: item.price ?? 0,
            precio_puntos: item.points ?? 0,
            modalidad: item.modality ?? 'venta',
            imageUrl: item.imageUrl ?? undefined,
            cantidad: item.quantity,
            // Add other fields required by ProductDetails if necessary, defaulting if missing
            category: item.category ?? undefined,
          }));
          setCartItems(mappedItems);
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
  }, [
    catalogPath,
    checkoutMode,
    effectiveTenantSlug,
    loadLocalCart,
    navigate,
  ]);

  const subtotal = useMemo(() => {
    return cartItems.reduce(
      (sum, item) =>
        sum +
        (item.modalidad === 'puntos' || item.modalidad === 'donacion'
          ? 0
          : item.precio_unitario * item.cantidad),
      0,
    );
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

  const missingPoints = useMemo(
    () => Math.max(pointsTotal - pointsBalance, 0),
    [pointsBalance, pointsTotal],
  );

  const hasDonations = useMemo(
    () => cartItems.some((item) => item.modalidad === 'donacion'),
    [cartItems],
  );

  const requiresAuthForPoints = useMemo(
    () => cartItems.some((item) => item.modalidad === 'puntos') && !user && checkoutMode !== 'local',
    [cartItems, user, checkoutMode],
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
      console.warn('[ProductCheckoutPage] No se pudo refrescar el saldo de puntos', err);
    }
  }, [adjustPointsBalance, pointsTotal, refreshPointsBalance]);

  const onSubmit = async (data: CheckoutFormData) => {
    setIsSubmitting(true);
    setError(null);
    setCheckoutError(null);
    saveGuestContact({
      nombre: data.nombre,
      email: data.email,
      telefono: data.telefono,
    });

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
      items: cartItems.map((item) => ({
        producto_id: item.id,
        nombre_producto: item.nombre,
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
      estado: 'pendiente_confirmacion',
    };

    try {
      if (requiresAuthForPoints) {
        const warning = 'Inicia sesión para canjear tus puntos.';
        setCheckoutError(warning);
        setIsSubmitting(false);
        return;
      }

      if (hasPointsDeficit) {
        setCheckoutError('No tienes puntos suficientes.');
        setIsSubmitting(false);
        return;
      }

      if (checkoutMode === 'local') {
        persistDemoOrder({
          payload: { ...pedidoData, modo: 'demo' },
          createdAt: new Date().toISOString(),
        });
        clearLocalCart();
        setCartItems([]);
        setOrderPlaced(true);
        return;
      }

      const shouldSkipMp = data.metodoPago === 'acordar';

      if (!effectiveTenantSlug) throw new Error("Falta el ID del comercio");

      const response = await startMarketCheckout(effectiveTenantSlug, {
        ...pedidoData,
        items: cartItems.map(item => ({
          productId: item.id,
          quantity: item.cantidad
        })),
        customer: {
          ...pedidoData.cliente,
          name: pedidoData.cliente.nombre,
          phone: pedidoData.cliente.telefono
        },
        shipping: {
          method: pedidoData.envio.metodo,
          address: pedidoData.envio.direccion,
          notes: pedidoData.envio.notas,
          coordinates: pedidoData.envio.coordenadas
        },
        payment: {
          method: pedidoData.metodo_pago
        }
      });

      if (response.status === 'confirmed' || response.status === 'demo') {
        setOrderPlaced(true);
        await applyPointsAdjustments();
      } else if (response.paymentUrl) {
         window.location.href = response.paymentUrl;
      } else {
         // Fallback if status is unknown but no error thrown
         setOrderPlaced(true);
      }
    } catch (err) {
      if (err instanceof ApiError) {
        const code = err.body?.code || err.body?.error_code || err.body?.errorCode;
        if (err.status === 401 && code === 'REQUIERE_LOGIN_PUNTOS') {
          setShowPointsAuthPrompt(true);
          setIsSubmitting(false);
          return;
        }
        if (err.status === 400 && code === 'SALDO_INSUFICIENTE') {
          setCheckoutError('Saldo insuficiente de puntos.');
          setIsSubmitting(false);
          return;
        }
      }
      const message = getErrorMessage(err, 'No se pudo procesar tu pedido.');
      setCheckoutError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const isDemoMode = checkoutMode === 'local';

  // Lifecycle Redirect Logic
  const handleViewOrders = useCallback(() => {
    // If logged in, go to Portal Orders
    if (user) {
      navigate(portalOrdersPath);
      return;
    }
    // If guest, go to Login (then to Portal Orders)
    // Pass 'portal' context to login page via state if needed
    navigate(loginPath, { state: { redirectTo: portalOrdersPath } });
  }, [navigate, user, portalOrdersPath, loginPath]);

  const handleContinueShopping = useCallback(() => {
    // Navigate to Portal Catalog if possible, else just Catalog
    navigate(buildTenantPath('/portal/catalogo', effectiveTenantSlug) || catalogPath);
  }, [navigate, effectiveTenantSlug, catalogPath]);


  if (orderPlaced) {
    const demoSuccess = checkoutMode === 'local';
    return (
      <div className="container mx-auto p-4 md:p-8 flex flex-col items-center justify-center min-h-[calc(100vh-200px)] text-center">
        <motion.div
            initial={{ scale: 0, rotate: -45 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: "spring", stiffness: 260, damping: 20 }}
            className="mb-8"
        >
            <div className="bg-green-100 dark:bg-green-900/30 p-6 rounded-full inline-block">
                <CheckCircle className="h-20 w-20 text-green-600 dark:text-green-500" />
            </div>
        </motion.div>

        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
        >
            <h1 className="text-4xl font-extrabold text-foreground mb-4 tracking-tight">
            {demoSuccess ? '¡Pedido Demo Guardado!' : '¡Excelente!'}
            </h1>
            <p className="text-xl text-muted-foreground mb-10 max-w-lg mx-auto">
            {demoSuccess
                ? 'La simulación se registró con éxito en este navegador. Regístrate o inicia sesión para verlo en tu portal.'
                : `Hemos recibido tu ${completionLabel}. Te enviamos los detalles a tu correo.`}
            </p>

            <div className="flex flex-col gap-4 sm:flex-row justify-center items-center">
                {!user ? (
                   <>
                     {/* Prioritize direct portal access for demos to avoid friction */}
                     <Button size="lg" className="w-full sm:w-auto shadow-lg bg-primary hover:bg-primary/90" onClick={handleViewOrders}>
                        Ver pedido en el Portal
                     </Button>
                     <Button size="lg" variant="outline" className="w-full sm:w-auto" onClick={() => navigate(registerPath, { state: { redirectTo: portalOrdersPath } })}>
                        Crear cuenta para seguimiento
                     </Button>
                   </>
                ) : (
                    <Button size="lg" className="w-full sm:w-auto shadow-lg" onClick={handleViewOrders}>
                        Ir a mis Pedidos
                    </Button>
                )}
                 <Button size="lg" variant="ghost" onClick={handleContinueShopping}>
                    Volver al inicio
                 </Button>
            </div>
        </motion.div>
      </div>
    );
  }

  if (isLoadingCart) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-200px)] animate-pulse">
        <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
        <p className="text-lg font-medium text-muted-foreground">Preprando checkout...</p>
      </div>
    );
  }

  if (error && !cartItems.length) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-200px)] text-destructive">
        <AlertTriangle className="h-12 w-12 mb-4" />
        <p className="text-lg font-semibold mb-4">{error}</p>
        <Button onClick={() => window.location.reload()}>Reintentar</Button>
      </div>
    );
  }

  return (
    <motion.div
        initial="hidden"
        animate="visible"
        variants={staggerContainer}
        className="container mx-auto p-4 md:p-8 max-w-6xl"
    >
      <Dialog open={showPointsAuthPrompt} onOpenChange={setShowPointsAuthPrompt}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Inicia sesión para canjear</DialogTitle>
            <DialogDescription>
              Tus puntos están seguros. Solo necesitamos verificar tu cuenta.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex flex-col sm:flex-row sm:justify-end gap-2">
            <Button variant="outline" onClick={() => navigate(registerPath)}>Registrarme</Button>
            <Button onClick={() => navigate(loginPath)}>Iniciar sesión</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <motion.div variants={fadeInUp} className="mb-6 flex items-center justify-between">
         <Button variant="ghost" onClick={() => navigate(cartPath)}>
            <ArrowLeft className="mr-2 h-4 w-4" /> Volver al Carrito
         </Button>
         <div className="hidden sm:block text-sm text-muted-foreground">Paso final</div>
      </motion.div>

      <motion.h1 variants={fadeInUp} className="text-3xl md:text-4xl font-extrabold text-foreground mb-8">
        Finalizar Compra
      </motion.h1>

      <form onSubmit={handleSubmit(onSubmit)} className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          <motion.div variants={fadeInUp}>
            <Card className="border-l-4 border-l-primary shadow-sm">
                <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-3">
                    <div className="bg-primary/10 p-2 rounded-full"><User className="h-5 w-5 text-primary" /></div>
                    Información de Contacto
                </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                <div>
                    <Label htmlFor="nombre">Nombre Completo</Label>
                    <Controller name="nombre" control={control} render={({ field }) => <Input id="nombre" {...field} className="mt-1.5" />} />
                    {errors.nombre && <p className="text-sm text-destructive mt-1">{errors.nombre.message}</p>}
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                    <Label htmlFor="email">Email</Label>
                    <Controller name="email" control={control} render={({ field }) => <Input id="email" type="email" {...field} className="mt-1.5" />} />
                    {errors.email && <p className="text-sm text-destructive mt-1">{errors.email.message}</p>}
                    </div>
                    <div>
                    <Label htmlFor="telefono">Teléfono</Label>
                    <Controller name="telefono" control={control} render={({ field }) => <Input id="telefono" {...field} className="mt-1.5" />} />
                    {errors.telefono && <p className="text-sm text-destructive mt-1">{errors.telefono.message}</p>}
                    </div>
                </div>
                </CardContent>
            </Card>
          </motion.div>

          <motion.div variants={fadeInUp}>
            <Card className="border-l-4 border-l-blue-500 shadow-sm">
                <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-3">
                    <div className="bg-blue-500/10 p-2 rounded-full"><MapPin className="h-5 w-5 text-blue-600" /></div>
                    Entrega
                </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                 <div>
                    <Label htmlFor="direccion">Dirección de Envío</Label>
                    <Controller
                    name="direccion"
                    control={control}
                    render={({ field }) => (
                        <AddressAutocomplete
                        onSelect={(address) => field.onChange(address)}
                        initialValue={field.value}
                        placeholder="Calle, número, localidad..."
                        />
                    )}
                    />
                    {errors.direccion && <p className="text-sm text-destructive mt-1">{errors.direccion.message}</p>}
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                     <div>
                     <Label>Referencias</Label>
                     <Controller name="referencias" control={control} render={({ field }) => <Input {...field} placeholder="Piso 2, puerta roja..." className="mt-1.5" />} />
                     </div>
                     <div>
                     <Label>Notas</Label>
                     <Controller name="notasEnvio" control={control} render={({ field }) => <Input {...field} placeholder="Entregar por la tarde..." className="mt-1.5" />} />
                     </div>
                </div>

                 <div className="pt-2">
                     <Label className="mb-2 block">Opciones de Entrega</Label>
                     <Controller
                        name="metodoEnvio"
                        control={control}
                        render={({ field }) => (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <label className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-all ${field.value === 'delivery' ? 'border-primary bg-primary/5 ring-1 ring-primary' : 'hover:bg-muted'}`}>
                                    <input type="radio" className="mt-1" value="delivery" checked={field.value === 'delivery'} onChange={() => field.onChange('delivery')} />
                                    <div>
                                        <span className="font-semibold block">Envío a Domicilio</span>
                                        <span className="text-xs text-muted-foreground">Te lo llevamos a la puerta.</span>
                                    </div>
                                </label>
                                <label className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-all ${field.value === 'pickup' ? 'border-primary bg-primary/5 ring-1 ring-primary' : 'hover:bg-muted'}`}>
                                    <input type="radio" className="mt-1" value="pickup" checked={field.value === 'pickup'} onChange={() => field.onChange('pickup')} />
                                    <div>
                                        <span className="font-semibold block">Retiro en Local</span>
                                        <span className="text-xs text-muted-foreground">Pasa a buscarlo cuando quieras.</span>
                                    </div>
                                </label>
                            </div>
                        )}
                     />
                 </div>

                 <div className="flex justify-end pt-2">
                    <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="text-xs"
                        onClick={() => {
                            if (!navigator.geolocation) return;
                            setIsLocating(true);
                            navigator.geolocation.getCurrentPosition(
                            (pos) => { setIsLocating(false); setShippingCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude }); },
                            () => { setIsLocating(false); toast({ title: 'Error', description: 'No pudimos leer tu ubicación', variant: 'destructive' }); }
                            );
                        }}
                    >
                        {isLocating ? <Loader2 className="mr-2 h-3 w-3 animate-spin" /> : <MapPin className="mr-2 h-3 w-3" />}
                        {shippingCoords ? 'Ubicación Guardada' : 'Adjuntar mi ubicación actual'}
                    </Button>
                 </div>
                </CardContent>
            </Card>
          </motion.div>

          <motion.div variants={fadeInUp}>
            <Card className="border-l-4 border-l-green-500 shadow-sm">
                <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-3">
                    <div className="bg-green-500/10 p-2 rounded-full"><CreditCard className="h-5 w-5 text-green-600" /></div>
                    Pago
                </CardTitle>
                </CardHeader>
                <CardContent>
                    <Controller
                    name="metodoPago"
                    control={control}
                    render={({ field }) => (
                        <div className="space-y-3">
                             <label className={`flex items-center gap-3 p-4 rounded-lg border cursor-pointer transition-all ${field.value === 'mercado_pago' ? 'border-green-500 bg-green-50 dark:bg-green-900/20' : 'hover:bg-muted'}`}>
                                <div className="flex items-center justify-center h-5 w-5 rounded-full border border-primary shrink-0">
                                     {field.value === 'mercado_pago' && <div className="h-3 w-3 rounded-full bg-primary" />}
                                </div>
                                <input type="radio" className="hidden" value="mercado_pago" checked={field.value === 'mercado_pago'} onChange={() => field.onChange('mercado_pago')} />
                                <div className="flex-1">
                                    <span className="font-semibold block text-base">Mercado Pago</span>
                                    <span className="text-sm text-muted-foreground">Tarjetas, efectivo y dinero en cuenta.</span>
                                </div>
                                <img src="https://logotipoz.com/wp-content/uploads/2021/10/version-horizontal-large-logo-mercado-pago.webp" alt="MP" className="h-6 object-contain opacity-80" />
                            </label>

                             <label className={`flex items-center gap-3 p-4 rounded-lg border cursor-pointer transition-all ${field.value === 'acordar' ? 'border-green-500 bg-green-50 dark:bg-green-900/20' : 'hover:bg-muted'}`}>
                                <div className="flex items-center justify-center h-5 w-5 rounded-full border border-primary shrink-0">
                                     {field.value === 'acordar' && <div className="h-3 w-3 rounded-full bg-primary" />}
                                </div>
                                <input type="radio" className="hidden" value="acordar" checked={field.value === 'acordar'} onChange={() => field.onChange('acordar')} />
                                <div>
                                    <span className="font-semibold block text-base">Acordar con el vendedor</span>
                                    <span className="text-sm text-muted-foreground">Transferencia o efectivo al retirar.</span>
                                </div>
                            </label>
                        </div>
                    )}
                    />
                </CardContent>
            </Card>
          </motion.div>
        </div>

        <motion.div variants={fadeInUp} className="lg:col-span-1">
          <div className="sticky top-24 space-y-4">
             <Card className="shadow-lg border-primary/20 overflow-hidden">
                <div className="bg-muted/50 p-4 border-b">
                    <h3 className="font-bold text-lg">Tu Pedido</h3>
                </div>
                <CardContent className="p-0">
                    <div className="max-h-[300px] overflow-y-auto p-4 space-y-3">
                        {cartItems.map((item) => (
                            <div key={item.id || item.nombre} className="flex justify-between items-start text-sm group">
                                <div>
                                    <p className="font-medium">{item.nombre}</p>
                                    <p className="text-xs text-muted-foreground">Cant: {item.cantidad}</p>
                                </div>
                                <span className="font-medium whitespace-nowrap">
                                     {item.modalidad === 'puntos' ? `${(item.precio_puntos ?? 0) * item.cantidad} pts` : formatCurrency(item.precio_unitario * item.cantidad)}
                                </span>
                            </div>
                        ))}
                    </div>
                    <Separator />
                    <div className="p-4 space-y-2 bg-muted/20">
                         <div className="flex justify-between text-sm">
                            <span>Subtotal</span>
                            <span>{formatCurrency(subtotal)}</span>
                         </div>
                         {pointsTotal > 0 && (
                             <div className="flex justify-between text-sm text-primary font-medium">
                                <span>Puntos</span>
                                <span>{pointsTotal} pts</span>
                             </div>
                         )}
                         <Separator className="my-2" />
                         <div className="flex justify-between text-lg font-bold">
                            <span>Total</span>
                            <span>{formatCurrency(subtotal)}</span>
                         </div>
                    </div>
                </CardContent>
                <CardFooter className="p-4 bg-muted/50 border-t flex flex-col gap-3">
                     {checkoutError && (
                        <div className="text-sm text-destructive bg-destructive/10 p-2 rounded w-full text-center">
                            {checkoutError}
                        </div>
                     )}
                     <Button
                        type="submit"
                        size="lg"
                        className="w-full font-bold shadow-md hover:shadow-lg transition-all"
                        disabled={isSubmitting || isLoadingCart || hasPointsDeficit}
                    >
                        {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Check className="mr-2 h-4 w-4" />}
                        {isSubmitting ? 'Procesando...' : 'Confirmar Pedido'}
                     </Button>
                     <p className="text-xs text-center text-muted-foreground">
                        Al confirmar aceptas nuestros términos y condiciones.
                     </p>
                </CardFooter>
             </Card>

             {isDemoMode && (
                <Alert className="bg-orange-50 dark:bg-orange-900/10 border-orange-200 text-orange-800 dark:text-orange-200">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertTitle>Modo Simulación</AlertTitle>
                    <AlertDescription className="text-xs">
                        No se realizará ningún cobro real.
                    </AlertDescription>
                </Alert>
             )}
          </div>
        </motion.div>
      </form>
    </motion.div>
  );
}
