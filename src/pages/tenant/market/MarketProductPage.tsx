import React, { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  BadgePercent,
  MessageCircle,
  Minus,
  PackageCheck,
  Plus,
  ShieldCheck,
  ShoppingCart,
} from 'lucide-react';

import { MarketCartProvider, useMarketCart } from '@/context/MarketCartContext';
import type { MarketProduct } from '@/types/market';
import { apiClient } from '@/api/client';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { formatCurrency } from '@/utils/currency';
import { buildTenantPath } from '@/utils/tenantPaths';
import { getMarketCommercialValidation } from '@/utils/marketValidation';

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
    imageUrl: asStringOrNull(first(record, ['imageUrl', 'image_url', 'imagen', 'imagen_url', 'foto_url', 'photo_url'])),
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

const normalizeStockStatus = (product: MarketProduct) => {
  const normalized = product.stock_status?.toLowerCase() ?? null;
  if (product.available_to_sell === false || product.disponible === false) {
    return {
      label: 'No disponible',
      detail: 'El operador debe revisar este producto antes de venderlo.',
      tone: 'danger',
    };
  }
  if (normalized === 'out_of_stock') {
    return {
      label: 'Sin stock',
      detail: 'No se puede confirmar la compra hasta reponer stock.',
      tone: 'danger',
    };
  }
  if (normalized === 'stock_unknown') {
    return {
      label: 'Stock a confirmar',
      detail: 'El equipo valida disponibilidad antes de cerrar el pedido.',
      tone: 'warning',
    };
  }
  if (normalized === 'validated') {
    return {
      label: 'Stock validado',
      detail: product.stock_quantity
        ? `${product.stock_quantity} ${product.unit ?? 'u'} disponibles`
        : 'Disponibilidad confirmada por el catalogo.',
      tone: 'success',
    };
  }
  if (typeof product.stock_quantity === 'number' && product.stock_quantity > 0) {
    return {
      label: 'Disponible',
      detail: `${product.stock_quantity} ${product.unit ?? 'u'} disponibles`,
      tone: 'success',
    };
  }
  return {
    label: 'Operacion asistida',
    detail: 'El equipo puede confirmar disponibilidad por WhatsApp o desde el CRM.',
    tone: 'neutral',
  };
};

const signalToneClass = (tone: string) => {
  if (tone === 'success') return 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200';
  if (tone === 'warning') return 'border-amber-500/30 bg-amber-500/10 text-amber-100';
  if (tone === 'danger') return 'border-red-500/30 bg-red-500/10 text-red-100';
  return 'border-sky-500/30 bg-sky-500/10 text-sky-100';
};

const buildProductWhatsAppUrl = (product: MarketProduct, tenantSlug: string, productSlug: string) => {
  if (product.whatsappShareUrl) return product.whatsappShareUrl;
  const productPath = buildTenantPath(`/product/${productSlug}`, tenantSlug);
  const absoluteProductUrl =
    typeof window !== 'undefined' ? `${window.location.origin}${productPath}` : product.publicUrl ?? productPath;
  const price =
    product.priceText ??
    (product.price !== null && product.price !== undefined
      ? formatCurrency(product.price, (product.currency ?? 'ARS').toUpperCase())
      : null);
  const message = [
    `Hola, quiero consultar por ${product.name}.`,
    price ? `Precio publicado: ${price}.` : null,
    product.promoInfo ? `Promo: ${product.promoInfo}.` : null,
    `Link: ${product.publicUrl ?? absoluteProductUrl}`,
  ]
    .filter(Boolean)
    .join(' ');
  return `https://wa.me/?text=${encodeURIComponent(message)}`;
};

