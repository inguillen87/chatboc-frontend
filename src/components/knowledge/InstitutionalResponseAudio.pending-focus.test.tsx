import React from 'react';
import {act,cleanup,fireEvent,render,screen} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
import type {InstitutionalAudioReading,InstitutionalAudioScope} from './institutionalAssistantAudio';
const mocks=vi.hoisted(()=>({read:vi.fn()}));
vi.mock('./institutionalAssistantAudio',()=>({readInstitutionalAudio:(...args:unknown[])=>mocks.read(...args)}));
import {InstitutionalResponseAudio} from './InstitutionalResponseAudio';
const scope:InstitutionalAudioScope={tenant:{id:701,slug:'qa-knowledge'},revision:'b'.repeat(64),nodeIds:['start']};
const copy:InstitutionalAudioReading={contract_version:'chatboc.institutional_audio.v1',listen:'Escuchar respuesta',pause:'Pausar lectura',resume:'Continuar lectura',stop:'Detener lectura',loading:'Preparando lectura',error:'Podés seguir leyendo o volver a escuchar.',disclosure:'Esta voz fue generada con inteligencia artificial.'};
function deferred(){let resolve!:(value:Blob)=>void,reject!:(reason:Error)=>void;const promise=new Promise<Blob>((yes,no)=>{resolve=yes;reject=no;});return {promise,resolve,reject};}
const create=vi.fn(),play=vi.fn();
beforeEach(()=>{
  mocks.read.mockReset();create.mockReset();play.mockReset();
  vi.stubGlobal('URL',class extends URL{static createObjectURL=create;static revokeObjectURL=vi.fn();});
  vi.spyOn(HTMLMediaElement.prototype,'play').mockImplementation(play);
  vi.spyOn(HTMLMediaElement.prototype,'pause').mockImplementation(()=>{});
  vi.spyOn(HTMLMediaElement.prototype,'load').mockImplementation(()=>{});
});
afterEach(()=>{cleanup();vi.restoreAllMocks();vi.unstubAllGlobals();});
describe('pending institutional audio retains keyboard access',()=>{
  it('keeps Listen focusable and exposes its unavailable state while preparing, then retries after a rejection',async()=>{
    const user=userEvent.setup(),first=deferred(),retry=deferred();mocks.read.mockReturnValueOnce(first.promise).mockReturnValueOnce(retry.promise);
    render(<InstitutionalResponseAudio scope={scope} copy={copy}/>);
    await user.tab();await user.keyboard('{Enter}');
    const primary=screen.getByRole('button',{name:copy.loading});
    expect(primary).not.toBeDisabled();expect(primary).toHaveAttribute('aria-disabled','true');expect(primary).toHaveFocus();
    await user.keyboard('{Enter} ');expect(mocks.read).toHaveBeenCalledOnce();
    await act(async()=>first.reject(new Error('synthetic rejection')));
    expect(screen.getByRole('button',{name:copy.listen})).toHaveFocus();expect(primary).toHaveAttribute('aria-disabled','false');
    await user.keyboard('{Enter}');expect(mocks.read).toHaveBeenCalledTimes(2);
    expect(create).not.toHaveBeenCalled();expect(play).not.toHaveBeenCalled();
  });
  it('suppresses repeated activations before React commits the loading state',()=>{
    const pending=deferred();mocks.read.mockReturnValue(pending.promise);render(<InstitutionalResponseAudio scope={scope} copy={copy}/>);
    const primary=screen.getByRole('button',{name:copy.listen});
    act(()=>{fireEvent.click(primary);fireEvent.click(primary);fireEvent.click(primary);});
    expect(mocks.read).toHaveBeenCalledOnce();expect(screen.getByRole('button',{name:copy.loading})).toHaveAttribute('aria-disabled','true');
  });
  it('keeps preparation unavailable while playback starts and releases it after playback rejects without reclaiming focus',async()=>{
    const pending=deferred();let rejectPlay!:(reason:Error)=>void;
    mocks.read.mockReturnValue(pending.promise);create.mockReturnValue('blob:synthetic');play.mockReturnValue(new Promise<void>((_,no)=>{rejectPlay=no;}));
    render(<><InstitutionalResponseAudio scope={scope} copy={copy}/><label>Otra tarea<input/></label></>);
    fireEvent.click(screen.getByRole('button',{name:copy.listen}));
    await act(async()=>pending.resolve(new Blob(['synthetic'])));
    const primary=screen.getByRole('button',{name:copy.loading});expect(primary).toHaveAttribute('aria-disabled','true');expect(screen.getByRole('status')).toHaveTextContent(copy.loading);
    act(()=>{fireEvent.click(primary);fireEvent.click(primary);});
    expect(mocks.read).toHaveBeenCalledOnce();expect(play).toHaveBeenCalledOnce();
    screen.getByLabelText('Otra tarea').focus();await act(async()=>rejectPlay(new Error('synthetic playback failure')));
    expect(screen.getByLabelText('Otra tarea')).toHaveFocus();expect(screen.getByRole('button',{name:copy.listen})).toHaveAttribute('aria-disabled','false');expect(screen.getByRole('alert')).toHaveTextContent(copy.error);
  });
  it('lets Tab reach Stop and preserves its existing failure recovery',async()=>{
    const user=userEvent.setup(),pending=deferred();mocks.read.mockReturnValue(pending.promise);
    render(<InstitutionalResponseAudio scope={scope} copy={copy}/>);
    await user.tab();await user.keyboard('{Enter}');await user.tab();expect(screen.getByRole('button',{name:copy.stop})).toHaveFocus();
    await act(async()=>pending.reject(new Error('synthetic rejection')));
    expect(screen.getByRole('button',{name:copy.listen})).toHaveFocus();expect(screen.queryByRole('button',{name:copy.stop})).not.toBeInTheDocument();
  });
  it.each(['external','body'] as const)('does not reclaim voluntarily moved %s focus after preparation rejects',async target=>{
    const user=userEvent.setup(),pending=deferred();mocks.read.mockReturnValue(pending.promise);
    render(<><InstitutionalResponseAudio scope={scope} copy={copy}/><label>Otra tarea<input/></label></>);
    await user.tab();await user.keyboard('{Enter}');
    if(target==='external')screen.getByLabelText('Otra tarea').focus();else (document.activeElement as HTMLElement).blur();
    const destination=document.activeElement;
    await act(async()=>pending.reject(new Error('synthetic rejection')));
    expect(document.activeElement).toBe(destination);expect(mocks.read).toHaveBeenCalledOnce();expect(play).not.toHaveBeenCalled();
  });
  it('allows Stop then retry immediately and a retired response cannot release the new duplicate guard',async()=>{
    const first=deferred(),next=deferred();mocks.read.mockReturnValueOnce(first.promise).mockReturnValueOnce(next.promise);
    render(<InstitutionalResponseAudio scope={scope} copy={copy}/>);
    fireEvent.click(screen.getByRole('button',{name:copy.listen}));const prior=mocks.read.mock.calls[0][1];
    fireEvent.click(screen.getByRole('button',{name:copy.stop}));expect(prior.signal.aborted).toBe(true);
    fireEvent.click(screen.getByRole('button',{name:copy.listen}));expect(mocks.read).toHaveBeenCalledTimes(2);
    await act(async()=>first.resolve(new Blob(['retired'])));
    fireEvent.click(screen.getByRole('button',{name:copy.loading}));expect(mocks.read).toHaveBeenCalledTimes(2);
    expect(create).not.toHaveBeenCalled();expect(play).not.toHaveBeenCalled();
    await act(async()=>next.reject(new Error('current rejection')));
    expect(screen.getByRole('alert')).toHaveTextContent(copy.error);
  });
  it('retires preparation at a scope change without playing late bytes or taking external focus',async()=>{
    const pending=deferred();mocks.read.mockReturnValue(pending.promise);
    const mounted=render(<><InstitutionalResponseAudio scope={scope} copy={copy}/><label>Otra tarea<input/></label></>);
    fireEvent.click(screen.getByRole('button',{name:copy.listen}));const prior=mocks.read.mock.calls[0][1];screen.getByLabelText('Otra tarea').focus();
    mounted.rerender(<><InstitutionalResponseAudio scope={{...scope,revision:'c'.repeat(64)}} copy={copy}/><label>Otra tarea<input/></label></>);
    expect(prior.signal.aborted).toBe(true);
    await act(async()=>pending.resolve(new Blob(['retired'])));
    expect(screen.getByLabelText('Otra tarea')).toHaveFocus();expect(create).not.toHaveBeenCalled();expect(play).not.toHaveBeenCalled();expect(screen.getByRole('button',{name:copy.listen})).not.toHaveAttribute('aria-disabled','true');
  });
});
