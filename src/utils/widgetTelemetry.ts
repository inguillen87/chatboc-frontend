import { safeLocalStorage } from '@/utils/safeLocalStorage';

type WidgetTelemetryEvent =
  | 'widget_opened'
  | 'demo_selector_rendered'
  | 'demo_option_clicked'
  | 'first_real_question_sent'
  | 'lead_cta_clicked';

const EVENT_PREFIX = 'chatboc_widget';

export function trackWidgetEvent(event: WidgetTelemetryEvent, payload: Record<string, unknown> = {}) {
  if (typeof window === 'undefined') return;

  const detail = {
    event,
    payload,
    timestamp: new Date().toISOString(),
    sessionId: safeLocalStorage.getItem('chat_session_id') ?? undefined,
  };

  window.dispatchEvent(new CustomEvent(`${EVENT_PREFIX}:${event}`, { detail }));

  const dataLayer = (window as any).dataLayer;
  if (Array.isArray(dataLayer)) {
    dataLayer.push({ event: `${EVENT_PREFIX}_${event}`, ...payload });
  }
}
