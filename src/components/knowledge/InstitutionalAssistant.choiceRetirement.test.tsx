import React from 'react';
import {act,cleanup,fireEvent,render,screen,waitFor} from '@testing-library/react';
import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
import {workspace,reply} from '../../../tests/fixtures/institutional-assistant.synthetic';
const mocks=vi.hoisted(()=>({fetch:vi.fn()}));
vi.mock('@/utils/api',async original=>({...await original<typeof import('@/utils/api')>(),apiFetch:(...args:unknown[])=>mocks.fetch(...args)}));
import InstitutionalAssistant from './InstitutionalAssistant';
const published=()=>workspace({visibility:'public',can_edit:false});
const deferred=()=>{let resolve!:(value:unknown)=>void;const promise=new Promise<unknown>(done=>{resolve=done;});return{promise,resolve};};
beforeEach(()=>{mocks.fetch.mockReset();mocks.fetch.mockResolvedValueOnce(published());});
afterEach(()=>{cleanup();vi.restoreAllMocks();});

describe('owned choice retirement before native blur',()=>{
 it.each(['owned','tab','wheel','pointer'] as const)('preserves %s intent when the busy render removes the exact focused choice',async intent=>{
  render(<InstitutionalAssistant tenantSlug="qa-knowledge" mode="public"/>);
  const origin=await screen.findByRole('button',{name:'1 Consultar requisitos'}),pending=deferred();
  mocks.fetch.mockReturnValueOnce(pending.promise);
  // Model Chromium's connected/enabled blur at DOM removal. The actual portal
  // regression is independently measured by the controlled browser fixture.
  const removeChild=Node.prototype.removeChild;let nativeBlur=0;
  vi.spyOn(Node.prototype,'removeChild').mockImplementation(function<T extends Node>(child:T):T{
   if(child instanceof Element&&child.contains(origin)&&document.activeElement===origin){
    expect(origin.isConnected).toBe(true);expect(origin.disabled).toBe(false);
    origin.blur();nativeBlur++;
   }
   return removeChild.call(this,child) as T;
  });
  origin.focus();fireEvent.click(origin);
  expect(nativeBlur).toBe(1);expect(document.activeElement).toBe(document.body);
  expect(screen.queryByRole('button',{name:'1 Consultar requisitos'})).not.toBeInTheDocument();
  if(intent==='tab')fireEvent.keyDown(document.body,{key:'Tab'});
  if(intent==='wheel')fireEvent.wheel(document.body);
  if(intent==='pointer')fireEvent.pointerDown(document.body);
  await act(async()=>{pending.resolve(reply('requirements',published()));await pending.promise;});
  const heading=await screen.findByRole('heading',{name:'Requisitos de la consulta'});
  if(intent==='owned')await waitFor(()=>expect(heading).toHaveFocus());
  else{await act(async()=>{await new Promise(resolve=>requestAnimationFrame(()=>resolve(undefined)));});expect(heading).not.toHaveFocus();}
  expect(mocks.fetch).toHaveBeenCalledTimes(2);expect(mocks.fetch.mock.calls[1][1].method).toBe('GET');
 });
});
