import OrganizationSetupWorkspace from './OrganizationSetupWorkspace';
import journeyFixtures from '../../../tests/fixtures/organization-setup-journeys.json';
import {parseOrganizationSetupJourney} from '@/utils/organizationSetupJourney';
import React from 'react';
import {act,cleanup,fireEvent,render,screen,waitFor} from '@testing-library/react';
import {beforeEach,afterEach,describe,it,expect,vi} from 'vitest';
import fixtures from '../../../tests/fixtures/organization-modules.json';
import {apiFetch} from '@/utils/api';
import OrganizationModuleSelector from './OrganizationModuleSelector';
import {readModuleSelection} from '@/utils/organizationModules';
vi.mock('@/utils/api',()=>({apiFetch:vi.fn()}));
const api=vi.mocked(apiFetch);const full=fixtures.full;const saved=fixtures.saved;
const show=(slug='tenant-a',onSaved=vi.fn())=>render(<OrganizationModuleSelector slug={slug} copy={full.ui} onSaved={onSaved}/>);
const receipt=()=>({contract_version:'organization.setup_modules_save.v1',saved:true,tenant:full.tenant,selection:saved,provider_calls_performed:false,changes_runtime_access:false});
async function edit(){
  await screen.findByRole('checkbox',{name:/^WhatsApp/});
  for(const name of [/^WhatsApp/,/^Encuestas/,/^Territorio/])fireEvent.click(screen.getByRole('checkbox',{name}));
  fireEvent.click(screen.getByRole('checkbox',{name:/^Catálogo/}));fireEvent.click(screen.getByRole('checkbox',{name:/^Cobros/}));
}
beforeEach(()=>{api.mockReset().mockResolvedValue({organization_modules:full});});afterEach(cleanup);
describe('module preparation selector',()=>{
  it('reads a matching snapshot and keeps provider actions distinct',async()=>{
    show();await screen.findByRole('checkbox',{name:/^WhatsApp/});
    expect(screen.getByText(full.ui.scope_note)).toBeVisible();expect(api).toHaveBeenCalledTimes(1);
  });
  it('blocks payment selection until its dependency is selected',async()=>{
    show();await screen.findByRole('checkbox',{name:/^Cobros/});
    expect(screen.getByRole('checkbox',{name:/^Cobros/})).toBeDisabled();
    fireEvent.click(screen.getByRole('checkbox',{name:/^Catálogo/}));fireEvent.click(screen.getByRole('checkbox',{name:/^Cobros/}));
    expect(screen.getByRole('checkbox',{name:/^Catálogo/})).toBeDisabled();
  });
  it('requires explicit confirmation and validates the persisted receipt',async()=>{
    const onSaved=vi.fn();show('tenant-a',onSaved);await edit();
    fireEvent.click(screen.getByRole('button',{name:full.ui.save}));expect(api).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('alertdialog')).toBeVisible();api.mockResolvedValueOnce(receipt());
    fireEvent.click(screen.getByRole('button',{name:full.ui.confirmed}));
    await screen.findByText(full.ui.success);expect(onSaved).toHaveBeenCalledTimes(1);
    expect(api.mock.calls[1][1]?.body).toEqual({expected_revision:full.revision,organization_modules:{selected:['catalog','payments']}});
  });
  it('discard confirmation restores loaded values without a PUT',async()=>{
    show();await edit();fireEvent.click(screen.getByRole('button',{name:full.ui.reset}));
    fireEvent.click(screen.getByRole('button',{name:full.ui.discard_confirm}));
    expect(screen.getByRole('checkbox',{name:/^WhatsApp/})).toBeChecked();expect(api).toHaveBeenCalledTimes(1);
  });
  it('free plan cannot alter selection or publish',async()=>{
    api.mockResolvedValue({organization_modules:fixtures.free});show();await screen.findByText(fixtures.free.message);
    expect(screen.getByRole('button',{name:full.ui.save})).toBeDisabled();
    expect(screen.getAllByRole('checkbox').every(input=>(input as HTMLInputElement).disabled)).toBe(true);
  });
  it('preserves a draft on conflict and requires a new read and explicit comparison',async()=>{
    show();await edit();api.mockRejectedValueOnce({status:412});
    fireEvent.click(screen.getByRole('button',{name:full.ui.save}));fireEvent.click(screen.getByRole('button',{name:full.ui.confirmed}));
    await screen.findByRole('alert');expect(screen.getByRole('button',{name:full.ui.save})).toBeDisabled();
    api.mockResolvedValueOnce({organization_modules:saved});fireEvent.click(screen.getByRole('button',{name:full.ui.refresh}));
    await screen.findByRole('button',{name:full.ui.review});const calls=api.mock.calls.length;
    fireEvent.click(screen.getByRole('button',{name:full.ui.review}));expect(api).toHaveBeenCalledTimes(calls);
  });
  it('does not accept a response from a different tenant',async()=>{
    api.mockResolvedValueOnce({organization_modules:{...full,tenant:{id:2,slug:'other'}}});show();
    await screen.findByText(full.ui.error);expect(screen.queryByRole('checkbox')).toBeNull();
  });
  it('does not announce success for a malformed save receipt',async()=>{
    show();await edit();api.mockResolvedValueOnce({...receipt(),changes_runtime_access:true});
    fireEvent.click(screen.getByRole('button',{name:full.ui.save}));fireEvent.click(screen.getByRole('button',{name:full.ui.confirmed}));
    await screen.findByRole('alert');expect(screen.queryByText(full.ui.success)).toBeNull();
  });
  it('clears the editor on revocation rather than allowing an old draft to publish',async()=>{
    show();await edit();api.mockRejectedValueOnce({status:403});
    fireEvent.click(screen.getByRole('button',{name:full.ui.save}));fireEvent.click(screen.getByRole('button',{name:full.ui.confirmed}));
    await screen.findByText(full.ui.error);expect(screen.queryByRole('checkbox')).toBeNull();
  });
  it('rejects invalid contracts and dangling catalog dependencies',()=>{
    for(const bad of [{...full,ui:{...full.ui,heading:'A\u0085B'}},{...full,selected:['payments']},
      {...full,catalog:full.catalog.map(m=>m.id==='payments'?{...m,requires:['missing-module']}:m)},
      {...full,can_edit:true,reason_code:'full'},{...full,save_endpoint:'/api/private'}]) {
      expect(readModuleSelection(bad,'tenant-a')).toBeNull();
    }
  });
  it('rejects stale responses after moving to another organization',async()=>{
    let resolve!:(value:any)=>void;api.mockReturnValueOnce(new Promise(r=>{resolve=r;}));
    const view=show();view.rerender(<OrganizationModuleSelector slug="tenant-b" copy={full.ui} onSaved={()=>{}}/>);
    await act(async()=>resolve({organization_modules:full}));
    await screen.findByText(full.ui.error);expect(screen.queryByRole('checkbox')).toBeNull();
  });
  it('keeps unsaved choices when the setup section is collapsed and opened again',async()=>{
    const parsed=parseOrganizationSetupJourney(journeyFixtures.municipio,'tenant-a',1)!;
    render(<OrganizationSetupWorkspace journey={{...parsed,module_selector_ui:full.ui}} onRefresh={()=>{}}/>);
    const disclosure=screen.getByText(full.ui.heading).closest('details')!;
    act(()=>{disclosure.open=true;fireEvent(disclosure,new Event('toggle'));});
    await screen.findByRole('checkbox',{name:/^WhatsApp/});
    fireEvent.click(screen.getByRole('checkbox',{name:/^WhatsApp/}));
    act(()=>{disclosure.open=false;fireEvent(disclosure,new Event('toggle'));});
    act(()=>{disclosure.open=true;fireEvent(disclosure,new Event('toggle'));});
    expect(screen.getByRole('checkbox',{name:/^WhatsApp/})).not.toBeChecked();
    expect(api).toHaveBeenCalledTimes(1);
  });
});
