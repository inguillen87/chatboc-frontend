import React from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { OrganizationDirectory } from './OrganizationDirectory';
import { exportOrganizationsCsv } from './exportOrganizations';
import type { Tenant } from '@/types/superAdmin';

vi.mock('./exportOrganizations', () => ({ exportOrganizationsCsv: vi.fn() }));
const tenants: Tenant[] = [
  { id: 1, slug: 'rio', nombre: 'Municipio Río', tipo: 'municipio', plan: 'enterprise', is_active: true, status: 'active', owner_email: 'rio@example.test', created_at: '' },
  { id: 2, slug: 'colegio', nombre: 'Colegio Norte', tipo: 'colegio', plan: 'standard', is_active: false, status: 'inactive', created_at: '' },
  { id: 3, slug: 'tienda', nombre: 'Tienda Sur', tipo: 'pyme', plan: 'standard', is_active: true, status: 'active', created_at: '' },
];
const props = () => ({ tenants, total: 103, loading: false, error: null, onRefresh: vi.fn(), onLoadMore: vi.fn(), onProfile: vi.fn(), onEdit: vi.fn(), onImpersonate: vi.fn(), onToggleStatus: vi.fn(), onPurge: vi.fn() });

describe('OrganizationDirectory', () => {
  const manyTenants = Array.from({ length: 25 }, (_, index) => ({ ...tenants[0], id: index + 10, slug: `org-${index + 1}`, nombre: `Organización ${String(index + 1).padStart(2, '0')}` }));
  it('keeps a long loaded directory compact without hiding total coverage or later organizations', () => {
    render(<OrganizationDirectory {...props()} tenants={manyTenants} total={125} />);
    expect(screen.getAllByRole('row')).toHaveLength(9);
    expect(screen.getByText('25 resultados · 25 organizaciones cargadas de 125')).toBeVisible();
    expect(screen.getByRole('status')).toHaveTextContent('Mostrando 1–8 de 25');
    expect(screen.getByRole('button', { name: 'Página anterior' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Página siguiente' }));
    expect(screen.getByRole('button', { name: 'Organización 09' })).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Organización 01' })).not.toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('Mostrando 9–16 de 25');
  });
  it('searches across all loaded pages and resets to a visible matching page', () => {
    render(<OrganizationDirectory {...props()} tenants={manyTenants} total={25} />);
    fireEvent.click(screen.getByRole('button', { name: 'Página siguiente' }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Buscar organizaciones' }), { target: { value: 'organizacion 25' } });
    expect(screen.getByRole('button', { name: 'Organización 25' })).toBeVisible();
    expect(screen.getByRole('status')).toHaveTextContent('Mostrando 1–1 de 1');
    expect(screen.getByRole('button', { name: 'Página siguiente' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Limpiar filtros' }));
    expect(screen.getByRole('button', { name: 'Organización 01' })).toBeVisible();
    expect(screen.getByRole('status')).toHaveTextContent('Mostrando 1–8 de 25');
  });
  it('exports the full filtered loaded set, including other pages, and preserves row identity', () => {
    const handlers = props();
    render(<OrganizationDirectory {...handlers} tenants={manyTenants} total={125} />);
    fireEvent.click(screen.getByRole('button', { name: 'Página siguiente' }));
    fireEvent.click(screen.getByRole('button', { name: 'Organización 09' }));
    expect(handlers.onProfile).toHaveBeenCalledWith('org-9');
    fireEvent.click(screen.getByRole('button', { name: 'Exportar CSV' }));
    expect(exportOrganizationsCsv).toHaveBeenLastCalledWith(manyTenants);
    expect(screen.getByText(/aunque estén en otra página/)).toBeVisible();
  });
  it('resets pagination when changing page size and reaches the last partial page', () => {
    render(<OrganizationDirectory {...props()} tenants={manyTenants} total={25} />);
    for (let index = 0; index < 3; index += 1) fireEvent.click(screen.getByRole('button', { name: 'Página siguiente' }));
    expect(screen.getByRole('status')).toHaveTextContent('Mostrando 25–25 de 25');
    expect(screen.getByRole('button', { name: 'Página siguiente' })).toBeDisabled();
    fireEvent.change(screen.getByLabelText('Por página'), { target: { value: '16' } });
    expect(screen.getAllByRole('row')).toHaveLength(17);
    expect(screen.getByRole('status')).toHaveTextContent('Mostrando 1–16 de 25');
  });
  it('clamps a shrinking list immediately and never resurrects a stale page', () => {
    const handlers = props();
    const { rerender } = render(<OrganizationDirectory {...handlers} tenants={manyTenants} total={25} />);
    for (let index = 0; index < 3; index += 1) fireEvent.click(screen.getByRole('button', { name: 'Página siguiente' }));
    rerender(<OrganizationDirectory {...handlers} tenants={manyTenants.slice(0, 2)} total={2} />);
    expect(screen.getByRole('status')).toHaveTextContent('Mostrando 1–2 de 2');
    rerender(<OrganizationDirectory {...handlers} tenants={manyTenants} total={25} />);
    expect(screen.getByRole('status')).toHaveTextContent('Mostrando 1–8 de 25');
  });
  it('keeps loading additional backend rows distinct from local page navigation', () => {
    const handlers = props();
    const { rerender } = render(<OrganizationDirectory {...handlers} tenants={manyTenants.slice(0, 8)} total={25} />);
    fireEvent.click(screen.getByRole('button', { name: 'Cargar más organizaciones' }));
    expect(handlers.onLoadMore).toHaveBeenCalledOnce();
    rerender(<OrganizationDirectory {...handlers} tenants={manyTenants.slice(0, 16)} total={25} />);
    fireEvent.click(screen.getByRole('button', { name: 'Página siguiente' }));
    expect(handlers.onLoadMore).toHaveBeenCalledOnce();
    expect(screen.getByRole('status')).toHaveTextContent('Mostrando 9–16 de 16');
  });
  it('does not offer page navigation or stale export while the directory is unavailable', () => {
    render(<OrganizationDirectory {...props()} tenants={manyTenants} total={25} error="Servicio no disponible" />);
    expect(screen.queryByRole('navigation', { name: 'Páginas del directorio' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Exportar CSV' })).toBeDisabled();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });
  it('shows the published descriptive types while filters and selected identities retain their technical values', () => {
    const handlers = props();
    const records = tenants.map((tenant, index) => ({ ...tenant, organization_type_label_contract: 'organization.type_label.v1', organization_type_label: ['Gobierno', 'Educación', 'Empresa'][index] }));
    render(<OrganizationDirectory {...handlers} tenants={records} />);
    expect(screen.getByText('Gobierno · rio')).toBeVisible();
    expect(screen.getByText('Educación · colegio')).toBeVisible();
    expect(screen.getByText('Empresa · tienda')).toBeVisible();
    expect(screen.getByRole('option', { name: 'Gobierno' })).toHaveValue('municipio');
    fireEvent.change(screen.getByLabelText('Tipo'), { target: { value: 'colegio' } });
    fireEvent.click(screen.getByRole('button', { name: 'Colegio Norte' }));
    expect(handlers.onProfile).toHaveBeenCalledWith('colegio');
    expect(screen.queryByRole('button', { name: 'Municipio Río' })).not.toBeInTheDocument();
    expect(records.map((tenant) => tenant.tipo)).toEqual(['municipio', 'colegio', 'pyme']);
  });
  it('combines search, type, plan and status within the explicitly partial list', () => {
    render(<OrganizationDirectory {...props()} />);
    expect(screen.getByText('3 resultados · 3 organizaciones cargadas de 103')).toBeInTheDocument();
    fireEvent.change(screen.getByRole('textbox', { name: 'Buscar organizaciones' }), { target: { value: 'rio' } });
    fireEvent.change(screen.getByLabelText('Tipo'), { target: { value: 'municipio' } });
    fireEvent.change(screen.getByLabelText('Plan'), { target: { value: 'enterprise' } });
    fireEvent.change(screen.getByLabelText('Estado'), { target: { value: 'active' } });
    expect(screen.getByRole('button', { name: 'Municipio Río' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Colegio Norte' })).not.toBeInTheDocument();
    expect(screen.getByText(/búsqueda y los filtros se aplican a las organizaciones cargadas/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Limpiar filtros' }));
    expect(screen.getByText('3 resultados · 3 organizaciones cargadas de 103')).toBeInTheDocument();
  });
  it('exports only filtered rows and keeps the selected organization identity', () => {
    const handlers = props();
    render(<OrganizationDirectory {...handlers} />);
    fireEvent.change(screen.getByLabelText('Estado'), { target: { value: 'inactive' } });
    fireEvent.click(screen.getByRole('button', { name: 'Exportar CSV' }));
    expect(exportOrganizationsCsv).toHaveBeenLastCalledWith([tenants[1]]);
    fireEvent.click(screen.getByRole('button', { name: 'Colegio Norte' }));
    expect(handlers.onProfile).toHaveBeenCalledWith('colegio');
    fireEvent.click(screen.getByRole('button', { name: 'Cargar más organizaciones' }));
    expect(handlers.onLoadMore).toHaveBeenCalledTimes(1);
  });
  it('distinguishes no matches from an empty platform and disables exporting nothing', () => {
    render(<OrganizationDirectory {...props()} />);
    fireEvent.change(screen.getByRole('textbox', { name: 'Buscar organizaciones' }), { target: { value: 'missing' } });
    expect(screen.getByText('No hay coincidencias con estos filtros.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Exportar CSV' })).toBeDisabled();
    expect(screen.queryByText(/No hay organizaciones en este listado/)).not.toBeInTheDocument();
  });
  it('keeps a failed request unavailable instead of showing a successful empty list', () => {
    const handlers = props();
    render(<OrganizationDirectory {...handlers} tenants={[]} total={null} error="Servicio no disponible" />);
    expect(screen.getByRole('alert')).toHaveTextContent('Servicio no disponible');
    expect(screen.getByRole('button', { name: 'Exportar CSV' })).toBeDisabled();
    expect(screen.queryByText(/0 resultados/)).not.toBeInTheDocument();
    fireEvent.click(within(screen.getByRole('alert')).getByRole('button', { name: 'Reintentar' }));
    expect(handlers.onRefresh).toHaveBeenCalledOnce();
  });
  it('opens knowledge for the selected active organization without impersonation', () => {
    const handlers = props();const onKnowledge = vi.fn();
    render(<OrganizationDirectory {...handlers} onKnowledge={onKnowledge} />);
    fireEvent.click(screen.getByRole('button', { name: 'Fuentes de conocimiento de Municipio Río' }));
    expect(onKnowledge).toHaveBeenCalledWith(tenants[0]);
    expect(handlers.onImpersonate).not.toHaveBeenCalled();
    expect(screen.queryByRole('button', { name: 'Fuentes de conocimiento de Colegio Norte' })).not.toBeInTheDocument();
  });
  it('does not advertise knowledge without an authorized navigation action', () => {
    render(<OrganizationDirectory {...props()} />);
    expect(screen.queryByRole('button', { name: /Fuentes de conocimiento/ })).not.toBeInTheDocument();
  });
  it('opens the data editor for the exact active organization without impersonation or a plan change', () => {
    const handlers = props(); const onInstitutionProfile = vi.fn();
    render(<OrganizationDirectory {...handlers} onInstitutionProfile={onInstitutionProfile} />);
    fireEvent.click(screen.getByRole('button', { name: 'Datos institucionales de Municipio Río' }));
    expect(onInstitutionProfile).toHaveBeenCalledWith(tenants[0]);
    expect(handlers.onImpersonate).not.toHaveBeenCalled();
    expect(handlers.onEdit).not.toHaveBeenCalled();
    expect(screen.queryByRole('button', { name: 'Datos institucionales de Colegio Norte' })).not.toBeInTheDocument();
  });
});
