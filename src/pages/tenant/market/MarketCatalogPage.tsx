import React, { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';

import ProductCard from '@/components/market/ProductCard';
import { MarketCartProvider, useMarketCart } from '@/context/MarketCartContext';
import type { MarketCatalogResponse, MarketProduct } from '@/types/market';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { fetchMarketCatalog, searchCatalog } from '@/api/market';
import { Copy, MessageCircle, QrCode, ShoppingBag, Search } from 'lucide-react';
import { toast } from '@/components/ui/use-toast';
import { Badge } from '@/components/ui/badge';
import { buildDemoMarketCatalog } from '@/data/marketDemo';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { useDebounce } from '@/hooks/useDebounce';

function MarketCatalogContent({ tenantSlug }: { tenantSlug: string }) {
  const [products, setProducts] = useState<MarketProduct[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isDemo, setIsDemo] = useState(false);
  const [shareMeta, setShareMeta] = useState<Pick<MarketCatalogResponse, 'publicCartUrl' | 'whatsappShareUrl'> | null>(
    null,
  );

  // Search & Filter State
  const [searchQuery, setSearchQuery] = useState('');
  const [promoFilter, setPromoFilter] = useState(false);
  const [stockFilter, setStockFilter] = useState(false);
  const [priceMax, setPriceMax] = useState('');

  const debouncedQuery = useDebounce(searchQuery, 500);
  const debouncedPrice = useDebounce(priceMax, 500);

  const { addItem, isLoading: isCartLoading } = useMarketCart();
  const shareUrl = useMemo(() => {
    if (shareMeta?.publicCartUrl) return shareMeta.publicCartUrl;
    if (typeof window === 'undefined' || !tenantSlug) return '';
    const url = new URL(window.location.href);
    url.pathname = `/market/${tenantSlug}/cart`;
    url.search = '';
    return url.toString();
  }, [shareMeta?.publicCartUrl, tenantSlug]);
  const shareMessage = useMemo(() => {
    if (shareMeta?.whatsappShareUrl) return shareMeta.whatsappShareUrl;
    if (!shareUrl) return '';
    const prefix = tenantSlug ? `Catálogo de ${tenantSlug}` : 'Catálogo';
    return `https://wa.me/?text=${encodeURIComponent(`${prefix}: ${shareUrl}`)}`;
  }, [shareMeta?.whatsappShareUrl, shareUrl, tenantSlug]);

  useEffect(() => {
    setIsLoading(true);
    setError(null);
    setIsDemo(false);

    const isFiltering = debouncedQuery || promoFilter || stockFilter || debouncedPrice;
    const promise = isFiltering
      ? searchCatalog(tenantSlug, {
          query: debouncedQuery,
          en_promocion: promoFilter,
          con_stock: stockFilter,
          precio_max: debouncedPrice !== '' ? Number(debouncedPrice) : undefined
        })
      : fetchMarketCatalog(tenantSlug);

    promise
      .then((response) => {
        // Apply client-side availability filter only for default fetch.
        // For search, trust the backend filters.
        const rawProducts = response?.products ?? [];
        const availableProducts = isFiltering ? rawProducts : rawProducts.filter(p => p.disponible !== false);
        setProducts(availableProducts);
        setIsDemo(Boolean(response?.isDemo));
        setShareMeta({
          publicCartUrl: response?.publicCartUrl ?? null,
          whatsappShareUrl: response?.whatsappShareUrl ?? null,
        });
      })
      .catch((err) => {
        // Fallback to demo only on initial load or if meaningful error handling strategy exists
        // For search, maybe we just show empty or error, but here we keep existing behavior
        const demo = buildDemoMarketCatalog(tenantSlug).catalog;
        setProducts(demo.products);
        setIsDemo(true);
        setShareMeta({ publicCartUrl: null, whatsappShareUrl: null });
        setError(err instanceof Error ? err.message : 'No se pudo cargar el catálogo en vivo. Mostramos una demo.');
      })
      .finally(() => setIsLoading(false));
  }, [tenantSlug, debouncedQuery, promoFilter, stockFilter, debouncedPrice]);

  const emptyState = !isLoading && products.length === 0;

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-8">
      <header className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex items-start gap-3">
          <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-xl bg-primary/10 text-primary">
            <ShoppingBag className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold">Marketplace</h1>
            <p className="text-muted-foreground">
              Explorá los productos y agregalos al carrito para iniciar tu compra.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" onClick={async () => {
            try {
              if (!shareUrl) return;
              await navigator.clipboard.writeText(shareUrl);
              toast({ title: 'Enlace copiado', description: 'Listo para compartir por WhatsApp o email.' });
            } catch (copyError) {
              toast({ title: 'No se pudo copiar', description: shareUrl, variant: 'destructive' });
            }
          }} disabled={!shareUrl || !navigator?.clipboard}>
            <Copy className="mr-2 h-4 w-4" /> Copiar enlace
          </Button>
          <Button variant="outline" size="sm" onClick={() => {
            if (!shareMessage) return;
            const whatsappUrl = shareMessage.startsWith('https://wa.me')
              ? shareMessage
              : `https://wa.me/?text=${encodeURIComponent(shareMessage)}`;
            window.open(whatsappUrl, '_blank', 'noopener,noreferrer');
          }} disabled={!shareMessage}>
            <MessageCircle className="mr-2 h-4 w-4" /> WhatsApp
          </Button>
          <Button variant="outline" size="sm" onClick={() => {
            if (!shareUrl) return;
            const qrLink = `https://quickchart.io/qr?text=${encodeURIComponent(shareUrl)}&margin=12&size=320`;
            window.open(qrLink, '_blank', 'noopener,noreferrer');
          }} disabled={!shareUrl}>
            <QrCode className="mr-2 h-4 w-4" /> QR
          </Button>
          {isDemo ? <Badge variant="secondary">Demo</Badge> : null}
        </div>
      </header>

      {/* Search & Filters */}
      <div className="flex flex-col gap-4 rounded-lg border p-4 shadow-sm">
        <div className="flex items-center gap-2">
           <div className="relative flex-1">
             <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
             <Input
               placeholder="Buscar productos..."
               value={searchQuery}
               onChange={(e) => setSearchQuery(e.target.value)}
               className="pl-9"
             />
           </div>
        </div>
        <div className="flex flex-wrap items-center gap-6">
          <div className="flex items-center space-x-2">
            <Checkbox id="promo" checked={promoFilter} onCheckedChange={(c) => setPromoFilter(!!c)} />
            <Label htmlFor="promo" className="cursor-pointer">En Promoción</Label>
          </div>
          <div className="flex items-center space-x-2">
            <Checkbox id="stock" checked={stockFilter} onCheckedChange={(c) => setStockFilter(!!c)} />
            <Label htmlFor="stock" className="cursor-pointer">Solo con Stock</Label>
          </div>
          <div className="flex items-center gap-2">
            <Label htmlFor="price" className="whitespace-nowrap">Precio Máximo:</Label>
            <Input
              id="price"
              type="number"
              placeholder="0"
              value={priceMax}
              onChange={(e) => setPriceMax(e.target.value)}
              className="w-24 h-8"
            />
          </div>
        </div>
      </div>

      {isDemo ? (
        <Alert>
          <AlertTitle>Catálogo demo listo para mostrar</AlertTitle>
          <AlertDescription>
            Usa este catálogo de demostración para compartir por WhatsApp o escaneando el QR mientras se conecta el catálogo real.
          </AlertDescription>
        </Alert>
      ) : null}

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
