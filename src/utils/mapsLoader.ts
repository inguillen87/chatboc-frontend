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

  // If a script is already in the document, assume it's either loading or loaded.
  const existingScript = document.getElementById(SCRIPT_ID) as HTMLScriptElement | null;

  const allLibraries = new Set([...loadedLibraries, ...libraries]);
  const newLibrariesToLoad = libraries.filter(lib => !loadedLibraries.has(lib));

  // If there's no ongoing promise, or if new libraries are requested, create a new promise.
  // This simplifies logic, avoiding complex checks on the existing script's URL.
  if (!loadingPromise || newLibrariesToLoad.length > 0) {

    // If a script tag exists, we will not create a new one, but we will re-use the promise logic.
    // This handles cases where `loadGoogleMapsApi` is called multiple times in parallel.
    if (existingScript && loadingPromise) {
        // A load is already in progress. We just need to wait for it to complete.
        // The new libraries will be loaded by the original call.
        // We update the list of all libraries to ensure the promise resolves correctly.
        allLibraries.forEach(lib => loadedLibraries.add(lib));
        return loadingPromise;
    }

    loadingPromise = new Promise((resolve, reject) => {
      const onLoad = () => {
        if (window.google && window.google.maps) {
          allLibraries.forEach(lib => loadedLibraries.add(lib));
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

      // If there's no script tag, create one.
      if (!existingScript) {
        const script = document.createElement("script");
        script.id = SCRIPT_ID;
        script.type = "text/javascript";
        script.src = `https://maps.googleapis.com/maps/api/js?key=${Maps_API_KEY}&v=weekly&libraries=${Array.from(allLibraries).join(",")}&loading=async`;
        script.async = true;
        script.defer = true;
        script.onload = onLoad;
        script.onerror = onError;
        document.head.appendChild(script);
      } else {
        // If the script exists, it might be from a previous successful or failed load.
        // We can't easily add new libraries to a script that has already loaded.
        // The simplest, robust solution is to remove the old script and add a new one.
        // This is not ideal but prevents a lot of edge cases.
        // A more advanced solution would be to check the `src` and only reload if necessary.
        const currentSrc = new URL(existingScript.src);
        const currentLibraries = new Set(currentSrc.searchParams.get("libraries")?.split(",").filter(Boolean) || []);
        const areAllLibsAlreadyIncluded = [...allLibraries].every(lib => currentLibraries.has(lib));

        if (!areAllLibsAlreadyIncluded) {
          // Necessary libraries are not in the current script, so we must reload.
          existingScript.remove();
          loadingPromise = null; // Reset promise to force re-creation in next call
          return loadGoogleMapsApi(Array.from(allLibraries)); // Re-call to create a new script
        }

        // If all libraries are included, we can just wait for the existing script to load.
        // We need to attach new event listeners if it hasn't loaded yet.
        // However, if it has already loaded, the 'load' event won't fire again.
        // Check for `window.google.maps` as a sign of it being loaded.
        if (window.google && window.google.maps) {
            onLoad();
        } else {
            // Script exists but hasn't loaded. Add event listeners.
            existingScript.addEventListener('load', onLoad);
            existingScript.addEventListener('error', onError);
        }
      }
    });
  }

  return loadingPromise;
}
