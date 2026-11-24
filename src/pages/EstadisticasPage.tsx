import { motion, useReducedMotion } from 'framer-motion';
import SectionErrorBoundary from '@/components/errors/SectionErrorBoundary';
import { useTenant } from '@/context/TenantContext';
import { Badge } from '@/components/ui/badge';
import { OperationsDashboardPanel } from '@/features/analytics/OperationsDashboardPanel';
import { BarChart3, MapPin, RefreshCw, Users, Vote } from 'lucide-react';

const overviewChips = [
  { label: 'Actividad en vivo', icon: RefreshCw, accent: 'var(--brand-accent-1, hsl(var(--primary)))' },
  { label: 'Mapa y zonas calientes', icon: MapPin, accent: 'var(--brand-accent-2, hsl(var(--primary)))' },
  { label: 'Encuestas y comentarios', icon: Vote, accent: 'var(--brand-accent-3, hsl(var(--primary)))' },
  { label: 'Equipo y carga', icon: Users, accent: 'var(--brand-accent-4, hsl(var(--primary)))' },
] as const;

export default function EstadisticasPage() {
  const { currentSlug } = useTenant();
  const reduceMotion = Boolean(useReducedMotion());

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6 px-1 py-5 sm:px-0">
      <motion.section
        initial={reduceMotion ? false : { opacity: 0.94, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: reduceMotion ? 0 : 0.28, ease: 'easeOut' }}
        className="relative overflow-hidden rounded-2xl border border-border/80 bg-card p-5 shadow-sm sm:p-6"
        style={{
          backgroundImage:
            'radial-gradient(circle at 92% 14%, color-mix(in srgb, var(--brand-accent-1, hsl(var(--primary))) 12%, transparent), transparent 42%), radial-gradient(circle at 8% 92%, color-mix(in srgb, var(--brand-accent-3, hsl(var(--primary))) 8%, transparent), transparent 40%)',
        }}
      >
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-0 h-1"
          style={{
            backgroundImage:
              'linear-gradient(90deg, var(--brand-accent-1, hsl(var(--primary))), var(--brand-accent-2, hsl(var(--primary))), var(--brand-accent-3, hsl(var(--primary))), var(--brand-accent-4, hsl(var(--primary))))',
          }}
        />
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-2.5">
            <Badge
              variant="outline"
              className="gap-2 rounded-full border-primary/25 bg-primary/10 px-3 py-1 font-semibold text-foreground"
            >
              <BarChart3 className="h-3.5 w-3.5" aria-hidden="true" />
              Centro operativo
            </Badge>
            <div className="space-y-2">
              <h2 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
                Métricas, mapas y prioridades
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
                  className="inline-flex items-center gap-2 rounded-full border border-border/80 bg-background/85 px-3 py-2 text-xs font-medium text-foreground shadow-sm backdrop-blur-sm"
                >
                  <Icon className="h-3.5 w-3.5 shrink-0" style={{ color: chip.accent }} aria-hidden="true" />
                  <span>{chip.label}</span>
                </span>
              );
            })}
          </div>
        </div>
      </motion.section>

      <SectionErrorBoundary
        title="No pudimos cargar las estadísticas"
        description="Volvé a cargar las estadísticas sin salir del panel."
        resetKeys={[currentSlug]}
        fallbackAction={<a href="/perfil">Volver al panel</a>}
      >
        <OperationsDashboardPanel />
      </SectionErrorBoundary>
    </div>
  );
}
