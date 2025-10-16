const KNOWN_EXTENSION_PATTERNS = [
  /Cannot assign to read only property '(ethereum|tronLink)' of object '#<Window>'/i,
  /Cannot assign to read only property '(ethereum|tronLink)'/i,
  /This document requires 'TrustedScript' assignment/i,
];

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

export function registerExtensionNoiseFilters(): () => void {
  if (typeof window === 'undefined') {
    return () => {};
  }

  const win = window as typeof window & { __chatbocExtensionNoiseCleanup?: () => void };
  if (typeof win.__chatbocExtensionNoiseCleanup === 'function') {
    return win.__chatbocExtensionNoiseCleanup;
  }

  const handleError = (event: ErrorEvent) => {
    const errorMessage = extractMessage(event.error ?? event.message);
    if (shouldIgnore(errorMessage)) {
      event.preventDefault?.();
      event.stopImmediatePropagation?.();
      return false;
    }
    return undefined;
  };

  const handleRejection = (event: PromiseRejectionEvent) => {
    const reasonMessage = extractMessage(event.reason);
    if (shouldIgnore(reasonMessage)) {
      event.preventDefault?.();
      event.stopImmediatePropagation?.();
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
