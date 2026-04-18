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
  }, [denialState.from, denialState.reason, denialState.requiredCapabilities, denialState.requiredRoles, location.pathname]);

  const requestAccessHref = React.useMemo(() => {
    const subject = encodeURIComponent('Solicitud de acceso - Chatboc');
    const body = encodeURIComponent(
      [
        `Ruta: ${denialState.from || location.pathname}`,
        denialState.reason ? `Motivo: ${denialState.reason}` : '',
        denialState.currentRole ? `Rol actual: ${denialState.currentRole}` : '',
        denialState.requiredRoles?.length ? `Roles requeridos: ${denialState.requiredRoles.join(', ')}` : '',
        denialState.requiredCapabilities?.length
          ? `Capabilities requeridas: ${denialState.requiredCapabilities.join(', ')}`
          : '',
      ]
        .filter(Boolean)
        .join('\n'),
    );
    return `mailto:soporte@chatboc.ar?subject=${subject}&body=${body}`;
  }, [denialState.currentRole, denialState.from, denialState.reason, denialState.requiredCapabilities, denialState.requiredRoles, location.pathname]);

  return (
    <div className="min-h-screen flex items-center justify-center text-center p-8">
      <div className="max-w-xl space-y-4">
        <h1 className="text-3xl font-bold mb-4">Acceso restringido</h1>
        <p>Tu usuario no cuenta con los permisos necesarios para esta sección.</p>
        <p className="mt-2">Contactá al administrador si creés que se trata de un error.</p>
        {denialState.requiredCapabilities?.length ? (
          <p className="text-sm text-muted-foreground">
            Capabilities requeridas: <span className="font-medium">{denialState.requiredCapabilities.join(', ')}</span>
          </p>
        ) : null}
        {denialState.requiredRoles?.length ? (
          <p className="text-sm text-muted-foreground">
            Roles requeridos: <span className="font-medium">{denialState.requiredRoles.join(', ')}</span>
          </p>
        ) : null}
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
