import React from 'react';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import fixtures from '../../../tests/fixtures/organization-modules.json';
import assistance from '../../../tests/fixtures/module-selection-assistance.json';
import { apiFetch } from '@/utils/api';
import OrganizationModuleSelector from './OrganizationModuleSelector';
vi.mock('@/utils/api',()=>({apiFetch:vi.fn()}));
afterEach(cleanup);
it('keeps dependency assistance separate from explicit persistence and its receipt', async () => {
  const api=vi.mocked(apiFetch); const full={...fixtures.full,selection_assistance:assistance};
  const onSaved=vi.fn(); api.mockReset().mockResolvedValueOnce({organization_modules:full});
  render(<OrganizationModuleSelector slug="tenant-a" copy={full.ui} onSaved={onSaved}/>);
  fireEvent.click(await screen.findByRole('checkbox',{name:'Cobros y pedidos'}));
  expect(api).toHaveBeenCalledTimes(1);
  fireEvent.click(within(screen.getByRole('alertdialog')).getByRole('button',{name:assistance.apply_draft}));
  expect(api).toHaveBeenCalledTimes(1); expect(onSaved).not.toHaveBeenCalled();
  expect(screen.getByRole('checkbox',{name:'Cobros y pedidos'})).toBeChecked();
  const selected=['whatsapp','catalog','payments','surveys','territory'];
  api.mockResolvedValueOnce({contract_version:'organization.setup_modules_save.v1', saved:true,
    tenant:full.tenant, provider_calls_performed:false, changes_runtime_access:false,
    selection:{...full,version:1,source:'saved',revision:'b'.repeat(64),selected}});
  fireEvent.click(screen.getByRole('button',{name:full.ui.save}));
  expect(api).toHaveBeenCalledTimes(1);
  fireEvent.click(within(screen.getByRole('alertdialog')).getByRole('button',{name:full.ui.confirmed}));
  await screen.findByText(full.ui.success);
  expect(api).toHaveBeenCalledTimes(2); expect(onSaved).toHaveBeenCalledTimes(1);
  expect(api.mock.calls[1][1]?.body).toEqual({expected_revision:full.revision,organization_modules:{selected}});
});
