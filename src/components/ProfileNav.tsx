import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useUser } from '@/hooks/useUser';
import { normalizeRole } from '@/utils/roles';

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
  { label: 'Métricas', path: '/pyme/metrics', roles: ['admin'], tipo: 'pyme' },
];

export default function ProfileNav() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useUser();

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

  const items = NAV_ITEMS.filter(
    (it) =>
      (!it.roles || it.roles.includes(role)) &&
      (!it.tipo || it.tipo === tipo)
  );

  if (!items.length) return null;

  return (
    <Tabs value={location.pathname} onValueChange={(v) => navigate(v)}>
      <TabsList>
        {items.map((it) => (
          <TabsTrigger key={it.path} value={it.path} className="px-3 py-2">
            {it.label}
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  );
}
