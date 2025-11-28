import React, { Component, ErrorInfo, ReactNode } from 'react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';

interface Props {
  children: ReactNode;
  fallbackTitle?: string;
  fallbackMessage?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
  }

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-[50vh] w-full items-center justify-center p-4">
          <Alert className="max-w-md bg-destructive/5 border-destructive/20">
            <AlertTitle className="text-destructive font-semibold">
              {this.props.fallbackTitle || 'Algo salió mal'}
            </AlertTitle>
            <AlertDescription className="mt-2 space-y-4">
              <p className="text-sm text-muted-foreground">
                {this.props.fallbackMessage || 'Ocurrió un error inesperado al cargar este componente.'}
              </p>
              {process.env.NODE_ENV === 'development' && this.state.error && (
                <pre className="text-xs bg-muted p-2 rounded overflow-auto max-h-32">
                  {this.state.error.message}
                </pre>
              )}
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={this.handleReload}>
                  Recargar página
                </Button>
                <Button variant="ghost" size="sm" onClick={() => this.setState({ hasError: false, error: null })}>
                  Intentar de nuevo
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
