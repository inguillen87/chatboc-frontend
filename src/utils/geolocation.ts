// src/utils/geolocation.ts
export interface PositionCoords {
  latitud: number;
  longitud: number;
}

/**
 * Solicita la ubicación actual del usuario de forma segura.
 * Devuelve null si no hay permisos o no está disponible.
 */
export async function requestLocation(options?: PositionOptions): Promise<PositionCoords | null> {
  if (typeof navigator === 'undefined' || !navigator.geolocation) {
    return null;
  }

  if (typeof window !== 'undefined' && !window.isSecureContext) {
    // La geolocalización sólo funciona bajo HTTPS
    return null;
  }

  try {
    if (navigator.permissions) {
      const status = await navigator.permissions.query({ name: 'geolocation' });
      if (status.state === 'denied') {
        return null;
      }
    }
  } catch {
    // Ignorar errores de Permissions API
  }

  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        resolve({ latitud: pos.coords.latitude, longitud: pos.coords.longitude });
      },
      () => resolve(null),
      options
    );
  });
}