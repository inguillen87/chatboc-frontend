import type { CheckoutStartResponse } from '@/types/market';
import { getMarketCommercialValidation } from '@/utils/marketValidation';

export type CheckoutStatus = 'idle' | 'validating' | 'creating_order' | 'awaiting_payment' | 'success' | 'error';

export interface CheckoutState {
  status: CheckoutStatus;
  error: string | null;
  message: string | null;
  paymentUrl: string | null;
  orderId: string | null;
  updatedAt: string | null;
  contact: {
    name: string;
    phone: string;
  };
}

export interface PersistedCheckoutState {
  status?: CheckoutStatus;
  error?: string | null;
  message?: string | null;
  paymentUrl?: string | null;
  orderId?: string | null;
  updatedAt?: string | null;
  contact?: {
    name?: string;
    phone?: string;
  };
}

export const createInitialCheckoutState = (): CheckoutState => ({
  status: 'idle',
  error: null,
  message: null,
  paymentUrl: null,
  orderId: null,
  updatedAt: null,
  contact: {
    name: '',
    phone: '',
  },
});

export type CheckoutAction =
  | { type: 'HYDRATE'; payload: PersistedCheckoutState }
  | { type: 'SET_CONTACT'; payload: Partial<CheckoutState['contact']> }
  | { type: 'TRANSITION'; to: CheckoutStatus; payload?: Partial<CheckoutState> }
  | { type: 'RESET' };

const lowerString = (value: unknown): string | null =>
  typeof value === 'string' && value.trim() ? value.trim().toLowerCase() : null;

const getErrorCode = (value: unknown): unknown => {
  if (typeof value === 'string') return value;
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  return record.code ?? record.error ?? record.reason_code ?? record.reasonCode;
};

const isPlanLockResponse = (response: CheckoutStartResponse): boolean => {
  const candidates = [
    getErrorCode(response.error),
    response.reason_code,
    response.lock_reason_code,
    response.action_hint,
    response.frontend_contract?.render_as,
    response.checkout_options?.frontend_contract?.render_as,
    response.integration_access?.frontend_contract?.render_as,
    response.access?.frontend_contract?.render_as,
  ].map(lowerString);

  return candidates.some((code) => Boolean(code && ['plan_required', 'plan_full_required', 'upgrade_full_plan', 'upgrade_to_full', 'payment_integration_locked', 'integration_locked'].includes(code)));
};

// Browser storage is not an authenticated receipt or a source for contact PII.
// Kept as compatibility helpers for callers still holding the old state shape.
export const hydrateCheckoutState = (_raw: unknown): CheckoutState => createInitialCheckoutState();

export const checkoutReducer = (state: CheckoutState, action: CheckoutAction): CheckoutState => {
  switch (action.type) {
    case 'HYDRATE':
      return hydrateCheckoutState(action.payload);
    case 'SET_CONTACT':
      return {
        ...state,
        contact: {
          ...state.contact,
          ...action.payload,
        },
      };
    case 'TRANSITION':
      return {
        ...state,
        ...action.payload,
        status: action.to,
        updatedAt: new Date().toISOString(),
      };
    case 'RESET':
      return createInitialCheckoutState();
    default:
      return state;
  }
};

export const serializeCheckoutState = (_state: CheckoutState): PersistedCheckoutState => ({});

const receiptId = (value: unknown): string | null => {
  if (typeof value === 'number') return Number.isSafeInteger(value) && value > 0 ? String(value) : null;
  return typeof value === 'string' && value.trim() && value.length <= 256 && !/[\u0000-\u0020\u007f]/.test(value) ? value : null;
};
const safePaymentUrl = (value: unknown): string | null => {
  if (typeof value !== 'string' || !value || value.length > 4096 || value !== value.trim() || /[\u0000-\u0020\u007f\\]/.test(value)) return null;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && url.hostname && !url.username && !url.password ? url.href : null;
  } catch { return null; }
};
const failedOutcome = (message: unknown = null) => ({
  status: 'error' as const, paymentUrl: null, orderId: null,
  message: typeof message === 'string' && message.trim() ? message.trim() : null,
});

export const resolveCheckoutOutcome = (response: CheckoutStartResponse) => {
  if (!response || typeof response !== 'object' || Array.isArray(response)) return failedOutcome();
  const validation = getMarketCommercialValidation(response, response.order, response.inventory_policy);
  const normalizedStatus = String(response.status ?? response.estado ?? '').toLowerCase();
  const orderId = receiptId(response.market_order_id ?? response.orderId ?? response.order_id);
  const preferenceId = receiptId(response.preferenceId ?? response.preference_id);
  const publishedUrls = [response.checkoutUrl, response.init_point, response.checkout_url, response.paymentUrl, response.payment_url]
    .filter(value => value !== undefined && value !== null);
  const urls = publishedUrls.map(safePaymentUrl);
  const paymentUrl = urls.length && urls.every(url => url !== null && url === urls[0]) ? urls[0] : null;
  const statusKnown = ['pending','awaiting_payment','pendiente','pending_payment','pendiente_pago','confirmed','confirmado','created','success'].includes(normalizedStatus);
  if (response.ok === false || response.error || ['failed','error','rejected','cancelled','canceled','demo'].includes(normalizedStatus)) return failedOutcome(response.message);
  if (!(orderId && (statusKnown || response.ok === true)) && !(preferenceId && paymentUrl)) return failedOutcome();
  if (publishedUrls.length && !paymentUrl) return failedOutcome();

  if (isPlanLockResponse(response)) {
    return {
      status: 'error' as const,
      paymentUrl: null,
      orderId: orderId ? String(orderId) : null,
      message: response?.message ?? validation.reason ?? 'Plan Full requerido para cobrar desde WhatsApp, widget o checkout publico.',
    };
  }

  if (paymentUrl && validation.canStartCheckout) {
    return {
      status: 'awaiting_payment' as const,
      paymentUrl,
      orderId: orderId ? String(orderId) : null,
      message: response?.message ?? 'Continua con el pago para completar tu pedido.',
    };
  }

  if (['pending','awaiting_payment','pendiente','pending_payment','pendiente_pago'].includes(normalizedStatus)) {
    return {
      status: 'awaiting_payment' as const,
      paymentUrl: null,
      orderId: orderId ? String(orderId) : null,
      message: response?.message ?? validation.reason ?? 'El pedido queda pendiente de validacion.',
    };
  }

  if (!validation.canConfirmPurchase) {
    return {
      status: 'success' as const,
      paymentUrl: null,
      orderId: orderId ? String(orderId) : null,
      message: response?.message ?? validation.reason ?? 'Solicitud registrada para validacion.',
    };
  }

  return {
    status: 'success' as const,
    paymentUrl: null,
    orderId: orderId ? String(orderId) : null,
    message: response?.message ?? 'Pedido registrado correctamente.',
  };
};
