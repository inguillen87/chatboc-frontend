// src/services/configService.ts

interface AppConfig {
  backendUrl: string;
}

let config: AppConfig | null = null;
let initializationPromise: Promise<void> | null = null;

export const initializeConfig = (): Promise<void> => {
  if (initializationPromise) {
    return initializationPromise;
  }

  initializationPromise = fetch('/api/config')
    .then(response => {
      if (!response.ok) {
        throw new Error(`Failed to fetch config: ${response.statusText}`);
      }
      return response.json();
    })
    .then(json => {
      if (!json.backendUrl) {
        throw new Error('backendUrl not found in config response');
      }
      config = {
        backendUrl: json.backendUrl,
      };
      console.log('Backend config loaded:', config);
    })
    .catch(error => {
      console.error('Failed to initialize application config:', error);
      // Fallback or re-throw, depending on how critical this is.
      // For now, we re-throw to make it a hard failure.
      throw error;
    });

  return initializationPromise;
};

export const getBackendUrl = (): string => {
  if (!config) {
    throw new Error('Configuration has not been initialized. Call initializeConfig() first.');
  }
  return config.backendUrl;
};

export const isConfigInitialized = (): boolean => {
  return config !== null;
};
