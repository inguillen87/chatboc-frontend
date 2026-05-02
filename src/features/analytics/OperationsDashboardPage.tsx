import { OperationsDashboardPanel } from './OperationsDashboardPanel';

export default function OperationsDashboardPage() {
  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-5 p-4 sm:p-6">
      <header className="space-y-1">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Analytics v2</p>
        <h1 className="text-2xl font-semibold tracking-tight">Operaciones</h1>
        <p className="max-w-3xl text-sm text-muted-foreground">
          Vista operacional conectada a dashboard, heatmap y action center del backend.
        </p>
      </header>
      <OperationsDashboardPanel />
    </div>
  );
}
