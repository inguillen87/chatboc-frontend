import React from 'react';
import {act,cleanup,fireEvent,render,screen,waitFor} from '@testing-library/react';
import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
import {guideAccess,guideCopy,guideTenant,guideNode} from '../../../tests/fixtures/private-guide.synthetic';
import {readGuideAccess} from '@/utils/privateConversationGuide';
const mocks=vi.hoisted(()=>({fetch:vi.fn()}));
vi.mock('@/utils/api',()=>({apiFetch:(...args:unknown[])=>mocks.fetch(...args)}));
import PrivateConversationGuide from './PrivateConversationGuide';
const access=readGuideAccess(guideAccess,guideTenant)!;
const deferred=()=>{let resolve!:(value:any)=>void;const promise=new Promise<any>(r=>{resolve=r;});return {promise,resolve};};
const open=async()=>{const element=screen.getByText(guideCopy.open).closest('details')!;await act(async()=>{element.open=true;fireEvent(element,new Event('toggle'));});};
const close=async()=>{const element=screen.getByText(guideCopy.open).closest('details')!;await act(async()=>{element.open=false;fireEvent(element,new Event('toggle'));});};
beforeEach(()=>{mocks.fetch.mockReset();localStorage.clear();sessionStorage.clear();});
afterEach(()=>{cleanup();vi.useRealTimers();});
describe('private guide reader',()=>{
 it('does not fetch until the published disclosure is opened',async()=>{
  mocks.fetch.mockResolvedValue(guideNode());render(<PrivateConversationGuide access={access} sessionKey="actor-a"/>);
  expect(mocks.fetch).not.toHaveBeenCalled();await open();
  expect(await screen.findByRole('heading',{name:'Nodo start'})).toHaveFocus();
  expect(mocks.fetch).toHaveBeenCalledWith(access.endpoint+'?node=start',expect.objectContaining({tenantSlug:'qa-guide',cache:'no-store',persistTenantSlug:false}));
  expect(localStorage.length).toBe(0);expect(sessionStorage.length).toBe(0);
 });
 it('renders nothing without an authorized session or descriptor',()=>{
  const view=render(<PrivateConversationGuide access={access} sessionKey=""/>);expect(view.container).toBeEmptyDOMElement();
  view.rerender(<PrivateConversationGuide access={null} sessionKey="actor-a"/>);expect(view.container).toBeEmptyDOMElement();expect(mocks.fetch).not.toHaveBeenCalled();
 });
 it('uses the published current node and choice, and blocks consecutive clicks',async()=>{
  const pending=deferred();mocks.fetch.mockResolvedValueOnce(guideNode()).mockReturnValueOnce(pending.promise);
  render(<PrivateConversationGuide access={access} sessionKey="actor-a"/>);await open();
  const button=await screen.findByRole('button',{name:'Consultar requisitos QA'});
  act(()=>{button.dispatchEvent(new MouseEvent('click',{bubbles:true}));button.dispatchEvent(new MouseEvent('click',{bubbles:true}));});
  expect(mocks.fetch).toHaveBeenCalledTimes(2);expect(mocks.fetch.mock.calls[1][0]).toBe(access.endpoint+'?node=start&selection=1');
  expect(screen.queryByTestId('private-guide-node')).not.toBeInTheDocument();
  await act(async()=>{pending.resolve(guideNode('requirements'));await pending.promise;});
  expect(await screen.findByRole('heading',{name:'Nodo requirements'})).toHaveFocus();
 });
 it.each(['session','descriptor','closed'])('discards a pending response after %s changes',async mode=>{
  const pending=deferred();mocks.fetch.mockReturnValueOnce(pending.promise);
  const view=render(<PrivateConversationGuide access={access} sessionKey="actor-a"/>);await open();
  if(mode==='session')view.rerender(<PrivateConversationGuide access={access} sessionKey="actor-b"/>);
  else if(mode==='descriptor')view.rerender(<PrivateConversationGuide access={null} sessionKey="actor-a"/>);
  else await close();
  await act(async()=>{pending.resolve(guideNode());await pending.promise;});
  expect(screen.queryByText('Contenido de evaluación: start.')).not.toBeInTheDocument();
  expect(mocks.fetch).toHaveBeenCalledOnce();expect(localStorage.length).toBe(0);
 });
 it('shows only published failure copy and starts a new read after reopening',async()=>{
  mocks.fetch.mockRejectedValueOnce(new Error('PRIVATE SERVER BODY')).mockResolvedValueOnce(guideNode());
  render(<PrivateConversationGuide access={access} sessionKey="actor-a"/>);await open();
  expect(await screen.findByRole('alert')).toHaveTextContent(guideCopy.error);expect(screen.queryByText(/PRIVATE/)).not.toBeInTheDocument();
  await close();await open();expect(await screen.findByRole('heading',{name:'Nodo start'})).toBeVisible();
 });
 it.each(['hash','source','node'])('refuses a mixed or unexpected %s after navigation',async mode=>{
  const changed=guideNode('requirements');if(mode==='hash')changed.guide_sha256='c'.repeat(64);
  if(mode==='source')changed.source.sha256='c'.repeat(64);if(mode==='node')changed.menu.id='unexpected';
  mocks.fetch.mockResolvedValueOnce(guideNode()).mockResolvedValueOnce(changed);
  render(<PrivateConversationGuide access={access} sessionKey="actor-a"/>);await open();
  fireEvent.click(await screen.findByRole('button',{name:'Consultar requisitos QA'}));
  expect(await screen.findByRole('alert')).toHaveTextContent(guideCopy.error);expect(screen.queryByTestId('private-guide-node')).not.toBeInTheDocument();
 });
 it('unmounts content when the same guide descriptor is revoked and republished',async()=>{
  mocks.fetch.mockResolvedValue(guideNode());const view=render(<PrivateConversationGuide access={access} sessionKey="actor-a"/>);await open();
  await screen.findByRole('heading',{name:'Nodo start'});view.rerender(<PrivateConversationGuide access={null} sessionKey="actor-a"/>);
  view.rerender(<PrivateConversationGuide access={access} sessionKey="actor-a"/>);expect(mocks.fetch).toHaveBeenCalledOnce();expect(screen.queryByTestId('private-guide-node')).not.toBeInTheDocument();
 });
 it('survives StrictMode setup/cleanup without a stuck request lock',async()=>{
  mocks.fetch.mockResolvedValue(guideNode());render(<React.StrictMode><PrivateConversationGuide access={access} sessionKey="actor-a"/></React.StrictMode>);await open();
  expect(await screen.findByRole('heading',{name:'Nodo start'})).toBeVisible();
  expect(screen.getByRole('button',{name:guideCopy.start})).toBeEnabled();
 });
 it('can traverse 29 synthetic nodes without persisting conversation content',async()=>{
  let index=0;mocks.fetch.mockImplementation(async()=>{const value=guideNode(index===0?'start':`node-${index}`);index++;
    value.menu.actions=index<29?[{code:'1',label:'Continuar QA',target:`node-${index}`}]:[];return value;});
  render(<PrivateConversationGuide access={access} sessionKey="actor-a"/>);await open();
  for(let step=1;step<29;step++)fireEvent.click(await screen.findByRole('button',{name:'Continuar QA'}));
  await waitFor(()=>expect(screen.getByTestId('private-guide-node')).toHaveAttribute('data-node','node-28'));
  expect(mocks.fetch).toHaveBeenCalledTimes(29);expect(localStorage.length).toBe(0);expect(sessionStorage.length).toBe(0);
 });
});
