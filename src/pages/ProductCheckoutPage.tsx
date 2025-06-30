import React, { useState, useEffect, useMemo } from 'react';
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

import { apiFetch, getErrorMessage } from '@/utils/api';
import { useUser } from '@/hooks/useUser'; // Para pre-rellenar datos
import { ProductDetails } from '@/components/product/ProductCard'; // Para tipo de producto
import { formatCurrency } from '@/utils/currency';

// Esquema de validación para el formulario de checkout
const checkoutSchema = z.object({
  nombre: z.string().min(3, { message: "El nombre debe tener al menos 3 caracteres." }),
  email: z.string().email({ message: "Ingresa un email válido." }),
  telefono: z.string().min(8, { message: "Ingresa un teléfono válido." }),
  direccion: z.string().min(5, { message: "La dirección es requerida." }),
  // notasAdicionales: z.string().optional(), // Campo opcional para el futuro
});

type CheckoutFormData = z.infer<typeof checkoutSchema>;

interface CartItem extends ProductDetails {
  cantidad: number;
}
interface CartApiItems { [productName: string]: number }
interface ProductMap { [productName: string]: ProductDetails }

export default function ProductCheckoutPage() {
  const navigate = useNavigate();
  const { user } = useUser(); // Hook para obtener datos del usuario logueado

  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [isLoadingCart, setIsLoadingCart] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [orderPlaced, setOrderPlaced] = useState(false);

  const { control, handleSubmit, setValue, formState: { errors } } = useForm<CheckoutFormData>({
    resolver: zodResolver(checkoutSchema),
    defaultValues: {
      nombre: '',
      email: '',
      telefono: '',
      direccion: '',
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

  // Cargar ítems del carrito
  useEffect(() => {
    const loadCart = async () => {
      setIsLoadingCart(true);
      try {
        const [cartApiData, productsApiData] = await Promise.all([
          apiFetch<CartApiItems>('/carrito'),
          apiFetch<ProductDetails[]>('/productos'),
        ]);

        const productMap: ProductMap = productsApiData.reduce((acc, p) => {
          acc[p.nombre] = { ...p, precio_unitario: Number(p.precio_unitario) || 0 };
          return acc;
        }, {} as ProductMap);

        const populatedCartItems: CartItem[] = Object.entries(cartApiData)
          .map(([productName, cantidad]) => {
            const productDetail = productMap[productName];
            return productDetail ? { ...productDetail, cantidad } : null;
          })
          .filter((item): item is CartItem => item !== null);

        if (populatedCartItems.length === 0) {
          toast({ title: "Carrito vacío", description: "No hay productos para finalizar la compra.", variant: "destructive" });
          navigate('/productos'); // Redirigir si el carrito está vacío
        } else {
          setCartItems(populatedCartItems);
        }
      } catch (err) {
        setError(getErrorMessage(err, 'No se pudo cargar tu carrito.'));
      } finally {
        setIsLoadingCart(false);
      }
    };
    loadCart();
  }, [navigate]);

  const subtotal = useMemo(() => {
    return cartItems.reduce((sum, item) => sum + (item.precio_unitario * item.cantidad), 0);
  }, [cartItems]);

  const onSubmit = async (data: CheckoutFormData) => {
    setIsSubmitting(true);
    setError(null);

    const pedidoData = {
      cliente: {
        nombre: data.nombre,
        email: data.email,
        telefono: data.telefono,
        direccion_envio: data.direccion,
      },
      items: cartItems.map(item => ({
        producto_id: item.id, // Asumiendo que el backend prefiere ID
        nombre_producto: item.nombre, // Enviar nombre por si ID no está en backend aún
        cantidad: item.cantidad,
        precio_unitario: item.precio_unitario,
      })),
      total_pedido: subtotal,
      // En el futuro: metodo_pago, metodo_envio, notas, etc.
      estado: 'pendiente_confirmacion', // Estado inicial del pedido
    };

    try {
      // TODO: Reemplazar '/pedidos/crear' con el endpoint real del backend
      await apiFetch('/pedidos/crear', {
        method: 'POST',
        body: pedidoData,
      });

      // await apiFetch('/carrito/vaciar', { method: 'DELETE' }); // Endpoint para vaciar carrito en backend (opcional)
      // O el backend podría vaciar el carrito al crear el pedido.
      // Por ahora, el usuario puede volver al carrito y verlo vacío o la página de catálogo.

      setOrderPlaced(true); // Mostrar mensaje de éxito
      toast({
        title: "¡Pedido Realizado!",
        description: "Hemos recibido tu pedido. Nos pondremos en contacto pronto.",
        className: "bg-green-600 text-white",
        duration: 7000,
      });
      // No limpiar el carrito localmente aquí, esperar a que el backend lo confirme o la próxima carga de /carrito lo muestre vacío.

    } catch (err) {
      setError(getErrorMessage(err, "No se pudo procesar tu pedido. Intenta nuevamente."));
      toast({ title: "Error al procesar pedido", description: getErrorMessage(err), variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (orderPlaced) {
    return (
      <div className="container mx-auto p-4 md:p-8 flex flex-col items-center justify-center min-h-[calc(100vh-200px)] text-center">
        <CheckCircle className="h-16 w-16 text-green-500 mb-6" />
        <h1 className="text-3xl font-bold text-foreground mb-3">¡Gracias por tu compra!</h1>
        <p className="text-lg text-muted-foreground mb-8">Tu pedido ha sido realizado con éxito y está siendo procesado.</p>
        <div className="flex gap-4">
          <Button onClick={() => navigate('/productos')}>Seguir Comprando</Button>
          <Button variant="outline" onClick={() => navigate('/perfil/pedidos')}>Ver Mis Pedidos</Button>
          {/* Asumiendo que /perfil/pedidos es donde el usuario ve sus pedidos */}
        </div>
      </div>
    );
  }


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


  return (
    <div className="container mx-auto p-4 md:p-8">
      <Button variant="outline" onClick={() => navigate('/carrito')} className="mb-6">
        <ArrowLeft className="mr-2 h-4 w-4" /> Volver al Carrito
      </Button>
      <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-8">Finalizar Compra</h1>

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
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>2. Método de Envío</CardTitle></CardHeader>
            <CardContent>
              <p className="text-muted-foreground">Por el momento, el envío se coordina post-compra.</p>
              {/* Placeholder para futura selección de envío */}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>3. Método de Pago</CardTitle></CardHeader>
            <CardContent>
              <p className="text-muted-foreground">El pago se realizará por "Transferencia Bancaria" o "Acordar con el Vendedor". Nos contactaremos para coordinar.</p>
              {/* Placeholder para futura selección de pago */}
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
                  <span className="font-medium text-foreground">{formatCurrency(item.precio_unitario * item.cantidad)}</span>
                </div>
              ))}
              <Separator />
              <div className="flex justify-between text-xl font-bold text-foreground">
                <span>Total</span>
                <span>{formatCurrency(subtotal)}</span>
              </div>
              {error && <p className="text-sm text-destructive mt-2">{error}</p>}
            </CardContent>
            <CardFooter>
              <Button type="submit" size="lg" className="w-full" disabled={isSubmitting || isLoadingCart || cartItems.length === 0}>
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
