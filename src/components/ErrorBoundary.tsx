import React from 'react';
import { isLikelyExtensionNoise } from '@/utils/registerExtensionNoiseFilters';

interface ErrorBoundaryProps {
  fallbackMessage?: string;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

const STALE_BUNDLE_RECOVERY_KEY = 'chatboc_stale_bundle_recovery_attempted';

const shouldAttemptStaleBundleRecovery = (error: unknown): boolean => {
  if (typeof window === 'undefined') return false;

  if (!(error instanceof ReferenceError)) return false;

  const message = error.message || '';
  const stack = String(error.stack || '');

  const looksLikeTdz = /Cannot access '.+' before initialization/i.test(message);
  const referencesBundledAssets = /\/assets\/(main|IframePage)-.+\.js/i.test(stack);

  if (!looksLikeTdz || !referencesBundledAssets) {
    return false;
  }

  try {
    if (window.sessionStorage.getItem(STALE_BUNDLE_RECOVERY_KEY) === '1') {
      return false;
    }
  } catch {
    return false;
  }

  return true;
};

const attemptStaleBundleRecovery = () => {
  if (typeof window === 'undefined') return;

  try {
    window.sessionStorage.setItem(STALE_BUNDLE_RECOVERY_KEY, '1');
    const url = new URL(window.location.href);
    url.searchParams.set('cb', Date.now().toString());
    window.location.replace(url.toString());
  } catch {
    window.location.reload();
  }
};

class ErrorBoundary extends React.Component<React.PropsWithChildren<ErrorBoundaryProps>, ErrorBoundaryState> {
  constructor(props: React.PropsWithChildren<ErrorBoundaryProps>) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: unknown): ErrorBoundaryState {
    if (isLikelyExtensionNoise(error)) {
      return { hasError: false };
    }

    return { hasError: true };
  }

  componentDidCatch(error: unknown, info: unknown) {
    if (isLikelyExtensionNoise(error)) {
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
