import { motion, useReducedMotion } from 'framer-motion';
import SectionErrorBoundary from '@/components/errors/SectionErrorBoundary';
import { useTenant } from '@/context/TenantContext';
import { OperationsDashboardPanel } from '@/features/analytics/OperationsDashboardPanel';

export default function EstadisticasPage() {
  const { currentSlug } = useTenant();
  const reduceMotion = Boolean(useReducedMotion());

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6 px-1 py-5 sm:px-0">
      <motion.section
        initial={reduceMotion ? false : { opacity: 0.94, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: reduceMotion ? 0 : 0.28, ease: 'easeOut' }}
        className="rounded-2xl border border-border/80 bg-card p-5 shadow-sm sm:p-6"
      >
        <div className="space-y-2">
          <h2 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            Actividad y prioridades
          </h2>
          <p className="max-w-3xl text-sm leading-6 text-muted-foreground sm:text-base">
            Revisá los casos, la participación, el equipo y las zonas con actividad. Cada bloque indica qué necesita atención y dónde continuar.
          </p>
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
