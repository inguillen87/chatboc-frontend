import { apiFetch, ApiError } from '@/utils/api';
import {
  MarketCartResponse,
  MarketCartItem,
  MarketCartPromotions,
  MarketCatalogResponse,
  MarketCatalogFacetItem,
  MarketCatalogFacets,
  MarketProduct,
  MarketPublicApiContract,
  MarketPublicApiEndpoint,
  MarketPublicFlowExecutionPolicy,
  AddToCartPayload,
  CheckoutStartResponse,
  CheckoutStartPayload,
  MarketCheckoutExperienceBlocker,
  MarketCheckoutOperatorAction,
  MarketCheckoutExperience,
  MarketCheckoutExperiencePolicy,
  MarketCheckoutExperienceStep,
  MarketCheckoutOptions,
  MarketCheckoutPreview,
  MarketFrontendContract,
  MarketIntegrationAccess,
  MarketNextStep,
  MarketPaymentCheckoutStatus,
  MarketPaymentStatusResponse,
  MarketPlanUpgrade,
  MarketRewardRedeemResponse,
  MarketRewardRedemption,
  MarketRewardsProfile,
} from '@/types/market';
import { PublicOrderTrackingResponse } from '@/types/tracking';
import type { CatalogPromotion, CatalogPromotionsOps } from '@/types/catalog';
import {
  getProductGalleryUrls,
  getProductImageAlt,
  getProductImageStatus,
  getProductPrimaryImage,
} from '@/utils/marketImages';

const asStringOrNull = (value: unknown): string | null => {
  if (typeof value !== 'string') return null;
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
};

const asStringIdOrNull = (value: unknown): string | null => {
  const direct = asStringOrNull(value);
  if (direct) return direct;
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return null;
};

const asBooleanOrNull = (value: unknown): boolean | null =>
  typeof value === 'boolean' ? value : null;

const asRecordOrNull = (value: unknown): Record<string, unknown> | null =>
  value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;

const asNumberOrNull = (value: unknown): number | null => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
};

const asArrayOfStringsOrNull = (value: unknown): string[] | null => {
  if (!Array.isArray(value)) return null;
  const normalized = value
    .map((item) => asStringOrNull(item))
    .filter((item): item is string => Boolean(item));
  return normalized.length ? normalized : [];
};

const asUnknownRecord = (value: unknown): Record<string, unknown> => asRecordOrNull(value) ?? {};

const getFirst = (record: Record<string, unknown>, keys: string[]) => {
  for (const key of keys) {
    const value = record[key];
    if (value !== undefined && value !== null) return value;
  }
  return undefined;
};

const marketPublicApiContracts = new Map<string, MarketPublicApiContract>();

const normalizeTenantContractKey = (tenantSlug: string | null | undefined): string | null => {
  const normalized = typeof tenantSlug === 'string' ? tenantSlug.trim().toLowerCase() : '';
  return normalized || null;
};

const endpointIsGuestSafe = (endpoint: MarketPublicApiEndpoint | null | undefined, tenantSlug: string): boolean => {
  const path = endpoint?.endpoint;
  if (!path) return false;
  if (endpoint.guest_safe === true) return true;
  return (
    path.startsWith('/api/pwa/public/cart') ||
    path.startsWith(`/api/${encodeURIComponent(tenantSlug)}/carrito`) ||
    path.startsWith(`/api/${tenantSlug}/carrito`)
  );
};

const rememberMarketPublicApiContract = (
  tenantSlug: string | null | undefined,
  contract: MarketPublicApiContract | null | undefined,
) => {
  const key = normalizeTenantContractKey(tenantSlug);
  if (!key || !contract) return;
  marketPublicApiContracts.set(key, contract);
};

const resolveMarketCartEndpoint = (
  tenantSlug: string,
  action: 'summary' | 'add',
): string | null => {
  const key = normalizeTenantContractKey(tenantSlug);
  const contract = key ? marketPublicApiContracts.get(key) : null;
  const endpoint = action === 'summary' ? contract?.cart?.summary : contract?.cart?.add;
  return endpointIsGuestSafe(endpoint, tenantSlug) ? endpoint?.endpoint ?? null : null;
};

const marketCartFetchOptions = (endpoint: string, tenantSlug: string) => ({
  tenantSlug,
  suppressPanel401Redirect: true,
  omitChatSessionId: true,
  ...(endpoint.startsWith('/api/pwa/public/cart')
    ? {
        skipAuth: true,
        omitCredentials: true,
        sendAnonId: true,
      }
    : {}),
});

const getSource = (input: unknown): unknown => {
  const record = asRecordOrNull(input);
  if (record && asRecordOrNull(record.data)) return record.data;
  return input;
};

