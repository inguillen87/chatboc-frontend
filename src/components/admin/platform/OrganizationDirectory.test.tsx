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
});
