import SectionErrorBoundary from '@/components/errors/SectionErrorBoundary';
import { Badge } from '@/components/ui/badge';
import { OperationsDashboardPanel } from '@/features/analytics/OperationsDashboardPanel';
import { BarChart3, MapPin, RefreshCw, Users, Vote } from 'lucide-react';

const overviewChips = [
  { label: 'Actividad en vivo', icon: RefreshCw },
  { label: 'Mapa y zonas calientes', icon: MapPin },
  { label: 'Encuestas y comentarios', icon: Vote },
  { label: 'Equipo y carga', icon: Users },
] as const;

export default function EstadisticasPage() {
  return (
    <div className="mx-auto w-full max-w-7xl space-y-5 px-1 py-4 sm:px-0">
      <section className="overflow-hidden rounded-2xl border border-border/70 bg-gradient-to-br from-background via-background to-primary/5 p-4 shadow-sm sm:p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-2">
            <Badge variant="outline" className="gap-2 rounded-full px-3 py-1">
              <BarChart3 className="h-3.5 w-3.5" />
              Centro operativo
            </Badge>
            <div className="space-y-2">
              <h2 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
                Metricas, mapas y prioridades
              </h2>
              <p className="max-w-3xl text-sm leading-6 text-muted-foreground sm:text-base">
                Una vista clara para ver reclamos, encuestas, canales, equipo y zonas calientes sin perder tiempo entre
                pantallas.
              </p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:justify-end">
            {overviewChips.map((chip) => {
              const Icon = chip.icon;
              return (
                <span
                  key={chip.label}
                  className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-background/80 px-3 py-2 text-xs font-medium text-muted-foreground shadow-sm"
                >
                  <Icon className="h-3.5 w-3.5 text-primary" />
                  {chip.label}
                </span>
              );
            })}
          </div>
        </div>
      </section>

      <SectionErrorBoundary
        title="No pudimos cargar las estadisticas"
        description="Actualiza la vista para volver a intentarlo."
        onRetry={() => window.location.reload()}
      >
        <OperationsDashboardPanel />
      </SectionErrorBoundary>
    </div>
  );
}
