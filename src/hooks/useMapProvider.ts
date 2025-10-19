import { useCallback, useEffect, useMemo, useState } from "react";

export type MapProvider = "maplibre" | "google";

export type MapProviderUnavailableReason =
  | "missing-api-key"
  | "load-error"
  | "heatmap-unavailable";

const STORAGE_KEY = "chatboc-map-provider";
const EVENT_NAME = "chatboc-map-provider-change";

const isValidProvider = (value: unknown): value is MapProvider =>
  value === "maplibre" || value === "google";

const readInitialProvider = (fallback: MapProvider): MapProvider => {
  if (typeof window === "undefined") {
    return fallback;
  }

  const stored = window.localStorage.getItem(STORAGE_KEY);
  return isValidProvider(stored) ? stored : fallback;
};

export function useMapProvider(defaultProvider: MapProvider = "maplibre") {
  const [provider, setProviderState] = useState<MapProvider>(() =>
    readInitialProvider(defaultProvider),
  );

  useEffect(() => {
    if (typeof window === "undefined") {
      return undefined;
    }

    const handleStorage = (event: StorageEvent) => {
      if (event.key !== STORAGE_KEY || !event.newValue) {
        return;
      }
      if (isValidProvider(event.newValue)) {
        setProviderState(event.newValue);
      }
    };

    const handleCustomEvent = (event: Event) => {
      const customEvent = event as CustomEvent<MapProvider>;
      if (isValidProvider(customEvent.detail)) {
        setProviderState(customEvent.detail);
      }
    };

    window.addEventListener("storage", handleStorage);
    window.addEventListener(EVENT_NAME, handleCustomEvent);

    return () => {
      window.removeEventListener("storage", handleStorage);
      window.removeEventListener(EVENT_NAME, handleCustomEvent);
    };
  }, []);

  const setProvider = useCallback((next: MapProvider) => {
    setProviderState(next);

    if (typeof window === "undefined") {
      return;
    }

    window.localStorage.setItem(STORAGE_KEY, next);

    try {
      const event = new CustomEvent<MapProvider>(EVENT_NAME, { detail: next });
      window.dispatchEvent(event);
    } catch (error) {
      console.warn("[useMapProvider] Unable to dispatch provider change event", error);
    }
  }, []);

  const availableProviders = useMemo(() => ["maplibre", "google"] as const, []);

  return { provider, setProvider, availableProviders } as const;
}

