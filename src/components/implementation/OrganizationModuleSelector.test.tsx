import React from 'react';
import {cleanup,fireEvent,render,screen,waitFor,within} from '@testing-library/react';
import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
import fixture from '../../../tests/fixtures/organization-modules.json';
import {apiFetch} from '@/utils/api';
import OrganizationModuleSelector from './OrganizationModuleSelector';
vi.mock('@/utils/api',()=>({apiFetch:vi.fn()}));
const api=vi.mocked(apiFetch),copy=()=>structuredClone(fixture);
const renderPanel=()=>render(<OrganizationModuleSelector tenantSlug="tenant-a" onSaved={vi.fn()}/>);
beforeEach(()=>{api.mockReset().mockResolvedValue({organization_modules:copy()});});afterEach(cleanup);
describe('module preparation selector',()=>{
  it('loads backend labels and does not save defaults implicitly',async()=>{
    renderPanel();await screen.findByRole('heading',{name:fixture.ui.heading});
    expect(screen.getAllByRole('checkbox')).toHaveLength(5);
    expect(screen.getByRole('button',{name:fixture.ui.save})).toBeDisabled();expect(api).toHaveBeenCalledTimes(1);
  });
  it('blocks an incomplete dependency without selecting it silently',async()=>{
    renderPanel();await screen.findByRole('heading',{name:fixture.ui.heading});
    fireEvent.click(screen.getByRole('checkbox',{name:'Cobros y pedidos'}));
    expect(screen.getByRole('button',{name:fixture.ui.save})).toBeDisabled();
    expect(screen.getByRole('checkbox',{name:'Catálogo de productos o servicios'})).not.toBeChecked();
  });
  it('confirms a valid change and verifies the exact receipt',async()=>{
    api.mockImplementation(async(_url,options)=>{
      if(options?.method!=='PUT')return {organization_modules:copy()} as any;
      const body=JSON.parse(options.body as string);
      return {contract_version:'organization.setup_modules_save.v1',saved:true,tenant:fixture.tenant,provider_calls_performed:false,
        modules:{...copy(),version:1,revision:'b'.repeat(64),selected:body.organization_modules.selected}} as any;
    });
    renderPanel();await screen.findByRole('heading',{name:fixture.ui.heading});
    fireEvent.click(screen.getByRole('checkbox',{name:'Catálogo de productos o servicios'}));
    fireEvent.click(screen.getByRole('button',{name:fixture.ui.save}));
    expect(api.mock.calls.filter(([,o])=>o?.method==='PUT')).toHaveLength(0);
    fireEvent.click(within(screen.getByRole('alertdialog')).getByRole('button',{name:fixture.ui.save}));
    await screen.findByText(fixture.ui.success);expect(api.mock.calls.filter(([,o])=>o?.method==='PUT')).toHaveLength(1);
  });
  it('does not announce success for an uncertain or mismatching response',async()=>{
    api.mockImplementation(async(_url,options)=>options?.method==='PUT'?{} as any:{organization_modules:copy()} as any);
    renderPanel();await screen.findByRole('heading',{name:fixture.ui.heading});
    fireEvent.click(screen.getByRole('checkbox',{name:'Catálogo de productos o servicios'}));
    fireEvent.click(screen.getByRole('button',{name:fixture.ui.save}));
    fireEvent.click(within(screen.getByRole('alertdialog')).getByRole('button',{name:fixture.ui.save}));
    await screen.findByRole('alert');expect(screen.queryByText(fixture.ui.success)).toBeNull();
    expect(screen.getByRole('button',{name:fixture.ui.save})).toBeDisabled();
  });
  it('discards only after confirmation and without a write',async()=>{
    renderPanel();await screen.findByRole('heading',{name:fixture.ui.heading});
    fireEvent.click(screen.getByRole('checkbox',{name:'WhatsApp y plantillas'}));
    fireEvent.click(screen.getByRole('button',{name:fixture.ui.reset}));
    fireEvent.click(within(screen.getByRole('alertdialog')).getByRole('button',{name:fixture.ui.reset}));
    expect(screen.getByRole('checkbox',{name:'WhatsApp y plantillas'})).toBeChecked();
    expect(api.mock.calls.filter(([,o])=>o?.method==='PUT')).toHaveLength(0);
  });
  it('respects server read-only state even if the client renders checkboxes',async()=>{
    api.mockResolvedValue({organization_modules:{...copy(),can_edit:false,reason_code:'full_plan_required'}} as any);
    renderPanel();await screen.findByRole('heading',{name:fixture.ui.heading});
    expect(screen.getByRole('checkbox',{name:'WhatsApp y plantillas'})).toBeDisabled();
  });
  it('rejects data returned for another organization',async()=>{
    api.mockResolvedValue({organization_modules:{...copy(),tenant:{id:2,slug:'other'}}} as any);
    renderPanel();await waitFor(()=>expect(api).toHaveBeenCalled());
    expect(screen.queryByTestId('module-selector')).toBeNull();
  });
  it('removes stale configuration after access revocation',async()=>{
    renderPanel();await screen.findByRole('heading',{name:fixture.ui.heading});
    api.mockRejectedValueOnce({status:403});fireEvent.click(screen.getByRole('button',{name:fixture.ui.refresh}));
    await waitFor(()=>expect(screen.queryByTestId('module-selector')).toBeNull());
  });
});
