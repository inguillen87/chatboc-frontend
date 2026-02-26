import React from 'react';

interface ErrorBoundaryProps {
  fallbackMessage?: string;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

class ErrorBoundary extends React.Component<React.PropsWithChildren<ErrorBoundaryProps>, ErrorBoundaryState> {
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
    if (ErrorBoundary.checkExtensionNoise(error)) {
      return { hasError: false };
    }

    return { hasError: true };
  }

  componentDidCatch(error: unknown, info: unknown) {
    if (ErrorBoundary.checkExtensionNoise(error)) {
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
