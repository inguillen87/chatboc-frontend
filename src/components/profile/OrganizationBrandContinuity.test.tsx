import React from 'react';
import {act,cleanup,fireEvent,render,renderHook,screen,waitFor,within} from '@testing-library/react';
import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
import OrganizationBrandStudio from './OrganizationBrandStudio';
import {useBrandStudio} from '@/hooks/useBrandStudio';
import {sameBrandValues} from '@/utils/workspaceBranding';
import fixtures from '../../../tests/fixtures/workspace-branding.json';
import {apiFetch} from '@/utils/api';
vi.mock('@/utils/api',()=>({apiFetch:vi.fn()}));
const api=vi.mocked(apiFetch);
const read=(brand:any=fixtures.initial)=>({organization_branding:brand});
const receipt=(brand:any=fixtures.published)=>({contract_version:'organization.branding_save.v1',saved:true,tenant:brand.tenant,brand,provider_calls_performed:false});
const mount=()=>render(<OrganizationBrandStudio tenantSlug="tenant-a" name="Organización de prueba"/>);
const edit=async()=>{await screen.findByTestId('brand-studio');fireEvent.click(screen.getByRole('checkbox'));fireEvent.click(screen.getByRole('button',{name:'Violeta y coral'}));};
const unload=()=>{const event=new Event('beforeunload',{cancelable:true});window.dispatchEvent(event);return event.defaultPrevented;};
const publish=async()=>{fireEvent.click(screen.getByRole('button',{name:'Publicar paleta'}));fireEvent.click(await screen.findByRole('button',{name:'Confirmar publicación'}));};
beforeEach(()=>api.mockReset().mockResolvedValue(read()));afterEach(()=>{cleanup();vi.useRealTimers();});
describe('brand editing continuity',()=>{
  it('starts without an unload listener or an unnecessary publication',async()=>{
    mount();await screen.findByTestId('brand-studio');expect(unload()).toBe(false);
    expect(screen.getByRole('button',{name:'Publicar paleta'})).toBeDisabled();
    expect(screen.queryByRole('button',{name:'Descartar borrador'})).toBeNull();
  });
  it('warns only for real edits and removes the warning when the values return',async()=>{
    mount();await screen.findByTestId('brand-studio');fireEvent.click(screen.getByRole('checkbox'));
    expect(unload()).toBe(true);fireEvent.click(screen.getByRole('checkbox'));expect(unload()).toBe(false);
  });
  it('discards only after confirmation and never writes to the server',async()=>{
    mount();await edit();fireEvent.click(screen.getByRole('button',{name:'Descartar borrador'}));
    expect(unload()).toBe(true);fireEvent.click(await screen.findByRole('button',{name:'Seguir revisando'}));
    expect(screen.getByLabelText('Color principal')).toHaveValue('#6D28D9');
    fireEvent.click(screen.getByRole('button',{name:'Descartar borrador'}));
    fireEvent.click(await screen.findByRole('button',{name:'Confirmar descarte'}));
    expect(screen.getByLabelText('Color principal')).toHaveValue(fixtures.initial.values.primary_color);
    expect(unload()).toBe(false);expect(api).toHaveBeenCalledTimes(1);
  });
  it('compares activation as well as both colours before publication',async()=>{
    mount();await edit();fireEvent.click(screen.getByRole('button',{name:'Publicar paleta'}));
    const summary=within(await screen.findByRole('group',{name:'Resumen de publicación'}));
    expect(summary.getByText('Activada')).toBeVisible();expect(summary.getByText('Desactivada')).toBeVisible();
    expect(summary.getByText('#6D28D9')).toBeVisible();expect(summary.getAllByText('Cambiará')).toHaveLength(3);
    expect(api).toHaveBeenCalledTimes(1);
  });
  it('shows a neutral preview when disabled without erasing the selected colours',async()=>{
    mount();await edit();expect(screen.getByTestId('brand-preview')).toHaveAttribute('data-brand-active','true');
    fireEvent.click(screen.getByRole('checkbox'));
    expect(screen.getByTestId('brand-preview')).toHaveAttribute('data-brand-active','false');
    expect(screen.getByTestId('brand-preview').style.getPropertyValue('--sample-brand')).toBe('');
    expect(screen.getByLabelText('Color principal')).toHaveValue('#6D28D9');
    fireEvent.click(screen.getByRole('checkbox'));expect(screen.getByTestId('brand-preview').style.getPropertyValue('--sample-brand')).toBe('#6D28D9');
  });
  it('uses a labelled neutral preview for an incomplete colour instead of a fictitious valid palette',async()=>{
    mount();await edit();fireEvent.change(screen.getByLabelText('Color principal'),{target:{value:'#12'}});
    expect(screen.getByTestId('brand-preview')).toHaveAttribute('data-brand-active','false');
    expect(screen.getByRole('alert')).toHaveTextContent('#RRGGBB');expect(screen.queryByText(/^Principal: [0-9]/)).toBeNull();
  });
  it('clears the previous success message on another edit and releases the unload warning after saving',async()=>{
    mount();await edit();api.mockResolvedValueOnce(receipt());await publish();
    await screen.findByText('La paleta quedó publicada y confirmada por el servidor.');expect(unload()).toBe(false);
    fireEvent.change(screen.getByLabelText('Color principal'),{target:{value:'#112233'}});
    expect(screen.queryByText('La paleta quedó publicada y confirmada por el servidor.')).toBeNull();expect(unload()).toBe(true);
  });
  it('shows restoration values, not the unrelated current draft, and warns about its replacement',async()=>{
    api.mockResolvedValueOnce(read(fixtures.published));mount();await screen.findByTestId('brand-studio');
    fireEvent.change(screen.getByLabelText('Color principal'),{target:{value:'#112233'}});
    fireEvent.click(screen.getByText(/Historial de paleta/));fireEvent.click(screen.getByRole('button',{name:'Restaurar versión 0'}));
    const summary=within(await screen.findByRole('group',{name:'Resumen de publicación'}));
    expect(summary.getByText(fixtures.initial.values.primary_color)).toBeVisible();expect(summary.queryByText('#112233')).toBeNull();
    expect(screen.getByText(/Restaurar reemplazará también tu borrador/)).toBeVisible();expect(api).toHaveBeenCalledTimes(1);
  });
  it('cannot discard an uncertain write or escape its review requirement',async()=>{
    mount();await edit();api.mockRejectedValueOnce({status:412});await publish();await screen.findByRole('alert');
    expect(screen.getByRole('button',{name:'Descartar borrador'})).toBeDisabled();expect(unload()).toBe(true);
    api.mockResolvedValueOnce(read(fixtures.published));fireEvent.click(screen.getByRole('button',{name:'Revisar versión actual'}));
    await screen.findByRole('button',{name:'Usar paleta guardada'});
    expect(screen.getByRole('button',{name:'Descartar borrador'})).toBeDisabled();
    fireEvent.click(screen.getByRole('button',{name:'Usar paleta guardada'}));expect(unload()).toBe(false);expect(api).toHaveBeenCalledTimes(3);
  });
  it('retains the warning for an uncertain result even if the user manually returns to the old values',async()=>{
    mount();await edit();api.mockRejectedValueOnce({status:503});await publish();await screen.findByRole('alert');
    fireEvent.click(screen.getByRole('checkbox'));fireEvent.click(screen.getByRole('button',{name:'Azul y teal'}));
    expect(unload()).toBe(true);expect(screen.getByRole('button',{name:'Publicar paleta'})).toBeDisabled();
  });
  it('protects a pending restoration even when no draft was dirty',async()=>{
    api.mockResolvedValueOnce(read(fixtures.published));mount();await screen.findByTestId('brand-studio');
    expect(unload()).toBe(false);let finish!:(value:any)=>void;
    api.mockImplementationOnce(()=>new Promise(resolve=>{finish=resolve;}));
    fireEvent.click(screen.getByText(/Historial de paleta/));fireEvent.click(screen.getByRole('button',{name:'Restaurar versión 0'}));
    fireEvent.click(await screen.findByRole('button',{name:'Confirmar publicación'}));expect(unload()).toBe(true);
    await act(async()=>finish(receipt(fixtures.restored)));expect(unload()).toBe(false);
  });
  it('removes the warning and all previous draft state on tenant switch',async()=>{
    const view=mount();await edit();expect(unload()).toBe(true);
    api.mockResolvedValueOnce(read({...fixtures.initial,tenant:{id:2,slug:'tenant-b'},save_endpoint:'/api/admin/tenants/tenant-b/config'}));
    view.rerender(<OrganizationBrandStudio tenantSlug="tenant-b" name="Segunda organización"/>);
    await screen.findByTestId('brand-studio');expect(unload()).toBe(false);
    expect(screen.getByLabelText('Color principal')).toHaveValue(fixtures.initial.values.primary_color);
  });
  it('removes the unload warning when access is revoked',async()=>{
    mount();await edit();api.mockRejectedValueOnce({status:403});await publish();
    await waitFor(()=>expect(screen.queryByTestId('brand-studio')).toBeNull());expect(unload()).toBe(false);
  });
  it('does not store edits in local or session storage',async()=>{
    const storage=vi.spyOn(Storage.prototype,'setItem');mount();await edit();expect(storage).not.toHaveBeenCalled();storage.mockRestore();
  });
  it('guards unchanged and invalid direct hook publications without a request',async()=>{
    const {result}=renderHook(()=>useBrandStudio('tenant-a'));await waitFor(()=>expect(result.current.snapshot).not.toBeNull());
    await act(async()=>result.current.publish());await act(async()=>result.current.publish(999));expect(api).toHaveBeenCalledTimes(1);
    act(()=>result.current.setDraft({...fixtures.initial.values,primary_color:'red'}));
    await act(async()=>result.current.publish());expect(api).toHaveBeenCalledTimes(1);
  });
  it('normalizes HEX case but never ignores activation differences',()=>{
    expect(sameBrandValues(fixtures.published.values,{...fixtures.published.values,primary_color:'#6d28d9'})).toBe(true);
    expect(sameBrandValues(fixtures.published.values,{...fixtures.published.values,enabled:false})).toBe(false);
  });
});
