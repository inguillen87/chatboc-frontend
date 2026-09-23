import React, { useMemo, useState } from 'react';
import { Search, MoreHorizontal, ArrowUpRight, Settings2, Users, MessageSquare, Power, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import type { Tenant } from '@/types/superAdmin';
import { exportOrganizationsCsv } from './exportOrganizations';

export const organizationTypeLabel = (type: string) => ({ pyme: 'Empresa', municipio: 'Municipio', colegio: 'Colegio' }[type] || type);
const normalizeSearch = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('es');

interface Props {
  tenants: Tenant[];
  total: number | null;
  loading: boolean;
  error: string | null;
  onRefresh: () => void;
  onLoadMore: () => void;
  onProfile: (slug: string) => void;
  onEdit: (tenant: Tenant, tab?: 'general' | 'users' | 'integrations') => void;
  onImpersonate: (tenant: Tenant) => void;
  onToggleStatus: (tenant: Tenant) => void;
  onPurge: (tenant: Tenant) => void;
}

export function OrganizationDirectory({ tenants, total, loading, error, onRefresh, onLoadMore, onProfile, onEdit, onImpersonate, onToggleStatus, onPurge }: Props) {
  const [query, setQuery] = useState('');
  const [type, setType] = useState('all');
  const [status, setStatus] = useState('all');
  const [plan, setPlan] = useState('all');
  const types = [...new Set(tenants.map((tenant) => tenant.tipo).filter(Boolean))].sort();
  const plans = [...new Set(tenants.map((tenant) => tenant.plan).filter(Boolean))].sort();
  const filtered = useMemo(() => tenants.filter((tenant) => {
    const matches = normalizeSearch(`${tenant.nombre} ${tenant.slug} ${tenant.owner_email || ''}`).includes(normalizeSearch(query.trim()));
    return matches && (type === 'all' || tenant.tipo === type) && (plan === 'all' || tenant.plan === plan)
      && (status === 'all' || (status === 'active' ? tenant.is_active === true : tenant.is_active === false));
  }), [tenants, query, type, plan, status]);
  const hasFilters = Boolean(query || type !== 'all' || status !== 'all' || plan !== 'all');

  return <section className="platform-panel" aria-labelledby="organization-directory-title">
    <div className="platform-panel-heading">
      <div><h2 id="organization-directory-title">Directorio de organizaciones</h2><p>Administrá sus espacios, responsables y canales desde un solo lugar.</p></div>
      <div className="flex flex-wrap gap-2"><Button variant="outline" onClick={() => exportOrganizationsCsv(filtered)} disabled={loading || Boolean(error) || !filtered.length}>Exportar CSV</Button><Button variant="outline" onClick={onRefresh} disabled={loading}>Actualizar directorio</Button></div>
    </div>
    <div className="platform-directory-filters">
      <label className="platform-search"><span className="sr-only">Buscar organizaciones</span><Search aria-hidden="true" size={17} /><Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Nombre, identificador o correo" /></label>
      <label><span>Tipo</span><select value={type} onChange={(event) => setType(event.target.value)}><option value="all">Todos los tipos</option>{types.map((value) => <option key={value} value={value}>{organizationTypeLabel(value)}</option>)}</select></label>
      <label><span>Plan</span><select value={plan} onChange={(event) => setPlan(event.target.value)}><option value="all">Todos los planes</option>{plans.map((value) => <option key={value}>{value}</option>)}</select></label>
      <label><span>Estado</span><select value={status} onChange={(event) => setStatus(event.target.value)}><option value="all">Todos los estados</option><option value="active">Activas</option><option value="inactive">Inactivas</option></select></label>
    </div>
    <div className="platform-directory-coverage" aria-live="polite">
      <span>{loading ? 'Cargando organizaciones…' : error ? 'Directorio no disponible' : `${filtered.length} ${filtered.length === 1 ? 'resultado' : 'resultados'} · ${tenants.length} ${tenants.length === 1 ? 'organización cargada' : 'organizaciones cargadas'}${total === null ? ' · total no disponible' : ` de ${total}`}`}</span>
      {hasFilters && <button type="button" onClick={() => { setQuery(''); setType('all'); setPlan('all'); setStatus('all'); }}>Limpiar filtros</button>}
    </div>
    <p className="platform-note">La exportación incluye únicamente los resultados visibles.{total !== null && tenants.length < total && !error ? ' La búsqueda y los filtros se aplican a las organizaciones cargadas. Cargá más para ampliar los resultados.' : ''}</p>
    {error ? <div role="alert" className="platform-empty">{error}<Button variant="outline" onClick={onRefresh}>Reintentar</Button></div>
      : !loading && !filtered.length ? <div className="platform-empty">{hasFilters ? 'No hay coincidencias con estos filtros.' : 'No hay organizaciones en este listado.'}</div>
        : <div className="platform-directory-table"><table>
          <thead><tr><th>Organización</th><th>Plan</th><th>Estado</th><th>Responsable</th><th><span className="sr-only">Acciones</span></th></tr></thead>
          <tbody>{filtered.map((tenant) => <tr key={tenant.id}>
            <td><button type="button" className="platform-organization-name" onClick={() => onProfile(tenant.slug)}>{tenant.nombre || tenant.slug}<ArrowUpRight size={14} aria-hidden="true" /></button><span className="platform-row-detail">{organizationTypeLabel(tenant.tipo)} · {tenant.slug}</span></td>
            <td data-label="Plan"><span className="platform-plan">{tenant.plan || 'Sin dato'}</span></td>
            <td data-label="Estado"><span className={`platform-status ${tenant.is_active === true ? 'is-active' : tenant.is_active === false ? 'is-inactive' : ''}`}>{tenant.is_active === true ? 'Activa' : tenant.is_active === false ? 'Inactiva' : 'Sin dato'}</span></td>
            <td data-label="Responsable" className="platform-owner-email">{tenant.owner_email || 'Sin correo disponible'}</td>
            <td className="platform-row-actions"><DropdownMenu><DropdownMenuTrigger asChild><Button variant="ghost" size="icon" aria-label={`Acciones de ${tenant.nombre || tenant.slug}`}><MoreHorizontal size={19} /></Button></DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onSelect={() => onProfile(tenant.slug)}><ArrowUpRight className="mr-2 h-4 w-4" />Ver organización</DropdownMenuItem>
                <DropdownMenuItem onSelect={() => onEdit(tenant, 'general')}><Settings2 className="mr-2 h-4 w-4" />Editar organización y plan</DropdownMenuItem>
                <DropdownMenuItem onSelect={() => onEdit(tenant, 'users')}><Users className="mr-2 h-4 w-4" />Administrar acceso</DropdownMenuItem>
                <DropdownMenuItem onSelect={() => onEdit(tenant, 'integrations')}><MessageSquare className="mr-2 h-4 w-4" />Configurar WhatsApp</DropdownMenuItem>
                <DropdownMenuItem disabled={!tenant.is_active} onSelect={() => onImpersonate(tenant)}>Acceder como administrador</DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={() => onToggleStatus(tenant)}><Power className="mr-2 h-4 w-4" />{tenant.is_active ? 'Desactivar organización' : 'Activar organización'}</DropdownMenuItem>
                <DropdownMenuItem className="text-destructive focus:text-destructive" onSelect={() => onPurge(tenant)}><Trash2 className="mr-2 h-4 w-4" />Eliminar definitivamente</DropdownMenuItem>
              </DropdownMenuContent></DropdownMenu></td>
          </tr>)}</tbody>
        </table></div>}
    {total !== null && tenants.length < total && !error && <div className="platform-load-more"><Button variant="outline" disabled={loading} onClick={onLoadMore}>Cargar más organizaciones</Button></div>}
  </section>;
}
