import EnterprisePageHeader from '@/components/enterprise/EnterprisePageHeader';
import EnterpriseTopNav from '@/components/enterprise/EnterpriseTopNav';
import SectionErrorBoundary from '@/components/errors/SectionErrorBoundary';
import NewTicketsPanel from '@/components/tickets/NewTicketsPanel';
import { TicketProvider } from '@/context/TicketContext';
import useRequireRole from '@/hooks/useRequireRole';
import type { Role } from '@/utils/roles';

const TicketsPanelPage = () => {
  useRequireRole(['admin', 'empleado', 'super_admin'] as Role[]);

  return (
    <div className="flex min-h-[100dvh] flex-col bg-background px-2 pb-4 pt-16 text-foreground dark:bg-gradient-to-tr dark:from-slate-950 dark:to-slate-900 sm:px-4 sm:pb-6 sm:pt-6 md:px-5 lg:px-6 2xl:px-5">
      <div className="relative mx-auto flex min-h-0 w-full max-w-[min(2400px,calc(100vw-2rem))] flex-1 flex-col">
        <EnterprisePageHeader
          badge="Mesa de atencion"
          title="Reclamos y conversaciones"
          description="Prioriza, asigna y responde cada caso desde un espacio de trabajo claro."
        />
        <EnterpriseTopNav />
        <div className="relative flex min-h-0 w-full flex-1">
          <SectionErrorBoundary
            title="Ocurrio un problema al cargar reclamos"
            description="Recarga la pagina o vuelve a la seccion principal del panel."
            onRetry={() => window.location.reload()}
          >
            <TicketProvider>
              <NewTicketsPanel />
            </TicketProvider>
          </SectionErrorBoundary>
        </div>
      </div>
    </div>
  );
};

export default TicketsPanelPage;
