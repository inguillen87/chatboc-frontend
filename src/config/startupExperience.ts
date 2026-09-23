/** Platform states only: never business answers or a customer's brand. */
export type StartupPhase = 'checking' | 'waiting' | 'session' | 'offline' | 'unavailable' | 'mismatch';
export const STARTUP_COPY = {
  checking: { title: 'Preparando tu espacio', description: 'Estamos comprobando la conexión con el servicio antes de iniciar el acceso.', label: 'Comprobando el servicio' },
  waiting: { title: 'Tu espacio sigue preparándose', description: 'La respuesta está tardando un poco más. Esta comprobación tiene un tiempo límite; no necesitás abrir otra pestaña.', label: 'Esperando respuesta' },
  session: { title: 'Preparando tu espacio', description: 'Estamos comprobando la configuración de acceso. Todavía no confirmamos una sesión.', label: 'Comprobando el acceso' },
  offline: { title: 'Parece que estás sin conexión', description: 'El dispositivo informa que no tiene conexión. Revisá tu red; al volver, comprobaremos el servicio sin recargar la página.', label: 'Revisá tu conexión' },
  unavailable: { title: 'No pudimos iniciar tu espacio', description: 'No se pudo completar la comprobación. Podés volver a intentarlo sin recargar esta página.', label: 'Inicio pendiente' },
  mismatch: { title: 'Las versiones todavía no coinciden', description: 'La interfaz y el servicio no corresponden a la misma versión de esta publicación. El acceso sigue en espera para evitar una combinación incompatible.', label: 'Publicación por verificar' },
} satisfies Record<StartupPhase, {title:string; description:string; label:string}>;
