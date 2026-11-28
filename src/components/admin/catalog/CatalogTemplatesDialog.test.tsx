import React from 'react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

const apiFetch = vi.fn();
vi.mock('@/utils/api', async () => {
  const actual = await vi.importActual<typeof import('@/utils/api')>('@/utils/api');
  return { ...actual, apiFetch: (...args: unknown[]) => apiFetch(...args) };
});
const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));
vi.mock('sonner', () => ({ toast }));

import CatalogTemplatesDialog from './CatalogTemplatesDialog';

beforeEach(() => { apiFetch.mockReset(); toast.success.mockReset(); });

describe('CatalogTemplatesDialog', () => {
  it('lists the server templates and loads one, then refreshes the catalog', async () => {
    apiFetch
      .mockResolvedValueOnce({ templates: [{ key: 'beneficios_ciudadanos', title: 'Beneficios ciudadanos', summary: 'Canjes y más', items: 20 }] })
      .mockResolvedValueOnce({ created: 20, updated: 0 });
    const onApplied = vi.fn();
    render(<CatalogTemplatesDialog tenantSlug="ciudad-demo" onApplied={onApplied} />);
    fireEvent.click(screen.getByRole('button', { name: /Plantillas/ }));
    await screen.findByText('Beneficios ciudadanos');
    expect(apiFetch).toHaveBeenCalledWith('/api/admin/tenants/ciudad-demo/marketplace/templates');
    fireEvent.click(screen.getByRole('button', { name: 'Cargar' }));
    await waitFor(() => expect(onApplied).toHaveBeenCalled());
    expect(apiFetch).toHaveBeenLastCalledWith('/api/admin/tenants/ciudad-demo/marketplace/templates/beneficios_ciudadanos/apply', { method: 'POST' });
    expect(toast.success).toHaveBeenCalledWith('Listo: sumamos 20 ítems de «Beneficios ciudadanos».');
  });
});
