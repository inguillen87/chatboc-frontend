import React from 'react';
import {act,cleanup,fireEvent,render,screen,waitFor} from '@testing-library/react';
import {beforeEach,afterEach,describe,expect,it,vi} from 'vitest';
import {guideActivation,guideAccess,guideCopy,guideNode} from '../../../tests/fixtures/private-guide.synthetic';
const mocks=vi.hoisted(()=>({fetch:vi.fn()}));
vi.mock('@/hooks/useUser',()=>({useUser:()=>({user:{id:1,rol:'admin'},hasVerifiedSession:true,organizationProfileVerified:true,loading:false})}));
vi.mock('@/utils/api',()=>({apiFetch:(...args:unknown[])=>mocks.fetch(...args)}));
import ChannelActivationChecklist from './ChannelActivationChecklist';
const deferred=()=>{let resolve!:(v:any)=>void,reject!:(v:any)=>void;const promise=new Promise<any>((a,b)=>{resolve=a;reject=b;});return {promise,resolve,reject};};
const open=async()=>{const d=screen.getByText(guideCopy.open).closest('details')!;await act(async()=>{d.open=true;fireEvent(d,new Event('toggle'));});};
const view=(actor='actor-a',slug='qa-guide')=><ChannelActivationChecklist tenantSlug={slug} privateGuideSessionKey={actor} presentation="launch-journey"/>;
beforeEach(()=>{mocks.fetch.mockReset();});afterEach(cleanup);
describe('guide integration in the activation checklist',()=>{
 it('waits for the current authorized activation read before publishing the entry',async()=>{
  const pending=deferred();mocks.fetch.mockReturnValueOnce(pending.promise).mockResolvedValueOnce(guideNode());
  render(<ChannelActivationChecklist tenantSlug="qa-guide" privateGuideSessionKey="actor-a" presentation="launch-journey" initialData={guideActivation() as any}/>);
  expect(screen.queryByText(guideCopy.open)).not.toBeInTheDocument();
  await act(async()=>{pending.resolve(guideActivation());await pending.promise;});
  await screen.findByText(guideCopy.open);expect(mocks.fetch).toHaveBeenCalledOnce();await open();
  expect(await screen.findByRole('heading',{name:'Nodo start'})).toBeVisible();expect(mocks.fetch).toHaveBeenCalledTimes(2);
 });
 it('does not treat initial profile data as permission when the current read is rejected',async()=>{
  mocks.fetch.mockRejectedValue(new Error('PRIVATE'));
  render(<ChannelActivationChecklist tenantSlug="qa-guide" privateGuideSessionKey="actor-a" presentation="launch-journey" initialData={guideActivation() as any}/>);
  await screen.findByRole('alert');expect(screen.queryByText(guideCopy.open)).not.toBeInTheDocument();expect(mocks.fetch).toHaveBeenCalledOnce();
 });
 it.each(['absent','wrong-tenant','no-session','overview'])('does not expose a guide for %s',async scenario=>{
  const data:any=guideActivation();if(scenario==='absent')delete data.organization_setup;
  if(scenario==='wrong-tenant')data.organization_setup.conversation_guide.tenant={id:702,slug:'other'};
  mocks.fetch.mockResolvedValue(data);
  render(<ChannelActivationChecklist tenantSlug="qa-guide" privateGuideSessionKey={scenario==='no-session'?'':'actor-a'} presentation={scenario==='overview'?'overview':'launch-journey'}/>);
  await waitFor(()=>expect(mocks.fetch).toHaveBeenCalledOnce());await act(async()=>{await Promise.resolve();});
  expect(screen.queryByText(guideCopy.open)).not.toBeInTheDocument();
 });
 it('removes an open guide while revalidating and after revocation',async()=>{
  mocks.fetch.mockResolvedValueOnce(guideActivation()).mockResolvedValueOnce(guideNode());
  render(view());await screen.findByText(guideCopy.open);await open();await screen.findByRole('heading',{name:'Nodo start'});
  const pending=deferred();mocks.fetch.mockReturnValueOnce(pending.promise);
  fireEvent.click(screen.getByRole('button',{name:'Actualizar',exact:true}));
  expect(screen.queryByTestId('private-guide-node')).not.toBeInTheDocument();
  const revoked:any=guideActivation();delete revoked.organization_setup;
  await act(async()=>{pending.resolve(revoked);await pending.promise;});
  expect(screen.queryByText(guideCopy.open)).not.toBeInTheDocument();
 });
 it('does not restore another actor descriptor after a delayed activation response',async()=>{
  const first=deferred();mocks.fetch.mockReturnValueOnce(first.promise).mockResolvedValueOnce({...guideActivation(),organization_setup:null});
  const rendered=render(view());await waitFor(()=>expect(mocks.fetch).toHaveBeenCalledOnce());rendered.rerender(view('actor-b'));
  await waitFor(()=>expect(mocks.fetch).toHaveBeenCalledTimes(2));
  await act(async()=>{first.resolve(guideActivation());await first.promise;});
  expect(screen.queryByText(guideCopy.open)).not.toBeInTheDocument();
 });
});
