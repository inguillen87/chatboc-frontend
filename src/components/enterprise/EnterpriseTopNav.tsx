import { Link, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { isBackofficeRouteActive, TICKET_DESK_PATH } from '@/utils/backofficeRoutes';

const items = [
  { to: TICKET_DESK_PATH, label: 'Reclamos' },
  { to: '/empleados', label: 'Equipo' },
  { to: '/analytics/operations', label: 'Metricas y mapa' },
  { to: '/admin/encuestas', label: 'Encuestas' },
  { to: '/notificaciones', label: 'Canales' },
  { to: '/perfil/plantillas-respuesta', label: 'Respuestas rapidas' },
] as const;

export const EnterpriseTopNav = () => {
  const location = useLocation();

  return (
    <nav className="mb-4 flex flex-wrap gap-2 rounded-2xl border border-border/70 bg-background/80 p-2 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      {items.map((item) => {
        const isActive = isBackofficeRouteActive(location.pathname, location.search, item.to);
        return (
          <Link
            key={item.to}
            to={item.to}
            className={cn(
              'inline-flex rounded-full border px-3 py-1 text-xs font-medium transition-colors',
              isActive
                ? 'border-primary bg-primary text-primary-foreground'
                : 'border-border/70 bg-background text-muted-foreground hover:border-primary/40 hover:text-foreground',
            )}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
};

export default EnterpriseTopNav;