const normalizeMarketProduct = (input: unknown): MarketProduct => {
  const record = asUnknownRecord(input);
  const tenantRecord = asRecordOrNull(record.tenant);
  const ownerRecord = asRecordOrNull(record.owner);
  const catalogItemId = asStringIdOrNull(getFirst(record, [
    'catalogo_item_id',
    'catalog_item_id',
    'catalogItemId',
    'market_catalog_item_id',
    'marketCatalogItemId',
  ]));
  const productId = asStringIdOrNull(getFirst(record, ['product_id', 'productId', 'producto_id']));
  const itemId = asStringIdOrNull(getFirst(record, ['item_id', 'itemId']));
  const name =
    asStringOrNull(getFirst(record, ['name', 'nombre', 'nombre_producto'])) ??
    'Producto';
  return {
    id:
      catalogItemId ??
      productId ??
      itemId ??
      asStringIdOrNull(getFirst(record, ['id', 'sku', 'codigo'])) ??
      `product-${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
    catalogo_item_id: catalogItemId,
    catalog_item_id: asStringIdOrNull(record.catalog_item_id) ?? catalogItemId,
    product_id: productId,
    item_id: itemId,
    tenant_slug:
      asStringOrNull(getFirst(record, ['tenant_slug', 'tenantSlug', 'slug_tenant'])) ??
      asStringOrNull(tenantRecord?.['slug']),
    tenant: asStringOrNull(getFirst(record, ['tenant', 'tenant_key'])),
    owner_slug:
      asStringOrNull(getFirst(record, ['owner_slug', 'ownerSlug'])) ??
      asStringOrNull(ownerRecord?.['slug']),
    tenant_id: asStringIdOrNull(getFirst(record, ['tenant_id', 'tenantId'])),
    name,
    description: asStringOrNull(getFirst(record, ['description', 'descripcion'])),
    descriptionShort: asStringOrNull(getFirst(record, ['descriptionShort', 'description_short', 'descripcion_corta'])),
    price: asNumberOrNull(getFirst(record, ['price', 'precio_unitario', 'precio', 'amount'])),
    priceText: asStringOrNull(getFirst(record, ['priceText', 'price_text', 'precio_texto'])),
    currency: asStringOrNull(getFirst(record, ['currency', 'moneda'])) ?? 'ARS',
    modality: asStringOrNull(getFirst(record, ['modality', 'modalidad'])) ?? 'venta',
    points: asNumberOrNull(getFirst(record, ['points', 'precio_puntos', 'puntos'])),
    imageUrl: getProductPrimaryImage(record),
    galleryUrls: getProductGalleryUrls(record),
    imageStatus: getProductImageStatus(record),
    imageAlt: getProductImageAlt(record, name),
    category: asStringOrNull(getFirst(record, ['category', 'categoria'])),
    unit: asStringOrNull(getFirst(record, ['unit', 'unidad'])) ?? 'u',
    quantity: asNumberOrNull(getFirst(record, ['quantity', 'stock_quantity', 'stock', 'stock_disponible', 'cantidad'])),
    stock_quantity: asNumberOrNull(getFirst(record, ['stock_quantity', 'stock', 'stock_disponible', 'cantidad'])),
    stock_status: asStringOrNull(getFirst(record, ['stock_status', 'stockStatus', 'availability_status'])),
    available_to_sell: asBooleanOrNull(getFirst(record, ['available_to_sell', 'availableToSell'])),
    amount_validated: asBooleanOrNull(getFirst(record, ['amount_validated', 'amountValidated'])),
    inventory: asRecordOrNull(record.inventory),
    sku: asStringOrNull(getFirst(record, ['sku', 'codigo'])),
    brand: asStringOrNull(getFirst(record, ['brand', 'marca'])),
    promoInfo: asStringOrNull(getFirst(record, [
      'promoInfo',
      'promo_info',
      'promocion_info',
      'promocion_activa',
      'promotion_label',
      'discount_label',
    ])),
    publicUrl: asStringOrNull(getFirst(record, ['publicUrl', 'public_url'])),
    whatsappShareUrl: asStringOrNull(getFirst(record, ['whatsappShareUrl', 'whatsapp_share_url'])),
    disponible: record.disponible === undefined ? true : Boolean(record.disponible),
    checkout_type: asStringOrNull(getFirst(record, ['checkout_type'])) as MarketProduct['checkout_type'],
    external_url: asStringOrNull(getFirst(record, ['external_url', 'externalUrl'])),
    rating: asNumberOrNull(getFirst(record, ['rating'])),
    ratingCount: asNumberOrNull(getFirst(record, ['ratingCount', 'rating_count', 'reviews_count'])),
    tags: asArrayOfStringsOrNull(getFirst(record, ['tags', 'etiquetas'])),
  };
};

const normalizeMarketPromotions = (value: unknown): CatalogPromotionsOps | null => {
  const record = asRecordOrNull(value);
  if (!record) return null;
  const items = Array.isArray(record.items)
    ? record.items
        .map((item) => {
          const itemRecord = asRecordOrNull(item);
          if (!itemRecord) return null;
          return {
            ...itemRecord,
            id: String(getFirst(itemRecord, ['id', 'promotion_id', 'codigo_promocion']) ?? ''),
            nombre_promocion: asStringOrNull(getFirst(itemRecord, ['nombre_promocion', 'title', 'name'])),
            descripcion_publica: asStringOrNull(getFirst(itemRecord, ['descripcion_publica', 'description', 'detail'])),
            tipo_promocion: asStringOrNull(getFirst(itemRecord, ['tipo_promocion', 'discount_type', 'type'])),
            valor_descuento: asNumberOrNull(getFirst(itemRecord, ['valor_descuento', 'discount_value', 'value'])),
            monto_minimo_carrito: asNumberOrNull(getFirst(itemRecord, ['monto_minimo_carrito', 'min_cart_amount'])),
            cantidad_minima_aplicable: asNumberOrNull(getFirst(itemRecord, ['cantidad_minima_aplicable', 'min_quantity'])),
            codigo_promocion: asStringOrNull(getFirst(itemRecord, ['codigo_promocion', 'code'])),
            title: asStringOrNull(getFirst(itemRecord, ['title', 'name'])),
            description: asStringOrNull(getFirst(itemRecord, ['description', 'detail'])),
            status: asStringOrNull(itemRecord.status),
            active_now: asBooleanOrNull(getFirst(itemRecord, ['active_now', 'activeNow'])),
            display_badge: asStringOrNull(getFirst(itemRecord, ['display_badge', 'displayBadge', 'badge'])),
            eligible_product_ids: Array.isArray(getFirst(itemRecord, ['eligible_product_ids', 'eligibleProductIds']))
              ? (getFirst(itemRecord, ['eligible_product_ids', 'eligibleProductIds']) as Array<string | number>)
              : null,
            countdown: asRecordOrNull(itemRecord.countdown) as CatalogPromotion['countdown'],
            terms_short: asStringOrNull(getFirst(itemRecord, ['terms_short', 'termsShort'])),
            priority: asNumberOrNull(itemRecord.priority),
            alcances: Array.isArray(getFirst(itemRecord, ['alcances', 'scopes']))
              ? (getFirst(itemRecord, ['alcances', 'scopes']) as CatalogPromotion['alcances'])
              : null,
          } as CatalogPromotion;
        })
        .filter((item): item is CatalogPromotion => Boolean(item?.id || item?.nombre_promocion))
    : [];

  return {
    ...(record as CatalogPromotionsOps),
    contract_version: asStringOrNull(record.contract_version) as CatalogPromotionsOps['contract_version'],
    enabled: asBooleanOrNull(record.enabled),
    total: asNumberOrNull(record.total),
    active: asNumberOrNull(record.active),
    catalog_items_with_promo_badge: asNumberOrNull(
      getFirst(record, ['catalog_items_with_promo_badge', 'catalog_badge_total']),
    ),
    items,
  };
};

const normalizeFacetItems = (value: unknown): MarketCatalogFacetItem[] | null => {
  if (!Array.isArray(value)) return null;
  const items = value
    .map((item): MarketCatalogFacetItem | null => {
      const record = asRecordOrNull(item);
      if (!record) return null;
      const value = asStringOrNull(record.value);
      if (!value) return null;
      return {
        value,
        label: asStringOrNull(record.label) ?? value,
        count: asNumberOrNull(record.count),
      };
    })
    .filter((item): item is MarketCatalogFacetItem => Boolean(item));
  return items.length ? items : [];
};

const normalizeMarketCatalogFacets = (value: unknown): MarketCatalogFacets | null => {
  const record = asRecordOrNull(value);
  if (!record) return null;
  const priceRange = asRecordOrNull(record.price_range);
  const availability = asRecordOrNull(record.availability);
  return {
    contract_version: asStringOrNull(record.contract_version),
    categories: normalizeFacetItems(record.categories),
    brands: normalizeFacetItems(record.brands),
    price_range: priceRange
      ? {
          min: asNumberOrNull(priceRange.min),
          max: asNumberOrNull(priceRange.max),
        }
      : null,
    availability: availability
      ? {
          available: asNumberOrNull(availability.available),
          unavailable: asNumberOrNull(availability.unavailable),
        }
      : null,
    promotion_count: asNumberOrNull(record.promotion_count),
  };
};

const normalizePublicApiEndpoint = (value: unknown): MarketPublicApiEndpoint | null => {
  const record = asRecordOrNull(value);
  if (!record) return null;
  const endpoint = asStringOrNull(getFirst(record, ['endpoint', 'url', 'path']));
  const aliasEndpoint = asStringOrNull(getFirst(record, ['alias_endpoint', 'aliasEndpoint']));
  const method = asStringOrNull(record.method);
  return {
    ...record,
    endpoint,
    alias_endpoint: aliasEndpoint,
    method,
    guest_safe: asBooleanOrNull(getFirst(record, ['guest_safe', 'guestSafe'])),
  };
};

const normalizePublicFlowExecutionPolicy = (value: unknown): MarketPublicFlowExecutionPolicy | null => {
  const record = asRecordOrNull(value);
  if (!record) return null;
  return {
    ...record,
    contract_version: asStringOrNull(getFirst(record, ['contract_version', 'contractVersion'])),
    id_strategy: asStringOrNull(getFirst(record, ['id_strategy', 'idStrategy'])),
    callback_endpoint_template: asStringOrNull(
      getFirst(record, ['callback_endpoint_template', 'callbackEndpointTemplate']),
    ),
    resume_policy: asStringOrNull(getFirst(record, ['resume_policy', 'resumePolicy'])),
  };
};

const normalizePublicApiFlowRuntime = (value: unknown): MarketPublicApiContract['flow_runtime'] => {
  const record = asRecordOrNull(value);
  const endpoint = normalizePublicApiEndpoint(record);
  if (!record || !endpoint) return null;
  return {
    ...endpoint,
    actions_endpoint: asStringOrNull(getFirst(record, ['actions_endpoint', 'actionsEndpoint'])),
    contract_version: asStringOrNull(getFirst(record, ['contract_version', 'contractVersion'])),
    execution_policy: normalizePublicFlowExecutionPolicy(getFirst(record, ['execution_policy', 'executionPolicy'])),
  };
};

const normalizePublicApiCart = (value: unknown): MarketPublicApiContract['cart'] => {
  const record = asRecordOrNull(value);
  if (!record) return null;
  return {
    ...record,
    summary: normalizePublicApiEndpoint(getFirst(record, ['summary', 'get'])),
    items: normalizePublicApiEndpoint(record.items),
    add: normalizePublicApiEndpoint(record.add),
    update: normalizePublicApiEndpoint(record.update),
    remove: normalizePublicApiEndpoint(record.remove),
    clear: normalizePublicApiEndpoint(record.clear),
    legacy: normalizePublicApiEndpoint(record.legacy),
    checkout: normalizePublicApiEndpoint(record.checkout),
  };
};

const normalizePublicApiCheckout = (value: unknown): MarketPublicApiContract['checkout'] => {
  const record = asRecordOrNull(value);
  if (!record) return null;
  return {
    ...record,
    start: normalizePublicApiEndpoint(record.start),
    fallback_behavior: asStringOrNull(getFirst(record, ['fallback_behavior', 'fallbackBehavior'])),
  };
};

const normalizePublicApiTracking = (value: unknown): Record<string, string | null> | null => {
  const record = asRecordOrNull(value);
  if (!record) return null;
  return Object.entries(record).reduce<Record<string, string | null>>((acc, [key, item]) => {
    acc[key] = asStringOrNull(item);
    return acc;
  }, {});
};

const normalizePublicApiAnalytics = (value: unknown): MarketPublicApiContract['analytics'] => {
  const record = asRecordOrNull(value);
  if (!record) return null;
  return {
    ...record,
    contract_version: asStringOrNull(getFirst(record, ['contract_version', 'contractVersion'])),
    event_endpoint: asStringOrNull(getFirst(record, ['event_endpoint', 'eventEndpoint'])),
    runtime_callback_endpoint_template: asStringOrNull(
      getFirst(record, ['runtime_callback_endpoint_template', 'runtimeCallbackEndpointTemplate']),
    ),
    public_client_can_write_events_directly: asBooleanOrNull(
      getFirst(record, ['public_client_can_write_events_directly', 'publicClientCanWriteEventsDirectly']),
    ),
    write_mode: asStringOrNull(getFirst(record, ['write_mode', 'writeMode'])),
    client_signal_channel: asStringOrNull(getFirst(record, ['client_signal_channel', 'clientSignalChannel'])),
    tenant_slug: asStringOrNull(getFirst(record, ['tenant_slug', 'tenantSlug'])),
    recommended_events: asArrayOfStringsOrNull(getFirst(record, ['recommended_events', 'recommendedEvents'])),
    funnel: Array.isArray(record.funnel) ? (record.funnel as Array<Record<string, unknown>>) : null,
    privacy: asRecordOrNull(record.privacy),
  };
};

const normalizePublicApiSecurity = (value: unknown): MarketPublicApiContract['security'] => {
  const record = asRecordOrNull(value);
  if (!record) return null;
  const turnstileRecord = asRecordOrNull(
    getFirst(record, ['turnstile', 'cloudflare_turnstile', 'cloudflareTurnstile']),
  );
  return {
    ...record,
    contract_version: asStringOrNull(getFirst(record, ['contract_version', 'contractVersion'])),
    protected_surfaces: asArrayOfStringsOrNull(getFirst(record, ['protected_surfaces', 'protectedSurfaces'])),
    turnstile: turnstileRecord
      ? {
          ...turnstileRecord,
          contract_version: asStringOrNull(
            getFirst(turnstileRecord, ['contract_version', 'contractVersion']),
          ),
          provider: asStringOrNull(turnstileRecord.provider),
          surface: asStringOrNull(turnstileRecord.surface),
          status: asStringOrNull(turnstileRecord.status),
          configured: asBooleanOrNull(turnstileRecord.configured),
          enforced: asBooleanOrNull(turnstileRecord.enforced),
          required: asBooleanOrNull(turnstileRecord.required),
          token_header: asStringOrNull(getFirst(turnstileRecord, ['token_header', 'tokenHeader'])),
          token_fields: asArrayOfStringsOrNull(getFirst(turnstileRecord, ['token_fields', 'tokenFields'])),
          retryable: asBooleanOrNull(turnstileRecord.retryable),
          reset_required: asBooleanOrNull(getFirst(turnstileRecord, ['reset_required', 'resetRequired'])),
          reason: asStringOrNull(turnstileRecord.reason),
        }
      : null,
  };
};

const normalizePublicApiContract = (value: unknown): MarketPublicApiContract | null => {
  const record = asRecordOrNull(value);
  if (!record) return null;
  return {
    ...record,
    contract_version: asStringOrNull(getFirst(record, ['contract_version', 'contractVersion'])),
    anonymous: asBooleanOrNull(record.anonymous),
    guest_safe: asBooleanOrNull(getFirst(record, ['guest_safe', 'guestSafe'])),
    identity_headers: asArrayOfStringsOrNull(getFirst(record, ['identity_headers', 'identityHeaders'])),
    catalog: normalizePublicApiEndpoint(record.catalog),
    cart: normalizePublicApiCart(record.cart),
    checkout: normalizePublicApiCheckout(record.checkout),
    assisted_upload: normalizePublicApiEndpoint(getFirst(record, ['assisted_upload', 'assistedUpload'])),
    security: normalizePublicApiSecurity(record.security),
    flow_runtime: normalizePublicApiFlowRuntime(getFirst(record, ['flow_runtime', 'flowRuntime'])),
    tracking: normalizePublicApiTracking(record.tracking),
    analytics: normalizePublicApiAnalytics(record.analytics),
  };
};

const normalizeAssistedIntake = (
  value: unknown,
  publicApi: MarketPublicApiContract | null,
): MarketCatalogResponse['assisted_intake'] => {
  const record = asRecordOrNull(value);
  if (!record) return null;

  const submitRecord = asRecordOrNull(record.submit);
  const frontendContract = asRecordOrNull(getFirst(record, ['frontend_contract', 'frontendContract']));
  const publicUploadEndpoint = publicApi?.assisted_upload?.endpoint ?? null;
  const publicUploadMethod = publicApi?.assisted_upload?.method ?? null;
  const frontendSubmitEndpoint = asStringOrNull(
    getFirst(frontendContract ?? {}, ['submit_endpoint', 'submitEndpoint']),
  );
  const submitEndpoint =
    publicUploadEndpoint ??
    asStringOrNull(submitRecord?.endpoint) ??
    frontendSubmitEndpoint;

  return {
    ...record,
    display_name:
      asStringOrNull(getFirst(record, ['display_name', 'displayName'])) ??
      asStringOrNull(getFirst(frontendContract ?? {}, ['display_name', 'displayName'])) ??
      null,
    submit:
      submitRecord || submitEndpoint
        ? {
            ...(submitRecord ?? {}),
            endpoint: submitEndpoint,
            method: asStringOrNull(submitRecord?.method) ?? publicUploadMethod ?? 'POST',
          }
        : null,
    frontend_contract: frontendContract,
  } as MarketCatalogResponse['assisted_intake'];
};

const normalizedToken = (value: unknown): string | null => {
  const token = asStringIdOrNull(value);
  return token ? token.toLowerCase() : null;
};

const normalizedText = (value: unknown): string | null => {
  const text = asStringOrNull(value);
  return text ? text.toLowerCase() : null;
};

const promotionLabel = (promotion: CatalogPromotion): string | null => {
  const record = promotion as CatalogPromotion & Record<string, unknown>;
  const title =
    promotion.nombre_promocion ??
    asStringOrNull(getFirst(record, ['title', 'name', 'promotion_label', 'discount_label'])) ??
    null;
  if (title) return title;
  const value = promotion.valor_descuento;
  const type = promotion.tipo_promocion ?? '';
  if (typeof value === 'number' && Number.isFinite(value)) {
    if (type.includes('PORCENTAJE')) return `${value}% off`;
    if (type.includes('FIJO')) return `$${value} off`;
  }
  return promotion.descripcion_publica ?? null;
};

const promotionAppliesToProduct = (promotion: CatalogPromotion, product: MarketProduct): boolean => {
  const record = promotion as CatalogPromotion & Record<string, unknown>;
  const productIds = new Set(
    [
      product.id,
      product.catalogo_item_id,
      product.catalog_item_id,
      product.product_id,
      product.item_id,
    ]
      .map(normalizedToken)
      .filter((item): item is string => Boolean(item)),
  );
  const productCategory = normalizedText(product.category);
  const productBrand = normalizedText(product.brand);
  const directCatalogId = normalizedToken(getFirst(record, ['catalogo_item_id', 'catalog_item_id']));
  const directProductName = normalizedText(getFirst(record, ['product_name', 'nombre_producto']));

  if (directCatalogId && productIds.has(directCatalogId)) return true;
  if (directProductName && directProductName === normalizedText(product.name)) return true;

  const scopes = Array.isArray(promotion.alcances) ? promotion.alcances : [];
  return scopes.some((scope) => {
    const scopeRecord = scope as Record<string, unknown>;
    const scopeType = asStringOrNull(scopeRecord.tipo_alcance)?.toUpperCase();
    if (scopeType === 'PRODUCTO') {
      const scopeCatalogId = normalizedToken(scopeRecord.catalogo_item_id);
      return Boolean(scopeCatalogId && productIds.has(scopeCatalogId));
    }
    if (scopeType === 'CATEGORIA') {
      const scopeCategory = normalizedText(scopeRecord.nombre_categoria);
      return Boolean(scopeCategory && productCategory === scopeCategory);
    }
    if (scopeType === 'MARCA') {
      const scopeBrand = normalizedText(scopeRecord.nombre_marca);
      return Boolean(scopeBrand && productBrand === scopeBrand);
    }
    return false;
  });
};

const applyCatalogPromotionsToProducts = (
  products: MarketProduct[],
  promotions: CatalogPromotionsOps | null,
): MarketProduct[] => {
  const promotionItems = promotions?.items ?? [];
  if (!promotionItems.length) return products;

  return products.map((product) => {
    if (product.promoInfo) return product;
    const match = promotionItems.find((promotion) => promotionAppliesToProduct(promotion, product));
    const label = match ? promotionLabel(match) : null;
    return label ? { ...product, promoInfo: label } : product;
  });
};

const normalizeMarketCatalogResponse = (input: unknown): MarketCatalogResponse => {
  const source = getSource(input);
  const record = asUnknownRecord(source);
  const promotions = normalizeMarketPromotions(record.promotions);
  const publicApi = normalizePublicApiContract(getFirst(record, ['public_api', 'publicApi']));
  const rawProducts =
    Array.isArray(record.products)
      ? record.products
      : Array.isArray(record.items)
        ? record.items
        : Array.isArray(source)
          ? source
          : [];
  const products = applyCatalogPromotionsToProducts(
    rawProducts.map((item) => normalizeMarketProduct(item)),
    promotions,
  );
  return {
    ...(record as Partial<MarketCatalogResponse>),
    products,
    promotions,
    facets: normalizeMarketCatalogFacets(record.facets),
    filters: asRecordOrNull(record.filters) as MarketCatalogResponse['filters'],
    assisted_intake: normalizeAssistedIntake(getFirst(record, ['assisted_intake', 'assistedIntake']), publicApi),
    sort_options: Array.isArray(record.sort_options)
      ? record.sort_options
          .map<NonNullable<MarketCatalogResponse['sort_options']>[number] | null>((item) => {
            const option = asRecordOrNull(item);
            const id = asStringOrNull(option?.id);
            return id ? { id, label: asStringOrNull(option?.label) ?? id } : null;
          })
          .filter((item): item is NonNullable<MarketCatalogResponse['sort_options']>[number] => item !== null)
      : null,
    total: asNumberOrNull(record.total),
    total_unfiltered: asNumberOrNull(record.total_unfiltered),
    publicCartUrl: asStringOrNull(getFirst(record, ['publicCartUrl', 'public_cart_url', 'cart_url'])),
    whatsappShareUrl: asStringOrNull(getFirst(record, ['whatsappShareUrl', 'whatsapp_share_url'])),
    heroImageUrl: asStringOrNull(getFirst(record, ['heroImageUrl', 'hero_image_url', 'banner_url'])),
    heroSubtitle: asStringOrNull(getFirst(record, ['heroSubtitle', 'hero_subtitle'])),
    frontend_contract: asRecordOrNull(getFirst(record, ['frontend_contract', 'frontendContract'])),
    public_api: publicApi,
  } as MarketCatalogResponse;
};

const shouldFallbackEndpoint = (error: unknown) =>
  error instanceof ApiError && [404, 405, 501].includes(error.status);

const shouldFallbackCheckoutEndpoint = (error: unknown) =>
  error instanceof ApiError && [401, 403, 404, 405, 501].includes(error.status);

const normalizeCheckoutUrls = (value: unknown): Record<string, string | null> | null => {
  const record = asRecordOrNull(value);
  if (!record) return null;
  return Object.entries(record).reduce<Record<string, string | null>>((acc, [key, item]) => {
    acc[key] = asStringOrNull(item);
    return acc;
  }, {});
};

const normalizeCapabilities = (value: unknown): Record<string, unknown> | unknown[] | null =>
  Array.isArray(value) ? value : asRecordOrNull(value);

const normalizeStringArray = (value: unknown): string[] | null => {
  const strings = asArrayOfStringsOrNull(value);
  return strings && strings.length ? strings : null;
};

const normalizePlanUpgrade = (value: unknown): MarketPlanUpgrade | null => {
  const record = asRecordOrNull(value);
  if (!record) return null;
  return {
    ...record,
    required_plan: asStringOrNull(getFirst(record, ['required_plan', 'requiredPlan'])),
    current_plan: asStringOrNull(getFirst(record, ['current_plan', 'currentPlan'])),
    upgrade_url: asStringOrNull(getFirst(record, ['upgrade_url', 'upgradeUrl', 'url'])),
    cta_label: asStringOrNull(getFirst(record, ['cta_label', 'ctaLabel', 'label'])),
  };
};

const normalizeFrontendContract = (value: unknown): MarketFrontendContract | null => {
  const record = asRecordOrNull(value);
  if (!record) return null;
  return {
    ...record,
    render_as: asStringOrNull(getFirst(record, ['render_as', 'renderAs'])),
    mode: asStringOrNull(record.mode),
    primary_action: asStringOrNull(getFirst(record, ['primary_action', 'primaryAction'])),
    action_hint: asStringOrNull(getFirst(record, ['action_hint', 'actionHint'])),
    reason_code: asStringOrNull(getFirst(record, ['reason_code', 'reasonCode'])),
    lock_reason_code: asStringOrNull(getFirst(record, ['lock_reason_code', 'lockReasonCode'])),
    message: asStringOrNull(record.message),
    title: asStringOrNull(record.title),
    hide_embed_copy: asBooleanOrNull(getFirst(record, ['hide_embed_copy', 'hideEmbedCopy'])),
    hide_widget_session: asBooleanOrNull(getFirst(record, ['hide_widget_session', 'hideWidgetSession'])),
    show_upgrade_cta: asBooleanOrNull(getFirst(record, ['show_upgrade_cta', 'showUpgradeCta'])),
    labels: asRecordOrNull(record.labels),
  };
};

const normalizeIntegrationAccess = (value: unknown): MarketIntegrationAccess | null => {
  const record = asRecordOrNull(value);
  if (!record) return null;
  const upgrade = normalizePlanUpgrade(getFirst(record, ['upgrade', 'plan_upgrade', 'planUpgrade']));
  const frontendContract = normalizeFrontendContract(getFirst(record, ['frontend_contract', 'frontendContract']));
  const normalized: MarketIntegrationAccess = {
    ...record,
    enabled: asBooleanOrNull(getFirst(record, ['enabled', 'allowed', 'active'])),
    reason_code: asStringOrNull(getFirst(record, ['reason_code', 'reasonCode'])),
    lock_reason_code: asStringOrNull(getFirst(record, ['lock_reason_code', 'lockReasonCode'])),
    status: asStringOrNull(record.status),
    feature_id: asStringOrNull(getFirst(record, ['feature_id', 'featureId'])),
    required_plan: asStringOrNull(getFirst(record, ['required_plan', 'requiredPlan'])),
    current_plan: asStringOrNull(getFirst(record, ['current_plan', 'currentPlan'])),
    upgrade_url: asStringOrNull(getFirst(record, ['upgrade_url', 'upgradeUrl'])) ?? upgrade?.upgrade_url ?? null,
    upgrade,
    frontend_contract: frontendContract,
  };
  return normalized;
};

const normalizeCheckoutPolicy = (value: unknown): MarketCheckoutExperiencePolicy | null => {
  const record = asRecordOrNull(value);
  if (!record) return null;
  return {
    ...record,
    payment_capture: asStringOrNull(getFirst(record, ['payment_capture', 'paymentCapture'])),
    card_data_in_chat: asBooleanOrNull(getFirst(record, ['card_data_in_chat', 'cardDataInChat'])),
    client_return_trusted: asBooleanOrNull(getFirst(record, ['client_return_trusted', 'clientReturnTrusted'])),
    confirmation_source: asStringOrNull(getFirst(record, ['confirmation_source', 'confirmationSource'])),
    webhook_required_for_paid_state: asBooleanOrNull(getFirst(record, ['webhook_required_for_paid_state', 'webhookRequiredForPaidState'])),
    whatsapp_window_policy: asStringOrNull(getFirst(record, ['whatsapp_window_policy', 'whatsappWindowPolicy'])),
  };
};

const normalizeCheckoutSteps = (value: unknown): MarketCheckoutExperienceStep[] | null => {
  if (!Array.isArray(value)) return null;
  const steps = value
    .map((item): MarketCheckoutExperienceStep | null => {
      const record = asRecordOrNull(item);
      if (!record) return null;
      const id = asStringOrNull(getFirst(record, ['id', 'key', 'action']));
      const label = asStringOrNull(getFirst(record, ['label', 'title', 'name']));
      const description = asStringOrNull(getFirst(record, ['description', 'detail', 'message']));
      if (!id && !label && !description) return null;
      return { ...record, id, label, description };
    })
    .filter((item): item is MarketCheckoutExperienceStep => Boolean(item));
  return steps.length ? steps : [];
};

const normalizeCheckoutBlockers = (value: unknown): MarketCheckoutExperienceBlocker[] | null => {
  if (!Array.isArray(value)) return null;
  const blockers = value
    .map((item): MarketCheckoutExperienceBlocker | null => {
      const record = asRecordOrNull(item);
      if (!record) return null;
      const id = asStringOrNull(getFirst(record, ['id', 'key', 'reason_code', 'reasonCode']));
      const label = asStringOrNull(getFirst(record, ['label', 'title', 'name']));
      const detail = asStringOrNull(getFirst(record, ['detail', 'description', 'message']));
      const owner = asStringOrNull(record.owner);
      if (!id && !label && !detail) return null;
      return { ...record, id, label, detail, owner };
    })
    .filter((item): item is MarketCheckoutExperienceBlocker => Boolean(item));
  return blockers.length ? blockers : [];
};

const normalizeOperatorActions = (value: unknown): MarketCheckoutOperatorAction[] | null => {
  if (!Array.isArray(value)) return null;
  const actions = value
    .map((item): MarketCheckoutOperatorAction | null => {
      const record = asRecordOrNull(item);
      if (!record) return null;
      const id = asStringOrNull(getFirst(record, ['id', 'key', 'action']));
      const label = asStringOrNull(getFirst(record, ['label', 'title', 'name']));
      const status = asStringOrNull(record.status);
      if (!id && !label && !status) return null;
      return { ...record, id, label, status };
    })
    .filter((item): item is MarketCheckoutOperatorAction => Boolean(item));
  return actions.length ? actions : [];
};

const normalizeCheckoutExperience = (input: unknown): MarketCheckoutExperience | null => {
  const record = asRecordOrNull(input);
  if (!record) return null;
  const gateway = asRecordOrNull(record.gateway);
  const copy = asRecordOrNull(record.copy);
  const normalized: MarketCheckoutExperience = {
    contract_version: asStringOrNull(record.contract_version),
    active_entrypoint: asStringOrNull(getFirst(record, ['active_entrypoint', 'activeEntrypoint'])),
    supported_entrypoints: normalizeStringArray(getFirst(record, ['supported_entrypoints', 'supportedEntrypoints'])),
    mode: asStringOrNull(record.mode),
    ready: asBooleanOrNull(record.ready),
    reason_code: asStringOrNull(getFirst(record, ['reason_code', 'reasonCode'])),
    blocking_reasons: normalizeCheckoutBlockers(getFirst(record, ['blocking_reasons', 'blockingReasons'])),
    operator_next_actions: normalizeOperatorActions(getFirst(record, ['operator_next_actions', 'operatorNextActions'])),
    integration_access: normalizeIntegrationAccess(getFirst(record, ['integration_access', 'integrationAccess'])),
    copy: copy
      ? {
          ...copy,
          title: asStringOrNull(copy.title),
          short: asStringOrNull(copy.short),
          customer_ready: asStringOrNull(getFirst(copy, ['customer_ready', 'customerReady'])),
          customer_pending_gateway: asStringOrNull(getFirst(copy, ['customer_pending_gateway', 'customerPendingGateway'])),
          customer_locked: asStringOrNull(getFirst(copy, ['customer_locked', 'customerLocked'])),
        }
      : null,
    policy: normalizeCheckoutPolicy(record.policy),
    steps: normalizeCheckoutSteps(record.steps),
    endpoints: normalizeCheckoutUrls(record.endpoints),
    gateway: gateway
      ? {
          ...gateway,
          name: asStringOrNull(gateway.name),
          configured: asBooleanOrNull(gateway.configured),
          provider_label: asStringOrNull(getFirst(gateway, ['provider_label', 'providerLabel'])),
        }
      : null,
  };

  const hasSignal = Object.values(normalized).some((value) =>
    Array.isArray(value)
      ? value.length > 0
      : value !== null && value !== undefined,
  );

  return hasSignal ? normalized : null;
};

const normalizeMarketCheckoutOptions = (input: unknown): MarketCheckoutOptions | null => {
  const record = asRecordOrNull(input);
  if (!record) return null;
  const checkoutExperience =
    normalizeCheckoutExperience(getFirst(record, ['checkout_experience', 'checkoutExperience'])) ??
    (asStringOrNull(record.contract_version)?.includes('checkout_experience') ? normalizeCheckoutExperience(record) : null);
  const gateway = asRecordOrNull(getFirst(record, ['gateway_config', 'gatewayConfig', 'gateway_detail', 'gatewayDetail']));
  const options: MarketCheckoutOptions = {
    contract_version: asStringOrNull(record.contract_version),
    ready: asBooleanOrNull(record.ready) ?? checkoutExperience?.ready ?? null,
    reason_code: asStringOrNull(getFirst(record, ['reason_code', 'reasonCode'])) ?? checkoutExperience?.reason_code ?? null,
    payment_required: asBooleanOrNull(getFirst(record, ['payment_required', 'paymentRequired'])),
    requires_contact_or_auth: asBooleanOrNull(getFirst(record, ['requires_contact_or_auth', 'requiresContactOrAuth'])),
    gateway: asStringOrNull(getFirst(record, ['gateway', 'payment_gateway'])) ?? checkoutExperience?.gateway?.name ?? null,
    gateway_hint:
      asStringOrNull(getFirst(record, ['gateway_hint', 'gatewayHint'])) ??
      checkoutExperience?.gateway?.provider_label ??
      checkoutExperience?.gateway?.name ??
      null,
    gateway_configured:
      asBooleanOrNull(getFirst(record, ['gateway_configured', 'gatewayConfigured'])) ??
      asBooleanOrNull(gateway?.configured) ??
      checkoutExperience?.gateway?.configured ??
      null,
    checkout_urls: normalizeCheckoutUrls(getFirst(record, ['checkout_urls', 'checkoutUrls'])),
    missing: asArrayOfStringsOrNull(record.missing),
    capabilities: normalizeCapabilities(record.capabilities),
    integration_access:
      normalizeIntegrationAccess(getFirst(record, ['integration_access', 'integrationAccess'])) ??
      checkoutExperience?.integration_access ??
      null,
    policy: normalizeCheckoutPolicy(record.policy) ?? checkoutExperience?.policy ?? null,
    checkout_experience: checkoutExperience,
    frontend_contract:
      normalizeFrontendContract(getFirst(record, ['frontend_contract', 'frontendContract'])) ??
      checkoutExperience?.integration_access?.frontend_contract ??
      null,
    upgrade: normalizePlanUpgrade(getFirst(record, ['upgrade', 'plan_upgrade', 'planUpgrade'])) ?? checkoutExperience?.integration_access?.upgrade ?? null,
  };

  const hasSignal = Object.values(options).some((value) =>
    Array.isArray(value)
      ? value.length > 0
      : value !== null && value !== undefined,
  );

  return hasSignal ? options : null;
};

const normalizeMarketNextSteps = (value: unknown): MarketNextStep[] | null => {
  if (!Array.isArray(value)) return null;
  const steps = value
    .map((item): MarketNextStep | null => {
      if (typeof item === 'string' && item.trim()) {
        return { title: item.trim(), description: null };
      }
      const record = asRecordOrNull(item);
      if (!record) return null;
      const title = asStringOrNull(getFirst(record, ['title', 'label', 'name']));
      const description = asStringOrNull(getFirst(record, ['description', 'detail', 'message']));
      if (!title && !description) return null;
      return { title, description };
    })
    .filter((item): item is MarketNextStep => Boolean(item));
  return steps.length ? steps : [];
};

const normalizeMarketCheckoutPreview = (input: unknown): MarketCheckoutPreview | null => {
  const source = getSource(input);
  const record = asRecordOrNull(source);
  if (!record) return null;
  const optionsSource = getFirst(record, ['checkout_options', 'checkoutOptions']);
  const checkoutExperience = normalizeCheckoutExperience(getFirst(record, ['checkout_experience', 'checkoutExperience']));
  const preview: MarketCheckoutPreview = {
    state: asStringOrNull(getFirst(record, ['state', 'status', 'estado'])),
    next_step_label: asStringOrNull(getFirst(record, ['next_step_label', 'nextStepLabel', 'message', 'action_hint'])),
    total_monetary: asNumberOrNull(getFirst(record, ['total_monetary', 'totalAmount', 'total_amount', 'total'])),
    total_points: asNumberOrNull(getFirst(record, ['total_points', 'totalPoints'])),
    amount_validated: asBooleanOrNull(getFirst(record, ['amount_validated', 'amountValidated'])),
    stock_status: asStringOrNull(getFirst(record, ['stock_status', 'stockStatus'])),
    available_to_sell: asBooleanOrNull(getFirst(record, ['available_to_sell', 'availableToSell'])),
    payment_required: asBooleanOrNull(getFirst(record, ['payment_required', 'paymentRequired'])),
    payment_ready: asBooleanOrNull(getFirst(record, ['payment_ready', 'paymentReady'])),
    contact_ready: asBooleanOrNull(getFirst(record, ['contact_ready', 'contactReady'])),
    checkout_options: normalizeMarketCheckoutOptions(optionsSource ?? checkoutExperience ?? record),
    checkout_experience: checkoutExperience ?? normalizeMarketCheckoutOptions(optionsSource)?.checkout_experience ?? null,
    next_steps: normalizeMarketNextSteps(getFirst(record, ['next_steps', 'nextSteps'])),
  };

  const hasSignal = Object.values(preview).some((value) =>
    Array.isArray(value)
      ? value.length > 0
      : value !== null && value !== undefined,
  );

  return hasSignal ? preview : null;
};

const normalizePaymentCheckoutStatus = (input: unknown): MarketPaymentCheckoutStatus => {
  const source = getSource(input);
  const record = asUnknownRecord(source);
  return {
    contract_version: asStringOrNull(record.contract_version),
    request_id: asStringOrNull(record.request_id),
    payment_ready: asBooleanOrNull(getFirst(record, ['payment_ready', 'paymentReady'])),
    mercadopago_ready: asBooleanOrNull(getFirst(record, ['mercadopago_ready', 'mercadoPagoReady'])),
    gateway: asStringOrNull(getFirst(record, ['gateway', 'payment_gateway'])),
    gateway_hint: asStringOrNull(getFirst(record, ['gateway_hint', 'gatewayHint'])),
    missing: asArrayOfStringsOrNull(record.missing),
    capabilities: normalizeCapabilities(record.capabilities),
    checkout_urls: normalizeCheckoutUrls(getFirst(record, ['checkout_urls', 'checkoutUrls'])),
    checkout_options: normalizeMarketCheckoutOptions(getFirst(record, ['checkout_options', 'checkoutOptions']) ?? record),
    checkout_experience:
      normalizeCheckoutExperience(getFirst(record, ['checkout_experience', 'checkoutExperience'])) ??
      normalizeMarketCheckoutOptions(getFirst(record, ['checkout_options', 'checkoutOptions']) ?? record)?.checkout_experience ??
      null,
    raw: input,
  };
};

const normalizeCheckoutStartResponse = (input: unknown): CheckoutStartResponse => {
  const source = getSource(input);
  const record = asUnknownRecord(source);
  const payment = asUnknownRecord(record.payment);
  const order = asUnknownRecord(record.order);
  const checkoutUrl =
    asStringOrNull(getFirst(record, ['checkoutUrl', 'checkout_url', 'init_point', 'payment_url', 'url'])) ??
    asStringOrNull(getFirst(payment, ['checkoutUrl', 'checkout_url', 'init_point', 'payment_url', 'url']));
  const preferenceId =
    asStringOrNull(getFirst(record, ['preferenceId', 'preference_id'])) ??
    asStringOrNull(getFirst(payment, ['preferenceId', 'preference_id']));
  const orderId =
    getFirst(record, ['orderId', 'order_id', 'market_order_id', 'pedido_id']) ??
    getFirst(order, ['id', 'order_id', 'market_order_id', 'pedido_id']);

  return {
    ok: asBooleanOrNull(record.ok),
    contract_version: asStringOrNull(record.contract_version),
    request_id: asStringOrNull(record.request_id),
    error: typeof record.error === 'string' ? record.error : asRecordOrNull(record.error),
    reason_code: asStringOrNull(getFirst(record, ['reason_code', 'reasonCode'])),
    lock_reason_code: asStringOrNull(getFirst(record, ['lock_reason_code', 'lockReasonCode'])),
    action_hint: asStringOrNull(getFirst(record, ['action_hint', 'actionHint'])),
    feature_id: asStringOrNull(getFirst(record, ['feature_id', 'featureId'])),
    feature: asRecordOrNull(record.feature),
    access: normalizeIntegrationAccess(record.access),
    integration_access: normalizeIntegrationAccess(getFirst(record, ['integration_access', 'integrationAccess'])),
    upgrade: normalizePlanUpgrade(getFirst(record, ['upgrade', 'plan_upgrade', 'planUpgrade'])),
    frontend_contract: normalizeFrontendContract(getFirst(record, ['frontend_contract', 'frontendContract'])),
    checkoutUrl: checkoutUrl ?? undefined,
    preferenceId: preferenceId ?? undefined,
    orderId: typeof orderId === 'string' || typeof orderId === 'number' ? orderId : undefined,
    order_id: getFirst(record, ['order_id', 'pedido_id']) as CheckoutStartResponse['order_id'],
    market_order_id: getFirst(record, ['market_order_id']) as CheckoutStartResponse['market_order_id'],
    preference_id: preferenceId,
    init_point: asStringOrNull(getFirst(record, ['init_point', 'initPoint'])) ?? checkoutUrl,
    external_reference: asStringOrNull(getFirst(record, ['external_reference', 'externalReference'])),
    status: asStringOrNull(getFirst(record, ['status', 'estado'])) ?? asStringOrNull(payment.status) ?? undefined,
    estado: asStringOrNull(record.estado),
    tipo: asStringOrNull(record.tipo),
    message: asStringOrNull(getFirst(record, ['message', 'detail', 'next_step_label'])),
    amount_validated:
      asBooleanOrNull(getFirst(record, ['amount_validated', 'amountValidated'])) ??
      asBooleanOrNull(getFirst(order, ['amount_validated', 'amountValidated'])),
    stock_status:
      asStringOrNull(getFirst(record, ['stock_status', 'stockStatus'])) ??
      asStringOrNull(getFirst(order, ['stock_status', 'stockStatus'])),
    available_to_sell:
      asBooleanOrNull(getFirst(record, ['available_to_sell', 'availableToSell'])) ??
      asBooleanOrNull(getFirst(order, ['available_to_sell', 'availableToSell'])),
    inventory_policy: asRecordOrNull(getFirst(record, ['inventory_policy', 'inventoryPolicy'])),
    order,
    checkout_options: normalizeMarketCheckoutOptions(getFirst(record, ['checkout_options', 'checkoutOptions'])),
    checkout_experience:
      normalizeCheckoutExperience(getFirst(record, ['checkout_experience', 'checkoutExperience'])) ??
      normalizeMarketCheckoutOptions(getFirst(record, ['checkout_options', 'checkoutOptions']))?.checkout_experience ??
      null,
    customer_profile: asRecordOrNull(record.customer_profile) as CheckoutStartResponse['customer_profile'],
    commercial_state: asRecordOrNull(record.commercial_state) as CheckoutStartResponse['commercial_state'],
    tracking: asRecordOrNull(record.tracking) as CheckoutStartResponse['tracking'],
    next_steps: normalizeMarketNextSteps(getFirst(record, ['next_steps', 'nextSteps'])),
    support_channels: asRecordOrNull(record.support_channels) as CheckoutStartResponse['support_channels'],
  };
};

const normalizePaymentStatusResponse = (input: unknown): MarketPaymentStatusResponse => {
  const source = getSource(input);
  const record = asUnknownRecord(source);
  return {
    contract_version: asStringOrNull(record.contract_version),
    request_id: asStringOrNull(record.request_id),
    payment: asRecordOrNull(record.payment) as MarketPaymentStatusResponse['payment'],
    mp_payment_id: getFirst(record, ['mp_payment_id', 'payment_id']) as MarketPaymentStatusResponse['mp_payment_id'],
    preference_id: asStringOrNull(getFirst(record, ['preference_id', 'preferenceId'])),
    order: asRecordOrNull(record.order),
    timeline: Array.isArray(record.timeline) ? record.timeline : null,
    raw: input,
  };
};

const normalizeRewardRedemption = (input: unknown): MarketRewardRedemption | null => {
  const record = asRecordOrNull(input);
  if (!record) return null;
  return {
    id: getFirst(record, ['id', 'reward_id']) as MarketRewardRedemption['id'],
    reward_id: getFirst(record, ['reward_id', 'id']) as MarketRewardRedemption['reward_id'],
    label: asStringOrNull(getFirst(record, ['label', 'name', 'title'])),
    title: asStringOrNull(getFirst(record, ['title', 'label', 'name'])),
    description: asStringOrNull(getFirst(record, ['description', 'detail'])),
    points: asNumberOrNull(getFirst(record, ['points', 'puntos'])),
    cost_points: asNumberOrNull(getFirst(record, ['cost_points', 'points_cost', 'puntos_costo'])),
    disabled: asBooleanOrNull(getFirst(record, ['disabled', 'unavailable'])),
    raw: input,
  };
};

const normalizeRewardsProfile = (input: unknown): MarketRewardsProfile => {
  const source = getSource(input);
  const record = asUnknownRecord(source);
  const wallet = asUnknownRecord(record.wallet);
  return {
    contract_version: asStringOrNull(record.contract_version),
    request_id: asStringOrNull(record.request_id),
    wallet: {
      ...wallet,
      balance: asNumberOrNull(getFirst(wallet, ['balance', 'saldo'])),
      pending_cart_points: asNumberOrNull(getFirst(wallet, ['pending_cart_points', 'pendingCartPoints'])),
    },
    rules: Array.isArray(record.rules) ? record.rules : asRecordOrNull(record.rules),
    available_redemptions: Array.isArray(record.available_redemptions)
      ? record.available_redemptions
          .map(normalizeRewardRedemption)
          .filter((item): item is MarketRewardRedemption => Boolean(item))
      : [],
    history: Array.isArray(record.history) ? record.history : [],
    summary: asRecordOrNull(record.summary),
    raw: input,
  };
};

const normalizeRewardRedeemResponse = (input: unknown): MarketRewardRedeemResponse => {
  const source = getSource(input);
  const record = asUnknownRecord(source);
  return {
    contract_version: asStringOrNull(record.contract_version),
    request_id: asStringOrNull(record.request_id),
    redemption_id: getFirst(record, ['redemption_id', 'id']) as MarketRewardRedeemResponse['redemption_id'],
    reward_id: getFirst(record, ['reward_id']) as MarketRewardRedeemResponse['reward_id'],
    balance: asNumberOrNull(record.balance),
    duplicate: asBooleanOrNull(record.duplicate),
    raw: input,
  };
};

const normalizeMarketCartPromotions = (value: unknown): MarketCartPromotions | null => {
  const record = asRecordOrNull(value);
  if (!record) return null;
  const applied = getFirst(record, ['promociones_aplicadas', 'applied_promotions', 'appliedPromotions']);
  return {
    items_detalle: Array.isArray(record.items_detalle) ? record.items_detalle : [],
    total_ahorrado: asNumberOrNull(getFirst(record, ['total_ahorrado', 'totalSaved', 'total_saved'])),
    total_con_descuento: asNumberOrNull(getFirst(record, ['total_con_descuento', 'discountedTotal', 'total_with_discount'])),
    promociones_aplicadas: Array.isArray(applied) ? applied.map((item) => String(item)).filter(Boolean) : [],
    promo_total_carrito: asRecordOrNull(getFirst(record, ['promo_total_carrito', 'cartPromotion', 'cart_promotion'])),
    raw: value,
  };
};

const withQuery = (path: string, params?: Record<string, string | number | boolean | null | undefined>) => {
  if (!params) return path;
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value === null || value === undefined || value === '') return;
    search.set(key, String(value));
  });
  const query = search.toString();
  return query ? `${path}?${query}` : path;
};

const normalizeMarketCartResponse = (input: MarketCartResponse | null | undefined): MarketCartResponse => {
  const payload = (input ?? {}) as MarketCartResponse & Record<string, unknown>;
  const continuityRaw = asRecordOrNull(payload.continuity);
  const portalLinksRaw = asRecordOrNull(continuityRaw?.portal_links);
  const checkoutOptionsRaw = asRecordOrNull(payload.checkout_options);
  const checkoutPreviewRaw = asRecordOrNull(payload.checkout_preview);
  const checkoutExperienceRaw = asRecordOrNull(getFirst(payload, ['checkout_experience', 'checkoutExperience']));
  const promotions = normalizeMarketCartPromotions(payload.promotions);
  const items = Array.isArray(payload.items)
    ? payload.items.map((item, index) => {
        const raw = asUnknownRecord(item);
        const catalogoItemId = getFirst(raw, ['catalogo_item_id', 'catalog_item_id', 'product_id', 'productId', 'id']);
        const lineId = getFirst(raw, ['line_id', 'cart_item_id', 'cartItemId']);
        const quantity = asNumberOrNull(getFirst(raw, ['quantity', 'cantidad', 'qty'])) ?? 1;
        const id = asStringIdOrNull(getFirst(raw, ['id', 'product_id', 'productId', 'catalogo_item_id', 'catalog_item_id'])) ?? `product-${index}`;
        return {
          ...item,
          id,
          catalogo_item_id: catalogoItemId as MarketCartItem['catalogo_item_id'],
          catalog_item_id: catalogoItemId as MarketCartItem['catalog_item_id'],
          product_id: getFirst(raw, ['product_id', 'productId', 'catalogo_item_id', 'catalog_item_id']) as MarketCartItem['product_id'],
          line_id: lineId as MarketCartItem['line_id'],
          quantity,
        } as MarketCartItem;
      })
    : [];

  return {
    ...payload,
    items,
    totalAmount: asNumberOrNull(getFirst(payload, ['totalAmount', 'total_amount', 'total_estimado', 'total_monetary', 'total'])) ?? null,
    totalPoints: asNumberOrNull(getFirst(payload, ['totalPoints', 'total_points', 'total_puntos_estimado'])) ?? null,
    continuity: continuityRaw
      ? {
          resume_key: asStringOrNull(continuityRaw.resume_key),
          preferred_handoff_channel: asStringOrNull(continuityRaw.preferred_handoff_channel),
          summary: asStringOrNull(continuityRaw.summary),
          conversation_id: asStringOrNull(continuityRaw.conversation_id),
          portal_links: portalLinksRaw
            ? {
                home: asStringOrNull(portalLinksRaw.home),
                orders: asStringOrNull(portalLinksRaw.orders),
                profile: asStringOrNull(portalLinksRaw.profile),
              }
            : null,
        }
      : null,
    checkout_options: normalizeMarketCheckoutOptions(checkoutOptionsRaw ?? checkoutExperienceRaw),
    checkout_preview: normalizeMarketCheckoutPreview(checkoutPreviewRaw),
    checkout_experience:
      normalizeCheckoutExperience(checkoutExperienceRaw) ??
      normalizeMarketCheckoutOptions(checkoutOptionsRaw)?.checkout_experience ??
      null,
    mercadopago_ready: asBooleanOrNull(payload.mercadopago_ready),
    amount_validated: asBooleanOrNull(payload.amount_validated),
    stock_status: asStringOrNull(payload.stock_status),
    available_to_sell: asBooleanOrNull(payload.available_to_sell),
    inventory_policy: asRecordOrNull(payload.inventory_policy),
    promotions,
  };
};

export async function fetchMarketCart(tenantSlug: string): Promise<MarketCartResponse> {
  const endpoint = resolveMarketCartEndpoint(tenantSlug, 'summary') ?? `/api/${tenantSlug}/carrito`;
  const response = await apiFetch<MarketCartResponse>(endpoint, marketCartFetchOptions(endpoint, tenantSlug));
  return normalizeMarketCartResponse(response);
}

export async function fetchMarketCatalog(
  tenantSlug: string,
  filters?: {
    q?: string | null;
    categoria?: string | null;
    precio_min?: number | string | null;
    precio_max?: number | string | null;
    en_promocion?: boolean | null;
    sort?: string | null;
  },
): Promise<MarketCatalogResponse> {
  const params = new URLSearchParams({ contract: 'marketplace' });
  if (filters?.q) params.set('q', filters.q);
  if (filters?.categoria) params.set('categoria', filters.categoria);
  if (filters?.precio_min !== undefined && filters.precio_min !== null && filters.precio_min !== '') {
    params.set('precio_min', String(filters.precio_min));
  }
  if (filters?.precio_max !== undefined && filters.precio_max !== null && filters.precio_max !== '') {
    params.set('precio_max', String(filters.precio_max));
  }
  if (filters?.en_promocion === true) params.set('en_promocion', 'true');
  if (filters?.sort) params.set('sort', filters.sort);

  const response = await apiFetch<MarketCatalogResponse>(
    `/api/public/tenants/${encodeURIComponent(tenantSlug)}/catalog?${params.toString()}`,
    {
    tenantSlug,
    suppressPanel401Redirect: true,
    omitChatSessionId: true,
    },
  );
  const catalog = normalizeMarketCatalogResponse(response);
  rememberMarketPublicApiContract(tenantSlug, catalog.public_api);
  return catalog;
}

export async function searchCatalog(tenantSlug: string, query: string): Promise<MarketCatalogResponse> {
  const params = new URLSearchParams({ q: query, tenant_slug: tenantSlug });
  const response = await apiFetch<MarketCatalogResponse>(`/catalogo/buscar?${params.toString()}`, {
    tenantSlug,
    suppressPanel401Redirect: true,
    omitChatSessionId: true,
  });
  return normalizeMarketCatalogResponse(response);
}

const normalizeAddToCartPayload = (payload: AddToCartPayload): AddToCartPayload => {
  const itemId =
    payload.catalogo_item_id ??
    payload.catalog_item_id ??
    payload.product_id ??
    payload.productId;

  const normalizedItemId =
    typeof itemId === 'string'
      ? itemId.trim()
      : typeof itemId === 'number' && Number.isFinite(itemId)
        ? itemId
        : null;

  return {
    ...payload,
    ...(normalizedItemId !== null
      ? {
          catalogo_item_id: normalizedItemId,
          catalog_item_id: normalizedItemId,
          productId: String(normalizedItemId),
        }
      : {}),
    ...(payload.quantity !== undefined && payload.cantidad === undefined
      ? { cantidad: payload.quantity }
      : {}),
  };
};

export async function addMarketItem(tenantSlug: string, payload: AddToCartPayload): Promise<MarketCartResponse> {
  const endpoint = resolveMarketCartEndpoint(tenantSlug, 'add') ?? `/api/${tenantSlug}/carrito`;
  const response = await apiFetch<MarketCartResponse>(endpoint, {
    ...marketCartFetchOptions(endpoint, tenantSlug),
    method: 'POST',
    body: normalizeAddToCartPayload(payload),
    headers: { 'X-Persist-Session': 'true' }
  });
  return normalizeMarketCartResponse(response);
}

export async function removeMarketItem(tenantSlug: string, itemId: string): Promise<MarketCartResponse> {
  const response = await apiFetch<MarketCartResponse>(`/api/${tenantSlug}/carrito/${itemId}`, {
    method: 'DELETE',
    tenantSlug,
    omitChatSessionId: true,
  });
  return normalizeMarketCartResponse(response);
}

export async function clearMarketCart(tenantSlug: string): Promise<MarketCartResponse> {
  const response = await apiFetch<MarketCartResponse>(`/api/${tenantSlug}/carrito`, {
    method: 'DELETE',
    tenantSlug,
    omitChatSessionId: true,
  });
  return normalizeMarketCartResponse(response);
}

export async function startMarketCheckout(tenantSlug: string, payload: CheckoutStartPayload): Promise<CheckoutStartResponse> {
  const options = {
    method: 'POST' as const,
    body: payload,
    tenantSlug,
    suppressPanel401Redirect: true,
    omitChatSessionId: true,
  };

  try {
    const response = await apiFetch<unknown>('/api/v2/payments/checkout-session', options);
    return normalizeCheckoutStartResponse(response);
  } catch (error) {
    if (!shouldFallbackCheckoutEndpoint(error)) {
      console.error("Error starting checkout:", error);
      throw error;
    }
  }

  try {
    const response = await apiFetch<unknown>('/api/v2/payments/preference', options);
    return normalizeCheckoutStartResponse(response);
  } catch (error) {
    if (!shouldFallbackCheckoutEndpoint(error)) {
      console.error("Error starting checkout preference:", error);
      throw error;
    }
  }

  try {
    const response = await apiFetch<unknown>(`/api/market/${tenantSlug}/checkout/start`, options);
    return normalizeCheckoutStartResponse(response);
  } catch (error) {
    console.error("Error starting checkout:", error);
    throw error;
  }
}

export async function fetchPaymentCheckoutStatus(
  tenantSlug: string,
  params?: Record<string, string | number | boolean | null | undefined>,
): Promise<MarketPaymentCheckoutStatus | null> {
  try {
    const response = await apiFetch<unknown>(withQuery('/api/v2/payments/checkout-status', params), {
      tenantSlug,
      suppressPanel401Redirect: true,
      omitChatSessionId: true,
    });
    return normalizePaymentCheckoutStatus(response);
  } catch (error) {
    if (shouldFallbackEndpoint(error)) return null;
    throw error;
  }
}

export async function fetchPaymentCapabilities(tenantSlug: string): Promise<MarketPaymentCheckoutStatus | null> {
  try {
    const response = await apiFetch<unknown>('/api/v2/payments/capabilities', {
      tenantSlug,
      suppressPanel401Redirect: true,
      omitChatSessionId: true,
    });
    return normalizePaymentCheckoutStatus(response);
  } catch (error) {
    if (shouldFallbackEndpoint(error)) return null;
    throw error;
  }
}

export async function previewPaymentCheckout(
  tenantSlug: string,
  payload: CheckoutStartPayload,
): Promise<MarketCheckoutPreview | null> {
  try {
    const response = await apiFetch<unknown>('/api/v2/payments/checkout-preview', {
      method: 'POST',
      body: payload,
      tenantSlug,
      suppressPanel401Redirect: true,
      omitChatSessionId: true,
    });
    return normalizeMarketCheckoutPreview(response);
  } catch (error) {
    if (shouldFallbackEndpoint(error)) return null;
    throw error;
  }
}

export async function fetchPaymentStatus(
  tenantSlug: string,
  params: Record<string, string | number | boolean | null | undefined>,
): Promise<MarketPaymentStatusResponse | null> {
  try {
    const response = await apiFetch<unknown>('/api/v2/payments/status', {
      method: 'POST',
      body: params,
      tenantSlug,
      suppressPanel401Redirect: true,
      omitChatSessionId: true,
    });
    return normalizePaymentStatusResponse(response);
  } catch (error) {
    if (!shouldFallbackEndpoint(error)) throw error;
  }

  try {
    const response = await apiFetch<unknown>(withQuery('/api/v2/payments/status', params), {
      tenantSlug,
      suppressPanel401Redirect: true,
      omitChatSessionId: true,
    });
    return normalizePaymentStatusResponse(response);
  } catch (error) {
    if (shouldFallbackEndpoint(error)) return null;
    throw error;
  }
}

export async function fetchRewardsProfile(tenantSlug: string): Promise<MarketRewardsProfile | null> {
  try {
    const response = await apiFetch<unknown>('/api/v2/rewards/profile', {
      tenantSlug,
      suppressPanel401Redirect: true,
      omitChatSessionId: true,
    });
    return normalizeRewardsProfile(response);
  } catch (error) {
    if (shouldFallbackEndpoint(error)) return null;
    if (error instanceof ApiError && [401, 403].includes(error.status)) return null;
    throw error;
  }
}

export async function redeemReward(
  tenantSlug: string,
  payload: Record<string, unknown>,
  idempotencyKey?: string,
): Promise<MarketRewardRedeemResponse> {
  const response = await apiFetch<unknown>('/api/v2/rewards/redeem', {
    method: 'POST',
    body: payload,
    tenantSlug,
    suppressPanel401Redirect: true,
    omitChatSessionId: true,
    headers: idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : undefined,
  });
  return normalizeRewardRedeemResponse(response);
}

export async function fetchPublicOrder(ticketNumber: string): Promise<PublicOrderTrackingResponse> {
  return apiFetch<PublicOrderTrackingResponse>(`/api/public/pyme/pedidos/${ticketNumber}`, {
    skipAuth: true
  });
}
