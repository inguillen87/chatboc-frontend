import type { RecoveryPhase } from '@/hooks/useRuntimeRecovery';

/** Platform status copy only, not tenant branding or business responses. */
export const RUNTIME_RECOVERY_COPY = {
  offline: { title: 'Sin conexión', detail: 'El dispositivo informa una desconexión. Los datos pueden estar desactualizados; revisá los resultados antes de repetir una acción.' },
  checking: { title: 'Comprobando el servicio', detail: 'No hace falta recargar. Esta comprobación no guarda cambios ni reenvía mensajes.' },
  waiting: { title: 'El servicio está tardando', detail: 'La comprobación tiene un tiempo límite. Tu pantalla no se cerrará mientras esperamos.' },
  verified: { title: 'El servicio volvió a responder', detail: 'Esto no confirma las acciones anteriores. Revisá su resultado antes de volver a enviarlas.' },
  unavailable: { title: 'No pudimos confirmar la conexión', detail: 'Podés comprobar otra vez sin recargar ni repetir las acciones de esta pantalla.' },
  mismatch: { title: 'La versión del servicio no coincide', detail: 'No repitas acciones pendientes. Volvé a comprobar el servicio o consultá al equipo de soporte.' },
} satisfies Record<Exclude<RecoveryPhase, 'quiet'>, { title: string; detail: string }>;
