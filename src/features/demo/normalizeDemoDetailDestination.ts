export type DemoDetailDestination =
  | {
      kind: 'api';
      href: string;
    }
  | {
      kind: 'public_tracking';
      href: string;
    }
  | {
      kind: 'none';
      href: null;
    };

const noDetailDestination = (): DemoDetailDestination => ({
  kind: 'none',
  href: null,
});

const isHttpOrigin = (origin: string) => {
  try {
    const parsed = new URL(origin);
    return (parsed.protocol === 'http:' || parsed.protocol === 'https:') && parsed.origin !== 'null';
  } catch {
    return false;
  }
};

const readBrowserOrigin = () => {
  if (typeof window === 'undefined') return null;
  return window.location?.origin || null;
};

const isApiPath = (pathname: string) => pathname.startsWith('/api/');

const isPublicClaimTrackingPath = (pathname: string) =>
  pathname === '/tracking/claim' || pathname.startsWith('/tracking/claim/');

const hasAllowedTrackingFragment = (hash: string) => {
  if (!hash) return true;

  const fragment = new URLSearchParams(hash.slice(1));
  const entries = Array.from(fragment.entries());
  if (entries.length !== 1 || entries[0][0] !== 'pin') return false;

  return /^[A-Za-z0-9_-]{1,128}$/.test(entries[0][1]);
};

/**
 * Converts a backend-provided detail target into a same-origin relative URL.
 *
 * API destinations are safe to fetch as JSON. Public claim tracking destinations
 * must be navigated to, never fetched as JSON. Unknown paths and cross-origin URLs
 * fail closed so backend content cannot become an open redirect.
 */
export const normalizeDemoDetailDestination = (
  endpoint: unknown,
  origin: string | null = readBrowserOrigin(),
): DemoDetailDestination => {
  if (typeof endpoint !== 'string' || !endpoint.trim() || !origin || !isHttpOrigin(origin)) {
    return noDetailDestination();
  }

  try {
    const baseOrigin = new URL(origin).origin;
    const destination = new URL(endpoint.trim(), baseOrigin);

    if (
      destination.origin !== baseOrigin ||
      (destination.protocol !== 'http:' && destination.protocol !== 'https:') ||
      destination.username ||
      destination.password
    ) {
      return noDetailDestination();
    }

    const href = `${destination.pathname}${destination.search}${destination.hash}`;

    if (isApiPath(destination.pathname)) {
      return { kind: 'api', href };
    }

    if (isPublicClaimTrackingPath(destination.pathname) && hasAllowedTrackingFragment(destination.hash)) {
      return { kind: 'public_tracking', href };
    }

    return noDetailDestination();
  } catch {
    return noDetailDestination();
  }
};
