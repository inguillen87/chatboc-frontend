import React, { useEffect, useState } from 'react';
import { apiFetch, getErrorMessage } from '@/utils/api';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import ProductCard, { AddToCartOptions, ProductDetails } from '@/components/product/ProductCard'; // Importar ProductCard y su interfaz
import { toast } from '@/components/ui/use-toast';
import { Input } from '@/components/ui/input';
import { Loader2, ShoppingCart, AlertTriangle, Search } from 'lucide-react'; // Icons

export default function ProductCatalog() {
  const [allProducts, setAllProducts] = useState<ProductDetails[]>([]);
  const [filteredProducts, setFilteredProducts] = useState<ProductDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    setLoading(true);
    apiFetch<ProductDetails[]>('/productos') // Asumimos que el API devuelve ProductDetails
      .then((data) => {
        // Asegurarse que precio_unitario sea siempre un número
        const sanitizedData = data.map(p => ({
          ...p,
          precio_unitario: Number(p.precio_unitario) || 0, // Default to 0 if NaN or not present
          precio_por_caja:
            p.precio_por_caja === null || p.precio_por_caja === undefined
              ? null
              : Number(p.precio_por_caja) || null,
          unidades_por_caja:
            p.unidades_por_caja === null || p.unidades_por_caja === undefined
              ? null
              : Number(p.unidades_por_caja) || null,
          precio_mayorista:
            p.precio_mayorista === null || p.precio_mayorista === undefined
              ? null
              : Number(p.precio_mayorista) || null,
          cantidad_minima_mayorista:
            p.cantidad_minima_mayorista === null || p.cantidad_minima_mayorista === undefined
              ? null
              : Number(p.cantidad_minima_mayorista) || null,
        }));
        setAllProducts(sanitizedData);
        setFilteredProducts(sanitizedData);
        setLoading(false);
      })
      .catch((err: any) => {
        setError(getErrorMessage(err, 'No se pudieron cargar los productos. Intenta de nuevo más tarde.'));
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    const lowercasedFilter = searchTerm.toLowerCase();
    const filtered = allProducts.filter(product => {
      return (
        product.nombre.toLowerCase().includes(lowercasedFilter) ||
        (product.descripcion && product.descripcion.toLowerCase().includes(lowercasedFilter)) ||
        (product.categoria && product.categoria.toLowerCase().includes(lowercasedFilter)) ||
        (product.marca && product.marca.toLowerCase().includes(lowercasedFilter))
      );
    });
    setFilteredProducts(filtered);
  }, [searchTerm, allProducts]);

  const handleAddToCart = async (product: ProductDetails, options: AddToCartOptions) => {
    try {
      const unitsPerCase = product.unidades_por_caja && product.unidades_por_caja > 0
        ? product.unidades_por_caja
        : 1;

      const quantity = Math.max(1, Math.floor(options.quantity));
      const mode = options.mode === 'case' && product.precio_por_caja && product.unidades_por_caja
        ? 'case'
        : 'unit';

      const totalUnits = mode === 'case' ? quantity * unitsPerCase : quantity;

      const payload: Record<string, unknown> = {
        nombre: product.nombre,
        cantidad: totalUnits,
        modo_compra: mode,
        precio_unitario: Number(product.precio_unitario) || 0,
      };

      if (mode === 'case') {
        payload['cantidad_cajas'] = quantity;
        payload['unidades_por_caja'] = unitsPerCase;
        if (product.precio_por_caja) {
          payload['precio_por_caja'] = Number(product.precio_por_caja) || undefined;
        }
      }

      // El backend actual espera 'nombre' y 'cantidad'.
      // Si los nombres no son únicos, esto debería cambiar a product.id o product.sku
      await apiFetch('/carrito', {
        method: 'POST',
        body: payload,
      });
      toast({
        title: "¡Agregado!",
        description: `${product.nombre} se agregó a tu carrito (${quantity} ${mode === 'case' ? 'caja(s)' : 'unidad(es)'}).`,
        className: "bg-green-500 text-white",
      });
    } catch (err) {
      toast({
        title: "Error",
        description: `No se pudo agregar ${product.nombre} al carrito.`,
        variant: "destructive",
      });
      console.error("Error agregando al carrito:", err);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-200px)] p-4 text-muted-foreground">
        <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
        <p className="text-lg">Cargando productos...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-200px)] p-4 text-destructive">
        <AlertTriangle className="h-12 w-12 mb-4" />
        <p className="text-lg font-semibold">Ocurrió un error</p>
        <p>{error}</p>
        <Button onClick={() => window.location.reload()} className="mt-4">Reintentar</Button>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 md:p-8">
      <header className="mb-8">
        <div className="flex flex-col sm:flex-row justify-between items-center gap-4 mb-6">
          <h1 className="text-3xl md:text-4xl font-bold text-foreground">Nuestro Catálogo</h1>
          <Button asChild variant="outline" className="w-full sm:w-auto">
            <Link to="/cart">
              <ShoppingCart className="mr-2 h-4 w-4" />
              Ver Carrito
            </Link>
          </Button>
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Buscar productos por nombre, descripción, categoría..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 text-base rounded-md border-border focus:ring-primary focus:border-primary"
          />
        </div>
      </header>

      {filteredProducts.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {filteredProducts.map((product) => (
            <ProductCard
              key={product.id}
              product={product}
              onAddToCart={handleAddToCart}
            />
          ))}
        </div>
      ) : (
        <div className="text-center py-12">
          <Search className="mx-auto h-16 w-16 text-muted-foreground mb-4" />
          <p className="text-xl text-muted-foreground">
            {allProducts.length > 0 ? "No se encontraron productos para tu búsqueda." : "Aún no hay productos en el catálogo."}
          </p>
          {allProducts.length > 0 && searchTerm && (
             <p className="text-sm text-muted-foreground mt-2">Intenta con otros términos de búsqueda.</p>
          )}
        </div>
      )}
    </div>
  );
}
