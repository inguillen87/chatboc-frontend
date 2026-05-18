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

export const getMarketCommercialValidation = (...sources: unknown[]): MarketCommercialValidation => {
  const records = sources.flatMap((source) => {
    const record = asRecord(source);
    if (!record) return [];
    const data = asRecord(record.data);
    const order = asRecord(record.order);
    const inventoryPolicy = asRecord(record.inventory_policy) ?? asRecord(record.inventoryPolicy);
    return [record, data, order, inventoryPolicy].filter((item): item is Record<string, unknown> => Boolean(item));
  });

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
  const confirmOrders = records.reduce<unknown>(
    (found, record) => found ?? first(record, ['confirm_orders', 'confirmOrders']),
    undefined,
  );

  const normalizedStock = stockStatus?.toLowerCase() ?? null;
  const unsafeStock = normalizedStock === 'stock_unknown' || normalizedStock === 'out_of_stock';
  const demoDisablesConfirm = confirmOrders === false;

  let reason: string | null = null;
  if (demoDisablesConfirm) reason = 'Esta demo no confirma pedidos reales.';
  if (amountValidated === false) reason = 'Monto a validar por backend.';
  if (normalizedStock === 'stock_unknown') reason = 'Stock a confirmar por backend.';
  if (normalizedStock === 'out_of_stock') reason = 'Sin stock confirmado.';
  if (availableToSell === false) reason = 'No disponible para venta confirmada.';

  return {
    canConfirmPurchase: !reason && amountValidated === true && !unsafeStock && availableToSell !== false,
    canStartCheckout: !reason,
    reason,
    amountValidated,
    stockStatus,
    availableToSell,
  };
};
