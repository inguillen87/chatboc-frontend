import { useState, useEffect } from 'react';
import { apiFetch, ApiError } from '@/utils/api';
import { safeLocalStorage } from '@/utils/safeLocalStorage';
import {
  clearEndpointUnavailable,
  isEndpointMarkedUnavailable,
  markEndpointUnavailable,
} from '@/utils/endpointAvailability';

/**
 * Checks if an API endpoint exists. Returns:
 *   true  -> endpoint responded without 404/403
 *   false -> endpoint returned 404 or 403
 *   null  -> still checking
 */
export default function useEndpointAvailable(path: string) {
  const [available, setAvailable] = useState<boolean | null>(null);

  useEffect(() => {
    const token = safeLocalStorage.getItem('authToken');
    if (!token) {
      setAvailable(false);
      return;
    }

    if (isEndpointMarkedUnavailable(path)) {
      setAvailable(false);
      return;
    }

    let canceled = false;
    (async () => {
      try {
        await apiFetch(path);
        if (!canceled) {
          setAvailable(true);
          clearEndpointUnavailable(path);
        }
      } catch (err: any) {
        if (!canceled) {
          if (
            err instanceof ApiError &&
            (err.status === 404 || err.status === 403 || err.status === 401 || err.status >= 500)
          ) {
            setAvailable(false);
            markEndpointUnavailable(path);
          } else {
            setAvailable(true);
          }
        }
      }
    })();
    return () => {
      canceled = true;
    };
  }, [path]);

  return available;
}
