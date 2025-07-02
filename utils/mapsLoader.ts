const Maps_API_KEY = import.meta.env.VITE_Maps_API_KEY || ""; // Default to empty, error will be caught by Google
const SCRIPT_ID = "chatboc-google-maps-script";

interface GoogleMapsApi {
  maps: typeof google.maps;
}

let loadingPromise: Promise<GoogleMapsApi> | null = null;
let loadedLibraries: Set<string> = new Set();

export function loadGoogleMapsApi(libraries: string[] = []): Promise<GoogleMapsApi> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("Cannot load Google Maps API outside of a browser environment."));
  }

  const newLibrariesToLoad = libraries.filter(lib => !loadedLibraries.has(lib));

  if (!loadingPromise || newLibrariesToLoad.length > 0) {
    loadingPromise = new Promise((resolve, reject) => {
      // Check if script already exists (e.g., from a previous call or manual inclusion)
      let script = document.getElementById(SCRIPT_ID) as HTMLScriptElement | null;

      const onLoad = () => {
        if (window.google && window.google.maps) {
          libraries.forEach(lib => loadedLibraries.add(lib));
          resolve({ maps: window.google.maps });
        } else {
          reject(new Error("Google Maps API loaded but window.google.maps is not available."));
        }
      };

      const onError = (event: Event | string) => {
        loadingPromise = null; // Allow retrying
        document.getElementById(SCRIPT_ID)?.remove(); // Clean up failed script
        console.error("Google Maps script failed to load:", event);
        reject(new Error("Google Maps script failed to load."));
      };

      if (script) {
        // Script exists. If it's already loaded and we need more libraries, we might need to reload.
        // For simplicity now, if the script tag exists, assume it's either loaded or loading.
        // We'll update its src if new libraries are needed, which might cause a reload by the browser.
        // A more sophisticated approach might involve checking script.src and loaded libraries.
        const currentSrc = new URL(script.src);
        const currentLibraries = new Set(currentSrc.searchParams.get("libraries")?.split(",") || []);
        newLibrariesToLoad.forEach(lib => currentLibraries.add(lib));

        const newSrc = `https://maps.googleapis.com/maps/api/js?key=${Maps_API_KEY}&v=weekly&libraries=${Array.from(currentLibraries).join(",")}&loading=async`;

        if (script.src !== newSrc) {
            // If src needs to change to add more libraries, we might need to remove and re-add.
            // However, just adding libraries to the existing set for the check should be okay.
            // The initial load will fetch all specified libraries.
            // This part needs careful handling if we expect to dynamically add libraries *after* first load.
            // For now, let's assume all libraries are requested upfront or on subsequent loads if the first one failed.
            console.warn("Attempting to load new libraries. This might require a new script load if not handled by the initial load.");
             // Fallback to re-creating the script if src needs to change significantly.
            script.remove();
            script = null; // Force re-creation
        } else if ((script as any)._isLoaded) {
             // Already loaded, and libraries are compatible (or current set includes new ones)
            onLoad(); // Resolve immediately
            return;
        }
        // If script exists but not marked loaded, or src changed, let it re-initialize or attach new handlers
      }

      if (!script) {
        script = document.createElement("script");
        script.id = SCRIPT_ID;
        script.type = "text/javascript";
        script.async = true;
        script.defer = true;
        document.head.appendChild(script);
      }

      // Always update src and handlers if we are re-initiating the load process
      const allLibs = Array.from(new Set([...Array.from(loadedLibraries), ...libraries])).join(",");
      script.src = `https://maps.googleapis.com/maps/api/js?key=${Maps_API_KEY}&v=weekly&libraries=${allLibs}&loading=async`;

      // Remove old listeners to prevent multiple triggers if promise is re-initialized
      script.removeEventListener("load", (script as any)._onloadHandler);
      script.removeEventListener("error", (script as any)._onerrorHandler);

      (script as any)._onloadHandler = () => {
        (script as any)._isLoaded = true;
        onLoad();
      };
      (script as any)._onerrorHandler = onError;

      script.addEventListener("load", (script as any)._onloadHandler);
      script.addEventListener("error", (script as any)._onerrorHandler);

    });
  } else {
     // If loadingPromise exists and no new libraries, it means a load is in progress or completed.
     // We need to ensure the promise resolves with the API if already loaded.
     if (window.google && window.google.maps) {
        const allRequestedLibrariesPresent = libraries.every(lib => loadedLibraries.has(lib));
        if (allRequestedLibrariesPresent) {
            return Promise.resolve({ maps: window.google.maps });
        } else {
            // This case indicates a previous load completed but not with all currently requested libraries.
            // This logic path should ideally be covered by re-initiating the load if newLibrariesToLoad.length > 0
            // For safety, re-initiate.
            loadingPromise = null; // Reset to force re-evaluation.
            loadedLibraries.clear(); // Reset known loaded libraries, as we need to fetch more.
            return loadGoogleMapsApi(libraries);
        }
     }
  }
  return loadingPromise;
}
