import React from 'react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';

interface SectionErrorBoundaryProps {
  children: React.ReactNode;
  title?: string;
  description?: string;
  onRetry?: () => void;
}

interface SectionErrorBoundaryState {
  hasError: boolean;
}

export class SectionErrorBoundary extends React.Component<
  SectionErrorBoundaryProps,
  SectionErrorBoundaryState
> {
  constructor(props: SectionErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): SectionErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('SectionErrorBoundary captured an error', error, info);
  }

  handleRetry = () => {
    this.setState({ hasError: false }, () => {
      if (this.props.onRetry) {
        this.props.onRetry();
      }
    });
  };

  render() {
    if (this.state.hasError) {
      const title = this.props.title || 'No pudimos cargar esta sección';
      const description =
        this.props.description ||
        'Ocurrió un error inesperado. Reintentá o volvé al inicio mientras investigamos.';

      return (
        <div className="flex min-h-[50vh] items-center justify-center bg-background px-4 py-6">
          <Alert className="max-w-2xl">
            <AlertTitle>{title}</AlertTitle>
            <AlertDescription className="space-y-3">
              <p>{description}</p>
              <div className="flex flex-wrap gap-2">
                <Button type="button" onClick={this.handleRetry}>
                  Reintentar
                </Button>
                <Button type="button" variant="outline" onClick={() => (window.location.href = '/') }>
                  Ir al inicio
                </Button>
              </div>
            </AlertDescription>
          </Alert>
        </div>
      );
    }

    return this.props.children;
  }
}

export default SectionErrorBoundary;
