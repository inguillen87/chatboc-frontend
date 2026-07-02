import React, { useDeferredValue, useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';

import { fetchMarketCatalog } from '@/api/market';
import UploadOrderFromFile from '@/components/cart/UploadOrderFromFile';
import ProductCard from '@/components/market/ProductCard';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import OperationalContinuityBar from '@/components/operations/OperationalContinuityBar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from '@/components/ui/use-toast';
import { MarketCartProvider, useMarketCart } from '@/context/MarketCartContext';
import type { MarketAssistedIntakeEntry, MarketCatalogResponse, MarketProduct } from '@/types/market';
import { buildTenantPath } from '@/utils/tenantPaths';
import { trackFrontendEvent } from '@/utils/frontendTelemetry';
import { ArrowRight, CheckCircle2, ClipboardList, Copy, FileText, MessageCircle, Percent, QrCode, Search, ShieldCheck, ShoppingBag, SlidersHorizontal, Sparkles, Upload as UploadIcon } from 'lucide-react';

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
    title: 'Foto o manuscrito',
    description: 'Lista escrita a mano, mostrador, ferreteria, supermercado o pedido de materiales.',
    icon: FileText,
  },
  {
    title: 'Texto de WhatsApp',
    description: 'El cliente copia texto suelto y Chatboc separa articulos, cantidades y faltantes.',
    icon: MessageCircle,
  },
  {
    title: 'Documento o reclamo',
    description: 'Gobiernos y colegios reciben documentos, comprobantes o solicitudes trazables.',
    icon: ClipboardList,
  },
];

const EMPTY_FLOW_STEPS = [
  {
    label: 'Subir foto o manuscrito',
    description: 'Nota de mostrador, lista escrita, boleta, comprobante o PDF.',
  },
  {
    label: 'Escribir lista',
    description: 'Pegas el pedido desde WhatsApp o lo cargas como texto simple.',
  },
  {
    label: 'Continuar por WhatsApp',
    description: 'El equipo responde con seguimiento si faltan datos, stock o precio.',
  },
];

const DEFAULT_COMMERCE_LOOP_STEPS = [
  { stage: 'catalog', event: 'catalog_viewed', label: 'Catalogo visto' },
  { stage: 'assist', event: 'assisted_upload_submitted', label: 'Pedido asistido' },
  { stage: 'cart', event: 'cart_started', label: 'Carrito iniciado' },
  { stage: 'checkout', event: 'checkout_session_created', label: 'Checkout creado' },
  { stage: 'order', event: 'order_created', label: 'Pedido generado' },
  { stage: 'tracking', event: 'order_tracking_opened', label: 'Seguimiento abierto' },
];

const ASSISTED_ENTRY_PROMISES = [
  'Foto de papel, boleta, certificado o comprobante',
  'Pedido escrito, lista de materiales o texto de WhatsApp',
  'Reclamo, tramite o consulta con seguimiento publico',
];

const ASSISTED_TEAM_HANDOFFS = [
  {
    title: 'Pedido desmenuzado',
    description: 'Articulos, cantidades, tramite o reclamo separados para que el equipo no vuelva a interpretar la nota.',
    icon: ClipboardList,
  },
  {
    title: 'Datos faltantes',
    description: 'Direccion, contacto, stock, precio o documentacion pendiente quedan marcados como proximo paso.',
    icon: FileText,
  },
  {
    title: 'Respuesta lista',
    description: 'Borrador y seguimiento publico para continuar por WhatsApp, mail, llamada o panel.',
    icon: MessageCircle,
  },
];

const publicMarketplaceText = (value: unknown) =>
  String(value ?? '')
    .replace(/\bOCR\s*\+\s*IA\b/gi, 'Lectura del documento')
    .replace(/\bIntake\b/gi, 'Ingreso')
    .replace(/\bCRM\b/g, 'panel')
    .replace(/\bIA\b/g, 'lectura')
    .replace(/\s+/g, ' ')
    .trim();

