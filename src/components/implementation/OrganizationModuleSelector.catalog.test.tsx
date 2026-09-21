import React from 'react';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import fixtures from '../../../tests/fixtures/organization-modules.json';
import { apiFetch } from '@/utils/api';
import OrganizationModuleSelector from './OrganizationModuleSelector';
vi.mock('@/utils/api', () => ({ apiFetch: vi.fn() }));
const api = vi.mocked(apiFetch), full = fixtures.full;
const show = (onSaved = vi.fn()) => render(<OrganizationModuleSelector slug="tenant-a" copy={full.ui} onSaved={onSaved}/>);
beforeEach(() => api.mockReset().mockResolvedValue({ organization_modules: full }));
afterEach(cleanup);
describe('catalog changes during module editing', () => {
  it('renders a new server capability and its declared dependency without a frontend list', async () => {
    const catalog = [{ id: 'directory', label: 'Directorio', description: 'Contactos', requires: [] },
      { id: 'appointments', label: 'Turnos', description: 'Agenda', requires: ['directory'] }];
    api.mockResolvedValueOnce({ organization_modules: { ...full, catalog, selected: [] } }); show();
    expect(await screen.findByRole('checkbox', { name: /^Turnos/ })).toBeDisabled();
    fireEvent.click(screen.getByRole('checkbox', { name: /^Directorio/ }));
    expect(screen.getByRole('checkbox', { name: /^Turnos/ })).toBeEnabled();
    fireEvent.click(screen.getByRole('checkbox', { name: /^Turnos/ }));
    expect(screen.getByRole('checkbox', { name: /^Directorio/ })).toBeDisabled();
    expect(screen.queryByRole('checkbox', { name: /^WhatsApp/ })).toBeNull();
  });
  it('compares current server labels and reorders a kept draft before saving', async () => {
    const onSaved = vi.fn(); show(onSaved);
    fireEvent.click(await screen.findByRole('checkbox', { name: /^WhatsApp/ }));
    const catalog = [...full.catalog].reverse().map(m => ({ ...m, label: `Actual ${m.label}` }));
    const latest = { ...full, catalog, selected: catalog.filter(m => full.selected.includes(m.id)).map(m => m.id),
      version: 1, source: 'saved', revision: 'b'.repeat(64) };
    api.mockResolvedValueOnce({ organization_modules: latest });
    fireEvent.click(screen.getByRole('button', { name: full.ui.refresh }));
    const comparison = await screen.findByRole('region', { name: full.ui.compare });
    expect(comparison).toHaveTextContent('Actual WhatsApp');
    fireEvent.click(within(comparison).getByRole('button', { name: full.ui.review }));
    const expected = catalog.filter(m => m.id !== 'whatsapp' && full.selected.includes(m.id)).map(m => m.id);
    const selection = { ...latest, version: 2, selected: expected, revision: 'c'.repeat(64) };
    api.mockResolvedValueOnce({ contract_version: 'organization.setup_modules_save.v1', saved: true,
      tenant: full.tenant, selection, provider_calls_performed: false, changes_runtime_access: false });
    fireEvent.click(screen.getByRole('button', { name: full.ui.save }));
    fireEvent.click(screen.getByRole('button', { name: full.ui.confirmed }));
    await screen.findByText(full.ui.success);
    expect(api.mock.calls[2][1]?.body).toEqual({ expected_revision: latest.revision, organization_modules: { selected: expected } });
    expect(onSaved).toHaveBeenCalledOnce();
  });
});
