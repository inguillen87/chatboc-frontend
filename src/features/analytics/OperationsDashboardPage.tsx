import { OperationsDashboardPanel } from './OperationsDashboardPanel';

export default function OperationsDashboardPage() {
  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-5 p-4 sm:p-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Actividad y tareas pendientes</h1>
        <p className="max-w-3xl text-sm text-muted-foreground">
          Revisá qué necesita atención y usá la acción de cada bloque para continuar.
        </p>
      </header>
      <OperationsDashboardPanel />
    </div>
  );
}
