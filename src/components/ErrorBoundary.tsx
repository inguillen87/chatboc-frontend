import React from 'react';

interface ErrorBoundaryProps {
  fallbackMessage?: string;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

const STALE_BUNDLE_RECOVERY_KEY = 'chatboc_stale_bundle_recovery_attempts';
const MAX_STALE_BUNDLE_RECOVERY_ATTEMPTS = 2;

function getActiveBundleFingerprint(): string {
  if (typeof document === 'undefined') return 'unknown';
  const script = document.querySelector('script[src*="/assets/main-"]') as HTMLScriptElement | null;
  const src = script?.src || '';
  const match = src.match(/\/assets\/main-([^./]+)\.js/i);
  return match?.[1] || 'unknown';
}

function getRecoveryStorageKey(): string {
  return `${STALE_BUNDLE_RECOVERY_KEY}:${getActiveBundleFingerprint()}`;
}

function extractErrorName(error: unknown): string {
  if (error && typeof error === 'object' && 'name' in error) {
    const value = (error as { name?: unknown }).name;
    if (typeof value === 'string') return value;
  }
  return '';
}

function extractErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message || '';
  if (error && typeof error === 'object' && 'message' in error) {
    const value = (error as { message?: unknown }).message;
    if (typeof value === 'string') return value;
  }
  if (typeof error === 'string') return error;
  return '';
}

function extractErrorStack(error: unknown): string {
  if (error instanceof Error) return String(error.stack || '');
  if (error && typeof error === 'object' && 'stack' in error) {
    return String((error as { stack?: unknown }).stack || '');
  }
  return '';
}

function getRecoveryAttempts(): number {
  if (typeof window === 'undefined') return 0;
  const storageKey = getRecoveryStorageKey();
  try {
    const raw = window.sessionStorage.getItem(storageKey);
    const parsed = Number(raw);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
  } catch {
    try {
      const searchParams = new URLSearchParams(window.location.search);
      const fromQuery = Number(searchParams.get('cb_attempt'));
      if (Number.isFinite(fromQuery) && fromQuery > 0) {
        return fromQuery;
      }
    } catch {
      // no-op
    }

    const bag = (window as typeof window & { __chatbocStaleRecoveryAttempts?: Record<string, number> })
      .__chatbocStaleRecoveryAttempts;
    const value = bag?.[storageKey];
    return Number.isFinite(value) && value > 0 ? Number(value) : 0;
  }
}

function setRecoveryAttempts(value: number) {
  if (typeof window === 'undefined') return;
  const storageKey = getRecoveryStorageKey();
  try {
    window.sessionStorage.setItem(storageKey, String(value));
  } catch {
    const target = window as typeof window & { __chatbocStaleRecoveryAttempts?: Record<string, number> };
    const bag = target.__chatbocStaleRecoveryAttempts || {};
    bag[storageKey] = value;
    target.__chatbocStaleRecoveryAttempts = bag;
  }
}

function shouldAttemptStaleBundleRecovery(error: unknown): boolean {
  if (typeof window === 'undefined') return false;

  const message = extractErrorMessage(error);
  const stack = extractErrorStack(error);
  const name = extractErrorName(error);

  const seemsReferenceError = name.toLowerCase() === 'referenceerror' || /referenceerror/i.test(stack);
  if (!seemsReferenceError) return false;

  const looksLikeTdz = /Cannot access '.+' before initialization/i.test(message);
  const referencesBundledAssets =
    /\/assets\/(main|IframePage|ErrorBoundary)-.+\.js/i.test(stack) ||
    /\bmain-[^\s)]+\.js\b/i.test(stack);

  if (!looksLikeTdz || !referencesBundledAssets) {
    return false;
  }

  const attempts = getRecoveryAttempts();
  if (attempts >= MAX_STALE_BUNDLE_RECOVERY_ATTEMPTS) {
    return false;
  }

  return true;
}

function shouldSuppressTransientTdzError(error: unknown): boolean {
  const message = extractErrorMessage(error);
  const stack = extractErrorStack(error);

  const looksLikeTdz = /Cannot access '.+' before initialization/i.test(message);
  if (!looksLikeTdz) return false;

  // Extension bridges usually surface through MessagePort and injected scripts.
  // Treat these as transient/noise to avoid crashing the full UI.
  const hasExtensionSignals =
    /\bMessagePort\b/i.test(stack) ||
    /\binpage\.js\b/i.test(stack) ||
    /\blockdown-install\.js\b/i.test(stack) ||
    /\boverlay\.js\b/i.test(stack);

  return hasExtensionSignals;
}

function isLikelyExtensionNoise(error: unknown): boolean {
  const message = extractErrorMessage(error);
  const stack = extractErrorStack(error);

  if (
    /No matching tab found/i.test(message) ||
    /Removing unpermitted intrinsics/i.test(message) ||
    /Cannot assign to read only property '(ethereum|tronLink)'/i.test(message)
  ) {
    return true;
  }

  return (
    /chrome-extension:\/\//i.test(stack) ||
    /moz-extension:\/\//i.test(stack) ||
    /safari-extension:\/\//i.test(stack) ||
    /\binpage\.js\b/i.test(stack) ||
    /\blockdown-install\.js\b/i.test(stack) ||
    /\boverlay\.js\b/i.test(stack)
  );
}

function attemptStaleBundleRecovery() {
  if (typeof window === 'undefined') return;

  try {
    const nextAttempt = getRecoveryAttempts() + 1;
    setRecoveryAttempts(nextAttempt);
    const url = new URL(window.location.href);
    url.searchParams.set('cb', Date.now().toString());
    url.searchParams.set('cb_attempt', String(nextAttempt));
    window.location.replace(url.toString());
  } catch {
    window.location.reload();
  }
}

class ErrorBoundary extends React.Component<React.PropsWithChildren<ErrorBoundaryProps>, ErrorBoundaryState> {
  constructor(props: React.PropsWithChildren<ErrorBoundaryProps>) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: unknown): ErrorBoundaryState {
    if (isLikelyExtensionNoise(error) || shouldSuppressTransientTdzError(error)) {
      return { hasError: false };
    }

    return { hasError: true };
  }

  componentDidCatch(error: unknown, info: unknown) {
    if (isLikelyExtensionNoise(error) || shouldSuppressTransientTdzError(error)) {
      return;
    }

    if (shouldAttemptStaleBundleRecovery(error)) {
      console.warn('[ErrorBoundary] Detected possible stale bundle mismatch. Attempting one-time reload.');
      attemptStaleBundleRecovery();
      return;
    }

    console.error('ErrorBoundary caught an error', error, info);
  }

  render() {
    if (this.state.hasError) {
      const message = this.props.fallbackMessage ||
        'Ocurrió un error inesperado. Por favor, recargá la página.';
      return (
        <div className="p-4 text-center text-red-500">
          {message}
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
