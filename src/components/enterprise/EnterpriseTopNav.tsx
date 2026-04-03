import { Link, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';

const items = [
  { to: '/enterprise', label: 'Workspace' },
  { to: '/tickets', label: 'Inbox' },
  { to: '/chatcrm', label: 'Live bridge' },
  { to: '/empleados', label: 'Roles/empleados' },
  { to: '/notificaciones', label: 'Notificaciones' },
  { to: '/perfil/plantillas-respuesta', label: 'Templates' },
] as const;

export const EnterpriseTopNav = () => {
  const location = useLocation();

  return (
    <nav className="mb-4 flex flex-wrap gap-2 rounded-2xl border border-border/70 bg-background/80 p-2 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      {items.map((item) => {
        const isActive = location.pathname === item.to || location.pathname.startsWith(`${item.to}/`);
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
