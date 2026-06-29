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
import { useCapabilities } from '@/context/CapabilitiesContext';
import { hasRequiredRole } from '@/utils/roles';
import useEndpointAvailable from '@/hooks/useEndpointAvailable';
import { useRealtimeAlerts } from '@/context/RealtimeAlertsContext';
import { useTenant } from '@/context/TenantContext';
import { buildTenantPath } from '@/utils/tenantPaths';
import { FEATURE_ENCUESTAS } from '@/config/featureFlags';
import { ORDER_READ_CAPABILITIES, TICKET_READ_CAPABILITIES } from '@/utils/moduleCapabilities';

interface NavItem {
  label: string;
  path: string;
  roles?: string[];
  tipo?: 'pyme' | 'municipio';
  requiredAnyCapabilities?: string[];
}

const NAV_ITEMS: NavItem[] = [
  {
    label: 'Panel de Tickets',
    path: '/tickets',
    roles: ['admin', 'empleado', 'super_admin'],
    requiredAnyCapabilities: TICKET_READ_CAPABILITIES,
  },
  {
    label: 'Pedidos',
    path: '/pedidos',
    roles: ['admin', 'empleado', 'super_admin'],
    tipo: 'pyme',
    requiredAnyCapabilities: ORDER_READ_CAPABILITIES,
  },
  { label: 'Usuarios', path: '/usuarios', roles: ['admin', 'empleado', 'super_admin'] },
  { label: 'Catálogo', path: '/pyme/catalog', roles: ['admin', 'super_admin'], tipo: 'pyme' },
  { label: 'Métricas', path: '/pyme/metrics', roles: ['admin', 'super_admin'], tipo: 'pyme' },
  // Municipio specific items
  { label: 'Trámites', path: '/municipal/tramites', roles: ['admin', 'super_admin'], tipo: 'municipio' },
  { label: 'Estadísticas', path: '/municipal/stats', roles: ['admin', 'super_admin'], tipo: 'municipio' },
  { label: 'Analytics', path: '/analytics', roles: ['admin', 'empleado', 'super_admin'] },
  { label: 'Encuestas', path: '/admin/encuestas', roles: ['admin', 'empleado', 'super_admin'] },
  { label: 'Empleados', path: '/municipal/usuarios', roles: ['admin', 'super_admin'], tipo: 'municipio' },
  { label: 'Mapa de Incidentes', path: '/municipal/incidents', roles: ['admin', 'super_admin'], tipo: 'municipio' },
];

export default function ProfileNav() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useUser();
  const { capabilities, hasAnyCapability } = useCapabilities();
  const { currentSlug } = useTenant();
  const { ticketUnreadCount, orderUnreadCount } = useRealtimeAlerts();

  // Hooks to check endpoint availability
  const tramitesAvailable = useEndpointAvailable('/municipal/tramites');
  const statsAvailable = useEndpointAvailable('/municipal/stats');
  const analyticsAvailable = useEndpointAvailable('/api/admin/analytics/overview');
  const empleadosAvailable = useEndpointAvailable('/municipal/usuarios');
  const incidentsMapAvailable = useEndpointAvailable('/municipal/incidents'); // Check for Mapa de Incidentes

  if (!user) return null;
  if (!user.rol || !user.tipo_chat) {
    return (
      <div className="text-destructive text-sm">
        Perfil incompleto: falta rol o tipo de chat.
      </div>
    );
  }
  const tipo = user.tipo_chat as 'pyme' | 'municipio';

  const hasDeclaredCapabilities = capabilities.length > 0;
  const isTenantOwnerLike = hasRequiredRole(user.rol, ['tenant_admin', 'superadmin']);

  const items = NAV_ITEMS.filter((it) => {
    // Check endpoint availability for relevant items
    if (it.path === '/municipal/tramites' && tramitesAvailable === false) return false;
    if (it.path === '/municipal/stats' && statsAvailable === false) return false;
    if (it.path === '/analytics' && analyticsAvailable === false) return false;
    if (it.path === '/municipal/usuarios' && empleadosAvailable === false) return false;
    if (it.path === '/municipal/incidents' && incidentsMapAvailable === false) return false; // Check for Mapa
    if (it.path === '/admin/encuestas' && !FEATURE_ENCUESTAS) return false;

    if (it.roles && !hasRequiredRole(user.rol, it.roles)) return false;
    if (it.tipo && it.tipo !== tipo) return false;
    if (
      it.requiredAnyCapabilities?.length &&
      hasDeclaredCapabilities &&
      !isTenantOwnerLike &&
      !hasAnyCapability(it.requiredAnyCapabilities)
    ) {
      return false;
    }

    return true;
  });

  // Sort items to ensure consistent order if needed, or adjust NAV_ITEMS order directly.
  // Example: Pyme items first, then Municipio items.
  // items.sort((a, b) => (a.tipo === 'pyme' ? -1 : 1)); // Simple sort, might need refinement


  const resolvedItems = items.map((it) => {
    if (it.path === '/analytics') {
      return {
        ...it,
        path: buildTenantPath('/analytics', currentSlug || undefined),
      };
    }
    return it;
  });

  const currentPath = location.pathname;
  const selectedPath =
    resolvedItems.find((it) => it.path === currentPath)?.path
    ?? resolvedItems.find((it) => currentPath.endsWith(it.path))?.path
    ?? resolvedItems[0]?.path;

  if (!resolvedItems.length) return null;

  return (
    <div className="w-full">
      <div className="hidden sm:block">
        <Tabs value={selectedPath} onValueChange={(v) => navigate(v)}>
          <TabsList className="flex w-full flex-wrap items-stretch gap-2 overflow-x-auto rounded-xl border border-border bg-muted/50 p-1 shadow-sm">
            {resolvedItems.map((it) => (
              <TabsTrigger
                key={it.path}
                value={it.path}
                className="rounded-lg px-4 py-2 text-sm font-semibold leading-snug text-center transition-all duration-200 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-lg hover:bg-accent/70 hover:shadow-md whitespace-normal"
              >
                <span className="flex items-center gap-2">
                  {it.label}
                  {it.path === '/tickets' && ticketUnreadCount > 0 && (
                    <span className="inline-flex h-4 min-w-[16px] items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold text-primary-foreground">
                      {ticketUnreadCount}
                    </span>
                  )}
                  {it.path === '/pedidos' && orderUnreadCount > 0 && (
                    <span className="inline-flex h-4 min-w-[16px] items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold text-primary-foreground">
                      {orderUnreadCount}
                    </span>
                  )}
                </span>
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
            {resolvedItems.map((it) => (
              <DropdownMenuItem key={it.path} onSelect={() => navigate(it.path)}>
                <span className="flex items-center gap-2">
                  {it.label}
                  {it.path === '/tickets' && ticketUnreadCount > 0 && (
                    <span className="inline-flex h-4 min-w-[16px] items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold text-primary-foreground">
                      {ticketUnreadCount}
                    </span>
                  )}
                  {it.path === '/pedidos' && orderUnreadCount > 0 && (
                    <span className="inline-flex h-4 min-w-[16px] items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold text-primary-foreground">
                      {orderUnreadCount}
                    </span>
                  )}
                </span>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
