import React, { useDeferredValue, useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';

import { fetchMarketCatalog } from '@/api/market';
import UploadOrderFromFile from '@/components/cart/UploadOrderFromFile';
import ProductCard from '@/components/market/ProductCard';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from '@/components/ui/use-toast';
import { MarketCartProvider, useMarketCart } from '@/context/MarketCartContext';
import type { MarketAssistedIntakeEntry, MarketCatalogResponse, MarketProduct } from '@/types/market';
import { buildTenantPath } from '@/utils/tenantPaths';
import { ClipboardList, Copy, FileText, MessageCircle, Percent, QrCode, Search, ShoppingBag, SlidersHorizontal, Sparkles, Upload as UploadIcon } from 'lucide-react';

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
  const record = promotion as PromotionItem & Record<string, unknown>;
  if (typeof record.terms_short === 'string' && record.terms_short) return record.terms_short;
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

const promotionBadge = (promotion: PromotionItem): string | null => {
  const record = promotion as PromotionItem & Record<string, unknown>;
  return typeof record.display_badge === 'string' && record.display_badge ? record.display_badge : promotionDetail(promotion) || null;
};

const ASSISTED_UPLOAD_ANCHOR_ID = 'market-assisted-upload';

const ASSISTED_FIRST_MODES = [
  {
    title: 'Foto de papel o manuscrito',
    description: 'Lista escrita a mano, mostrador, ferreteria, supermercado o pedido de materiales.',
    icon: FileText,
  },
  {
    title: 'Pedido pegado desde WhatsApp',
    description: 'El cliente copia texto suelto y Chatboc separa articulos, cantidades y faltantes.',
    icon: MessageCircle,
  },
  {
    title: 'Boleta, certificado o reclamo',
    description: 'Gobiernos y colegios reciben documentos, comprobantes o solicitudes trazables.',
    icon: ClipboardList,
  },
];

function MarketCatalogContent({ tenantSlug }: { tenantSlug: string }) {
  const [products, setProducts] = useState<MarketProduct[]>([]);
  const [promotions, setPromotions] = useState<MarketCatalogResponse['promotions']>(null);
  const [facets, setFacets] = useState<MarketCatalogResponse['facets']>(null);
  const [sortOptions, setSortOptions] = useState<MarketCatalogResponse['sort_options']>(null);
  const [assistedIntake, setAssistedIntake] = useState<MarketAssistedIntakeEntry | null>(null);
  const [frontendContract, setFrontendContract] = useState<MarketCatalogResponse['frontend_contract'] | null>(null);
  const [total, setTotal] = useState<number | null>(null);
  const [totalUnfiltered, setTotalUnfiltered] = useState<number | null>(null);
  const [heroSubtitle, setHeroSubtitle] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [promotionOnly, setPromotionOnly] = useState(false);
  const [selectedSort, setSelectedSort] = useState('promo_first');
  const [shareMeta, setShareMeta] = useState<Pick<MarketCatalogResponse, 'publicCartUrl' | 'whatsappShareUrl'> | null>(
    null,
  );
  const { addItem, isLoading: isCartLoading } = useMarketCart();
  const deferredSearchTerm = useDeferredValue(searchTerm);

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
  const categoryOptions = useMemo(() => {
    const fromBackend = facets?.categories ?? [];
    if (fromBackend.length) return fromBackend;
    const counts = new Map<string, number>();
    products.forEach((product) => {
      if (!product.category) return;
      counts.set(product.category, (counts.get(product.category) ?? 0) + 1);
    });
    return Array.from(counts.entries()).map(([value, count]) => ({ value, label: value, count }));
  }, [facets?.categories, products]);
  const effectiveSortOptions = sortOptions?.length
    ? sortOptions
    : [
        { id: 'promo_first', label: 'Promociones primero' },
        { id: 'name_asc', label: 'Nombre' },
        { id: 'price_asc', label: 'Menor precio' },
        { id: 'price_desc', label: 'Mayor precio' },
      ];
  const catalogStatusLine = useMemo(() => {
    if (isLoading) return 'Actualizando productos, promociones y disponibilidad...';
    const visibleCount = total ?? products.length;
    if (visibleCount === 0 && totalUnfiltered === 0) {
      return 'Catalogo en preparacion. La carga asistida por IA sigue activa para pedidos, boletas y consultas.';
    }
    const parts = [`${visibleCount} ${visibleCount === 1 ? 'visible' : 'visibles'}`];
    if (typeof totalUnfiltered === 'number') parts.push(`de ${totalUnfiltered} publicados`);
    if (facets?.promotion_count) parts.push(`${facets.promotion_count} con promocion`);
    return `${parts.join(' - ')}.`;
  }, [facets?.promotion_count, isLoading, products.length, total, totalUnfiltered]);
  const showAssistedIntake = Boolean(assistedIntake) && frontendContract?.show_assisted_intake !== false;
  const assistedFirstActive = showAssistedIntake && !isLoading && (
    assistedIntake?.mode === 'assisted_first' ||
    totalUnfiltered === 0 ||
    (products.length === 0 && assistedIntake?.show_on_empty_catalog !== false)
  );

  useEffect(() => {
    setIsLoading(true);
    setError(null);
    fetchMarketCatalog(tenantSlug, {
      q: deferredSearchTerm.trim() || null,
      categoria: selectedCategory === 'all' ? null : selectedCategory,
      en_promocion: promotionOnly || null,
      sort: selectedSort,
    })
      .then((response) => {
        const availableProducts = (response?.products ?? []).filter((product) => product.disponible !== false);
        setProducts(availableProducts);
        setPromotions(response?.promotions ?? null);
        setFacets(response?.facets ?? null);
        setSortOptions(response?.sort_options ?? null);
        setAssistedIntake(response?.assisted_intake ?? null);
        setFrontendContract(response?.frontend_contract ?? null);
        setTotal(response?.total ?? availableProducts.length);
        setTotalUnfiltered(response?.total_unfiltered ?? null);
        setHeroSubtitle(response?.heroSubtitle ?? null);
        setShareMeta({
          publicCartUrl: response?.publicCartUrl ?? null,
          whatsappShareUrl: response?.whatsappShareUrl ?? null,
        });
      })
      .catch((err) => {
        setProducts([]);
        setPromotions(null);
        setFacets(null);
        setSortOptions(null);
        setAssistedIntake(null);
        setFrontendContract(null);
        setTotal(null);
        setTotalUnfiltered(null);
        setHeroSubtitle(null);
        setShareMeta({ publicCartUrl: null, whatsappShareUrl: null });
        setError(err instanceof Error ? err.message : 'No se pudo cargar el catalogo real.');
      })
      .finally(() => setIsLoading(false));
  }, [deferredSearchTerm, promotionOnly, selectedCategory, selectedSort, tenantSlug]);

  const emptyState = !isLoading && products.length === 0;
  const canUseClipboard = typeof navigator !== 'undefined' && Boolean(navigator.clipboard);
  const scrollToAssistedUpload = () => {
    const target = document.getElementById(ASSISTED_UPLOAD_ANCHOR_ID);
    if (target) {
      const uploadDropzone = target.querySelector<HTMLElement>('[data-assisted-upload-dropzone="true"]');
      const firstInteractive = uploadDropzone ?? target.querySelector<HTMLElement>('textarea, input, button');
      const scrollTarget = firstInteractive ?? target;
      const alignTarget = () => {
        const rect = scrollTarget.getBoundingClientRect();
        const viewportHeight = window.innerHeight || document.documentElement.clientHeight;
        const desiredTop = Math.max(72, Math.min(180, (viewportHeight - rect.height) / 2));
        const nextTop = Math.max(0, window.scrollY + rect.top - desiredTop);
        window.scrollTo({ top: nextTop, behavior: 'smooth' });
      };
      const focusTarget = () => firstInteractive?.focus({ preventScroll: true });
      alignTarget();
      focusTarget();
      window.setTimeout(() => {
        alignTarget();
        focusTarget();
      }, 450);
    }
  };

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-8">
      <header className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex items-start gap-3">
          <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-lg bg-primary/10 text-primary">
            <ShoppingBag className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold">Marketplace asistido</h1>
            <p className="text-muted-foreground">
              {heroSubtitle ?? 'Explora catalogo, promociones o subi una nota anonima para que la IA arme la solicitud.'}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            onClick={scrollToAssistedUpload}
            disabled={!showAssistedIntake}
          >
            <UploadIcon className="mr-2 h-4 w-4" /> Subir nota, pedido o reclamo
          </Button>
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

      {assistedFirstActive ? (
        <section
          data-testid="assisted-first-banner"
          className="overflow-hidden rounded-xl border border-primary/20 bg-gradient-to-br from-primary/10 via-background to-emerald-500/10 p-5 shadow-sm"
        >
          <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-center">
            <div>
              <Badge variant="outline" className="border-primary/30 bg-background/80 text-primary">
                Marketplace asistido activo
              </Badge>
              <h2 className="mt-3 max-w-3xl text-2xl font-semibold tracking-normal">
                Subi el pedido como viene: foto, papel, boleta o texto.
              </h2>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
                Ideal para vecinos o clientes que no quieren navegar un catalogo. Chatboc interpreta la nota, cruza catalogo cuando exista,
                crea la solicitud en el CRM y devuelve seguimiento publico para continuar por WhatsApp, chat, email o telefono.
              </p>
              <div className="mt-4 grid gap-3 md:grid-cols-3">
                {ASSISTED_FIRST_MODES.map((mode) => {
                  const Icon = mode.icon;
                  return (
                    <div key={mode.title} className="rounded-lg border bg-background/85 p-3 shadow-sm">
                      <div className="flex items-start gap-3">
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                          <Icon className="h-4 w-4" />
                        </span>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold">{mode.title}</p>
                          <p className="mt-1 text-xs leading-5 text-muted-foreground">{mode.description}</p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
            <div className="rounded-xl border bg-background/85 p-4 shadow-sm">
              <p className="text-sm font-semibold">Salida operativa</p>
              <p className="mt-1 text-sm text-muted-foreground">
                El admin recibe archivo/texto original, lectura IA, candidatos de catalogo, datos faltantes, respuesta sugerida y link seguro.
              </p>
              <Button type="button" className="mt-4 w-full" onClick={scrollToAssistedUpload}>
                <UploadIcon className="mr-2 h-4 w-4" />
                Subir pedido o documento
              </Button>
            </div>
          </div>
        </section>
      ) : null}

      {showAssistedIntake ? (
        <UploadOrderFromFile
          id={ASSISTED_UPLOAD_ANCHOR_ID}
          tenantSlug={tenantSlug}
          variant="marketplace"
          intakeEntry={assistedIntake}
          onProcessed={(response) => {
            const requestId = response?.pedido_id ?? response?.lead_id;
            toast({
              title: 'Nota recibida por IA',
              description: requestId
                ? `Solicitud #${requestId}. El equipo puede revisarla desde el CRM.`
                : 'El equipo puede revisarla desde el CRM.',
            });
          }}
        />
      ) : null}

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
              const badge = promotionBadge(promotion);
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
                      {badge ? (
                        <Badge variant="outline" className="mt-2 border-emerald-200 bg-emerald-50 text-emerald-700">
                          {badge}
                        </Badge>
                      ) : null}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      ) : null}

      <section className="rounded-lg border bg-card p-4 shadow-sm">
        <div className="mb-4 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="flex items-center gap-2 text-lg font-semibold">
              <SlidersHorizontal className="h-5 w-5 text-primary" />
              Explorar catalogo o subir pedido asistido
            </h2>
            <p className="text-sm text-muted-foreground">
              {catalogStatusLine}
            </p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <Button
              type="button"
              variant={promotionOnly ? 'default' : 'outline'}
              size="sm"
              onClick={() => setPromotionOnly((prev) => !prev)}
            >
              <Sparkles className="mr-2 h-4 w-4" />
              En promocion
            </Button>
            <Button type="button" size="sm" onClick={scrollToAssistedUpload}>
              <UploadIcon className="mr-2 h-4 w-4" />
              Subir nota o manuscrito
            </Button>
          </div>
        </div>
        <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_220px_220px]">
          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Buscar producto, marca o promo..."
              className="pl-9"
            />
          </div>
          <Select value={selectedCategory} onValueChange={setSelectedCategory}>
            <SelectTrigger>
              <SelectValue placeholder="Categoria" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas las categorias</SelectItem>
              {categoryOptions.map((item) => (
                <SelectItem key={item.value} value={item.value}>
                  {item.label ?? item.value}{typeof item.count === 'number' ? ` (${item.count})` : ''}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={selectedSort} onValueChange={setSelectedSort}>
            <SelectTrigger>
              <SelectValue placeholder="Orden" />
            </SelectTrigger>
            <SelectContent>
              {effectiveSortOptions.map((item) => (
                <SelectItem key={item.id} value={item.id}>
                  {item.label ?? item.id}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </section>

      {error ? (
        <Alert variant="destructive">
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3" aria-label="Cargando catalogo">
          {[0, 1, 2].map((item) => (
            <div key={item} className="min-h-[260px] animate-pulse rounded-lg border bg-card p-4 shadow-sm">
              <div className="h-32 rounded-md bg-muted" />
              <div className="mt-4 h-4 w-3/4 rounded bg-muted" />
              <div className="mt-3 h-3 w-1/2 rounded bg-muted" />
              <div className="mt-6 h-10 rounded bg-muted" />
            </div>
          ))}
        </div>
      ) : null}

      {emptyState ? (
        <div className="rounded-lg border border-dashed bg-card p-6 shadow-sm">
          <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_300px] lg:items-center">
            <div className="max-w-2xl">
              <Badge variant="secondary" className="mb-3">Compra asistida activa</Badge>
              <h3 className="text-xl font-semibold">
                {assistedIntake?.empty_state?.title ?? 'Catalogo sin productos visibles, pedido asistido disponible.'}
              </h3>
              <p className="mt-2 text-sm text-muted-foreground">
                {assistedIntake?.empty_state?.description ??
                  'El catalogo puede estar en preparacion o la busqueda puede no coincidir. Igual podes subir una foto, PDF, boleta o nota manuscrita: Chatboc separa articulos, cantidades, rubro o tramite, crea la solicitud en CRM y genera seguimiento publico.'}
              </p>
              <div className="mt-4 grid gap-2 text-sm text-muted-foreground sm:grid-cols-3">
                <span className="rounded-md border bg-background px-3 py-2">Papel o texto recibido</span>
                <span className="rounded-md border bg-background px-3 py-2">IA discrimina articulos</span>
                <span className="rounded-md border bg-background px-3 py-2">CRM responde y sigue</span>
              </div>
            </div>
            <div className="rounded-lg border bg-muted/30 p-4">
              <p className="font-semibold">Camino recomendado</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Si tenes una lista de ferreteria, supermercado, bebidas, un comprobante o una foto de papel, subi el archivo para generar referencia y contacto comercial.
              </p>
            </div>
          </div>
          <div className="mt-5 flex flex-col gap-2 sm:flex-row">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setSearchTerm('');
                  setSelectedCategory('all');
                  setPromotionOnly(false);
                }}
              >
                <Search className="mr-2 h-4 w-4" />
                Limpiar filtros
              </Button>
              <Button type="button" onClick={scrollToAssistedUpload}>
                <UploadIcon className="mr-2 h-4 w-4" />
                {assistedIntake?.empty_state?.primary_cta ?? 'Subir pedido o comprobante'}
              </Button>
              {shareMeta?.whatsappShareUrl ? (
                <Button asChild>
                  <a href={shareMeta.whatsappShareUrl} target="_blank" rel="noreferrer">
                    <MessageCircle className="mr-2 h-4 w-4" />
                    Consultar por WhatsApp
                  </a>
                </Button>
              ) : null}
          </div>
        </div>
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
  const tenantSlug = useMemo(() => params.tenantSlug ?? params.tenant ?? null, [params.tenant, params.tenantSlug]);

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
