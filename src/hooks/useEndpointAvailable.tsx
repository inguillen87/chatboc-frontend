import { useState, useEffect } from 'react';
import { apiFetch, ApiError } from '@/utils/api';

/**
 * Checks if an API endpoint exists. Returns:
 *   true  -> endpoint responded without 404/403
 *   false -> endpoint returned 404 or 403
 *   null  -> still checking
 */
export default function useEndpointAvailable(path: string) {
  const [available, setAvailable] = useState<boolean | null>(null);

  useEffect(() => {
    let canceled = false;
    (async () => {
      try {
        await apiFetch(path);
        if (!canceled) setAvailable(true);
      } catch (err: any) {
        if (!canceled) {
          if (err instanceof ApiError && (err.status === 404 || err.status === 403)) {
            setAvailable(false);
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
