import React from 'react';
import { CheckCircle2, Circle, Compass } from 'lucide-react';
import { cn } from '@/lib/utils';
import styles from './SetupPreparationGuide.module.css';

type PreparationState = 'choose' | 'review' | 'prepared';
interface Props { state: PreparationState }

const steps = [
  { id: 'choose', title: 'Elegí una base', description: 'Usá la opción que mejor representa el servicio de tu organización.' },
  { id: 'review', title: 'Revisá antes de confirmar', description: 'Vas a ver qué se agregaría y qué información se conserva.' },
  { id: 'prepared', title: 'Completá tu puesta en marcha', description: 'Después prepará el equipo, los contenidos y los canales de atención.' },
] as const;

export default function SetupPreparationGuide({ state }: Props) {
  const current = steps.findIndex((step) => step.id === state);
  return (
    <section className={styles.guide} aria-label="Cómo preparar tu organización" data-testid="setup-preparation-guide">
      <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
        <Compass className="h-4 w-4 text-primary" aria-hidden="true" />
        Un paso a la vez
      </div>
      <ol className={styles.steps}>
        {steps.map((step, index) => (
          <li key={step.id} aria-current={index === current ? 'step' : undefined}
            className={cn(styles.step, index === current && styles.current)}>
            <span className={styles.number} aria-hidden="true">
              {index < current ? <CheckCircle2 className="h-4 w-4" /> : <Circle className="h-4 w-4" />}
              {index + 1}
            </span>
            <div className="min-w-0">
              <h3 className="text-sm font-semibold text-foreground">{step.title}</h3>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">{step.description}</p>
            </div>
          </li>
        ))}
      </ol>
      <p className="mt-3 text-xs leading-5 text-muted-foreground">
        Preparar la base no publica el servicio ni conecta WhatsApp. Podés revisar sin cambiar la configuración.
      </p>
    </section>
  );
}
