import React from 'react';
import { isLikelyExtensionNoise } from '@/utils/registerExtensionNoiseFilters';

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
