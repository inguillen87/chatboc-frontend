import React, { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';

import ProductCard from '@/components/market/ProductCard';
import { MarketCartProvider, useMarketCart } from '@/context/MarketCartContext';
import type { MarketProduct } from '@/types/market';
import { apiFetch } from '@/api/client';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';

const normalizeProducts = (raw: any): MarketProduct[] => {
  if (!Array.isArray(raw)) return [];
  return raw.map((item, index) => {
    const id = item?.id ?? item?.product_id ?? item?.slug ?? `product-${index}`;
    return {
      id: String(id),
      name: item?.name ?? item?.nombre ?? `Producto ${index + 1}`,
      description: item?.description ?? item?.descripcion ?? null,
      price: typeof item?.price === 'number' ? item.price : null,
      points: typeof item?.points === 'number' ? item.points : null,
      imageUrl: item?.imageUrl ?? item?.imagen ?? null,
    };
  });
};

function MarketCatalogContent({ tenantSlug }: { tenantSlug: string }) {
  const [products, setProducts] = useState<MarketProduct[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const { addItem, isLoading: isCartLoading } = useMarketCart();

  useEffect(() => {
    setIsLoading(true);
    setError(null);
    apiFetch(`/api/${tenantSlug}/productos`)
      .then((response: any) => {
        const normalized = normalizeProducts(response?.productos ?? response?.items ?? response);
        setProducts(normalized);
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : 'No se pudo cargar el catálogo.');
      })
      .finally(() => setIsLoading(false));
  }, [tenantSlug]);

  const emptyState = !isLoading && products.length === 0;

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-8">
      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold">Marketplace</h1>
        <p className="text-muted-foreground">
          Explorá los productos y agregalos al carrito para iniciar tu compra.
        </p>
      </header>

      {error ? (
        <Alert variant="destructive">
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      {isLoading ? <p className="text-sm text-muted-foreground">Cargando catálogo…</p> : null}

      {emptyState ? (
        <p className="text-sm text-muted-foreground">No hay productos disponibles.</p>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {products.map((product) => (
            <div key={product.id} className="flex flex-col gap-3">
              <ProductCard
                product={product}
                onAdd={(id) => addItem(id)}
                isAdding={isCartLoading}
              />
              <Button asChild variant="outline" size="sm">
                <Link to={`/tenant/${tenantSlug}/product/${encodeURIComponent(product.id)}`}>
                  Ver detalle
                </Link>
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function MarketCatalogPage() {
  const params = useParams();
  const tenantSlug = useMemo(() => params.tenant ?? params.tenantSlug ?? null, [params.tenant, params.tenantSlug]);

  useEffect(() => {
    if (typeof window !== 'undefined' && tenantSlug) {
      (window as any).currentTenantSlug = tenantSlug;
    }
  }, [tenantSlug]);

  if (!tenantSlug) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-8">
        <Alert variant="destructive">
          <AlertTitle>Falta el tenant</AlertTitle>
          <AlertDescription>Necesitamos el identificador del espacio para mostrar el catálogo.</AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <MarketCartProvider tenantSlug={tenantSlug}>
      <MarketCatalogContent tenantSlug={tenantSlug} />
    </MarketCartProvider>
  );
}
