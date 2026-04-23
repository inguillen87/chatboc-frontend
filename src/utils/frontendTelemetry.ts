// Assuming this file exists from before or we overwrite/append to it.
import { getOrCreateAnonId } from './anonIdGenerator';

export function trackFrontendEvent(eventName: string, payload: Record<string, any> = {}) {
  try {
    const isLocalhost = typeof window !== 'undefined' && window.location.hostname === 'localhost';
    if (isLocalhost) {
      // In development, just log to console to not spam production DBs with debug sessions
      console.log(`[Telemetry] ${eventName}`, payload);
      return;
    }

    // Attempt to push to standard dataLayer or generic analytics sink
    if (typeof window !== 'undefined') {
       const win = window as any;
       if (!win.dataLayer) {
          win.dataLayer = [];
       }
       win.dataLayer.push({
          event: eventName,
          anonId: getOrCreateAnonId(),
          timestamp: new Date().toISOString(),
          ...payload
       });
    }
  } catch (e) {
    // Fail silently, telemetry should never break the main thread
  }
}
