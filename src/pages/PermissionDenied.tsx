import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { trackFrontendEvent } from '@/utils/frontendTelemetry';

export default function PermissionDenied() {
  const navigate = useNavigate();
  const location = useLocation();
  const denialState = (location.state ?? {}) as {
    reason?: 'role' | 'capability';
    requiredCapabilities?: string[];
    requiredRoles?: string[];
    currentRole?: string;
    from?: string;
  };

  React.useEffect(() => {
    trackFrontendEvent('permission_denied', {
      reason: denialState.reason ?? 'unknown',
      requiredCapabilities: denialState.requiredCapabilities ?? [],
      requiredRoles: denialState.requiredRoles ?? [],
      from: denialState.from ?? location.pathname,
    });
  }, [
    denialState.from,
    denialState.reason,
    denialState.requiredCapabilities,
    denialState.requiredRoles,
    location.pathname,
  ]);

  const requestAccessHref = React.useMemo(() => {
    const subject = encodeURIComponent('Solicitud de acceso - Chatboc');
    const body = encodeURIComponent(
      [
        `Ruta: ${denialState.from || location.pathname}`,
        denialState.reason ? `Motivo: ${denialState.reason}` : '',
        denialState.currentRole ? `Rol actual: ${denialState.currentRole}` : '',
        denialState.requiredRoles?.length ? `Roles internos: ${denialState.requiredRoles.join(', ')}` : '',
        denialState.requiredCapabilities?.length
          ? `Permisos internos: ${denialState.requiredCapabilities.join(', ')}`
          : '',
      ]
        .filter(Boolean)
        .join('\n'),
    );
    return `mailto:soporte@chatboc.ar?subject=${subject}&body=${body}`;
  }, [
    denialState.currentRole,
    denialState.from,
    denialState.reason,
    denialState.requiredCapabilities,
    denialState.requiredRoles,
    location.pathname,
  ]);

  return (
    <div className="flex min-h-screen items-center justify-center p-8 text-center">
      <div className="max-w-xl space-y-4 rounded-2xl border border-border/70 bg-card/70 p-8 shadow-sm">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-primary">Acceso del equipo</p>
        <h1 className="text-3xl font-bold">Este modulo no esta habilitado para tu cuenta</h1>
        <p className="text-muted-foreground">
          Podes volver al panel o pedir que un administrador active esta seccion para tu usuario.
        </p>
        <p className="text-sm text-muted-foreground">
          Si sos administrador, revisa el rol y los accesos asignados a esta cuenta.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Button variant="outline" onClick={() => navigate(-1)}>
            Volver
          </Button>
          <Button asChild>
            <a href={requestAccessHref}>Solicitar acceso</a>
          </Button>
        </div>
      </div>
    </div>
  );
}