function ProductContent({ tenantSlug, productSlug }: { tenantSlug: string; productSlug: string }) {
  const [product, setProduct] = useState<MarketProduct | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedQuantity, setSelectedQuantity] = useState(1);
  const [addedToCart, setAddedToCart] = useState(false);
  const { addItem, items: cartItems, error: cartError, isLoading: isCartLoading } = useMarketCart();

  useEffect(() => {
    setIsLoading(true);
    setError(null);
    setSelectedQuantity(1);
    setAddedToCart(false);
    apiClient
      .get<unknown>(`/api/public/market/${encodeURIComponent(tenantSlug)}/productos/${encodeURIComponent(productSlug)}`, {
        tenantSlug,
        skipAuth: true,
        omitCredentials: true,
        omitChatSessionId: true,
        suppressPanel401Redirect: true,
        sendAnonId: true,
      })
      .then((response) => {
        setProduct(normalizeProductDetail(response, productSlug));
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : 'No se pudo cargar el producto.');
      })
      .finally(() => setIsLoading(false));
  }, [productSlug, tenantSlug]);

  const productValidation = useMemo(
    () => (product ? getMarketCommercialValidation(product, product.inventory) : null),
    [product],
  );
  const stockSignal = useMemo(() => (product ? normalizeStockStatus(product) : null), [product]);
  const cartItemsCount = cartItems.reduce((total, item) => total + (Number(item.quantity) || 0), 0);
  const cartPath = buildTenantPath('/cart', tenantSlug);
  const maxQuantity =
    product?.stock_quantity && product.stock_quantity > 0
      ? Math.max(1, Math.floor(product.stock_quantity))
      : 99;
  const canAddToCart =
    Boolean(product) &&
    product?.disponible !== false &&
    product?.available_to_sell !== false &&
    productValidation?.canStartCheckout === true;
  const whatsappUrl = product ? buildProductWhatsAppUrl(product, tenantSlug, productSlug) : '#';

  const handleAddToCart = async () => {
    if (!product || !canAddToCart) return;
    setAddedToCart(false);
    const added = await addItem(product.id, selectedQuantity);
    setAddedToCart(added);
  };

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
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 overflow-x-hidden px-4 py-6 sm:gap-6 sm:py-8">
      <div>
        <Button asChild variant="outline" size="sm">
          <Link to={buildTenantPath('/market', tenantSlug)}>
            <ArrowLeft className="mr-2 h-4 w-4" aria-hidden="true" />
            Volver al catalogo
          </Link>
        </Button>
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
        <Card className="overflow-hidden border-slate-200/70 bg-white/95 shadow-xl dark:border-slate-800 dark:bg-slate-950/80">
          <CardHeader className="min-w-0 border-b border-slate-200/70 bg-slate-50/80 dark:border-slate-800 dark:bg-slate-900/60">
            <div className="flex flex-wrap items-center gap-2">
              {product.category ? <Badge variant="secondary">{product.category}</Badge> : null}
              {product.brand ? <Badge variant="outline">{product.brand}</Badge> : null}
              {product.promoInfo ? (
                <Badge className="bg-emerald-600 text-white hover:bg-emerald-600">
                  <BadgePercent className="mr-1 h-3.5 w-3.5" aria-hidden="true" />
                  En promocion
                </Badge>
              ) : null}
            </div>
            <CardTitle className="break-words text-3xl font-semibold leading-tight">{product.name}</CardTitle>
            {product.description ? (
              <p className="max-w-3xl break-words text-base text-muted-foreground">{product.description}</p>
            ) : product.descriptionShort ? (
              <p className="max-w-3xl break-words text-base text-muted-foreground">{product.descriptionShort}</p>
            ) : null}
          </CardHeader>
          <CardContent className="space-y-5 p-4 sm:p-6">
            {product.imageUrl ? (
              <img
                src={product.imageUrl}
                alt={product.imageAlt || product.name}
                className="aspect-[4/3] w-full rounded-md object-cover"
                loading="lazy"
              />
            ) : (
              <div className="flex aspect-[4/3] w-full items-center justify-center rounded-md border border-dashed border-slate-300 bg-slate-50 text-sm text-muted-foreground dark:border-slate-700 dark:bg-slate-900">
                Imagen pendiente del catalogo
              </div>
            )}

            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-md border bg-background p-4">
                <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                  <ShieldCheck className="h-4 w-4" aria-hidden="true" />
                  Precio
                </div>
                <div className="mt-2 text-xl font-bold text-primary">
                  {product.priceText
                    ? product.priceText
                    : product.price !== null && product.price !== undefined
                      ? formatCurrency(product.price, (product.currency ?? 'ARS').toUpperCase())
                      : 'A cotizar'}
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {product.amount_validated === true ? 'Validado por backend' : 'Puede requerir confirmacion'}
                </p>
              </div>
              <div className="rounded-md border bg-background p-4" data-testid="market-product-stock-signal">
                <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                  <PackageCheck className="h-4 w-4" aria-hidden="true" />
                  Stock
                </div>
                <div className="mt-2 text-base font-semibold">{stockSignal?.label}</div>
                <p className="mt-1 text-xs text-muted-foreground">{stockSignal?.detail}</p>
              </div>
              <div className="rounded-md border bg-background p-4">
                <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                  <BadgePercent className="h-4 w-4" aria-hidden="true" />
                  Promos
                </div>
                <div className="mt-2 text-base font-semibold">{product.promoInfo ?? 'Sin promo activa'}</div>
                <p className="mt-1 text-xs text-muted-foreground">Visible en WhatsApp, webview y CRM.</p>
              </div>
            </div>

            {product.tags?.length ? (
              <div className="flex flex-wrap gap-2">
                {product.tags.slice(0, 8).map((tag) => (
                  <Badge key={tag} variant="outline">
                    {tag}
                  </Badge>
                ))}
              </div>
            ) : null}
          </CardContent>
        </Card>

        <aside className="min-w-0">
          <Card
            className="sticky top-24 overflow-hidden border-slate-800 bg-slate-950 text-white shadow-2xl"
            data-testid="market-product-commerce-panel"
          >
            <CardHeader className="space-y-3 border-b border-white/10">
              <div className="flex items-center justify-between gap-3">
                <Badge className={signalToneClass(stockSignal?.tone ?? 'neutral')}>{stockSignal?.label}</Badge>
                {cartItemsCount > 0 ? <Badge variant="secondary">{cartItemsCount} en carrito</Badge> : null}
              </div>
              <div>
                <CardTitle className="text-xl">Comprar o consultar</CardTitle>
                <p className="mt-1 text-sm text-slate-300">
                  Continuidad por carrito, WhatsApp y CRM para no perder el pedido.
                </p>
              </div>
            </CardHeader>
            <CardContent className="space-y-4 p-4">
              <div className="rounded-md border border-white/10 bg-white/5 p-3">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm font-medium text-slate-200">Cantidad</span>
                  <div
                    className="flex h-10 items-center rounded-md border border-white/10 bg-slate-900"
                    data-testid="market-product-quantity"
                  >
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      className="h-9 w-9 text-white hover:bg-white/10 hover:text-white"
                      aria-label="Restar cantidad"
                      disabled={selectedQuantity <= 1}
                      onClick={() => {
                        setSelectedQuantity((current) => Math.max(1, current - 1));
                        setAddedToCart(false);
                      }}
                    >
                      <Minus className="h-4 w-4" aria-hidden="true" />
                    </Button>
                    <span className="w-10 text-center text-sm font-semibold">{selectedQuantity}</span>
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      className="h-9 w-9 text-white hover:bg-white/10 hover:text-white"
                      aria-label="Sumar cantidad"
                      disabled={selectedQuantity >= maxQuantity}
                      onClick={() => {
                        setSelectedQuantity((current) => Math.min(maxQuantity, current + 1));
                        setAddedToCart(false);
                      }}
                    >
                      <Plus className="h-4 w-4" aria-hidden="true" />
                    </Button>
                  </div>
                </div>
                <p className="mt-2 text-xs text-slate-400">
                  {maxQuantity < 99 ? `Maximo publicado: ${maxQuantity} ${product.unit ?? 'u'}` : 'El operador confirma volumen si hace falta.'}
                </p>
              </div>

              {productValidation?.reason ? (
                <Alert
                  className="border-amber-500/30 bg-amber-500/10 text-amber-50"
                  data-testid="market-product-validation-reason"
                >
                  <ShieldCheck className="h-4 w-4" aria-hidden="true" />
                  <AlertTitle>Compra asistida</AlertTitle>
                  <AlertDescription className="text-amber-50/90">{productValidation.reason}</AlertDescription>
                </Alert>
              ) : (
                <div className="rounded-md border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-50">
                  Producto listo para agregar al carrito y continuar por checkout o WhatsApp.
                </div>
              )}

              {cartError ? (
                <Alert variant="destructive">
                  <AlertTitle>No se pudo actualizar el carrito</AlertTitle>
                  <AlertDescription>{cartError}</AlertDescription>
                </Alert>
              ) : null}

              <Button
                className="w-full bg-blue-600 text-white hover:bg-blue-500"
                onClick={handleAddToCart}
                disabled={!canAddToCart || isCartLoading}
              >
                <ShoppingCart className="mr-2 h-4 w-4" aria-hidden="true" />
                {isCartLoading ? 'Agregando...' : canAddToCart ? 'Agregar al carrito' : 'Compra a validar'}
              </Button>

              <Button asChild variant="secondary" className="w-full" data-testid="market-product-cart-link">
                <Link to={cartPath}>
                  <ShoppingCart className="mr-2 h-4 w-4" aria-hidden="true" />
                  Ver carrito{cartItemsCount ? ` (${cartItemsCount})` : ''}
                </Link>
              </Button>

              <Button asChild variant="outline" className="w-full border-white/20 bg-white/5 text-white hover:bg-white/10 hover:text-white">
                <a href={whatsappUrl} target="_blank" rel="noreferrer" data-testid="market-product-whatsapp">
                  <MessageCircle className="mr-2 h-4 w-4" aria-hidden="true" />
                  Consultar por WhatsApp
                </a>
              </Button>

              {addedToCart ? (
                <div className="rounded-md border border-sky-500/30 bg-sky-500/10 p-3 text-sm text-sky-50">
                  Agregado al carrito. Podes seguir comprando o cerrar el pedido.
                </div>
              ) : null}
            </CardContent>
          </Card>
        </aside>
      </div>
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
