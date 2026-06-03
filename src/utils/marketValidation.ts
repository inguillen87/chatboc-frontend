type ValidationSource = Record<string, unknown> | null | undefined;

export interface MarketCommercialValidation {
  canConfirmPurchase: boolean;
  canStartCheckout: boolean;
  reason: string | null;
  amountValidated: boolean | null;
  stockStatus: string | null;
  availableToSell: boolean | null;
}

const asRecord = (value: unknown): Record<string, unknown> | null =>
  value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : null;

const first = (source: ValidationSource, keys: string[]): unknown => {
  if (!source) return undefined;
  for (const key of keys) {
    const value = source[key];
    if (value !== undefined && value !== null) return value;
  }
  return undefined;
};

const asBoolean = (value: unknown): boolean | null => {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (['true', '1', 'yes', 'si', 'sí'].includes(normalized)) return true;
    if (['false', '0', 'no'].includes(normalized)) return false;
  }
  return null;
};

const asString = (value: unknown): string | null => {
  if (typeof value !== 'string') return null;
  const normalized = value.trim();
  return normalized ? normalized : null;
};

const nestedKeys = [
  'data',
  'order',
  'inventory_policy',
  'inventoryPolicy',
  'checkout_options',
  'checkoutOptions',
  'checkout_preview',
  'checkoutPreview',
  'checkout_experience',
  'checkoutExperience',
  'payment',
  'payments',
  'commerce',
  'integration_access',
  'integrationAccess',
  'gateway',
  'policy',
  'copy',
];

const collectRecords = (source: unknown, seen = new WeakSet<object>()): Record<string, unknown>[] => {
  const record = asRecord(source);
  if (!record) return [];
  if (seen.has(record)) return [];
  seen.add(record);

  return [
    record,
    ...nestedKeys.flatMap((key) => collectRecords(record[key], seen)),
  ];
};

export const getMarketCommercialValidation = (...sources: unknown[]): MarketCommercialValidation => {
  const records = sources.flatMap((source) => collectRecords(source));

  const amountValidated = records.reduce<boolean | null>(
    (found, record) => found ?? asBoolean(first(record, ['amount_validated', 'amountValidated', 'monto_validado'])),
    null,
  );
  const stockStatus = records.reduce<string | null>(
    (found, record) => found ?? asString(first(record, ['stock_status', 'stockStatus', 'availability_status'])),
    null,
  );
  const availableToSell = records.reduce<boolean | null>(
    (found, record) => found ?? asBoolean(first(record, ['available_to_sell', 'availableToSell', 'disponible'])),
    null,
  );
  const paymentRequired = records.reduce<boolean | null>(
    (found, record) => found ?? asBoolean(first(record, ['payment_required', 'paymentRequired'])),
    null,
  );
  const paymentReady = records.reduce<boolean | null>(
    (found, record) => found ?? asBoolean(first(record, ['payment_ready', 'paymentReady', 'ready'])),
    null,
  );
  const gatewayConfigured = records.reduce<boolean | null>(
    (found, record) => found ?? asBoolean(first(record, ['gateway_configured', 'gatewayConfigured', 'configured'])),
    null,
  );
  const integrationEnabled = records.reduce<boolean | null>(
    (found, record) => found ?? asBoolean(first(record, ['enabled', 'allowed'])),
    null,
  );
  const reasonCode = records.reduce<string | null>(
    (found, record) => found ?? asString(first(record, ['reason_code', 'reasonCode'])),
    null,
  );
  const customerLockedCopy = records.reduce<string | null>(
    (found, record) => found ?? asString(first(record, ['customer_locked', 'customerLocked'])),
    null,
  );
  const customerPendingGatewayCopy = records.reduce<string | null>(
    (found, record) => found ?? asString(first(record, ['customer_pending_gateway', 'customerPendingGateway'])),
    null,
  );
  const confirmOrders = records.reduce<unknown>(
    (found, record) => found ?? first(record, ['confirm_orders', 'confirmOrders']),
    undefined,
  );

  const normalizedStock = stockStatus?.toLowerCase() ?? null;
  const unsafeStock = normalizedStock === 'stock_unknown' || normalizedStock === 'out_of_stock';
  const demoDisablesConfirm = confirmOrders === false;
  const normalizedReasonCode = reasonCode?.toLowerCase() ?? null;

  let reason: string | null = null;
  if (demoDisablesConfirm) reason = 'Esta demo no confirma pedidos reales.';
  if (amountValidated === false) reason = 'Monto a validar por backend.';
  if (normalizedStock === 'stock_unknown') reason = 'Stock a confirmar por backend.';
  if (normalizedStock === 'out_of_stock') reason = 'Sin stock confirmado.';
  if (availableToSell === false) reason = 'No disponible para venta confirmada.';
  if (paymentRequired === true && (paymentReady === false || gatewayConfigured === false)) {
    reason =
      customerPendingGatewayCopy ??
      'El proveedor de pago todavia no esta configurado para cobrar online.';
  }
  if (normalizedReasonCode === 'payment_gateway_not_configured') {
    reason =
      customerPendingGatewayCopy ??
      'El proveedor de pago todavia no esta configurado para cobrar online.';
  }
  if (integrationEnabled === false || normalizedReasonCode === 'plan_full_required') {
    reason =
      customerLockedCopy ??
      'Plan Full requerido para cobrar desde WhatsApp o widget.';
  }

  return {
    canConfirmPurchase: !reason && amountValidated === true && !unsafeStock && availableToSell !== false,
    canStartCheckout: !reason,
    reason,
    amountValidated,
    stockStatus,
    availableToSell,
  };
};
