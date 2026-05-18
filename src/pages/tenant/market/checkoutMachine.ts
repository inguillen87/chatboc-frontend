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

const asString = (value: unknown): string => (typeof value === 'string' ? value : '');

export const hydrateCheckoutState = (raw: unknown): CheckoutState => {
  const base = createInitialCheckoutState();
  if (!raw || typeof raw !== 'object') return base;
  const payload = raw as PersistedCheckoutState;
  const validStatus: CheckoutStatus[] = ['idle', 'validating', 'creating_order', 'awaiting_payment', 'success', 'error'];
  const persistedStatus = payload.status && validStatus.includes(payload.status) ? payload.status : base.status;
  const status: CheckoutStatus =
    persistedStatus === 'validating' || persistedStatus === 'creating_order'
      ? 'idle'
      : persistedStatus;

  return {
    status,
    error: payload.error ?? null,
    message: payload.message ?? null,
    paymentUrl: payload.paymentUrl ?? null,
    orderId: payload.orderId ? String(payload.orderId) : null,
    updatedAt: payload.updatedAt ?? null,
    contact: {
      name: asString(payload.contact?.name),
      phone: asString(payload.contact?.phone),
    },
  };
};

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

export const serializeCheckoutState = (state: CheckoutState): PersistedCheckoutState => ({
  status: state.status,
  error: state.error,
  message: state.message,
  paymentUrl: state.paymentUrl,
  orderId: state.orderId,
  updatedAt: state.updatedAt,
  contact: state.contact,
});

export const resolveCheckoutOutcome = (response: CheckoutStartResponse) => {
  const validation = getMarketCommercialValidation(response, response?.order, response?.inventory_policy);
  const paymentUrl = response?.checkoutUrl ?? response?.init_point ?? null;
  const normalizedStatus = String(response?.status ?? response?.estado ?? '').toLowerCase();
  const orderId = response?.market_order_id ?? response?.orderId ?? response?.order_id;

  if (paymentUrl && validation.canStartCheckout) {
    return {
      status: 'awaiting_payment' as const,
      paymentUrl,
      orderId: orderId ? String(orderId) : null,
      message: response?.message ?? 'Continua con el pago para completar tu pedido.',
    };
  }

  if (normalizedStatus === 'pending' || normalizedStatus === 'awaiting_payment') {
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