const commerceLoopDescription = (stageOrEvent: string) => {
  const normalized = stageOrEvent.toLowerCase();
  if (normalized.includes('catalog')) return 'El cliente ve disponibilidad y promociones.';
  if (normalized.includes('assist') || normalized.includes('upload')) return 'Puede subir foto, texto o documento si no encuentra el producto.';
  if (normalized.includes('cart')) return 'Carrito persistente por sesion anonima o usuario.';
  if (normalized.includes('checkout')) return 'Checkout seguro con pagos habilitados por tenant.';
  if (normalized.includes('order')) return 'Pedido o solicitud queda en el panel operativo.';
  if (normalized.includes('tracking')) return 'Seguimiento publico para continuar sin perder contexto.';
  return 'Paso operativo registrado para que el equipo pueda responder.';
};

const commerceLoopEventLabel = (eventName: string) =>
  eventName
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase());

const FALLBACK_ASSISTED_INTAKE: MarketAssistedIntakeEntry = {
  contract_version: 'marketplace.assisted_intake_entry.v1',
  mode: 'assisted_first',
  title: 'Subi una nota, foto o pedido y Chatboc lo convierte en solicitud trazable',
  summary:
    'Funciona aunque el catalogo este vacio: interpreta articulos, documentos, reclamos o datos de contacto y deja una solicitud clara para responder.',
  anonymous_intake: true,
  catalog_matching: true,
  show_on_empty_catalog: true,
  submit: {
    contract_version: 'marketplace.assisted_intake_submit.v1',
    method: 'POST',
    endpoint: '/api/pedidos/from-file?origen=marketplace',
    content_type: 'multipart/form-data',
    tenant_fields: ['X-Tenant'],
    headers: ['X-Tenant', 'X-Checkout-Origin'],
    file_field: 'archivo',
    text_field: 'pedido_text',
    document_type_field: 'document_type',
    contact_fields: ['contact_name', 'contact_phone', 'contact_email', 'contact_notes'],
    accepted_mime_types: ['image/jpeg', 'image/png', 'image/webp', 'application/pdf', 'text/plain'],
    accepted_extensions: ['.jpg', '.jpeg', '.png', '.webp', '.pdf', '.txt'],
    max_file_mb: 8,
    max_text_chars: 4000,
  },
  input_examples: [
    'Foto de una nota manuscrita',
    'Pedido pegado desde WhatsApp',
    'Boleta, comprobante o certificado',
    'Reclamo vecinal con direccion',
  ],
  text_examples: [
    {
      id: 'fallback_hardware_order',
      label: 'Ferreteria',
      document_type: 'quote_request',
      text: '2 chapas galvanizadas\n1 caja de clavos punta paris\n3 bolsas de cemento',
    },
    {
      id: 'fallback_municipal_claim',
      label: 'Reclamo',
      document_type: 'service_request',
      text: 'Luminaria quemada en Don Bosco 55 esquina Sarmiento. De noche queda muy oscuro.',
    },
  ],
  document_types: [
    { id: 'order_note', label: 'Nota de pedido', helper: 'Lista de productos, cantidades o materiales.' },
    { id: 'handwritten_order', label: 'Nota manuscrita', helper: 'Foto de papel o mostrador.' },
    { id: 'quote_request', label: 'Cotizacion', helper: 'Pedido para presupuestar o revisar stock.' },
    { id: 'receipt', label: 'Factura / recibo', helper: 'Pago, factura, recibo o constancia.' },
    { id: 'tax_bill', label: 'Boleta / impuesto', helper: 'Tasa, impuesto, padron o vencimiento.' },
    { id: 'certificate', label: 'Certificado / tramite', helper: 'Documentacion o permiso para validar.' },
    { id: 'service_request', label: 'Reclamo vecinal', helper: 'Bache, luminaria, agua, limpieza o solicitud municipal.' },
  ],
  pipeline: [
    { id: 'capture', label: 'Carga publica', description: 'Foto, PDF, texto o nota escrita sin registro.' },
    { id: 'ai_parse', label: 'Datos ordenados', description: 'Productos, cantidades, tramite, reclamo y faltantes.' },
    { id: 'crm_handoff', label: 'Equipo informado', description: 'Resumen, archivo original y respuesta sugerida.' },
    { id: 'public_follow_up', label: 'Seguimiento', description: 'Link o WhatsApp para continuar sin perder contexto.' },
  ],
  crm_receives: [
    'Archivo o texto original',
    'Resumen con articulos, reclamos o datos detectados',
    'Cruce con catalogo cuando exista',
    'Datos faltantes y respuesta sugerida',
    'Link publico de seguimiento',
  ],
  empty_state: {
    title: 'Catalogo sin productos visibles, pedido asistido disponible.',
    description:
      'Aunque no haya productos publicados todavia, podes subir una foto, boleta, PDF o nota manuscrita para que el equipo la gestione.',
    primary_cta: 'Subir pedido o documento',
  },
  frontend_contract: {
    render_as: 'marketplace_assisted_intake',
    show_quick_examples: true,
    fallback: true,
  },
};

