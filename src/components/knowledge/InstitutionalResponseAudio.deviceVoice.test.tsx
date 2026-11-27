import React from 'react';
import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
import {cleanup,fireEvent,render,screen,waitFor} from '@testing-library/react';

const readAudio=vi.fn();
vi.mock('./institutionalAssistantAudio',()=>({readInstitutionalAudio:(...args:unknown[])=>readAudio(...args)}));
import {InstitutionalResponseAudio} from './InstitutionalResponseAudio';

const copy={contract_version:'chatboc.institutional_audio.v1',disclosure:'Voz generada por IA.',listen:'Escuchar',
  loading:'Preparando audio',pause:'Pausar',resume:'Continuar',stop:'Detener',error:'No se pudo preparar el audio.'} as never;
const scope={tenant:{id:46,slug:'tierra-del-fuego'},revision:'a'.repeat(64),nodeIds:['rupe']};

describe('device voice when the recorded reading is unavailable',()=>{
  const spoken:Array<{text:string;lang:string;onend?:()=>void}>=[];
  const synth={cancel:vi.fn(),pause:vi.fn(),resume:vi.fn(),speak:vi.fn((u:never)=>{spoken.push(u);})};
  beforeEach(()=>{
    spoken.length=0;readAudio.mockReset();readAudio.mockRejectedValue(new Error('knowledge_audio_response_invalid'));
    vi.stubGlobal('speechSynthesis',synth);
    vi.stubGlobal('SpeechSynthesisUtterance',class{text:string;lang='';rate=1;onend?:()=>void;onerror?:()=>void;constructor(text:string){this.text=text;}});
  });
  afterEach(()=>{cleanup();vi.unstubAllGlobals();vi.clearAllMocks();});

  it('reads the published text in Spanish and says whose voice it is',async()=>{
    render(<InstitutionalResponseAudio scope={scope} copy={copy} fallbackText={'Pensión RUPE. • Requisitos y contactos.'}/>);
    fireEvent.click(screen.getByRole('button',{name:'Escuchar'}));
    await waitFor(()=>expect(synth.speak).toHaveBeenCalledTimes(1));
    expect(spoken[0].text).toBe('Pensión RUPE. Requisitos y contactos.');
    expect(spoken[0].lang).toBe('es-AR');
    expect(screen.getByText('Se lee con la voz de este dispositivo.')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).toBeNull();
    fireEvent.click(screen.getByRole('button',{name:'Pausar'}));
    expect(synth.pause).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('button',{name:'Continuar'}));
    expect(synth.resume).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('button',{name:'Detener'}));
    expect(screen.getByRole('button',{name:'Escuchar'})).toBeInTheDocument();
  });

  it('keeps the error when there is no text or no device voice',async()=>{
    render(<InstitutionalResponseAudio scope={scope} copy={copy}/>);
    fireEvent.click(screen.getByRole('button',{name:'Escuchar'}));
    expect(await screen.findByRole('alert')).toHaveTextContent('No se pudo preparar el audio.');
    expect(synth.speak).not.toHaveBeenCalled();
  });
});
