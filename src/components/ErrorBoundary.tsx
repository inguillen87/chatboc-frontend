import React, { type ComponentType } from 'react';

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


function extractInfoText(info: unknown): string {
  if (!info) return '';
  if (typeof info === 'string') return info;
  if (typeof info === 'object' && 'componentStack' in info) {
    const stack = (info as { componentStack?: unknown }).componentStack;
    return typeof stack === 'string' ? stack : '';
  }
  return '';
}

function isTdzReferenceError(error: unknown): boolean {
  const message = extractErrorMessage(error);
  const name = extractErrorName(error);
  return /Cannot access '.+' before initialization/i.test(message) && /referenceerror/i.test(name || '');
}

function getRecoveryAttemptsFromQuery(): number {
  if (typeof window === 'undefined') return 0;

  try {
    const searchParams = new URLSearchParams(window.location.search);
    const fromQuery = Number(searchParams.get('cb_attempt'));
    return Number.isFinite(fromQuery) && fromQuery > 0 ? fromQuery : 0;
  } catch {
    return 0;
  }
}

function getRecoveryAttempts(): number {
  if (typeof window === 'undefined') return 0;
  const storageKey = getRecoveryStorageKey();
  const queryAttempts = getRecoveryAttemptsFromQuery();

  try {
    const raw = window.sessionStorage.getItem(storageKey);
    const parsed = Number(raw);
    const storageAttempts = Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
    return Math.max(storageAttempts, queryAttempts);
  } catch {
    const bag = (window as typeof window & { __chatbocStaleRecoveryAttempts?: Record<string, number> })
      .__chatbocStaleRecoveryAttempts;
    const value = bag?.[storageKey];
    const memoryAttempts = Number.isFinite(value) && value > 0 ? Number(value) : 0;
    return Math.max(memoryAttempts, queryAttempts);
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

function shouldSuppressTransientTdzError(error: unknown, info?: unknown): boolean {
  const message = extractErrorMessage(error);
  const stack = extractErrorStack(error);
  const infoText = extractInfoText(info);

  const looksLikeTdz = /Cannot access '.+' before initialization/i.test(message);
  if (!looksLikeTdz) return false;

  // Extension bridges usually surface through MessagePort/inpage scripts.
  // Treat these as transient/noise to avoid repeated false crashes.
  const hasExtensionSignals =
    /\bMessagePort\b/i.test(stack) ||
    /\binpage\.js\b/i.test(stack) ||
    /\blockdown-install\.js\b/i.test(stack) ||
    /\boverlay\.js\b/i.test(stack) ||
    /registerExtensionNoiseFilters-[^\s)]+\.js/i.test(stack) ||
    /\bMessagePort\b/i.test(infoText) ||
    /registerExtensionNoiseFilters-[^\s)]+\.js/i.test(infoText);

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

class ErrorBoundaryImpl extends (React.Component as any)<React.PropsWithChildren<ErrorBoundaryProps>, ErrorBoundaryState> {
  constructor(props: React.PropsWithChildren<ErrorBoundaryProps>) {
    super(props);
    this.state = { hasError: false };
  }

  // Moved filtering logic inside the class as a static method to prevent scope/access issues
  // during bundling or initialization.
  static checkExtensionNoise(value: unknown): boolean {
    const KNOWN_PATTERNS = [
      /Cannot assign to read only property '(ethereum|tronLink)' of object '#<Window>'/i,
      /Cannot assign to read only property '(ethereum|tronLink)'/i,
      /This document requires 'TrustedScript' assignment/i,
      /No matching tab found/i,
      /Removing unpermitted intrinsics/i,
      /Cannot access '.*' before initialization/i,
      /ReferenceError: Cannot access '.*' before initialization/i,
    ];

    const PROTOCOLS = ['chrome-extension://', 'moz-extension://', 'safari-extension://'];

    const extractMessage = (val: unknown): string => {
      try {
        if (typeof val === 'string') return val;
        if (val && typeof val === 'object') {
           if ('message' in val && typeof (val as any).message === 'string') {
              return (val as any).message;
           }
           if (val.toString && val.toString() !== '[object Object]') {
              return val.toString();
           }
        }
        if (val instanceof Error) return val.message;
      } catch (e) {
        return '';
      }
      return '';
    };

    const isExtUrl = (url: string | null | undefined): boolean => {
      if (typeof url !== 'string' || !url) return false;
      return PROTOCOLS.some((protocol) => url.startsWith(protocol));
    };

    const message = extractMessage(value);
    if (KNOWN_PATTERNS.some((pattern) => pattern.test(message))) {
      return true;
    }

    if (value && typeof value === 'object' && 'stack' in value) {
      const stack = String((value as { stack?: unknown }).stack ?? '');
      if (isExtUrl(stack)) {
        return true;
      }
    }

    return false;
  }

  static getDerivedStateFromError(error: unknown): ErrorBoundaryState {
    // Keep the app mounted for TDZ runtime errors and let componentDidCatch
    // decide whether to recover (stale bundle) or log. This avoids full UI
    // fallback loops caused by transient extension/inpage noise.
    if (isTdzReferenceError(error) || isLikelyExtensionNoise(error) || shouldSuppressTransientTdzError(error)) {
      return { hasError: false };
    }

    return { hasError: true };
  }

  componentDidCatch(error: unknown, info: unknown) {
    if (isLikelyExtensionNoise(error) || shouldSuppressTransientTdzError(error, info)) {
      return;
    }

    if (isTdzReferenceError(error)) {
      if (shouldAttemptStaleBundleRecovery(error)) {
        console.warn('[ErrorBoundary] Detected possible stale bundle mismatch. Attempting one-time reload.');
        attemptStaleBundleRecovery();
      }
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

const ErrorBoundary = ErrorBoundaryImpl as unknown as ComponentType<React.PropsWithChildren<ErrorBoundaryProps>>;

export default ErrorBoundary;
