import React from 'react';
import useRequireRole from '@/hooks/useRequireRole';
import type { Role } from '@/utils/roles';
import NewTicketsPanel from '@/components/tickets/NewTicketsPanel';
import { TicketProvider } from '@/context/TicketContext';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

class TicketsErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean }> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('Tickets panel failed to render', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-screen items-center justify-center bg-background px-4">
          <Alert className="max-w-xl">
            <AlertTitle>Ocurrió un problema al cargar Tickets</AlertTitle>
            <AlertDescription className="space-y-3">
              <p>Recargá la página o volvé a la sección principal del panel.</p>
              <div className="flex flex-wrap gap-2">
                <Button variant="default" onClick={() => window.location.reload()}>Recargar</Button>
                <Button variant="outline" onClick={() => (window.location.href = '/')}>Ir al inicio</Button>
              </div>
            </AlertDescription>
          </Alert>
        </div>
      );
    }

    return this.props.children;
  }
}

const TicketsPanelPage = () => {
  useRequireRole(['admin', 'empleado', 'super_admin'] as Role[]);
  return (
    <div className="flex min-h-screen flex-col bg-background dark:bg-gradient-to-tr dark:from-slate-950 dark:to-slate-900 text-foreground py-4 sm:py-6 px-2 sm:px-4 md:px-5 lg:px-6 2xl:px-5">
      <div className="relative mx-auto flex w-full flex-1 max-w-[min(2400px,calc(100vw-2rem))]">
        <TicketsErrorBoundary>
          <TicketProvider>
            <NewTicketsPanel />
          </TicketProvider>
        </TicketsErrorBoundary>
      </div>
    </div>
  );
};

export default TicketsPanelPage;
