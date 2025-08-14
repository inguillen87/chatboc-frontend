// src/config.ts

interface AppConfig {
  backendUrl: string;
  panelUrl: string;
  widgetUrl: string;
}

// La configuración se adjuntará al objeto window por un script en index.html
const config = (window as any).appConfig as AppConfig;

if (!config || !config.backendUrl) {
  throw new Error(
    "CRITICAL: App config not found or invalid. This usually means the initial config fetch failed. Please check the network tab for a call to /api/config."
  );
}

export const BACKEND_URL = config.backendUrl;
export const PANEL_URL = config.panelUrl;
export const WIDGET_URL = config.widgetUrl;

console.log("App configured with Backend URL:", BACKEND_URL);
