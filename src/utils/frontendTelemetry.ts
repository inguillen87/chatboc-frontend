export type FrontendEventName =
  | 'catalog_structured_rendered'
  | 'lead_capture_step_viewed'
  | 'lead_capture_step_completed'
  | 'catalog_quality_queue_opened'
  | 'lead_sla_filter_enabled';

export function trackFrontendEvent(event: FrontendEventName, payload: Record<string, unknown> = {}) {
  if (typeof window === 'undefined') return;
  const detail = { event, payload, timestamp: new Date().toISOString() };
  window.dispatchEvent(new CustomEvent(`chatboc_frontend:${event}`, { detail }));
  const dataLayer = (window as any).dataLayer;
  if (Array.isArray(dataLayer)) {
    dataLayer.push({ event: `chatboc_frontend_${event}`, ...payload });
  }
}
