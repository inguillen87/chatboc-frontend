import { useSyncExternalStore } from 'react';

const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';
const serverSnapshot = () => false;
const readSystemPreference = () =>
  typeof window !== 'undefined' && typeof window.matchMedia === 'function'
    ? window.matchMedia(REDUCED_MOTION_QUERY).matches
    : false;

const subscribe = (onChange: () => void) => {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return () => {};
  const query = window.matchMedia(REDUCED_MOTION_QUERY);
  if (typeof query.addEventListener === 'function') {
    query.addEventListener('change', onChange);
    return () => query.removeEventListener('change', onChange);
  }
  if (typeof query.addListener === 'function') {
    query.addListener(onChange);
    return () => query.removeListener(onChange);
  }
  return () => {};
};

/** Local reduction supplements the operating system; false never overrides it. */
export function useEffectiveReducedMotion(localReducedMotion = false): boolean {
  const systemReducedMotion = useSyncExternalStore(subscribe, readSystemPreference, serverSnapshot);
  return Boolean(localReducedMotion || systemReducedMotion);
}
