
function getNoisePatterns() {
  const KNOWN_PATTERNS = [
    /Cannot assign to read only property '(ethereum|tronLink)' of object '#<Window>'/i,
    /Cannot assign to read only property '(ethereum|tronLink)'/i,
    /This document requires 'TrustedScript' assignment/i,
    /No matching tab found/i,
    /Removing unpermitted intrinsics/i,
    // Removed generic TDZ filters to avoid hiding real app bugs
  ];

  const PROTOCOLS = ['chrome-extension://', 'moz-extension://', 'safari-extension://'];

  return { KNOWN_PATTERNS, PROTOCOLS };
}

function extractMessage(value: unknown): string {
  try {
    if (typeof value === 'string') {
      return value;
    }
    if (value && typeof value === 'object') {
       if ('message' in value && typeof (value as any).message === 'string') {
          return (value as any).message;
       }
       // Sometimes errors are wrapped or custom objects
       if (value.toString && value.toString() !== '[object Object]') {
          return value.toString();
       }
    }
    if (value instanceof Error) {
      return value.message;
    }
  } catch (e) {
    return '';
  }
  return '';
}

function shouldIgnore(message: string | null | undefined): boolean {
  if (!message) return false;
  const { KNOWN_PATTERNS } = getNoisePatterns();
  return KNOWN_PATTERNS.some((pattern) => pattern.test(message));
}

function isExtensionUrl(url: string | null | undefined): boolean {
  if (typeof url !== 'string' || !url) return false;
  const { PROTOCOLS } = getNoisePatterns();
  return PROTOCOLS.some((protocol) => url.startsWith(protocol));
}

export function isLikelyExtensionNoise(value: unknown): boolean {
  const message = extractMessage(value);

  if (shouldIgnore(message)) {
    return true;
  }

  if (value && typeof value === 'object' && 'stack' in value) {
    const stack = String((value as { stack?: unknown }).stack ?? '');
    if (isExtensionUrl(stack)) {
      return true;
    }
  }

  return false;
}

export function registerExtensionNoiseFilters(): () => void {
  if (typeof window === 'undefined') {
    return () => {};
  }

  const win = window as typeof window & { __chatbocExtensionNoiseCleanup?: () => void };
  if (typeof win.__chatbocExtensionNoiseCleanup === 'function') {
    return win.__chatbocExtensionNoiseCleanup;
  }

  const handleError = (event: ErrorEvent) => {
    try {
      const errorMessage = extractMessage(event.error ?? event.message);
      const fromExtension = isExtensionUrl(event.filename) || isExtensionUrl((event.error as any)?.stack);

      if (fromExtension || shouldIgnore(errorMessage)) {
        event.preventDefault?.();
        event.stopImmediatePropagation?.();
        return false;
      }
    } catch (error) {
      // Never let the noise filter crash the app – swallow unexpected shapes.
      console.error('registerExtensionNoiseFilters error handler failed', error);
    }
    return undefined;
  };

  const handleRejection = (event: PromiseRejectionEvent) => {
    try {
      const reasonMessage = extractMessage(event.reason);
      if (shouldIgnore(reasonMessage) || isLikelyExtensionNoise(event.reason)) {
        event.preventDefault?.();
        event.stopImmediatePropagation?.();
      }
    } catch (error) {
      console.error('registerExtensionNoiseFilters rejection handler failed', error);
    }
  };

  window.addEventListener('error', handleError);
  window.addEventListener('unhandledrejection', handleRejection);

  const cleanup = () => {
    window.removeEventListener('error', handleError);
    window.removeEventListener('unhandledrejection', handleRejection);
    delete win.__chatbocExtensionNoiseCleanup;
  };

  win.__chatbocExtensionNoiseCleanup = cleanup;
  return cleanup;
}

export default registerExtensionNoiseFilters;
