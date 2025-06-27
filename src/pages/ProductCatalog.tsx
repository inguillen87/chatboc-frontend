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

export default function ProductCatalog() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<Product[]>('/productos')
      .then((data) => {
        setProducts(data);
        setLoading(false);
      })
      .catch((err: any) => {
        setError(getErrorMessage(err, 'Error'));
        setLoading(false);
      });
  }, []);

  if (loading) return <p>Cargando...</p>;
  if (error) return <p>{error}</p>;

  const handleAdd = async (name: string) => {
    await apiFetch('/carrito', { method: 'POST', body: { nombre: name, cantidad: 1 } });
  };

  return (
    <div className="p-4 space-y-4">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Catálogo</h1>
        <Button asChild variant="outline">
          <Link to="/cart">Ver carrito</Link>
        </Button>
      </div>
      <ul className="grid gap-4">
        {products.map((p) => (
          <li key={p.id} className="flex gap-4 items-center border-b pb-2">
            {p.imagen_url && (
              <img
                src={p.imagen_url}
                alt=""
                className="w-16 h-16 object-cover rounded"
              />
            )}
            <div className="flex-1">
              <p className="font-medium">{p.nombre}</p>
              {p.presentacion && (
                <p className="text-sm text-muted-foreground">{p.presentacion}</p>
              )}
            </div>
            {typeof p.precio_unitario === 'number' && (
              <span className="font-semibold mr-2">{formatPrice(p.precio_unitario)}</span>
            )}
            <Button size="sm" onClick={() => handleAdd(p.nombre)}>
              Agregar
            </Button>
          </li>
        ))}
      </ul>
    </div>
  );
}
