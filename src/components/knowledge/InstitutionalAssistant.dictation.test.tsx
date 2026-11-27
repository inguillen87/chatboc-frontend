import React from 'react';
import {act,cleanup,fireEvent,render,screen} from '@testing-library/react';
import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
import {workspace} from '../../../tests/fixtures/institutional-assistant.synthetic';
const transport=vi.hoisted(()=>({fetch:vi.fn()}));
vi.mock('@/utils/api',()=>({apiFetch:(...args:unknown[])=>transport.fetch(...args)}));
import InstitutionalAssistant from '@/components/knowledge/InstitutionalAssistant';

class FakeRecognition{
  static last:FakeRecognition|null=null;
  lang='';interimResults=true;maxAlternatives=0;
  onresult:((event:unknown)=>void)|null=null;onerror:((event:unknown)=>void)|null=null;onend:(()=>void)|null=null;
  start=vi.fn(()=>{FakeRecognition.last=this;});stop=vi.fn(()=>{this.onend?.();});abort=vi.fn();
}
beforeEach(()=>{transport.fetch.mockReset();FakeRecognition.last=null;});
afterEach(()=>{cleanup();vi.unstubAllGlobals();});

describe('dictating a question',()=>{
  it('puts the spoken words in the field without sending them',async()=>{
    vi.stubGlobal('SpeechRecognition',FakeRecognition);
    const value=workspace({visibility:'public',can_edit:false});transport.fetch.mockResolvedValue(value);
    render(<InstitutionalAssistant tenantSlug={value.tenant.slug} mode="public"/>);
    const field=await screen.findByLabelText('Escribí tu consulta');
    const calls=transport.fetch.mock.calls.length;
    fireEvent.click(screen.getByRole('button',{name:'Dictar'}));
    expect(FakeRecognition.last?.lang).toBe('es-AR');
    expect(screen.getByRole('button',{name:'Terminar'})).toHaveAttribute('aria-pressed','true');
    act(()=>{FakeRecognition.last?.onresult?.({results:[[{transcript:'  necesito   el certificado '}]]});FakeRecognition.last?.onend?.();});
    expect(field).toHaveValue('necesito el certificado');
    expect(screen.getByRole('button',{name:'Dictar'})).toHaveAttribute('aria-pressed','false');
    expect(transport.fetch.mock.calls.length).toBe(calls);
  });
  it('explains a blocked microphone and is absent where the browser cannot listen',async()=>{
    vi.stubGlobal('SpeechRecognition',FakeRecognition);
    const value=workspace({visibility:'public',can_edit:false});transport.fetch.mockResolvedValue(value);
    const first=render(<InstitutionalAssistant tenantSlug={value.tenant.slug} mode="public"/>);
    await screen.findByLabelText('Escribí tu consulta');
    fireEvent.click(screen.getByRole('button',{name:'Dictar'}));
    act(()=>{FakeRecognition.last?.onerror?.({error:'not-allowed'});FakeRecognition.last?.onend?.();});
    expect(screen.getByText('Para dictar, permití el uso del micrófono en el navegador.')).toBeInTheDocument();
    first.unmount();vi.unstubAllGlobals();
    render(<InstitutionalAssistant tenantSlug={value.tenant.slug} mode="public"/>);
    await screen.findByLabelText('Escribí tu consulta');
    expect(screen.queryByRole('button',{name:'Dictar'})).toBeNull();
  });
});
