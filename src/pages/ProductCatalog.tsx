import React, { useEffect, useState } from 'react';
import { apiFetch, getErrorMessage } from '@/utils/api';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';

interface Product {
  id: number;
  nombre: string;
  categoria?: string | null;
  presentacion?: string | null;
  descripcion?: string | null;
  precio_unitario?: number | null;
  imagen_url?: string | null;
}

const formatPrice = (value: number) =>
  value.toLocaleString('es-AR', { style: 'currency', currency: 'ARS' });

// Importar Card y AspectRatio
import { Card } from '@/components/ui/card';
import { AspectRatio } from '@/components/ui/aspect-ratio';
import { ShoppingCart } from 'lucide-react'; // Icono para el botón del carrito

export default function ProductCatalog() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    document.title = "Catálogo de Productos - Chatboc"; // Título de la página
    apiFetch<Product[]>('/productos')
      .then((data) => {
        setProducts(data);
        setLoading(false);
      })
      .catch((err: any) => {
        setError(getErrorMessage(err, 'Error al cargar productos'));
        setLoading(false);
      });
  }, []);

  // Estados de carga y error más visuales
  if (loading) {
    return ( // Skeleton para la carga
      <div className="p-6 space-y-6">
        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-bold">Catálogo</h1>
          <Button size="lg" variant="outline" disabled>
            <ShoppingCart className="mr-2 h-5 w-5" /> Ver carrito
          </Button>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {[...Array(8)].map((_, i) => (
            <Card key={i} className="overflow-hidden">
              <AspectRatio ratio={1}>
                <div className="h-full w-full bg-muted animate-pulse rounded-t-xl"></div>
              </AspectRatio>
              <div className="p-4 space-y-2">
                <div className="h-6 bg-muted animate-pulse rounded w-3/4"></div>
                <div className="h-4 bg-muted animate-pulse rounded w-1/2"></div>
                <div className="h-5 bg-muted animate-pulse rounded w-1/4 mt-2"></div>
                <div className="h-10 bg-muted animate-pulse rounded w-full mt-3"></div>
              </div>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 text-center">
        <h1 className="text-3xl font-bold mb-4">Catálogo</h1>
        <p className="text-destructive text-lg">{error === 'No encontrado' ? 'No se encontraron productos.' : error}</p>
        <Button onClick={() => window.location.reload()} className="mt-4">Reintentar</Button>
      </div>
    );
  }

  const handleAdd = async (productName: string, productId: number) => {
    // TODO: Implementar feedback visual al agregar (ej. toast, animación)
    try {
      await apiFetch('/carrito', { method: 'POST', body: { nombre: productName, cantidad: 1, producto_id: productId } });
      // toast({ title: "Producto agregado", description: `${productName} fue añadido al carrito.` });
      console.log(`${productName} agregado al carrito`);
    } catch (err) {
      // toast({ title: "Error", description: `No se pudo agregar ${productName} al carrito.`, variant: "destructive" });
      console.error("Error al agregar al carrito:", err);
    }
  };

  return (
    <div className="p-4 md:p-6 space-y-6 min-h-screen"> {/* Padding aumentado y space-y */}
      <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
        <h1 className="text-3xl font-bold text-foreground">Catálogo</h1> {/* text-3xl */}
        <Button size="lg" variant="outline" asChild> {/* size="lg" */}
          <Link to="/cart">
            <ShoppingCart className="mr-2 h-5 w-5" /> Ver carrito
          </Link>
        </Button>
      </div>

      {/* TODO: Añadir aquí Input de Búsqueda y Botones/Selects para Filtro y Ordenamiento */}
      {/* <div className="flex flex-col md:flex-row gap-4 mb-6">
        <Input placeholder="Buscar productos..." className="h-12 text-base md:flex-grow" sizeVariant="lg" />
        <Select> ... </Select>
        <Button variant="outline" size="lg">Filtros</Button>
      </div> */}

      {products.length === 0 ? (
        <div className="text-center py-10">
            <ShoppingCart className="mx-auto h-16 w-16 text-muted-foreground/50 mb-4" />
            <p className="text-xl text-muted-foreground">No hay productos disponibles en este momento.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-x-4 gap-y-6 md:gap-6"> {/* Columnas responsivas y gap aumentado */}
          {products.map((p) => (
            <Card key={p.id} className="overflow-hidden flex flex-col group transition-all duration-300 ease-in-out hover:shadow-xl">
              <AspectRatio ratio={1} className="bg-muted rounded-t-xl">
                {p.imagen_url ? (
                  <img
                    src={p.imagen_url}
                    alt={p.nombre || 'Imagen del producto'}
                    className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                  />
                ) : (
                  <div className="h-full w-full flex items-center justify-center bg-muted text-muted-foreground">
                    <ShoppingCart size={48} /> {/* Placeholder si no hay imagen */}
                  </div>
                )}
              </AspectRatio>
              <div className="p-4 flex flex-col flex-grow">
                <h2 className="text-lg font-semibold text-foreground mb-1 line-clamp-2" title={p.nombre}>
                  {p.nombre}
                </h2>
                {p.presentacion && (
                  <p className="text-sm text-muted-foreground mb-2 line-clamp-2 h-[40px]" title={p.presentacion}> {/* Altura fija para alinear botones */}
                    {p.presentacion}
                  </p>
                )}
                <div className="mt-auto"> {/* Empuja el precio y el botón hacia abajo */}
                  {typeof p.precio_unitario === 'number' && (
                    <p className="text-xl font-bold text-primary my-2"> {/* Tamaño de precio aumentado */}
                      {formatPrice(p.precio_unitario)}
                    </p>
                  )}
                  <Button size="default" className="w-full text-base font-medium" onClick={() => handleAdd(p.nombre, p.id)}> {/* text-base y font-medium */}
                    Agregar al Carrito
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
