import React, { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';

import { MarketCartProvider, useMarketCart } from '@/context/MarketCartContext';
import type { MarketProduct } from '@/types/market';
import { apiClient } from '@/api/client';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { formatCurrency } from '@/utils/currency';
import { buildTenantPath } from '@/utils/tenantPaths';

const asRecord = (value: unknown): Record<string, unknown> | null =>
  value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : null;

const first = (record: Record<string, unknown>, keys: string[]) => {
  for (const key of keys) {
    const value = record[key];
    if (value !== undefined && value !== null) return value;
  }
  return undefined;
};

const asStringOrNull = (value: unknown): string | null => {
  if (typeof value !== 'string') return null;
  const normalized = value.trim();
  return normalized ? normalized : null;
};

const asStringIdOrNull = (value: unknown): string | null => {
  const direct = asStringOrNull(value);
  if (direct) return direct;
  return typeof value === 'number' && Number.isFinite(value) ? String(value) : null;
};

const asNumberOrNull = (value: unknown): number | null => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
};

const asBooleanOrNull = (value: unknown): boolean | null =>
  typeof value === 'boolean' ? value : null;

const asStringArrayOrNull = (value: unknown): string[] | null => {
  if (!Array.isArray(value)) return null;
  const strings = value
    .map((item) => asStringOrNull(item))
    .filter((item): item is string => Boolean(item));
  return strings.length ? strings : null;
};

const asCheckoutType = (value: unknown): MarketProduct['checkout_type'] => {
  const normalized = asStringOrNull(value);
  return normalized === 'mercadolibre' || normalized === 'tiendanube' || normalized === 'chatboc'
    ? normalized
    : null;
};

const normalizeProductDetail = (input: unknown, fallbackId: string): MarketProduct => {
  const record = asRecord(input) ?? {};
  const catalogItemId = asStringIdOrNull(first(record, ['catalogo_item_id', 'catalog_item_id', 'catalogItemId']));
  const productId = asStringIdOrNull(first(record, ['product_id', 'productId', 'producto_id']));
  const itemId = asStringIdOrNull(first(record, ['item_id', 'itemId']));
  const name = asStringOrNull(first(record, ['name', 'nombre', 'nombre_producto'])) ?? 'Producto';
  const stockQuantity = asNumberOrNull(first(record, ['stock_quantity', 'stock', 'stock_disponible', 'cantidad']));

  return {
    id: catalogItemId ?? productId ?? itemId ?? asStringIdOrNull(first(record, ['id', 'sku', 'codigo'])) ?? fallbackId,
    catalogo_item_id: catalogItemId,
    catalog_item_id: asStringIdOrNull(record.catalog_item_id) ?? catalogItemId,
    product_id: productId,
    item_id: itemId,
    tenant_slug: asStringOrNull(first(record, ['tenant_slug', 'tenantSlug', 'slug_tenant'])),
    tenant: asStringOrNull(first(record, ['tenant', 'tenant_key'])),
    owner_slug: asStringOrNull(first(record, ['owner_slug', 'ownerSlug'])),
    tenant_id: asStringIdOrNull(first(record, ['tenant_id', 'tenantId'])),
    name,
    description: asStringOrNull(first(record, ['description', 'descripcion'])),
    descriptionShort: asStringOrNull(first(record, ['descriptionShort', 'description_short', 'descripcion_corta'])),
    price: asNumberOrNull(first(record, ['price', 'precio_unitario', 'precio', 'amount'])),
    priceText: asStringOrNull(first(record, ['priceText', 'price_text', 'precio_texto'])),
    currency: asStringOrNull(first(record, ['currency', 'moneda'])) ?? 'ARS',
    modality: asStringOrNull(first(record, ['modality', 'modalidad', 'tipo_modalidad'])) ?? 'venta',
    points: asNumberOrNull(first(record, ['points', 'precio_puntos', 'puntos'])),
    imageUrl: asStringOrNull(first(record, ['imageUrl', 'image_url', 'imagen', 'imagen_url'])),
    galleryUrls: asStringArrayOrNull(first(record, ['galleryUrls', 'gallery_urls', 'imagenes'])),
    imageStatus: asStringOrNull(first(record, ['imageStatus', 'image_status'])),
    imageAlt: asStringOrNull(first(record, ['imageAlt', 'image_alt', 'alt'])),
    category: asStringOrNull(first(record, ['category', 'categoria'])),
    unit: asStringOrNull(first(record, ['unit', 'unidad'])) ?? 'u',
    quantity: asNumberOrNull(first(record, ['quantity', 'stock_quantity', 'stock', 'stock_disponible', 'cantidad'])),
    stock_quantity: stockQuantity,
    stock_status: asStringOrNull(first(record, ['stock_status', 'stockStatus', 'availability_status'])),
    available_to_sell: asBooleanOrNull(first(record, ['available_to_sell', 'availableToSell'])),
    amount_validated: asBooleanOrNull(first(record, ['amount_validated', 'amountValidated'])),
    inventory: asRecord(record.inventory),
    sku: asStringOrNull(first(record, ['sku', 'codigo'])),
    brand: asStringOrNull(first(record, ['brand', 'marca'])),
    promoInfo: asStringOrNull(first(record, ['promoInfo', 'promo_info', 'promocion', 'promotion_label'])),
    publicUrl: asStringOrNull(first(record, ['publicUrl', 'public_url'])),
    whatsappShareUrl: asStringOrNull(first(record, ['whatsappShareUrl', 'whatsapp_share_url'])),
    disponible: record.disponible === undefined ? true : Boolean(record.disponible),
    checkout_type: asCheckoutType(first(record, ['checkout_type', 'checkoutType'])),
    external_url: asStringOrNull(first(record, ['external_url', 'externalUrl'])),
    rating: asNumberOrNull(record.rating),
    ratingCount: asNumberOrNull(first(record, ['ratingCount', 'rating_count', 'reviews_count'])),
    tags: asStringArrayOrNull(first(record, ['tags', 'etiquetas'])),
  };
};

function ProductContent({ tenantSlug, productSlug }: { tenantSlug: string; productSlug: string }) {
  const [product, setProduct] = useState<MarketProduct | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { addItem, isLoading: isCartLoading } = useMarketCart();

  useEffect(() => {
    setIsLoading(true);
    setError(null);
    apiClient
      .get<unknown>(`/public/market/${encodeURIComponent(tenantSlug)}/productos/${encodeURIComponent(productSlug)}`)
      .then((response) => {
        setProduct(normalizeProductDetail(response, productSlug));
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
    return <p className="mx-auto mt-8 max-w-3xl text-sm text-muted-foreground">Cargando producto...</p>;
  }

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-4 overflow-x-hidden px-4 py-6 sm:gap-6 sm:py-8">
      <div>
        <Button asChild variant="outline" size="sm">
          <Link to={buildTenantPath('/market', tenantSlug)}>Volver al catalogo</Link>
        </Button>
      </div>

      <Card>
        <CardHeader className="min-w-0">
          <CardTitle className="break-words text-2xl font-semibold">{product.name}</CardTitle>
          {product.description ? (
            <p className="break-words text-muted-foreground">{product.description}</p>
          ) : null}
        </CardHeader>
        <CardContent className="space-y-4">
          {product.imageUrl ? (
            <img
              src={product.imageUrl}
              alt={product.imageAlt || product.name}
              className="aspect-[4/3] w-full rounded-lg object-cover"
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
            {isCartLoading ? 'Agregando...' : 'Agregar al carrito'}
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
