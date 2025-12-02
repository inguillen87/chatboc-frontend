import React, { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';

import { MarketCartProvider, useMarketCart } from '@/context/MarketCartContext';
import type { MarketProduct } from '@/types/market';
import { apiFetch } from '@/api/client';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { formatCurrency } from '@/utils/currency';

function ProductContent({ tenantSlug, productSlug }: { tenantSlug: string; productSlug: string }) {
  const [product, setProduct] = useState<MarketProduct | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { addItem, isLoading: isCartLoading } = useMarketCart();

  useEffect(() => {
    setIsLoading(true);
    setError(null);
    apiFetch(`/api/${tenantSlug}/productos/${productSlug}`)
      .then((response: any) => {
          const normalized: MarketProduct = {
            id: response?.id ?? response?.product_id ?? productSlug,
            name: response?.name ?? response?.nombre ?? 'Producto',
            description: response?.description ?? response?.descripcion ?? null,
            descriptionShort: response?.descripcion_corta ?? response?.description_short ?? null,
            price:
              typeof response?.price === 'number'
                ? response.price
                : typeof response?.precio === 'number'
                  ? response.precio
                  : null,
            priceText: response?.precio_texto ?? response?.price_text ?? null,
            currency: response?.currency ?? response?.moneda ?? null,
            points: typeof response?.points === 'number' ? response.points : null,
            imageUrl: response?.imageUrl ?? response?.imagen ?? null,
          };
        setProduct(normalized);
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : 'No se pudo cargar el producto.');
      })
      .finally(() => setIsLoading(false));
  }, [productSlug, tenantSlug]);

  if (error) {
    return (
      <Alert variant="destructive" className="mx-auto mt-8 max-w-3xl">
        <AlertTitle>Error</AlertTitle>
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }

  if (isLoading || !product) {
    return <p className="mx-auto mt-8 max-w-3xl text-sm text-muted-foreground">Cargando producto…</p>;
  }

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-4 py-8">
      <div>
        <Button asChild variant="outline" size="sm">
          <Link to={`/tenant/${tenantSlug}/market`}>Volver al catálogo</Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-2xl font-semibold">{product.name}</CardTitle>
          {product.description ? (
            <p className="text-muted-foreground">{product.description}</p>
          ) : null}
        </CardHeader>
        <CardContent className="space-y-4">
          {product.imageUrl ? (
            <img
              src={product.imageUrl}
              alt={product.name}
              className="w-full rounded-lg object-cover"
              loading="lazy"
            />
          ) : null}

          <div className="flex flex-wrap items-center gap-3">
            {product.priceText ? (
              <div className="text-xl font-bold text-primary">{product.priceText}</div>
            ) : product.price !== null && product.price !== undefined ? (
              <div className="text-xl font-bold text-primary">
                {formatCurrency(product.price, (product.currency ?? 'ARS').toUpperCase())}
              </div>
            ) : null}
            {product.points ? (
              <Badge variant="secondary">{product.points} pts</Badge>
            ) : null}
          </div>

          <Button
            className="w-full sm:w-auto"
            onClick={() => addItem(product.id)}
            disabled={isCartLoading}
          >
            {isCartLoading ? 'Agregando…' : 'Agregar al carrito'}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

export default function MarketProductPage() {
  const params = useParams();
  const tenantSlug = useMemo(() => params.tenant ?? params.tenantSlug ?? null, [params.tenant, params.tenantSlug]);
  const productSlug = useMemo(() => params.slug ?? null, [params.slug]);

  useEffect(() => {
    if (typeof window !== 'undefined' && tenantSlug) {
      (window as any).currentTenantSlug = tenantSlug;
    }
  }, [tenantSlug]);

  if (!tenantSlug || !productSlug) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-8">
        <Alert variant="destructive">
          <AlertTitle>Faltan datos</AlertTitle>
          <AlertDescription>Necesitamos el tenant y el producto para continuar.</AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <MarketCartProvider tenantSlug={tenantSlug}>
      <ProductContent tenantSlug={tenantSlug} productSlug={productSlug} />
    </MarketCartProvider>
  );
}
