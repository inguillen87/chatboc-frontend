import React, { useEffect, useState, useMemo } from 'react';
import { apiFetch, getErrorMessage } from '@/utils/api';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Link, useNavigate } from 'react-router-dom';
import { ProductDetails } from '@/components/product/ProductCard'; // Usar la misma interfaz detallada
import { toast } from '@/components/ui/use-toast';
import { formatCurrency } from '@/utils/currency';
import { Loader2, ShoppingCart, AlertTriangle, Trash2, PlusCircle, MinusCircle, ArrowLeft } from 'lucide-react';
import { Separator } from '@/components/ui/separator';

// Interfaz para el producto en el carrito, extendiendo ProductDetails y añadiendo cantidad
interface CartItem extends ProductDetails {
  cantidad: number;
}

// El API de /carrito devuelve un objeto donde las claves son nombres de producto y los valores son cantidades
interface CartApiItems { [productName: string]: number }

// El API de /productos devuelve un array de ProductDetails (o una estructura similar)
// Necesitamos mapearlos a un objeto para fácil acceso por nombre, similar a como estaba antes.
interface ProductMap { [productName: string]: ProductDetails }


export default function CartPage() {
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  const loadCartData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [cartApiData, productsApiData] = await Promise.all([
        apiFetch<CartApiItems>('/carrito'),
        apiFetch<ProductDetails[]>('/productos'),
      ]);

      const productMap: ProductMap = productsApiData.reduce((acc, p) => {
        acc[p.nombre] = {
          ...p,
          // Asegurar que precio_unitario es un número
          precio_unitario: Number(p.precio_unitario) || 0,
        };
        return acc;
      }, {} as ProductMap);

      const populatedCartItems: CartItem[] = Object.entries(cartApiData)
        .map(([productName, cantidad]) => {
          const productDetail = productMap[productName];
          if (productDetail) {
            return {
              ...productDetail,
              cantidad: cantidad,
            };
          }
          return null; // O manejar el caso de un item en carrito sin detalle de producto
        })
        .filter((item): item is CartItem => item !== null);

      setCartItems(populatedCartItems);

    } catch (err) {
      setError(getErrorMessage(err, 'No se pudo cargar el carrito. Intenta de nuevo.'));
      console.error("Error cargando datos del carrito:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCartData();
  }, []);

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
      if (newQuantity <= 0) {
        await apiFetch('/carrito', { method: 'DELETE', body: { nombre: productName } });
      } else {
        await apiFetch('/carrito', { method: 'PUT', body: { nombre: productName, cantidad: newQuantity } });
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

  const subtotal = useMemo(() => {
    return cartItems.reduce((sum, item) => sum + (item.precio_unitario * item.cantidad), 0);
  }, [cartItems]);

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
        <Button onClick={loadCartData} className="mt-4">Reintentar</Button>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 md:p-8">
      <Button variant="outline" onClick={() => navigate(-1)} className="mb-6">
        <ArrowLeft className="mr-2 h-4 w-4" /> Volver
      </Button>
      <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-8">Tu Carrito de Compras</h1>

      {cartItems.length === 0 ? (
        <div className="text-center py-12 bg-card border border-border rounded-lg shadow-sm">
          <ShoppingCart className="mx-auto h-16 w-16 text-muted-foreground mb-4" />
          <p className="text-xl text-muted-foreground mb-2">Tu carrito está vacío.</p>
          <p className="text-sm text-muted-foreground mb-6">Parece que no has agregado nada aún.</p>
          <Button asChild>
            <Link to="/productos">Explorar Catálogo</Link>
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-4">
            {cartItems.map((item) => (
              <Card key={item.id || item.nombre} className="flex flex-col sm:flex-row items-center overflow-hidden shadow-sm border-border">
                {item.imagen_url && (
                  <img
                    src={item.imagen_url}
                    alt={item.nombre}
                    className="w-full sm:w-32 h-32 sm:h-full object-cover"
                  />
                )}
                {!item.imagen_url && (
                   <div className="w-full sm:w-32 h-32 sm:h-full bg-muted flex items-center justify-center">
                     <ShoppingCart className="w-12 h-12 text-muted-foreground" />
                   </div>
                )}
                <CardContent className="p-4 flex-1 flex flex-col sm:flex-row justify-between items-start sm:items-center">
                  <div className="flex-1 mb-4 sm:mb-0">
                    <h3 className="font-semibold text-lg text-foreground">{item.nombre}</h3>
                    {item.presentacion && item.presentacion !== 'NaN' && (
                      <p className="text-sm text-muted-foreground">{item.presentacion}</p>
                    )}
                    <p className="text-md font-medium text-primary mt-1">{formatCurrency(item.precio_unitario)} c/u</p>
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
                <div className="flex justify-between text-xl font-bold text-foreground">
                  <span>Total</span>
                  <span>{formatCurrency(subtotal)}</span>
                </div>
              </CardContent>
              <CardFooter className="flex-col gap-3">
                <Button
                  size="lg"
                  className="w-full bg-primary hover:bg-primary/90"
                  onClick={() => navigate('/checkout-productos')} // Redirigir a la nueva página de checkout de productos
                >
                  Continuar Compra
                </Button>
                <Button variant="link" asChild className="text-sm text-muted-foreground">
                  <Link to="/productos">Seguir comprando</Link>
                </Button>
              </CardFooter>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
