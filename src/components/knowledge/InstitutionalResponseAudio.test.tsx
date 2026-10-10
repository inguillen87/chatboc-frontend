import React from 'react';
import {act,cleanup,fireEvent,render,screen,waitFor} from '@testing-library/react';
import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
import {node,workspace,reply} from '../../../tests/fixtures/institutional-assistant.synthetic';
const mocks=vi.hoisted(()=>({read:vi.fn(),fetch:vi.fn()}));
vi.mock('@/utils/api',()=>({apiFetch:(...args:unknown[])=>mocks.fetch(...args)}));
vi.mock('./institutionalAssistantAudio',async original=>({...await original<typeof import('./institutionalAssistantAudio')>(),readInstitutionalAudio:(...args:unknown[])=>mocks.read(...args)}));
import {InstitutionalResponseAudio} from './InstitutionalResponseAudio';
import InstitutionalChatMessage from '@/components/chat/InstitutionalChatMessage';
import InstitutionalAssistant from './InstitutionalAssistant';
import type {InstitutionalAudioReading,InstitutionalAudioScope} from './institutionalAssistantAudio';
const scope:InstitutionalAudioScope={tenant:{id:701,slug:'qa-knowledge'},revision:'b'.repeat(64),nodeIds:['start']};
const copy:InstitutionalAudioReading={contract_version:'chatboc.institutional_audio.v1',listen:'Escuchar respuesta',pause:'Pausar lectura',resume:'Continuar lectura',stop:'Detener lectura',loading:'Preparando lectura',error:'No pudimos reproducir. Podés seguir leyendo o volver a escuchar.',disclosure:'Esta voz fue generada con inteligencia artificial.'};
const create=vi.fn(()=> 'blob:synthetic-audio'),revoke=vi.fn();
const NativeURL=URL;
beforeEach(()=>{
  mocks.read.mockReset();mocks.fetch.mockReset();mocks.read.mockResolvedValue(new Blob(['synthetic'],{type:'audio/mpeg'}));create.mockClear();revoke.mockClear();
  vi.stubGlobal('URL',class extends NativeURL {static createObjectURL=create;static revokeObjectURL=revoke;});
  vi.spyOn(HTMLMediaElement.prototype,'play').mockResolvedValue();vi.spyOn(HTMLMediaElement.prototype,'pause').mockImplementation(()=>{});vi.spyOn(HTMLMediaElement.prototype,'load').mockImplementation(()=>{});
});
afterEach(()=>{cleanup();vi.restoreAllMocks();vi.unstubAllGlobals();});
describe('institutional voice controls',()=>{
  it('uses the same reading controls in the public portal and retires audio when navigating, without discarding a typed question',async()=>{
    const w=workspace({visibility:'public',can_edit:false,audio_reading:copy});mocks.fetch.mockResolvedValueOnce(w);
    render(<InstitutionalAssistant tenantSlug="qa-knowledge" mode="public"/>);await screen.findByRole('button',{name:copy.listen});
    const input=screen.getByLabelText(w.ui.question);fireEvent.change(input,{target:{value:'Consulta que estoy preparando'}});expect(mocks.read).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button',{name:copy.listen}));await screen.findByRole('button',{name:copy.pause});
    mocks.fetch.mockResolvedValueOnce(reply('requirements',w));fireEvent.click(screen.getByRole('button',{name:'1 Consultar requisitos'}));
    await screen.findByRole('heading',{name:'Requisitos de la consulta'});expect(revoke).toHaveBeenCalledWith('blob:synthetic-audio');expect(input).toHaveValue('Consulta que estoy preparando');expect(screen.getByRole('button',{name:copy.listen})).toBeEnabled();
  });
  it('does not fetch or autoplay on rendering and supports explicit listening, pausing, resuming and stopping',async()=>{
    const mounted=render(<InstitutionalResponseAudio scope={scope} copy={copy}/>);
    expect(screen.getByText(copy.disclosure)).toBeVisible();expect(mocks.read).not.toHaveBeenCalled();expect(HTMLMediaElement.prototype.play).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button',{name:copy.listen}));
    await screen.findByRole('button',{name:copy.pause});expect(mocks.read).toHaveBeenCalledOnce();expect(HTMLMediaElement.prototype.play).toHaveBeenCalledOnce();
    fireEvent.click(screen.getByRole('button',{name:copy.pause}));expect(screen.getByRole('button',{name:copy.resume})).toBeEnabled();
    fireEvent.click(screen.getByRole('button',{name:copy.resume}));await screen.findByRole('button',{name:copy.pause});expect(mocks.read).toHaveBeenCalledOnce();
    fireEvent.click(screen.getByRole('button',{name:copy.stop}));expect(screen.getByRole('button',{name:copy.listen})).toBeEnabled();expect(screen.getByRole('button',{name:copy.listen})).toHaveFocus();expect(revoke).toHaveBeenCalledWith('blob:synthetic-audio');expect(mounted.container.querySelector('audio')).not.toHaveAttribute('src');
  });
  it('cancels pending generation and never creates or plays a late URL when scope changes',async()=>{
    let resolve!:(value:Blob)=>void;mocks.read.mockReturnValue(new Promise<Blob>(done=>{resolve=done;}));
    const mounted=render(<InstitutionalResponseAudio scope={scope} copy={copy}/>);fireEvent.click(screen.getByRole('button',{name:copy.listen}));
    const pending=mocks.read.mock.calls[0][1];expect(pending.signal.aborted).toBe(false);
    mounted.rerender(<InstitutionalResponseAudio scope={{...scope,tenant:{id:702,slug:'other'}}} copy={copy}/>);expect(pending.signal.aborted).toBe(true);
    await act(async()=>{resolve(new Blob(['late']));});expect(create).not.toHaveBeenCalled();expect(HTMLMediaElement.prototype.play).not.toHaveBeenCalled();expect(screen.getByRole('button',{name:copy.listen})).toBeEnabled();
  });
  it('stops and releases playing audio on unmount',async()=>{
    const mounted=render(<InstitutionalResponseAudio scope={scope} copy={copy}/>);fireEvent.click(screen.getByRole('button',{name:copy.listen}));await screen.findByRole('button',{name:copy.pause});
    vi.mocked(HTMLMediaElement.prototype.pause).mockClear();mounted.unmount();expect(HTMLMediaElement.prototype.pause).toHaveBeenCalledOnce();expect(revoke).toHaveBeenCalledWith('blob:synthetic-audio');
  });
  it('cancels a previous reading before starting another and stops when selecting a menu choice',async()=>{
    let resolve!:(value:Blob)=>void;mocks.read.mockReturnValueOnce(new Promise<Blob>(done=>{resolve=done;}));
    const first=render(<InstitutionalResponseAudio scope={scope} copy={copy}/>);fireEvent.click(screen.getByRole('button',{name:copy.listen}));
    const pending=mocks.read.mock.calls[0][1];
    render(<InstitutionalChatMessage answer={{tenant:scope.tenant,revision:scope.revision,nodes:[node()],sources:node().sources,audioReading:copy}} onButtonClick={()=>{}}/>);
    expect(pending.signal.aborted).toBe(true);await act(async()=>{resolve(new Blob(['retired']));});expect(create).not.toHaveBeenCalled();
    first.unmount();fireEvent.click(screen.getByRole('button',{name:copy.listen}));await screen.findByRole('button',{name:copy.pause});
    fireEvent.click(screen.getByRole('button',{name:'1 Consultar requisitos'}));expect(revoke).toHaveBeenCalledWith('blob:synthetic-audio');expect(screen.getByRole('button',{name:copy.listen})).toBeEnabled();
  });
  it('keeps canonical text, sources and choices after an audio failure, without provider detail',async()=>{
    mocks.read.mockRejectedValue(new Error('PRIVATE_PROVIDER_FAILURE'));
    render(<InstitutionalChatMessage answer={{tenant:scope.tenant,revision:scope.revision,nodes:[node()],sources:node().sources,audioReading:copy}} onButtonClick={()=>{}}/>);
    fireEvent.click(screen.getByRole('button',{name:copy.listen}));await waitFor(()=>expect(screen.getByRole('alert')).toHaveTextContent(copy.error));
    expect(screen.getByText(node().text)).toBeVisible();expect(screen.getByRole('button',{name:'1 Consultar requisitos'})).toBeEnabled();expect(screen.queryByText('PRIVATE_PROVIDER_FAILURE')).not.toBeInTheDocument();
  });
  it('does not expose voice for an answer without a backend capability',()=>{
    render(<InstitutionalChatMessage answer={{tenant:scope.tenant,revision:scope.revision,nodes:[node()],sources:node().sources}} onButtonClick={()=>{}}/>);
    expect(screen.queryByRole('button',{name:copy.listen})).not.toBeInTheDocument();expect(mocks.read).not.toHaveBeenCalled();expect(screen.getByText(node().text)).toBeVisible();
  });
});
