import React from 'react';
import {act,cleanup,fireEvent,render,screen,waitFor} from '@testing-library/react';
import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
import OrganizationBrandStudio from './OrganizationBrandStudio';
import fixtures from '../../../tests/fixtures/workspace-branding.json';
import {apiFetch} from '@/utils/api';
vi.mock('@/utils/api',()=>({apiFetch:vi.fn()}));
const api=vi.mocked(apiFetch);
const read=(brand:any=fixtures.initial)=>({organization_branding:brand});
const receipt=(brand:any=fixtures.published)=>({contract_version:'organization.branding_save.v1',saved:true,tenant:brand.tenant,brand,provider_calls_performed:false});
const renderStudio=(slug='tenant-a',callback=vi.fn())=>render(<OrganizationBrandStudio tenantSlug={slug} name="Organización de prueba" onPublished={callback}/>);
const prepare=async()=>{
  await screen.findByTestId('brand-studio');
  fireEvent.click(screen.getByRole('checkbox',{name:'Usar mi paleta en el espacio'}));
  fireEvent.click(screen.getByRole('button',{name:'Violeta y coral'}));
};
const confirm=async()=>{fireEvent.click(screen.getByRole('button',{name:'Publicar paleta'}));fireEvent.click(await screen.findByRole('button',{name:'Confirmar publicación'}));};
beforeEach(()=>{api.mockReset().mockResolvedValue(read());});afterEach(()=>{cleanup();vi.useRealTimers();});
describe('organization brand publication',()=>{
  it('previews without writing or claiming provider configuration',async()=>{
    renderStudio();await prepare();expect(api).toHaveBeenCalledTimes(1);
    expect(screen.getByText(/No cambia dominios, PWA, WhatsApp/)).toBeVisible();
    expect(screen.getByLabelText('Color principal')).toHaveValue('#6D28D9');
    expect(screen.queryByText(/La paleta quedó publicada/)).toBeNull();
  });
  it('requires confirmation and verifies the server receipt',async()=>{
    const callback=vi.fn();renderStudio('tenant-a',callback);await prepare();
    api.mockResolvedValueOnce(receipt());await confirm();
    expect(await screen.findByText('La paleta quedó publicada y confirmada por el servidor.')).toBeVisible();
    expect(callback).toHaveBeenCalledWith(fixtures.published);
    expect(api).toHaveBeenLastCalledWith(fixtures.initial.save_endpoint,expect.objectContaining({method:'PUT',tenantSlug:'tenant-a',
      body:{expected_revision:fixtures.initial.revision,organization_branding:{operation:'publish',values:fixtures.published.values}}}));
  });
  it('restores an existing history version only after explicit confirmation',async()=>{
    api.mockResolvedValueOnce(read(fixtures.published));renderStudio();await screen.findByTestId('brand-studio');
    fireEvent.click(screen.getByText(/Historial de paleta/));api.mockResolvedValueOnce(receipt(fixtures.restored));
    fireEvent.click(screen.getByRole('button',{name:'Restaurar versión 0'}));
    expect(api).toHaveBeenCalledTimes(1);fireEvent.click(await screen.findByRole('button',{name:'Confirmar publicación'}));
    await screen.findByText('La paleta quedó publicada y confirmada por el servidor.');
    expect(api).toHaveBeenLastCalledWith(fixtures.published.save_endpoint,expect.objectContaining({body:{
      expected_revision:fixtures.published.revision,organization_branding:{operation:'restore',version:0}}}));
  });
  it('retains edits on conflict and does not silently retry',async()=>{
    renderStudio();await prepare();api.mockRejectedValueOnce({status:412});await confirm();
    await screen.findByRole('alert');expect(screen.getByLabelText('Color principal')).toHaveValue('#6D28D9');
    expect(screen.getByRole('button',{name:'Publicar paleta'})).toBeDisabled();expect(api).toHaveBeenCalledTimes(2);
    api.mockResolvedValueOnce(read(fixtures.published));fireEvent.click(screen.getByRole('button',{name:'Revisar versión actual'}));
    await screen.findByRole('button',{name:'Conservar mi borrador'});
    expect(screen.getByRole('button',{name:'Publicar paleta'})).toBeDisabled();
    fireEvent.click(screen.getByRole('button',{name:'Conservar mi borrador'}));
    expect(screen.getByRole('button',{name:'Publicar paleta'})).toBeEnabled();expect(api).toHaveBeenCalledTimes(3);
  });
  it('keeps the preview but blocks publication for a lower plan',async()=>{
    api.mockResolvedValueOnce(read(fixtures.locked));renderStudio();await screen.findByTestId('brand-studio');
    expect(screen.getByText(/La personalización del espacio requiere/)).toBeVisible();
    expect(screen.getByRole('button',{name:'Publicar paleta'})).toBeDisabled();
    fireEvent.click(screen.getByRole('button',{name:'Azul y teal'}));expect(api).toHaveBeenCalledTimes(1);
  });
  it('rejects malformed and cross-tenant replies without exposing their appearance',async()=>{
    const foreign={...fixtures.initial,tenant:{id:99,slug:'foreign'}};api.mockResolvedValueOnce(read(foreign));
    renderStudio();await screen.findByText(/No pudimos verificar la marca/);
    expect(screen.queryByTestId('brand-studio')).toBeNull();expect(screen.queryByRole('button',{name:'Publicar paleta'})).toBeNull();
  });
  it('cannot publish arbitrary CSS or a malformed color',async()=>{
    renderStudio();await prepare();fireEvent.change(screen.getByLabelText('Color principal'),{target:{value:'red'}});
    expect(screen.getByLabelText('Color principal')).toHaveAttribute('aria-invalid','true');
    expect(screen.getByRole('button',{name:'Publicar paleta'})).toBeDisabled();
  });
  it('does not claim success for a wrong receipt after a write',async()=>{
    const callback=vi.fn();renderStudio('tenant-a',callback);await prepare();api.mockResolvedValueOnce({ok:true});await confirm();
    await screen.findByRole('alert');expect(callback).not.toHaveBeenCalled();
    expect(screen.getByLabelText('Color principal')).toHaveValue('#6D28D9');
    expect(screen.getByRole('button',{name:'Publicar paleta'})).toBeDisabled();
  });
  it('removes state when publishing loses permission',async()=>{
    renderStudio();await prepare();api.mockRejectedValueOnce({status:403});await confirm();
    await waitFor(()=>expect(screen.queryByTestId('brand-studio')).toBeNull());
    expect(screen.queryByLabelText('Color principal')).toBeNull();
  });
  it('does not duplicate a pending publication',async()=>{
    let finish!:(value:any)=>void;
    renderStudio();await prepare();api.mockImplementationOnce(()=>new Promise(r=>{finish=r;}));await confirm();
    expect(screen.getByRole('button',{name:'Verificando…'})).toBeDisabled();
    expect(screen.getByRole('button',{name:'Revisar versión actual'})).toBeDisabled();expect(api).toHaveBeenCalledTimes(2);
    await act(async()=>finish(receipt()));
  });
  it('scopes A-B-A responses to the mounted organization only',async()=>{
    let first!:(value:any)=>void,second!:(value:any)=>void;
    api.mockImplementationOnce(()=>new Promise(r=>{first=r;})).mockImplementationOnce(()=>new Promise(r=>{second=r;}));
    const view=renderStudio();view.rerender(<OrganizationBrandStudio tenantSlug="tenant-b" name="Other"/>);
    view.rerender(<OrganizationBrandStudio tenantSlug="tenant-a" name="Latest"/>);await screen.findByTestId('brand-studio');
    await act(async()=>first(read(fixtures.published)));
    await act(async()=>second(read({...fixtures.published,tenant:{id:2,slug:'tenant-b'}})));
    expect(screen.getByLabelText('Color principal')).toHaveValue(fixtures.initial.values.primary_color);
    expect(screen.queryByText('Versión 1')).toBeNull();
  });
  it('preserves the draft after a timeout and ignores a late successful receipt',async()=>{
    renderStudio();await prepare();vi.useFakeTimers();let finish!:(value:any)=>void;
    api.mockImplementationOnce(()=>new Promise(resolve=>{finish=resolve;}));
    fireEvent.click(screen.getByRole('button',{name:'Publicar paleta'}));
    fireEvent.click(screen.getByRole('button',{name:'Confirmar publicación'}));
    await act(async()=>{vi.advanceTimersByTime(15001);});
    expect(screen.getByRole('alert')).toHaveTextContent('No pudimos confirmar la publicación');
    expect(screen.getByLabelText('Color principal')).toHaveValue('#6D28D9');
    await act(async()=>finish(receipt()));
    expect(screen.queryByText('La paleta quedó publicada y confirmada por el servidor.')).toBeNull();
    expect(screen.getByRole('button',{name:'Publicar paleta'})).toBeDisabled();
    expect(api).toHaveBeenCalledTimes(2);
  });
});
