export type FrontendEventName =
  | 'catalog_structured_rendered'
  | 'lead_capture_step_viewed'
  | 'lead_capture_step_completed'
  | 'catalog_quality_queue_opened'
  | 'lead_sla_filter_enabled'
  | 'realtime_session_started'
  | 'realtime_session_failed'
  | 'realtime_mode_switched'
  | 'avatar_rendered'
  | 'accessibility_caption_enabled'
  | 'business_action_executed'
  | 'map_loaded'
  | 'map_layer_toggle'
  | 'map_cluster_click'
  | 'map_time_slider_changed'
  | 'tracking_public_access_restored'
  | 'tracking_public_lookup_succeeded'
  | 'tracking_public_lookup_failed'
  | 'tracking_public_message_sent'
  | 'tracking_public_refresh_failed'
  | 'tracking_public_maps_opened'
  | 'tracking_403_detected'
  | 'socket_reconnect'
  | 'realtime_duplicate_dropped';

export function trackFrontendEvent(event: FrontendEventName, payload: Record<string, unknown> = {}) {
  if (typeof window === 'undefined') return;
  const detail = { event, payload, timestamp: new Date().toISOString() };
  window.dispatchEvent(new CustomEvent(`chatboc_frontend:${event}`, { detail }));
  const dataLayer = (window as any).dataLayer;
  if (Array.isArray(dataLayer)) {
    dataLayer.push({ event: `chatboc_frontend_${event}`, ...payload });
  }
}