function MarketCatalogContent({ tenantSlug }: { tenantSlug: string }) {
  const [products, setProducts] = useState<MarketProduct[]>([]);
  const [promotions, setPromotions] = useState<MarketCatalogResponse['promotions']>(null);
  const [facets, setFacets] = useState<MarketCatalogResponse['facets']>(null);
  const [sortOptions, setSortOptions] = useState<MarketCatalogResponse['sort_options']>(null);
  const [assistedIntake, setAssistedIntake] = useState<MarketAssistedIntakeEntry | null>(null);
  const [frontendContract, setFrontendContract] = useState<MarketCatalogResponse['frontend_contract'] | null>(null);
  const [publicApi, setPublicApi] = useState<MarketCatalogResponse['public_api'] | null>(null);
  const [total, setTotal] = useState<number | null>(null);
  const [totalUnfiltered, setTotalUnfiltered] = useState<number | null>(null);
  const [heroSubtitle, setHeroSubtitle] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [promotionOnly, setPromotionOnly] = useState(false);
  const [selectedSort, setSelectedSort] = useState('promo_first');
  const [assistedDraftRequest, setAssistedDraftRequest] = useState<{ text: string; key: number } | null>(null);
  const [shareMeta, setShareMeta] = useState<Pick<MarketCatalogResponse, 'publicCartUrl' | 'whatsappShareUrl'> | null>(
    null,
  );
  const { addItem, items: cartItems, totalAmount: cartTotalAmount, isLoading: isCartLoading } = useMarketCart();
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
  const commerceLoopSteps = useMemo(() => {
    const funnel = publicApi?.analytics?.funnel;
    const source = Array.isArray(funnel) && funnel.length
      ? funnel
      : publicApi?.analytics?.recommended_events?.length
        ? publicApi.analytics.recommended_events
            .filter((eventName) => DEFAULT_COMMERCE_LOOP_STEPS.some((step) => step.event === eventName))
            .map((eventName) => DEFAULT_COMMERCE_LOOP_STEPS.find((step) => step.event === eventName)!)
        : DEFAULT_COMMERCE_LOOP_STEPS;
    return source
      .map((rawStep, index) => {
        const record = rawStep as Record<string, unknown>;
        const stage = publicMarketplaceText(record.stage);
        const eventName = publicMarketplaceText(record.event);
        const label =
          publicMarketplaceText(record.label) ||
          commerceLoopEventLabel(eventName || stage || `Paso ${index + 1}`);
        const id = stage || eventName || `step-${index}`;
        return {
          id,
          label,
          eventName,
          description: publicMarketplaceText(record.description) || commerceLoopDescription(`${stage} ${eventName}`),
        };
      })
      .filter((step) => step.label)
      .slice(0, 6);
  }, [publicApi?.analytics?.funnel, publicApi?.analytics?.recommended_events]);
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
    const publishedCount = typeof totalUnfiltered === 'number' ? totalUnfiltered : products.length;
    if (visibleCount === 0 && publishedCount === 0) {
      return 'Subi una foto, lista, boleta o reclamo. El equipo recibe una solicitud ordenada y responde con seguimiento.';
    }
    const parts = [`${visibleCount} ${visibleCount === 1 ? 'visible' : 'visibles'}`];
    if (typeof totalUnfiltered === 'number') parts.push(`de ${totalUnfiltered} publicados`);
    if (facets?.promotion_count) parts.push(`${facets.promotion_count} con promocion`);
    return `${parts.join(' - ')}.`;
  }, [facets?.promotion_count, isLoading, products.length, total, totalUnfiltered]);
  const emptyState = !isLoading && products.length === 0;
  const catalogActuallyEmpty = (totalUnfiltered ?? products.length) === 0;
  const forceAssistedIntakeForEmptyCatalog = emptyState && catalogActuallyEmpty;
  const assistedIntakeDisabled =
    frontendContract?.show_assisted_intake === false && !forceAssistedIntakeForEmptyCatalog;
  const effectiveAssistedIntake = assistedIntakeDisabled ? null : assistedIntake ?? FALLBACK_ASSISTED_INTAKE;
  const showAssistedIntake = Boolean(effectiveAssistedIntake);
  const hasActiveFilters = Boolean(deferredSearchTerm.trim() || selectedCategory !== 'all' || promotionOnly);
  const noResultsSearchTerm = !isLoading && products.length === 0 && !catalogActuallyEmpty
    ? deferredSearchTerm.trim()
    : '';
  const buildNoResultsSearchDraft = (term: string) => [
    `Busco: ${term}`,
    'No lo encontre en el catalogo. Quiero que el equipo revise disponibilidad, precio o alternativa y me responda.',
  ].join('\n');
  const assistedFirstActive = showAssistedIntake && !isLoading && (
    effectiveAssistedIntake?.mode === 'assisted_first' ||
    totalUnfiltered === 0 ||
    (products.length === 0 && effectiveAssistedIntake?.show_on_empty_catalog !== false)
  );
  const showCatalogFilters = !assistedFirstActive || !catalogActuallyEmpty || hasActiveFilters;
  const cartItemCount = cartItems.reduce((sum, item) => sum + (Number(item.quantity) || 1), 0);
  const cartTotalLabel = typeof cartTotalAmount === 'number' ? moneyFormatter.format(cartTotalAmount) : '-';

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
        setPublicApi(response?.public_api ?? null);
        setTotal(response?.total ?? availableProducts.length);
        setTotalUnfiltered(response?.total_unfiltered ?? null);
        setHeroSubtitle(response?.heroSubtitle ?? null);
        setShareMeta({
          publicCartUrl: response?.publicCartUrl ?? null,
          whatsappShareUrl: response?.whatsappShareUrl ?? null,
        });
        trackFrontendEvent('catalog_viewed', {
          tenant_slug: tenantSlug,
          screen_name: 'marketplace_public_catalog',
          channel: 'web_marketplace',
          product_count: availableProducts.length,
          total_unfiltered: response?.total_unfiltered ?? availableProducts.length,
          assisted_intake_mode: response?.assisted_intake?.mode ?? null,
          public_api_contract: response?.public_api?.contract_version ?? null,
          analytics_contract: response?.public_api?.analytics?.contract_version ?? null,
          client_signal_channel: response?.public_api?.analytics?.client_signal_channel ?? 'dataLayer',
        });
      })
      .catch((err) => {
        setProducts([]);
        setPromotions(null);
        setFacets(null);
        setSortOptions(null);
        setAssistedIntake(null);
        setFrontendContract(null);
        setPublicApi(null);
        setTotal(null);
        setTotalUnfiltered(null);
        setHeroSubtitle(null);
        setShareMeta({ publicCartUrl: null, whatsappShareUrl: null });
        setError(err instanceof Error ? err.message : 'No se pudo cargar el catalogo real.');
      })
      .finally(() => setIsLoading(false));
  }, [deferredSearchTerm, promotionOnly, selectedCategory, selectedSort, tenantSlug]);

  const assistedPrimaryCta = effectiveAssistedIntake?.empty_state?.primary_cta ?? 'Subir pedido o documento';
  const canUseClipboard = typeof navigator !== 'undefined' && Boolean(navigator.clipboard);
  const trackMarketplaceCta = (eventName: string, source: string, extra: Record<string, unknown> = {}) => {
    trackFrontendEvent(eventName, {
      tenant_slug: tenantSlug,
      screen_name: 'marketplace_public_catalog',
      channel: 'web_marketplace',
      source,
      public_api_contract: publicApi?.contract_version ?? null,
      analytics_contract: publicApi?.analytics?.contract_version ?? null,
      ...extra,
    });
  };
  const openWhatsappShare = (source: string) => {
    if (!shareMessage) return;
    trackMarketplaceCta('whatsapp_cta_clicked', source);
    const whatsappUrl = shareMessage.startsWith('https://wa.me')
      ? shareMessage
      : `https://wa.me/?text=${encodeURIComponent(shareMessage)}`;
    window.open(whatsappUrl, '_blank', 'noopener,noreferrer');
  };
  const scrollToAssistedUpload = (preferredMode: 'file' | 'text' = 'file') => {
    const target = document.getElementById(ASSISTED_UPLOAD_ANCHOR_ID);
    if (target) {
      const uploadDropzone = target.querySelector<HTMLElement>('[data-assisted-upload-dropzone="true"]');
      const uploadTextarea = target.querySelector<HTMLElement>('[data-assisted-textarea="true"]');
      const preferredInteractive = preferredMode === 'text' ? uploadTextarea : uploadDropzone;
      const firstInteractive = preferredInteractive ?? uploadDropzone ?? target.querySelector<HTMLElement>('textarea, input, button');
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
  const activateAssistedUpload = (preferredMode: 'file' | 'text' = 'file') => {
    trackMarketplaceCta('assisted_upload_started', preferredMode === 'text' ? 'write_list_cta' : 'upload_file_cta', {
      preferred_mode: preferredMode,
      assisted_intake_mode: effectiveAssistedIntake?.mode ?? null,
      catalog_empty: catalogActuallyEmpty,
      filtered_empty: Boolean(noResultsSearchTerm.trim()),
    });
    const resolvedSearchTerm = noResultsSearchTerm.trim();
    if (resolvedSearchTerm) {
      setAssistedDraftRequest((current) => ({
        text: buildNoResultsSearchDraft(resolvedSearchTerm),
        key: (current?.key ?? 0) + 1,
      }));
      scrollToAssistedUpload('text');
      return;
    }
    scrollToAssistedUpload(preferredMode);
  };

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 overflow-x-hidden px-4 py-5 sm:gap-5 sm:py-6 md:py-8">
      <header className="flex min-w-0 flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-primary/10 text-primary">
            <ShoppingBag className="h-6 w-6" />
          </div>
          <div className="min-w-0">
            <h1 className="text-xl font-semibold sm:text-2xl">Marketplace asistido</h1>
            <p className="line-clamp-2 text-sm text-muted-foreground sm:text-base">
              {assistedFirstActive
                ? 'Atencion sin registro para pedidos, reclamos, boletas y documentos. El equipo recibe todo ordenado para responder.'
                : heroSubtitle ?? 'Explora catalogo, promociones o subi una nota anonima para que el equipo reciba una solicitud ordenada.'}
            </p>
          </div>
        </div>

        <div className="hidden flex-wrap items-center gap-2 md:flex">
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
            onClick={() => openWhatsappShare('desktop_share_button')}
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

      <OperationalContinuityBar
        testId="market-operational-continuity"
        icon={ShoppingBag}
        tone={cartItemCount > 0 ? 'success' : assistedFirstActive ? 'warning' : 'default'}
        title="Operacion comercial conectada"
        subtitle={
          assistedFirstActive
            ? 'El cliente puede subir una nota, foto o documento y el equipo recibe una solicitud ordenada en el panel operativo.'
            : 'Catalogo, promociones, carrito, WhatsApp y seguimiento quedan unidos en el mismo recorrido de compra.'
        }
        reference={tenantSlug}
        statusLabel={isLoading ? 'Actualizando catalogo' : catalogActuallyEmpty ? 'Solicitud abierta' : `${products.length} visibles`}
        channelLabel="Webview / WhatsApp"
        liveLabel={shareMessage ? 'WhatsApp listo' : 'Canal web'}
        slaLabel={publicApi?.analytics?.contract_version ?? 'Analytics operativo'}
        nextActionLabel={
          cartItemCount > 0
            ? 'Revisar carrito y checkout'
            : assistedFirstActive
              ? 'Subir pedido o documento'
              : 'Explorar catalogo'
        }
        primaryActionLabel={cartItemCount > 0 ? 'Ver carrito' : assistedPrimaryCta}
        onPrimaryAction={() => {
          if (cartItemCount > 0) {
            window.location.href = buildTenantPath('/cart', tenantSlug);
            return;
          }
          activateAssistedUpload('file');
        }}
        secondaryActionLabel="WhatsApp"
        onSecondaryAction={() => openWhatsappShare('continuity_bar')}
        metrics={[
          { label: 'Carrito', value: cartItemCount, tone: cartItemCount > 0 ? 'success' : 'muted' },
          { label: 'Total', value: cartTotalLabel, tone: cartItemCount > 0 ? 'success' : 'muted' },
          { label: 'Promos', value: promotionItems.length, tone: promotionItems.length > 0 ? 'live' : 'muted' },
          { label: 'Loop', value: `${commerceLoopSteps.length} pasos`, tone: 'default' },
        ]}
      />

      <section
        data-testid="market-primary-actions"
        className="rounded-lg border bg-card p-3 shadow-sm sm:p-4"
      >
        <div className="flex min-w-0 flex-col gap-1">
          <h2 className="flex min-w-0 items-center gap-2 text-base font-semibold sm:text-lg">
            {assistedFirstActive ? (
              <UploadIcon className="h-5 w-5 shrink-0 text-primary" />
            ) : (
              <SlidersHorizontal className="h-5 w-5 shrink-0 text-primary" />
            )}
            <span className="min-w-0 truncate">
              {assistedFirstActive ? 'Cargar pedido, reclamo o documento' : 'Buscar o cargar pedido'}
            </span>
          </h2>
          <p className="text-sm text-muted-foreground">{catalogStatusLine}</p>
        </div>

        {assistedFirstActive ? (
          <div
            data-testid="market-assisted-command"
            className="mt-3 overflow-hidden rounded-lg border border-primary/25 bg-primary/5 p-3 sm:p-4"
          >
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="min-w-0">
                <Badge variant="outline" className="border-primary/30 bg-background/80 text-primary">
                  Sin registro
                </Badge>
                <h3 className="mt-2 text-lg font-semibold tracking-normal">
                  Subi una foto, lista o documento. El equipo te responde con seguimiento.
                </h3>
                <p className="mt-1 max-w-3xl text-sm leading-6 text-muted-foreground">
                  No hace falta navegar producto por producto: sirve para notas manuscritas, boletas, certificados, reclamos, pedidos de ferreteria, supermercado, bebidas o mensajes copiados de WhatsApp.
                </p>
              </div>
              <div className="grid w-full shrink-0 gap-2 sm:grid-cols-2 lg:w-auto">
                <Button type="button" className="w-full" onClick={() => activateAssistedUpload('file')}>
                  <UploadIcon className="mr-2 h-4 w-4" />
                  Subir foto o archivo
                </Button>
                <Button type="button" variant="outline" className="w-full" onClick={() => activateAssistedUpload('text')}>
                  <FileText className="mr-2 h-4 w-4" />
                  Escribir lista
                </Button>
              </div>
            </div>
            <div
              data-testid="market-assisted-public-promise"
              className="mt-3 grid gap-2 text-sm sm:grid-cols-2 lg:grid-cols-4"
            >
              {ASSISTED_FIRST_MODES.map((mode) => {
                const Icon = mode.icon;
                return (
                  <div key={mode.title} className="min-w-0 rounded-md border bg-background/85 px-3 py-2">
                    <div className="flex items-center gap-2 font-semibold text-foreground">
                      <Icon className="h-4 w-4 shrink-0 text-primary" />
                      <span className="truncate">{mode.title}</span>
                    </div>
                    <p className="mt-1 line-clamp-2 text-xs leading-5 text-muted-foreground">{mode.description}</p>
                  </div>
                );
              })}
              <div className="min-w-0 rounded-md border bg-background/85 px-3 py-2">
                <div className="flex items-center gap-2 font-semibold text-foreground">
                  <ClipboardList className="h-4 w-4 shrink-0 text-primary" />
                  <span className="truncate">Seguimiento seguro</span>
                </div>
                <p className="mt-1 line-clamp-2 text-xs leading-5 text-muted-foreground">
                  Referencia publica para consultar estado o continuar por WhatsApp.
                </p>
              </div>
            </div>
            <div
              data-testid="market-assisted-team-handoff"
              className="mt-3 grid gap-2 rounded-lg border border-background/70 bg-background/80 p-2 sm:grid-cols-3"
            >
              {ASSISTED_TEAM_HANDOFFS.map((handoff) => {
                const Icon = handoff.icon;
                return (
                  <div key={handoff.title} className="min-w-0 rounded-md border bg-muted/30 px-3 py-2">
                    <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                      <Icon className="h-4 w-4 shrink-0 text-primary" />
                      <span className="truncate">{handoff.title}</span>
                    </div>
                    <p className="mt-1 line-clamp-2 text-xs leading-5 text-muted-foreground">{handoff.description}</p>
                  </div>
                );
              })}
            </div>
          </div>
        ) : showAssistedIntake ? (
          <div className="mt-3 rounded-lg border border-primary/20 bg-primary/5 p-3">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <div className="min-w-0">
                <Badge variant="outline" className="border-primary/30 bg-background/80 text-primary">
                  Ingreso sin registro
                </Badge>
                <p className="mt-2 text-sm font-semibold">
                  {catalogActuallyEmpty
                    ? 'Aunque no haya productos visibles, el cliente puede iniciar una solicitud completa.'
                    : 'Si el cliente no encuentra el producto, puede subir su pedido como lo tiene.'}
                </p>
                <div className="mt-2 grid gap-2 text-xs text-muted-foreground sm:grid-cols-3">
                  {ASSISTED_ENTRY_PROMISES.map((promise) => (
                    <span key={promise} className="rounded-md border bg-background/85 px-2.5 py-2 leading-5">
                      {promise}
                    </span>
                  ))}
                </div>
                <p className="mt-2 text-xs leading-5 text-muted-foreground">
                  El equipo recibe archivo/texto original, datos ordenados, candidatos de catalogo, datos faltantes y respuesta sugerida.
                </p>
              </div>
              <Button type="button" className="w-full shrink-0 sm:w-auto" onClick={() => activateAssistedUpload('file')}>
                <UploadIcon className="mr-2 h-4 w-4" />
                {assistedPrimaryCta}
              </Button>
            </div>
          </div>
        ) : null}

        {showCatalogFilters ? (
          <div className="mt-3 grid min-w-0 gap-2 md:grid-cols-2 lg:grid-cols-[minmax(0,1fr)_auto_190px_190px_auto]">
            <div className="relative min-w-0 md:col-span-2 lg:col-span-1">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Buscar producto, marca o promo..."
                className="w-full min-w-0 pl-9"
              />
            </div>
            <Button
              type="button"
              data-testid="market-assisted-upload-cta"
              onClick={() => activateAssistedUpload('file')}
              disabled={!showAssistedIntake}
              className="w-full whitespace-normal text-left leading-tight sm:whitespace-nowrap lg:w-auto"
            >
              <UploadIcon className="mr-2 h-4 w-4 shrink-0" />
              Subir pedido/foto/texto
            </Button>
            <Select value={selectedCategory} onValueChange={setSelectedCategory}>
              <SelectTrigger className="w-full min-w-0">
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
              <SelectTrigger className="w-full min-w-0">
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
            <Button
              type="button"
              variant={promotionOnly ? 'default' : 'outline'}
              onClick={() => setPromotionOnly((prev) => !prev)}
              className="w-full whitespace-normal leading-tight sm:whitespace-nowrap lg:w-auto"
            >
              <Sparkles className="mr-2 h-4 w-4 shrink-0" />
              En promocion
            </Button>
          </div>
        ) : null}

        <div className="mt-3 grid min-w-0 gap-2 sm:grid-cols-2 md:hidden">
          <Button
            type="button"
            variant="outline"
            onClick={() => openWhatsappShare('mobile_share_button')}
            disabled={!shareMessage}
            className="w-full"
          >
            <MessageCircle className="mr-2 h-4 w-4" />
            Continuar por WhatsApp
          </Button>
          <Button
            type="button"
            variant="outline"
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
            className="w-full"
          >
            <Copy className="mr-2 h-4 w-4" />
            Copiar enlace
          </Button>
        </div>
      </section>

      {commerceLoopSteps.length ? (
        <section
          data-testid="market-commerce-loop"
          className="overflow-hidden rounded-lg border bg-card shadow-sm"
          aria-label="Seguimiento operativo del pedido"
        >
          <div className="flex flex-col gap-3 border-b bg-muted/30 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                <ShieldCheck className="h-4 w-4 shrink-0 text-primary" />
                <span>Pedido trazable de punta a punta</span>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                Catalogo, pedido asistido, carrito, checkout y seguimiento quedan conectados al panel.
              </p>
            </div>
            <Badge variant="outline" className="w-fit border-primary/25 bg-primary/5 text-primary">
              {publicApi?.analytics?.write_mode === 'frontend_signal_plus_server_reconciliation'
                ? 'Frontend + servidor'
                : publicApi?.analytics?.contract_version ?? 'Loop operativo'}
            </Badge>
          </div>
          <div className="grid gap-0 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
            {commerceLoopSteps.map((step, index) => (
              <div key={`${step.id}-${index}`} className="relative min-w-0 border-b p-4 last:border-b-0 sm:border-r lg:border-b-0">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <CheckCircle2 className="h-4 w-4" />
                  </div>
                  {index < commerceLoopSteps.length - 1 ? (
                    <ArrowRight className="hidden h-4 w-4 shrink-0 text-muted-foreground xl:block" />
                  ) : null}
                </div>
                <p className="mt-3 line-clamp-2 text-sm font-semibold text-foreground">{step.label}</p>
                <p className="mt-1 line-clamp-3 text-xs leading-5 text-muted-foreground">{step.description}</p>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {showAssistedIntake ? (
        <UploadOrderFromFile
          id={ASSISTED_UPLOAD_ANCHOR_ID}
          tenantSlug={tenantSlug}
          variant="marketplace"
          intakeEntry={effectiveAssistedIntake}
          fallbackWhatsappHref={shareMeta?.whatsappShareUrl ?? null}
          suggestedTextDraft={assistedDraftRequest?.text ?? null}
          suggestedTextDraftKey={assistedDraftRequest?.key ?? null}
          suggestedDocumentType={assistedDraftRequest?.text ? 'quote_request' : null}
          onProcessed={(response) => {
            const requestId = response?.pedido_id ?? response?.lead_id;
            toast({
              title: 'Solicitud recibida',
              description: requestId
                ? `Solicitud #${requestId}. El equipo puede revisarla desde el panel.`
                : 'El equipo puede revisarla desde el panel.',
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

      {emptyState && !(assistedFirstActive && catalogActuallyEmpty) ? (
        <div data-testid="market-empty-state" className="rounded-lg border border-dashed bg-card p-4 shadow-sm sm:p-6">
          <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_300px] lg:items-center">
            <div className="max-w-2xl">
              <Badge variant="secondary" className="mb-3">Compra asistida activa</Badge>
              <h3 className="text-xl font-semibold">
                {hasActiveFilters && !catalogActuallyEmpty
                  ? 'No hay productos para esos filtros, pero podes cargar el pedido igual.'
                  : publicMarketplaceText(effectiveAssistedIntake?.empty_state?.title) || 'Catalogo sin productos visibles, pedido asistido disponible.'}
              </h3>
              <p className="mt-2 text-sm text-muted-foreground">
                {hasActiveFilters && !catalogActuallyEmpty
                  ? 'Limpia filtros para volver al catalogo o subi una nota/foto: Chatboc la transforma en pedido, reclamo o consulta para que el equipo responda.'
                  : publicMarketplaceText(effectiveAssistedIntake?.empty_state?.description) ||
                    'El catalogo puede estar en preparacion. Igual podes subir una foto, PDF, boleta o nota manuscrita: Chatboc separa articulos, cantidades, rubro o tramite y genera seguimiento publico.'}
              </p>
              <div className="mt-4 grid gap-2 text-sm text-muted-foreground sm:grid-cols-3">
                {EMPTY_FLOW_STEPS.map((step) => (
                  <div key={step.label} className="min-w-0 rounded-md border bg-background px-3 py-2">
                    <p className="break-words font-semibold text-foreground">{step.label}</p>
                    <p className="mt-1 break-words text-xs leading-5">{step.description}</p>
                  </div>
                ))}
              </div>
            </div>
            <div className="rounded-lg border bg-muted/30 p-4">
              <p className="font-semibold">Camino recomendado</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Si tenes una lista de ferreteria, supermercado, bebidas, un comprobante o una foto de papel, cargala para generar referencia y contacto comercial.
              </p>
            </div>
          </div>
          <div className="mt-5 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
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
            <Button type="button" onClick={() => activateAssistedUpload('file')}>
              <UploadIcon className="mr-2 h-4 w-4" />
              {effectiveAssistedIntake?.empty_state?.primary_cta ?? 'Subir pedido o comprobante'}
            </Button>
            {shareMeta?.whatsappShareUrl ? (
              <Button asChild variant="outline">
                <a href={shareMeta.whatsappShareUrl} target="_blank" rel="noreferrer">
                  <MessageCircle className="mr-2 h-4 w-4" />
                  Continuar por WhatsApp
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
