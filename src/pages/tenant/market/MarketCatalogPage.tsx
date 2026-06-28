import React, { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';

import { fetchMarketCatalog } from '@/api/market';
import ProductCard from '@/components/market/ProductCard';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/use-toast';
import { MarketCartProvider, useMarketCart } from '@/context/MarketCartContext';
import type { MarketCatalogResponse, MarketProduct } from '@/types/market';
import { buildTenantPath } from '@/utils/tenantPaths';
import { Copy, MessageCircle, Percent, QrCode, ShoppingBag, Sparkles } from 'lucide-react';

type PromotionItem = NonNullable<NonNullable<MarketCatalogResponse['promotions']>['items']>[number];

const moneyFormatter = new Intl.NumberFormat('es-AR', {
  style: 'currency',
  currency: 'ARS',
  maximumFractionDigits: 0,
});

const promotionTitle = (promotion: PromotionItem): string => {
  const record = promotion as PromotionItem & Record<string, unknown>;
  return (
    promotion.nombre_promocion ||
    (typeof record.title === 'string' ? record.title : null) ||
    (typeof record.name === 'string' ? record.name : null) ||
    'Promocion activa'
  );
};

const promotionDescription = (promotion: PromotionItem): string | null => {
  const record = promotion as PromotionItem & Record<string, unknown>;
  return (
    promotion.descripcion_publica ||
    (typeof record.description === 'string' ? record.description : null) ||
    null
  );
};

const promotionDetail = (promotion: PromotionItem): string => {
  const pieces: string[] = [];
  const type = promotion.tipo_promocion ?? '';

  if (typeof promotion.valor_descuento === 'number') {
    pieces.push(type.includes('PORCENTAJE') ? `${promotion.valor_descuento}% off` : `${moneyFormatter.format(promotion.valor_descuento)} off`);
  }
  if (typeof promotion.monto_minimo_carrito === 'number' && promotion.monto_minimo_carrito > 0) {
    pieces.push(`desde ${moneyFormatter.format(promotion.monto_minimo_carrito)}`);
  }
  if (typeof promotion.cantidad_minima_aplicable === 'number' && promotion.cantidad_minima_aplicable > 1) {
    pieces.push(`minimo ${promotion.cantidad_minima_aplicable} unidades`);
  }
  if (promotion.codigo_promocion) pieces.push(`codigo ${promotion.codigo_promocion}`);

  return pieces.join(' - ');
};

function MarketCatalogContent({ tenantSlug }: { tenantSlug: string }) {
  const [products, setProducts] = useState<MarketProduct[]>([]);
  const [promotions, setPromotions] = useState<MarketCatalogResponse['promotions']>(null);
  const [heroSubtitle, setHeroSubtitle] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [shareMeta, setShareMeta] = useState<Pick<MarketCatalogResponse, 'publicCartUrl' | 'whatsappShareUrl'> | null>(
    null,
  );
  const { addItem, isLoading: isCartLoading } = useMarketCart();

  const shareUrl = useMemo(() => {
    if (shareMeta?.publicCartUrl) return shareMeta.publicCartUrl;
    if (typeof window === 'undefined' || !tenantSlug) return '';
    const url = new URL(window.location.href);
    url.pathname = buildTenantPath('/cart', tenantSlug);
    url.search = '';
    return url.toString();
  }, [shareMeta?.publicCartUrl, tenantSlug]);

  const shareMessage = useMemo(() => {
    if (shareMeta?.whatsappShareUrl) return shareMeta.whatsappShareUrl;
    if (!shareUrl) return '';
    const prefix = tenantSlug ? `Catalogo de ${tenantSlug}` : 'Catalogo';
    return `https://wa.me/?text=${encodeURIComponent(`${prefix}: ${shareUrl}`)}`;
  }, [shareMeta?.whatsappShareUrl, shareUrl, tenantSlug]);

  const promotionItems = useMemo(
    () => promotions?.items?.filter((item) => item && promotionTitle(item)) ?? [],
    [promotions],
  );

  useEffect(() => {
    setIsLoading(true);
    setError(null);
    fetchMarketCatalog(tenantSlug)
      .then((response) => {
        const availableProducts = (response?.products ?? []).filter((product) => product.disponible !== false);
        setProducts(availableProducts);
        setPromotions(response?.promotions ?? null);
        setHeroSubtitle(response?.heroSubtitle ?? null);
        setShareMeta({
          publicCartUrl: response?.publicCartUrl ?? null,
          whatsappShareUrl: response?.whatsappShareUrl ?? null,
        });
      })
      .catch((err) => {
        setProducts([]);
        setPromotions(null);
        setHeroSubtitle(null);
        setShareMeta({ publicCartUrl: null, whatsappShareUrl: null });
        setError(err instanceof Error ? err.message : 'No se pudo cargar el catalogo real.');
      })
      .finally(() => setIsLoading(false));
  }, [tenantSlug]);

  const emptyState = !isLoading && products.length === 0;
  const canUseClipboard = typeof navigator !== 'undefined' && Boolean(navigator.clipboard);

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-8">
      <header className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex items-start gap-3">
          <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-lg bg-primary/10 text-primary">
            <ShoppingBag className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold">Marketplace</h1>
            <p className="text-muted-foreground">
              {heroSubtitle ?? 'Explora productos, promociones y compra desde el carrito conversacional.'}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={async () => {
              try {
                if (!shareUrl || !canUseClipboard) return;
                await navigator.clipboard.writeText(shareUrl);
                toast({ title: 'Enlace copiado', description: 'Listo para compartir por WhatsApp o email.' });
              } catch (copyError) {
                toast({ title: 'No se pudo copiar', description: shareUrl, variant: 'destructive' });
              }
            }}
            disabled={!shareUrl || !canUseClipboard}
          >
            <Copy className="mr-2 h-4 w-4" /> Copiar enlace
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              if (!shareMessage) return;
              const whatsappUrl = shareMessage.startsWith('https://wa.me')
                ? shareMessage
                : `https://wa.me/?text=${encodeURIComponent(shareMessage)}`;
              window.open(whatsappUrl, '_blank', 'noopener,noreferrer');
            }}
            disabled={!shareMessage}
          >
            <MessageCircle className="mr-2 h-4 w-4" /> WhatsApp
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              if (!shareUrl) return;
              const qrLink = `https://quickchart.io/qr?text=${encodeURIComponent(shareUrl)}&margin=12&size=320`;
              window.open(qrLink, '_blank', 'noopener,noreferrer');
            }}
            disabled={!shareUrl}
          >
            <QrCode className="mr-2 h-4 w-4" /> QR
          </Button>
        </div>
      </header>

      {promotionItems.length ? (
        <section className="overflow-hidden rounded-lg border bg-gradient-to-br from-emerald-50 via-white to-sky-50 p-4 shadow-sm">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div className="max-w-2xl">
              <Badge variant="outline" className="mb-3 border-emerald-200 bg-white text-emerald-700">
                <Sparkles className="mr-1 h-3.5 w-3.5" />
                Promociones activas
              </Badge>
              <h2 className="text-xl font-semibold text-slate-950">Ofertas listas para comprar</h2>
              <p className="mt-1 text-sm text-slate-600">
                Descuentos configurados por el operador y aplicables desde catalogo, WhatsApp o checkout.
              </p>
            </div>
            <Button asChild className="w-full md:w-auto">
              <Link to={buildTenantPath('/cart', tenantSlug)}>
                <ShoppingBag className="mr-2 h-4 w-4" />
                Ver carrito
              </Link>
            </Button>
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {promotionItems.slice(0, 6).map((promotion) => {
              const detail = promotionDetail(promotion);
              return (
                <div key={promotion.id} className="rounded-lg border border-white/80 bg-white/85 p-4 shadow-sm">
                  <div className="flex items-start gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700">
                      <Percent className="h-5 w-5" />
                    </div>
                    <div className="min-w-0">
                      <h3 className="line-clamp-2 font-semibold text-slate-950">{promotionTitle(promotion)}</h3>
                      {promotionDescription(promotion) ? (
                        <p className="mt-1 line-clamp-2 text-sm text-slate-600">{promotionDescription(promotion)}</p>
                      ) : null}
                      {detail ? (
                        <p className="mt-2 text-xs font-semibold uppercase tracking-wide text-emerald-700">
                          {detail}
                        </p>
                      ) : null}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      ) : null}

      {error ? (
        <Alert variant="destructive">
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      {isLoading ? <p className="text-sm text-muted-foreground">Cargando catalogo...</p> : null}

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
                <Link to={buildTenantPath(`/product/${encodeURIComponent(product.id)}`, tenantSlug)}>
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
          <AlertDescription>Necesitamos el identificador del espacio para mostrar el catalogo.</AlertDescription>
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
