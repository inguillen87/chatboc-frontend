import React from 'react';
import {act,cleanup,fireEvent,render,screen,waitFor,within} from '@testing-library/react';
import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
const mock=vi.hoisted(()=>({read:vi.fn(),save:vi.fn()}));
vi.mock('./followUpApi',async()=>{const original=await vi.importActual<typeof import('./followUpApi')>('./followUpApi');return {...original,followUpApi:mock};});
import {ContactFollowUpDialog} from './ContactFollowUpDialog';
import {FollowUpConflict,FollowUpUnconfirmed} from './followUpApi';
const identity={tenantSlug:'org-a',contactId:'contact-42'};
const snapshot=(overrides={})=>({...identity,name:'Contacto QA',notes:'Nota previa',nextActionAt:null,updatedAt:null,updatedBy:null,...overrides});
const deferred=<T,>()=>{let resolve!:(value:T)=>void;const promise=new Promise<T>(r=>resolve=r);return {promise,resolve};};
beforeEach(()=>{mock.read.mockReset().mockResolvedValue(snapshot());mock.save.mockReset();});afterEach(cleanup);
const edit=async()=>{const notes=await screen.findByLabelText('Notas del responsable');fireEvent.change(notes,{target:{value:'Seguimiento de propuesta'}});fireEvent.click(screen.getByRole('button',{name:'Revisar seguimiento'}));return screen.findByRole('alertdialog',{name:'Confirmar seguimiento'});};
describe('contact follow-up editor',()=>{
  it('cancels confirmation without saving or clearing the draft',async()=>{
    render(<ContactFollowUpDialog identity={identity} onClose={vi.fn()}/>);const dialog=await edit();
    fireEvent.click(within(dialog).getByRole('button',{name:'Volver sin guardar'}));
    expect(mock.save).not.toHaveBeenCalled();expect(screen.getByLabelText('Notas del responsable')).toHaveValue('Seguimiento de propuesta');
  });
  it('saves once, blocks dismissal while pending, and clears dirty state only after verification',async()=>{
    const pending=deferred<ReturnType<typeof snapshot>>();mock.save.mockReturnValue(pending.promise);const close=vi.fn(),saved=vi.fn();
    render(<ContactFollowUpDialog identity={identity} onClose={close} onSaved={saved}/>);const dialog=await edit();
    const button=within(dialog).getByRole('button',{name:'Guardar seguimiento'});fireEvent.click(button);fireEvent.click(button);
    expect(mock.save).toHaveBeenCalledTimes(1);expect(saved).not.toHaveBeenCalled();
    fireEvent.keyDown(dialog,{key:'Escape',code:'Escape'});expect(close).not.toHaveBeenCalled();
    await act(async()=>pending.resolve(snapshot({notes:'Seguimiento de propuesta'})));
    expect(await screen.findByText('Seguimiento guardado y verificado en el servidor.')).toBeVisible();expect(saved).toHaveBeenCalledOnce();
  });
  it('preserves the draft and stops saving after a preflight conflict',async()=>{
    mock.save.mockRejectedValue(new FollowUpConflict());render(<ContactFollowUpDialog identity={identity} onClose={vi.fn()}/>);
    const dialog=await edit();fireEvent.click(within(dialog).getByRole('button',{name:'Guardar seguimiento'}));
    await screen.findByText(/cambió desde que abriste/);expect(screen.getByLabelText('Notas del responsable')).toHaveValue('Seguimiento de propuesta');
    expect(screen.getByRole('button',{name:'Revisar seguimiento'})).toBeDisabled();expect(mock.save).toHaveBeenCalledOnce();
  });
  it('does not claim success when acknowledgement cannot be verified',async()=>{
    mock.save.mockRejectedValue(new FollowUpUnconfirmed(true,new Error('network')));
    render(<ContactFollowUpDialog identity={identity} onClose={vi.fn()}/>);const dialog=await edit();fireEvent.click(within(dialog).getByRole('button',{name:'Guardar seguimiento'}));
    await screen.findByText(/aceptó la actualización/);expect(screen.queryByText('Seguimiento guardado y verificado en el servidor.')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Notas del responsable')).toHaveValue('Seguimiento de propuesta');
  });
  it.each([401,403,404])('removes private notes after a denied write %s',async status=>{
    mock.save.mockRejectedValue(new FollowUpUnconfirmed(false,{status}));
    render(<ContactFollowUpDialog identity={identity} onClose={vi.fn()}/>);const dialog=await edit();fireEvent.click(within(dialog).getByRole('button',{name:'Guardar seguimiento'}));
    await screen.findByRole('alert');expect(screen.queryByLabelText('Notas del responsable')).not.toBeInTheDocument();
  });
  it('confirms discard before closing a dirty editor',async()=>{
    const close=vi.fn();render(<ContactFollowUpDialog identity={identity} onClose={close}/>);await screen.findByLabelText('Notas del responsable');
    fireEvent.change(screen.getByLabelText('Notas del responsable'),{target:{value:'Borrador'}});
    fireEvent.keyDown(screen.getByRole('dialog'),{key:'Escape',code:'Escape'});
    const alert=await screen.findByRole('alertdialog',{name:'Hay un borrador sin guardar'});expect(close).not.toHaveBeenCalled();
    fireEvent.click(within(alert).getByRole('button',{name:'Seguir editando'}));expect(screen.getByLabelText('Notas del responsable')).toHaveValue('Borrador');
  });
  it('ignores a late read when the organization changes',async()=>{
    const old=deferred<ReturnType<typeof snapshot>>();mock.read.mockReturnValueOnce(old.promise).mockResolvedValueOnce(snapshot({tenantSlug:'org-b',name:'Contacto B'}));
    const view=render(<ContactFollowUpDialog identity={identity} onClose={vi.fn()}/>);
    view.rerender(<ContactFollowUpDialog identity={{...identity,tenantSlug:'org-b'}} onClose={vi.fn()}/>);await screen.findByText('Contacto B');
    await act(async()=>old.resolve(snapshot({name:'Contacto A anterior'})));expect(screen.queryByText('Contacto A anterior')).not.toBeInTheDocument();
  });
  it('does not announce an old save after a new contact session opens',async()=>{
    const pending=deferred<ReturnType<typeof snapshot>>();mock.save.mockReturnValue(pending.promise);const saved=vi.fn();
    const view=render(<ContactFollowUpDialog identity={identity} onClose={vi.fn()} onSaved={saved}/>);const dialog=await edit();fireEvent.click(within(dialog).getByRole('button',{name:'Guardar seguimiento'}));
    mock.read.mockResolvedValue(snapshot({contactId:'contact-43',name:'Contacto nuevo'}));
    view.rerender(<ContactFollowUpDialog identity={{...identity,contactId:'contact-43'}} onClose={vi.fn()} onSaved={saved}/>);await screen.findByText('Contacto nuevo');
    await act(async()=>pending.resolve(snapshot({notes:'Seguimiento de propuesta'})));expect(saved).not.toHaveBeenCalled();expect(screen.queryByText('Seguimiento guardado y verificado en el servidor.')).not.toBeInTheDocument();
  });
  it('requires explicit confirmation to remove the scheduled date',async()=>{
    mock.read.mockResolvedValue(snapshot({nextActionAt:'2026-10-01T15:00:00Z'}));mock.save.mockResolvedValue(snapshot());
    render(<ContactFollowUpDialog identity={identity} onClose={vi.fn()}/>);await screen.findByLabelText('Notas del responsable');
    fireEvent.click(screen.getByRole('button',{name:'Quitar fecha'}));expect(mock.save).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button',{name:'Revisar seguimiento'}));const dialog=await screen.findByRole('alertdialog');
    fireEvent.click(within(dialog).getByRole('button',{name:'Guardar seguimiento'}));await waitFor(()=>expect(mock.save).toHaveBeenCalledOnce());
    expect(mock.save.mock.calls[0][1]).toEqual({notes:'Nota previa',nextActionAt:null});
  });
});
