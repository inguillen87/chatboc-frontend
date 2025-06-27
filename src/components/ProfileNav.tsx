import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { Menu } from 'lucide-react';
import { useUser } from '@/hooks/useUser';
import { normalizeRole } from '@/utils/roles';
import useEndpointAvailable from '@/hooks/useEndpointAvailable';

interface NavItem {
  label: string;
  path: string;
  roles?: string[];
  tipo?: 'pyme' | 'municipio';
}

const NAV_ITEMS: NavItem[] = [
  { label: 'Panel de Tickets', path: '/tickets', roles: ['admin', 'empleado'] },
  { label: 'Pedidos', path: '/pedidos', roles: ['admin', 'empleado'], tipo: 'pyme' },
  { label: 'Usuarios', path: '/usuarios', roles: ['admin', 'empleado'] },
  { label: 'Catálogo', path: '/pyme/catalog', roles: ['admin'], tipo: 'pyme' },
  { label: 'Trámites', path: '/municipal/tramites', roles: ['admin'], tipo: 'municipio' },
  { label: 'Estadísticas', path: '/municipal/stats', roles: ['admin'], tipo: 'municipio' },
  { label: 'Analíticas', path: '/municipal/analytics', roles: ['admin'], tipo: 'municipio' },
  { label: 'Empleados', path: '/municipal/usuarios', roles: ['admin'], tipo: 'municipio' },
  { label: 'Métricas', path: '/pyme/metrics', roles: ['admin'], tipo: 'pyme' },
];

export default function ProfileNav() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useUser();
  const tramitesAvailable = useEndpointAvailable('/municipal/tramites');
  const statsAvailable = useEndpointAvailable('/municipal/stats');
  const analyticsAvailable = useEndpointAvailable('/municipal/analytics');
  const empleadosAvailable = useEndpointAvailable('/municipal/usuarios');

  if (!user) return null;
  if (!user.rol || !user.tipo_chat) {
    return (
      <div className="text-destructive text-sm">
        Perfil incompleto: falta rol o tipo de chat
      </div>
    );
  }
  const role = normalizeRole(user.rol);
  const tipo = user.tipo_chat as 'pyme' | 'municipio';

  const items = NAV_ITEMS.filter((it) => {
    if (it.path === '/municipal/tramites' && tramitesAvailable === false) return false;
    if (it.path === '/municipal/stats' && statsAvailable === false) return false;
    if (it.path === '/municipal/analytics' && analyticsAvailable === false) return false;
    if (it.path === '/municipal/usuarios' && empleadosAvailable === false) return false;
    return (!it.roles || it.roles.includes(role)) && (!it.tipo || it.tipo === tipo);
  });

  if (!items.length) return null;

  return (
    <div className="w-full">
      <div className="hidden sm:block">
        <Tabs value={location.pathname} onValueChange={(v) => navigate(v)}>
          <TabsList className="rounded-xl border border-border bg-muted/50 shadow-sm p-1">
            {items.map((it) => (
              <TabsTrigger
                key={it.path}
                value={it.path}
                className="rounded-lg px-4 py-2 text-sm font-semibold data-[state=active]:bg-primary data-[state=active]:text-primary-foreground transition-colors"
              >
                {it.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </div>
      <div className="sm:hidden">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" className="w-full flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Menu className="w-4 h-4" />
                Menú
              </span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            {items.map((it) => (
              <DropdownMenuItem key={it.path} onSelect={() => navigate(it.path)}>
                {it.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
