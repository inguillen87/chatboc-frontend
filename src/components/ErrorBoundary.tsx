import React from 'react';

interface ErrorBoundaryProps {
  fallbackMessage?: string;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

// Inlined from registerExtensionNoiseFilters to avoid cyclic dependency risks
const KNOWN_EXTENSION_PATTERNS = [
  /Cannot assign to read only property '(ethereum|tronLink)' of object '#<Window>'/i,
  /Cannot assign to read only property '(ethereum|tronLink)'/i,
  /This document requires 'TrustedScript' assignment/i,
  /No matching tab found/i,
  /Removing unpermitted intrinsics/i,
  /Cannot access '.*' before initialization/i, // Catch generic cyclic/TDZ errors
  /ReferenceError: Cannot access '.*' before initialization/i, // Explicitly match ReferenceError string
];

const EXTENSION_PROTOCOLS = ['chrome-extension://', 'moz-extension://', 'safari-extension://'];

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
  return KNOWN_EXTENSION_PATTERNS.some((pattern) => pattern.test(message));
}

function isExtensionUrl(url: string | null | undefined): boolean {
  if (typeof url !== 'string' || !url) return false;
  return EXTENSION_PROTOCOLS.some((protocol) => url.startsWith(protocol));
}

function isLikelyExtensionNoise(value: unknown): boolean {
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
