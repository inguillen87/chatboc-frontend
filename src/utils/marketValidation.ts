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

const hasAnySignal = (record: Record<string, unknown>, keys: string[]) =>
  keys.some((key) => record[key] !== undefined && record[key] !== null);

const hasPaymentContractShape = (record: Record<string, unknown>) =>
  hasAnySignal(record, [
    'contract_version',
    'payment_required',
    'paymentRequired',
    'payment_ready',
    'paymentReady',
    'gateway_configured',
    'gatewayConfigured',
    'gateway',
    'gateway_config',
    'gatewayConfig',
    'payment_capture',
    'paymentCapture',
    'confirmation_source',
    'confirmationSource',
    'webhook_required_for_paid_state',
    'webhookRequiredForPaidState',
  ]);

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
  'access',
  'frontend_contract',
  'frontendContract',
  'upgrade',
  'feature',
  'error',
  'plan',
  'capability',
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
    (found, record) => {
      if (found !== null) return found;
      const explicit = asBoolean(first(record, ['payment_ready', 'paymentReady']));
      if (explicit !== null) return explicit;
      return hasPaymentContractShape(record) ? asBoolean(record.ready) : null;
    },
    null,
  );
  const gatewayConfigured = records.reduce<boolean | null>(
    (found, record) => {
      if (found !== null) return found;
      const explicit = asBoolean(first(record, ['gateway_configured', 'gatewayConfigured']));
      if (explicit !== null) return explicit;
      return hasPaymentContractShape(record) ? asBoolean(record.configured) : null;
    },
    null,
  );
  const integrationEnabled = records.reduce<boolean | null>((found, record) => {
    if (found !== null) return found;
    const hasIntegrationShape =
      first(record, ['required_plan', 'requiredPlan', 'current_plan', 'currentPlan', 'feature', 'capability']) !==
        undefined ||
      first(record, ['frontend_contract', 'frontendContract', 'lock_reason_code', 'lockReasonCode', 'action_hint', 'actionHint']) !==
        undefined;
    return hasIntegrationShape ? asBoolean(first(record, ['enabled', 'allowed'])) : null;
  }, null);
  const reasonCode = records.reduce<string | null>(
    (found, record) => found ?? asString(first(record, ['reason_code', 'reasonCode'])),
    null,
  );
  const lockReasonCode = records.reduce<string | null>(
    (found, record) => found ?? asString(first(record, ['lock_reason_code', 'lockReasonCode'])),
    null,
  );
  const errorCode = records.reduce<string | null>(
    (found, record) => found ?? asString(first(record, ['error', 'code', 'error_code', 'errorCode'])),
    null,
  );
  const renderAs = records.reduce<string | null>(
    (found, record) => found ?? asString(first(record, ['render_as', 'renderAs'])),
    null,
  );
  const actionHint = records.reduce<string | null>(
    (found, record) => found ?? asString(first(record, ['action_hint', 'actionHint'])),
    null,
  );
  const messageCopy = records.reduce<string | null>(
    (found, record) => found ?? asString(first(record, ['message', 'detail'])),
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
  const confirmationSource = records.reduce<string | null>(
    (found, record) => found ?? asString(first(record, ['confirmation_source', 'confirmationSource'])),
    null,
  );
  const cardDataInChat = records.reduce<boolean | null>(
    (found, record) => found ?? asBoolean(first(record, ['card_data_in_chat', 'cardDataInChat'])),
    null,
  );
  const webhookRequiredForPaidState = records.reduce<boolean | null>(
    (found, record) =>
      found ?? asBoolean(first(record, ['webhook_required_for_paid_state', 'webhookRequiredForPaidState'])),
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
  const normalizedLockReasonCode = lockReasonCode?.toLowerCase() ?? null;
  const normalizedErrorCode = errorCode?.toLowerCase() ?? null;
  const normalizedRenderAs = renderAs?.toLowerCase() ?? null;
  const normalizedActionHint = actionHint?.toLowerCase() ?? null;
  let reason: string | null = null;

  const setReason = (nextReason: string) => {
    reason = reason ?? nextReason;
  };

  const planRequired =
    integrationEnabled === false ||
    normalizedReasonCode === 'plan_full_required' ||
    normalizedReasonCode === 'plan_required' ||
    normalizedLockReasonCode === 'plan_full_required' ||
    normalizedLockReasonCode === 'plan_required' ||
    normalizedErrorCode === 'plan_required' ||
    normalizedRenderAs === 'payment_integration_locked' ||
    normalizedRenderAs === 'integration_locked' ||
    normalizedActionHint === 'upgrade_full_plan' ||
    normalizedActionHint === 'upgrade_to_full';

  if (planRequired) {
    setReason(
      messageCopy ??
      customerLockedCopy ??
        'Plan Full requerido para cobrar desde WhatsApp, widget o checkout publico.',
    );
  }
  if (demoDisablesConfirm) setReason('Esta demo no confirma pedidos reales.');
  if (amountValidated === false) setReason('Monto a validar por backend.');
  if (normalizedStock === 'stock_unknown') setReason('Stock a confirmar por backend.');
  if (normalizedStock === 'out_of_stock') setReason('Sin stock confirmado.');
  if (availableToSell === false) setReason('No disponible para venta confirmada.');
  if (paymentRequired === true && (paymentReady === false || gatewayConfigured === false)) {
    setReason(
      customerPendingGatewayCopy ??
        'El proveedor de pago todavia no esta configurado para cobrar online.',
    );
  }
  if (paymentRequired === true && cardDataInChat === true) {
    setReason('Por seguridad, Chatboc no permite capturar datos de tarjeta dentro del chat.');
  }
  if (
    paymentRequired === true &&
    confirmationSource !== null &&
    confirmationSource !== 'server_to_server_webhook'
  ) {
    setReason('El pago debe confirmarse por webhook del proveedor antes de marcar la orden como pagada.');
  }
  if (paymentRequired === true && webhookRequiredForPaidState === false) {
    setReason('El estado pagado requiere webhook server-to-server del proveedor.');
  }
  if (normalizedReasonCode === 'payment_gateway_not_configured') {
    setReason(
      customerPendingGatewayCopy ??
        'El proveedor de pago todavia no esta configurado para cobrar online.',
    );
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
