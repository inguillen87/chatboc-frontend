// Use the same env var name used across the app
const MAPS_API_KEY = import.meta.env.VITE_Maps_API_KEY || '';
const SCRIPT_ID = 'chatboc-google-maps-script';

interface GoogleMapsApi {
  maps: typeof google.maps;
}

let loadingPromise: Promise<GoogleMapsApi> | null = null;
const loadedLibraries: Set<string> = new Set();

export function loadGoogleMapsApi(
  libraries: string[] = []
): Promise<GoogleMapsApi> {
  if (typeof window === 'undefined') {
    return Promise.reject(
      new Error('Cannot load Google Maps API outside of a browser environment.')
    );
  }

  const newLibraries = libraries.filter((lib) => !loadedLibraries.has(lib));

  if (!loadingPromise) {
    loadingPromise = new Promise((resolve, reject) => {
      const existingScript = document.getElementById(
        SCRIPT_ID
      ) as HTMLScriptElement | null;

      if (existingScript) {
        // Script already exists, wait for it to load
        existingScript.addEventListener('load', () => {
          if (window.google && window.google.maps) {
            resolve({ maps: window.google.maps });
          } else {
            reject(
              new Error(
                'Google Maps API loaded but window.google.maps is not available.'
              )
            );
          }
        });
        existingScript.addEventListener('error', (event) => {
          loadingPromise = null;
          console.error('Google Maps script failed to load:', event);
          reject(new Error('Google Maps script failed to load.'));
        });
        return;
      }

      const script = document.createElement('script');
      script.id = SCRIPT_ID;
      script.type = 'text/javascript';
      script.src = `https://maps.googleapis.com/maps/api/js?key=${MAPS_API_KEY}&v=weekly&libraries=${newLibraries.join(
        ','
      )}&loading=async`;
      script.async = true;
      script.defer = true;
      script.onload = () => {
        if (window.google && window.google.maps) {
          libraries.forEach((lib) => loadedLibraries.add(lib));
          resolve({ maps: window.google.maps });
        } else {
          reject(
            new Error(
              'Google Maps API loaded but window.google.maps is not available.'
            )
          );
        }
      };
      script.onerror = (event) => {
        loadingPromise = null;
        document.getElementById(SCRIPT_ID)?.remove();
        console.error('Google Maps script failed to load:', event);
        reject(new Error('Google Maps script failed to load.'));
      };
      document.head.appendChild(script);
    });
  } else if (newLibraries.length > 0) {
    // A promise exists, but new libraries are requested.
    // This scenario requires updating the script src, which is complex.
    // A simpler approach for now is to reload if new libraries are needed.
    console.warn(
      'Google Maps API already loading. New libraries requested. Consider a unified loading strategy.'
    );
    // For simplicity, we'll just return the existing promise.
    // A more robust solution might involve queueing requests or reloading the script.
  }

  return loadingPromise;
}
