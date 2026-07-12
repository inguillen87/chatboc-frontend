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
import { trackFrontendEvent } from '@/utils/frontendTelemetry';
import { ArrowRight, CheckCircle2, ChevronDown, ClipboardList, Copy, FileDown, FileText, MessageCircle, Percent, QrCode, Search, ShieldCheck, ShoppingBag, SlidersHorizontal, Sparkles, Upload as UploadIcon } from 'lucide-react';

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

const DEFAULT_COMMERCE_LOOP_STEPS = [
  { stage: 'catalog', event: 'catalog_viewed', label: 'Catalogo visto' },
  { stage: 'assist', event: 'assisted_upload_submitted', label: 'Pedido asistido' },
  { stage: 'cart', event: 'cart_started', label: 'Carrito iniciado' },
  { stage: 'checkout', event: 'checkout_session_created', label: 'Checkout creado' },
  { stage: 'order', event: 'order_created', label: 'Pedido generado' },
  { stage: 'tracking', event: 'order_tracking_opened', label: 'Seguimiento abierto' },
];

type AssistedUseCaseCard = {
  id: string;
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
};

const FALLBACK_ASSISTED_USE_CASES: AssistedUseCaseCard[] = [
  {
    id: 'quote_request',
    title: 'Pedido o cotizacion',
    description: 'Ferreteria, supermercado, bebidas, repuestos o compras por lista.',
    icon: ShoppingBag,
  },
  {
    id: 'service_request',
    title: 'Reclamo o tramite',
    description: 'Direccion, foto, boleta, certificado o dato faltante para derivar.',
    icon: ClipboardList,
  },
  {
    id: 'receipt',
    title: 'Comprobante o cuota',
    description: 'Recibo, transferencia, impuesto o pago para revision del equipo.',
    icon: ShieldCheck,
  },
  {
    id: 'follow_up',
    title: 'Seguimiento publico',
    description: 'Referencia para consultar estado y continuar por WhatsApp o link seguro.',
    icon: MessageCircle,
  },
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

const ASSISTED_PUBLIC_FLOW_STEPS = [
  {
    title: 'Foto o texto',
    description: 'El cliente sube papel, PDF, boleta o lista pegada.',
    icon: UploadIcon,
  },
  {
    title: 'Lectura ordenada',
    description: 'Se separan articulos, cantidades, direccion y faltantes.',
    icon: Search,
  },
  {
    title: 'Solicitud en panel',
    description: 'El equipo recibe resumen, archivo original y proximo paso.',
    icon: ClipboardList,
  },
  {
    title: 'Respuesta y seguimiento',
    description: 'Continua por WhatsApp, mail, llamada o link publico.',
    icon: CheckCircle2,
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

const publicProductName = (value: unknown) =>
  String(value ?? '')
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

const assistedUseCaseIcon = (value: string) => {
  const normalized = value.toLowerCase();
  if (normalized.includes('reclamo') || normalized.includes('service') || normalized.includes('tramite')) {
    return ClipboardList;
  }
  if (normalized.includes('boleta') || normalized.includes('comprobante') || normalized.includes('cuota') || normalized.includes('receipt')) {
    return ShieldCheck;
  }
  if (normalized.includes('certificado') || normalized.includes('certificate') || normalized.includes('document')) {
    return FileText;
  }
  if (normalized.includes('seguimiento') || normalized.includes('whatsapp') || normalized.includes('follow')) {
    return MessageCircle;
  }
  return ShoppingBag;
};

const FALLBACK_ASSISTED_INTAKE: MarketAssistedIntakeEntry = {
  contract_version: 'marketplace.assisted_intake_entry.v1',
  display_name: 'Vega Marketplace IA',
  product_surface: {
    name: 'Vega Marketplace IA',
    scope: 'anonymous_marketplace_intake',
  },
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
      document_type: 'handwritten_order',
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
    display_name: 'Vega Marketplace IA',
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
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [promotionOnly, setPromotionOnly] = useState(false);
  const [selectedSort, setSelectedSort] = useState('promo_first');
  const [isAssistedPanelOpen, setIsAssistedPanelOpen] = useState(false);
  const [assistedDraftRequest, setAssistedDraftRequest] = useState<{ text: string; key: number } | null>(null);
  const [shareMeta, setShareMeta] = useState<Pick<MarketCatalogResponse, 'publicCartUrl' | 'whatsappShareUrl'> | null>(
    null,
  );
  const { addItem, items: cartItems, isLoading: isCartLoading } = useMarketCart();
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
  const catalogDownloadUrl = useMemo(() => {
    if (!tenantSlug) return '';
    return `/api/public/tenants/${encodeURIComponent(tenantSlug)}/catalog/download?format=pdf`;
  }, [tenantSlug]);

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
  const catalogHasNoPublishedProducts = (totalUnfiltered ?? products.length) === 0;
  const assistedIntakeExplicitlyDisabled =
    frontendContract?.show_assisted_intake === false && products.length > 0 && !catalogHasNoPublishedProducts;
  const catalogStatusLine = useMemo(() => {
    if (isLoading) return 'Actualizando productos, promociones y disponibilidad...';
    const visibleCount = total ?? products.length;
    const publishedCount = typeof totalUnfiltered === 'number' ? totalUnfiltered : products.length;
    if (visibleCount === 0 && publishedCount === 0) {
      return assistedIntakeExplicitlyDisabled
        ? 'Catalogo sin productos publicados por ahora. Usa los canales de contacto del tenant para continuar.'
        : 'Subi una foto, lista, boleta o reclamo. El equipo recibe una solicitud ordenada y responde con seguimiento.';
    }
    const parts = [`${visibleCount} ${visibleCount === 1 ? 'visible' : 'visibles'}`];
    if (typeof totalUnfiltered === 'number') parts.push(`de ${totalUnfiltered} publicados`);
    if (facets?.promotion_count) parts.push(`${facets.promotion_count} con promocion`);
    return `${parts.join(' - ')}.`;
  }, [assistedIntakeExplicitlyDisabled, facets?.promotion_count, isLoading, products.length, total, totalUnfiltered]);
  const emptyState = !isLoading && products.length === 0;
  const catalogActuallyEmpty = catalogHasNoPublishedProducts;
  const effectiveAssistedIntake = assistedIntakeExplicitlyDisabled ? null : assistedIntake ?? FALLBACK_ASSISTED_INTAKE;
  const showAssistedIntake = Boolean(effectiveAssistedIntake);
  const assistedUseCases = useMemo(() => {
    const rawUseCases = Array.isArray(effectiveAssistedIntake?.use_cases)
      ? effectiveAssistedIntake.use_cases
      : [];
    const normalizedUseCases = rawUseCases
      .map((item, index) => {
        const record = item as Record<string, unknown>;
        const title = publicMarketplaceText(record.title ?? record.label ?? record.name);
        if (!title) return null;
        const id = publicMarketplaceText(record.id) || `use-case-${index}`;
        const description = publicMarketplaceText(record.description);
        return {
          id,
          title,
          description,
          icon: assistedUseCaseIcon(`${id} ${title} ${description}`),
        };
      })
      .filter((item): item is AssistedUseCaseCard => Boolean(item))
      .slice(0, 4);
    return normalizedUseCases.length ? normalizedUseCases : FALLBACK_ASSISTED_USE_CASES;
  }, [effectiveAssistedIntake?.use_cases]);
  const hasActiveFilters = Boolean(deferredSearchTerm.trim() || selectedCategory !== 'all' || promotionOnly);
  const noResultsSearchTerm = !isLoading && products.length === 0 && !catalogActuallyEmpty
    ? deferredSearchTerm.trim()
    : '';
  const buildNoResultsSearchDraft = (term: string) => [
    `Busco: ${term}`,
    'No lo encontre en el catalogo. Quiero que el equipo revise disponibilidad, precio o alternativa y me responda.',
  ].join('\n');
  const buildProductConsultDraft = (product: MarketProduct, reason?: string | null) => [
    `Busco: ${product.name}`,
    product.sku ? `SKU: ${product.sku}` : null,
    product.category ? `Categoria: ${product.category}` : null,
    product.priceText ? `Precio publicado: ${product.priceText}` : null,
    reason ? `Motivo: ${reason}` : 'Necesito confirmar disponibilidad, precio o alternativa.',
    'Quiero que el equipo revise este producto y me responda para completar el pedido.',
  ].filter(Boolean).join('\n');
  const assistedFirstActive = showAssistedIntake && !isLoading && (
    effectiveAssistedIntake?.mode === 'assisted_first' ||
    totalUnfiltered === 0 ||
    (products.length === 0 && effectiveAssistedIntake?.show_on_empty_catalog !== false)
  );
  const cartItemCount = cartItems.reduce((sum, item) => sum + (Number(item.quantity) || 1), 0);

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

  useEffect(() => {
    if (assistedFirstActive && catalogActuallyEmpty) setIsAssistedPanelOpen(true);
  }, [assistedFirstActive, catalogActuallyEmpty]);

  const assistedPrimaryCta = effectiveAssistedIntake?.empty_state?.primary_cta ?? 'Subir pedido o documento';
  const assistedDisplayName =
    publicProductName(effectiveAssistedIntake?.display_name) ||
    publicProductName(effectiveAssistedIntake?.product_surface?.name) ||
    publicProductName((effectiveAssistedIntake?.frontend_contract as Record<string, unknown> | null | undefined)?.display_name) ||
    'Vega Marketplace IA';
  const assistedEmptyTitle =
    publicMarketplaceText(effectiveAssistedIntake?.empty_state?.title) ||
    'Catalogo sin productos visibles, solicitud asistida activa.';
  const assistedEmptyDescription =
    publicMarketplaceText(effectiveAssistedIntake?.empty_state?.description) ||
    'Podes subir una foto, PDF, boleta o nota manuscrita. El equipo recibe la solicitud ordenada con seguimiento para responderte sin que tengas que navegar el catalogo.';
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
  const openQrShare = (source: string) => {
    if (!shareUrl) return;
    trackMarketplaceCta('catalog_qr_opened', source, { share_url_available: true });
    const qrLink = `https://quickchart.io/qr?text=${encodeURIComponent(shareUrl)}&margin=12&size=320`;
    window.open(qrLink, '_blank', 'noopener,noreferrer');
  };
  const openCatalogDownload = (source: string) => {
    if (!catalogDownloadUrl) return;
    trackMarketplaceCta('catalog_download_opened', source, {
      format: 'pdf',
      download_contract: 'public.catalog_download.v1',
    });
    window.open(catalogDownloadUrl, '_blank', 'noopener,noreferrer');
  };
  const copyShareUrl = async () => {
    try {
      if (!shareUrl || !canUseClipboard) return;
      await navigator.clipboard.writeText(shareUrl);
      toast({ title: 'Enlace copiado', description: 'Listo para compartir por WhatsApp o email.' });
    } catch {
      toast({ title: 'No se pudo copiar', description: shareUrl, variant: 'destructive' });
    }
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
  const revealAssistedUpload = (preferredMode: 'file' | 'text') => {
    if (isAssistedPanelOpen) {
      scrollToAssistedUpload(preferredMode);
      return;
    }
    setIsAssistedPanelOpen(true);
    window.setTimeout(() => scrollToAssistedUpload(preferredMode), 0);
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
      revealAssistedUpload('text');
      return;
    }
    revealAssistedUpload(preferredMode);
  };
  const activateProductConsult = (product: MarketProduct, reason?: string | null) => {
    const draft = buildProductConsultDraft(product, reason);
    trackMarketplaceCta('product_consult_started', 'product_card', {
      product_id: product.id,
      product_name: product.name,
      stock_status: product.stock_status ?? product.inventory?.stock_status ?? null,
      reason: reason ?? null,
    });
    if (showAssistedIntake) {
      setAssistedDraftRequest((current) => ({
        text: draft,
        key: (current?.key ?? 0) + 1,
      }));
      revealAssistedUpload('text');
      return;
    }
    const fallbackUrl =
      product.whatsappShareUrl ||
      shareMeta?.whatsappShareUrl ||
      `https://wa.me/?text=${encodeURIComponent(draft)}`;
    window.open(fallbackUrl, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 overflow-x-hidden px-4 py-4 sm:py-5">
      <header
        data-testid="market-catalog-header"
        className="flex min-w-0 flex-col gap-3 border-b pb-3 md:flex-row md:items-center md:justify-between"
      >
        <div className="flex min-w-0 items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <ShoppingBag className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <h1 className="text-xl font-semibold sm:text-2xl">Marketplace</h1>
            <p className="line-clamp-2 text-sm text-muted-foreground">
              {heroSubtitle ?? 'Busca productos o envia una nota, foto o texto para recibir una respuesta.'}
            </p>
          </div>
        </div>

        <div className="flex w-full min-w-0 items-center gap-2 md:w-auto md:justify-end">
          {showAssistedIntake ? (
            <div data-testid="market-assisted-header-rail" className="min-w-0 flex-1 md:flex-none">
              <Button
                type="button"
                data-testid="market-assisted-upload-cta"
                className="w-full whitespace-normal leading-tight md:w-auto md:whitespace-nowrap"
                onClick={() => activateAssistedUpload('file')}
              >
                <UploadIcon className="mr-2 h-4 w-4 shrink-0" />
                {assistedPrimaryCta}
              </Button>
            </div>
          ) : null}
          {cartItemCount > 0 ? (
            <Button asChild variant="outline" size="sm" className="shrink-0">
              <Link to={buildTenantPath('/cart', tenantSlug)}>
                <ShoppingBag className="mr-2 h-4 w-4" />
                Carrito ({cartItemCount})
              </Link>
            </Button>
          ) : null}
          <div className="hidden shrink-0 items-center gap-1 md:flex" aria-label="Compartir catalogo">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={copyShareUrl}
              disabled={!shareUrl || !canUseClipboard}
              aria-label="Copiar enlace del catalogo"
              title="Copiar enlace"
            >
              <Copy className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => openWhatsappShare('desktop_share_button')}
              disabled={!shareMessage}
              aria-label="Compartir por WhatsApp"
              title="WhatsApp"
            >
              <MessageCircle className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => openQrShare('desktop_qr_button')}
              disabled={!shareUrl}
              aria-label="Abrir codigo QR"
              title="Codigo QR"
            >
              <QrCode className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => openCatalogDownload('desktop_pdf_button')}
              disabled={!catalogDownloadUrl}
              aria-label="Descargar catalogo PDF"
              title="Descargar PDF"
            >
              <FileDown className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      <section data-testid="market-primary-actions" className="border-b pb-4" aria-label="Buscar y filtrar productos">
        <div className="mb-2 flex min-w-0 items-center justify-between gap-3">
          <h2 className="flex shrink-0 items-center gap-2 text-sm font-semibold">
            <SlidersHorizontal className="h-4 w-4 text-primary" />
            Productos
          </h2>
          <p data-testid="market-catalog-status" className="min-w-0 truncate text-right text-xs text-muted-foreground sm:text-sm">
            {catalogStatusLine}
          </p>
        </div>
        <div className="grid min-w-0 gap-2 sm:grid-cols-2 lg:grid-cols-[minmax(0,1fr)_190px_190px_auto]">
          <div className="relative min-w-0 sm:col-span-2 lg:col-span-1">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Buscar producto, marca o promo..."
              className="w-full min-w-0 pl-9"
            />
          </div>
          <Select value={selectedCategory} onValueChange={setSelectedCategory}>
            <SelectTrigger className="w-full min-w-0" aria-label="Filtrar por categoria">
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
            <SelectTrigger className="w-full min-w-0" aria-label="Ordenar productos">
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
            onClick={() => setPromotionOnly((current) => !current)}
            className="w-full whitespace-nowrap lg:w-auto"
            aria-pressed={promotionOnly}
          >
            <Sparkles className="mr-2 h-4 w-4 shrink-0" />
            En promocion
          </Button>
        </div>
      </section>

      {error ? (
        <Alert variant="destructive">
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      <main
        data-testid="market-products-region"
        className="grid min-w-0 grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3"
        aria-label="Productos del catalogo"
      >
        {isLoading
          ? [0, 1, 2].map((item) => (
              <div key={item} className="order-1 min-h-[260px] animate-pulse rounded-lg border bg-card p-4 shadow-sm">
                <div className="h-32 rounded-md bg-muted" />
                <div className="mt-4 h-4 w-3/4 rounded bg-muted" />
                <div className="mt-3 h-3 w-1/2 rounded bg-muted" />
                <div className="mt-6 h-10 rounded bg-muted" />
              </div>
            ))
          : null}

        {emptyState ? (
          <section
            data-testid={assistedFirstActive && catalogActuallyEmpty ? 'market-assisted-empty-state' : 'market-empty-state'}
            className="order-1 border-y border-dashed py-5 md:col-span-2 lg:col-span-3"
          >
            <Badge variant="secondary" className="mb-2">
              {showAssistedIntake ? 'Sin productos' : 'Catalogo pendiente'}
            </Badge>
            <h2 className="max-w-3xl text-lg font-semibold sm:text-xl">
              {hasActiveFilters && !catalogActuallyEmpty
                ? 'No hay productos para esos filtros.'
                : showAssistedIntake
                  ? assistedEmptyTitle
                  : 'No hay productos disponibles en este catalogo.'}
            </h2>
            <p className="mt-1 max-w-3xl text-sm leading-6 text-muted-foreground">
              {hasActiveFilters && !catalogActuallyEmpty
                ? 'Limpia los filtros o usa la carga asistida para consultar disponibilidad, precio o una alternativa.'
                : showAssistedIntake
                  ? assistedEmptyDescription
                  : 'El tenant todavia no publico productos. Usa los canales disponibles para pedir informacion.'}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {hasActiveFilters ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setSearchTerm('');
                    setSelectedCategory('all');
                    setPromotionOnly(false);
                  }}
                >
                  <Search className="mr-2 h-4 w-4" />
                  Limpiar filtros
                </Button>
              ) : null}
              {!showAssistedIntake && shareMeta?.whatsappShareUrl ? (
                <Button asChild variant="outline" size="sm">
                  <a href={shareMeta.whatsappShareUrl} target="_blank" rel="noreferrer">
                    <MessageCircle className="mr-2 h-4 w-4" />
                    Continuar por WhatsApp
                  </a>
                </Button>
              ) : null}
            </div>
          </section>
        ) : null}

        {!isLoading
          ? products.map((product, index) => {
              const responsiveOrder = index === 0
                ? 'order-1'
                : index === 1
                  ? 'order-3 md:order-1'
                  : index === 2
                    ? 'order-3 lg:order-1'
                    : 'order-3';
              return (
                <article
                  key={product.id}
                  data-testid={`market-product-${product.id}`}
                  className={`flex min-w-0 flex-col gap-3 ${responsiveOrder}`}
                >
                  <ProductCard
                    product={product}
                    onAdd={(id) => addItem(id)}
                    onConsult={activateProductConsult}
                    isAdding={isCartLoading}
                  />
                  <Button asChild variant="outline" size="sm">
                    <Link to={buildTenantPath(`/product/${encodeURIComponent(product.id)}`, tenantSlug)}>
                      Ver detalle
                    </Link>
                  </Button>
                </article>
              );
            })
          : null}

        {showAssistedIntake ? (
          <details
            data-testid="market-assisted-command"
            className="group order-2 overflow-hidden border-y bg-primary/5 md:col-span-2 lg:col-span-3"
            open={isAssistedPanelOpen}
          >
            <summary
              className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-3 px-3 py-2.5 sm:px-4"
              onClick={(event) => {
                event.preventDefault();
                setIsAssistedPanelOpen((current) => !current);
              }}
            >
              <span className="flex min-w-0 items-center gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                  <UploadIcon className="h-4 w-4" />
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-semibold">Enviar nota, foto o texto</span>
                  <span className="block truncate text-xs text-muted-foreground sm:text-sm">
                    Nota manuscrita, foto, PDF o texto, sin registro.
                  </span>
                </span>
              </span>
              <ChevronDown className="h-5 w-5 shrink-0 transition-transform group-open:rotate-180" />
            </summary>
            <div className="border-t p-3 sm:p-4">
              <UploadOrderFromFile
                id={ASSISTED_UPLOAD_ANCHOR_ID}
                tenantSlug={tenantSlug}
                variant="marketplace"
                compactMarketplaceHeader
                className="rounded-none border-0 bg-transparent p-0 shadow-none"
                intakeEntry={effectiveAssistedIntake}
                securityContract={publicApi?.security ?? null}
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
            </div>
          </details>
        ) : null}

        <details
          data-testid="market-assisted-details"
          className="group order-2 overflow-hidden border-y bg-muted/20 md:col-span-2 lg:col-span-3"
        >
          <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 px-3 py-2.5 sm:px-4">
            <span className="min-w-0">
              <span className="block text-sm font-semibold">Como funciona y como compartir</span>
              <span className="block truncate text-xs text-muted-foreground sm:text-sm">
                Proceso, seguimiento y canales del pedido.
              </span>
            </span>
            <ChevronDown className="h-5 w-5 shrink-0 transition-transform group-open:rotate-180" />
          </summary>
          <div className="divide-y border-t px-3 sm:px-4">
            {showAssistedIntake ? (
              <section className="py-4" aria-label="Alcance de la carga asistida">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <Badge variant="outline" className="mb-2 border-primary/30 bg-background text-primary">
                      {assistedDisplayName}
                    </Badge>
                    <h3 className="text-sm font-semibold">Que podes enviar</h3>
                  </div>
                  <span data-testid="market-assisted-public-promise" className="text-xs text-muted-foreground">
                    Foto o manuscrito - texto de WhatsApp - documento o reclamo
                  </span>
                </div>
                <div data-testid="market-assisted-use-cases" className="mt-3 grid gap-x-5 gap-y-3 sm:grid-cols-2 lg:grid-cols-4">
                  {assistedUseCases.map((useCase) => {
                    const Icon = useCase.icon;
                    return (
                      <div key={useCase.id} className="min-w-0 border-l-2 border-primary/30 pl-3">
                        <div className="flex items-center gap-2 text-sm font-semibold">
                          <Icon className="h-4 w-4 shrink-0 text-primary" />
                          <span>{useCase.title}</span>
                        </div>
                        {useCase.description ? (
                          <p className="mt-1 text-xs leading-5 text-muted-foreground">{useCase.description}</p>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              </section>
            ) : null}

            {showAssistedIntake ? (
              <section data-testid="market-assisted-public-flow" className="py-4" aria-label="Circuito de carga asistida">
                <h3 className="text-sm font-semibold">Circuito asistido</h3>
                <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  {ASSISTED_PUBLIC_FLOW_STEPS.map((step, index) => {
                    const Icon = step.icon;
                    return (
                      <div key={step.title} className="relative min-w-0 pr-3">
                        {index < ASSISTED_PUBLIC_FLOW_STEPS.length - 1 ? (
                          <ArrowRight className="absolute -right-1 top-2 hidden h-4 w-4 text-muted-foreground lg:block" />
                        ) : null}
                        <div className="flex items-center gap-2 text-sm font-semibold">
                          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                            <Icon className="h-4 w-4" />
                          </span>
                          <span>{step.title}</span>
                        </div>
                        <p className="mt-1 text-xs leading-5 text-muted-foreground">{step.description}</p>
                      </div>
                    );
                  })}
                </div>
              </section>
            ) : null}

            {showAssistedIntake ? (
              <section data-testid="market-assisted-team-handoff" className="py-4" aria-label="Informacion para el equipo">
                <h3 className="text-sm font-semibold">Lo que recibe el equipo</h3>
                <div className="mt-3 grid gap-3 sm:grid-cols-3">
                  {ASSISTED_TEAM_HANDOFFS.map((handoff) => {
                    const Icon = handoff.icon;
                    return (
                      <div key={handoff.title} className="min-w-0 border-l-2 border-border pl-3">
                        <div className="flex items-center gap-2 text-sm font-semibold">
                          <Icon className="h-4 w-4 shrink-0 text-primary" />
                          <span>{handoff.title}</span>
                        </div>
                        <p className="mt-1 text-xs leading-5 text-muted-foreground">{handoff.description}</p>
                      </div>
                    );
                  })}
                </div>
              </section>
            ) : null}

            {commerceLoopSteps.length ? (
              <section data-testid="market-commerce-loop" className="py-4" aria-label="Seguimiento operativo del pedido">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="flex items-center gap-2 text-sm font-semibold">
                    <ShieldCheck className="h-4 w-4 text-primary" />
                    Pedido trazable de punta a punta
                  </h3>
                  <Badge variant="outline">
                    {publicApi?.analytics?.write_mode === 'frontend_signal_plus_server_reconciliation'
                      ? 'Frontend + servidor'
                      : publicApi?.analytics?.contract_version ?? 'Loop operativo'}
                  </Badge>
                </div>
                <div className="mt-3 grid gap-x-4 gap-y-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
                  {commerceLoopSteps.map((step, index) => (
                    <div key={`${step.id}-${index}`} className="min-w-0 border-l-2 border-border pl-3">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4 shrink-0 text-primary" />
                        <p className="text-sm font-semibold">{step.label}</p>
                      </div>
                      <p className="mt-1 text-xs leading-5 text-muted-foreground">{step.description}</p>
                    </div>
                  ))}
                </div>
              </section>
            ) : null}

            <section className="py-4 md:hidden" aria-label="Compartir catalogo desde el celular">
              <div className="grid min-w-0 grid-cols-2 gap-2 sm:grid-cols-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => openWhatsappShare('mobile_share_button')}
                  disabled={!shareMessage}
                  className="w-full whitespace-normal leading-tight"
                >
                  <MessageCircle className="mr-2 h-4 w-4" />
                  Continuar por WhatsApp
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={copyShareUrl}
                  disabled={!shareUrl || !canUseClipboard}
                  className="w-full whitespace-normal leading-tight"
                >
                  <Copy className="mr-2 h-4 w-4" />
                  Copiar enlace
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => openQrShare('mobile_qr_button')}
                  disabled={!shareUrl}
                  className="w-full"
                  data-testid="market-mobile-qr-share"
                >
                  <QrCode className="mr-2 h-4 w-4" />
                  QR
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => openCatalogDownload('mobile_pdf_button')}
                  disabled={!catalogDownloadUrl}
                  className="w-full"
                  data-testid="market-mobile-download-catalog"
                >
                  <FileDown className="mr-2 h-4 w-4" />
                  PDF
                </Button>
              </div>
            </section>
          </div>
        </details>

        {promotionItems.length ? (
          <section className="order-4 border-t pt-5 md:col-span-2 lg:col-span-3" aria-label="Promociones activas">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <Badge variant="outline" className="mb-2 border-emerald-200 bg-emerald-50 text-emerald-700">
                  <Sparkles className="mr-1 h-3.5 w-3.5" />
                  Promociones activas
                </Badge>
                <h2 className="text-lg font-semibold">Ofertas listas para comprar</h2>
              </div>
              <Button asChild size="sm" className="w-full sm:w-auto">
                <Link to={buildTenantPath('/cart', tenantSlug)}>
                  <ShoppingBag className="mr-2 h-4 w-4" />
                  Ver carrito
                </Link>
              </Button>
            </div>
            <div className="mt-3 grid gap-3 md:grid-cols-2 lg:grid-cols-3">
              {promotionItems.slice(0, 6).map((promotion) => {
                const detail = promotionDetail(promotion);
                const badge = promotionBadge(promotion);
                return (
                  <div key={promotion.id} className="rounded-lg border bg-card p-4 shadow-sm">
                    <div className="flex items-start gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700">
                        <Percent className="h-5 w-5" />
                      </div>
                      <div className="min-w-0">
                        <h3 className="line-clamp-2 font-semibold">{promotionTitle(promotion)}</h3>
                        {promotionDescription(promotion) ? (
                          <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{promotionDescription(promotion)}</p>
                        ) : null}
                        {detail ? <p className="mt-2 text-xs font-semibold text-emerald-700">{detail}</p> : null}
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
      </main>
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
