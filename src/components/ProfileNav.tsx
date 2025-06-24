import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
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
    <div className="flex gap-3 items-center flex-wrap">
      {items.map((it) => (
        <Button
          key={it.path}
          variant="outline"
          className="h-10 px-5 text-sm border-border text-foreground hover:bg-accent hover:text-accent-foreground"
          onClick={() => navigate(it.path)}
        >
          {it.label}
        </Button>
      ))}
    </div>
  );
}
