const KNOWN_EXTENSION_PATTERNS = [
  /Cannot assign to read only property '(ethereum|tronLink)' of object '#<Window>'/i,
  /Cannot assign to read only property '(ethereum|tronLink)'/i,
  /This document requires 'TrustedScript' assignment/i,
];

const EXTENSION_PROTOCOLS = ['chrome-extension://', 'moz-extension://', 'safari-extension://'];

function extractMessage(value: unknown): string {
  if (typeof value === 'string') {
    return value;
  }
  if (value && typeof value === 'object' && 'message' in value && typeof (value as any).message === 'string') {
    return (value as any).message;
  }
  if (value instanceof Error) {
    return value.message;
  }
  return '';
}

function shouldIgnore(message: string | null | undefined): boolean {
  if (!message) return false;
  return KNOWN_EXTENSION_PATTERNS.some((pattern) => pattern.test(message));
}

function isExtensionUrl(url: string | null | undefined): boolean {
  if (typeof url !== 'string' || !url) return false;
  return EXTENSION_PROTOCOLS.some((protocol) => url.startsWith(protocol));
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
      if (shouldIgnore(reasonMessage)) {
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
