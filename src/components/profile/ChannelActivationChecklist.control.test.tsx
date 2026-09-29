import React from 'react';
import {act,cleanup,render,screen,waitFor} from '@testing-library/react';
import {beforeEach,afterEach,describe,it,expect,vi} from 'vitest';
const mocks=vi.hoisted(()=>({fetch:vi.fn()}));
vi.mock('@/utils/api',()=>({apiFetch:(...args:unknown[])=>mocks.fetch(...args)}));
import ChannelActivationChecklist from './ChannelActivationChecklist';
import {tenant,descriptor,controlUi} from '../../../tests/fixtures/guide-control.synthetic';
const activation=()=>({contract_version:'tenant.channel_activation.v1',tenant,channels:[],conversation_guide_control:descriptor()});
const show=(session='verified')=><ChannelActivationChecklist tenantSlug={tenant.slug} privateGuideSessionKey={session} presentation="launch-journey" initialData={activation() as any}/>;
beforeEach(()=>{mocks.fetch.mockReset();});afterEach(cleanup);
describe('published management authority',()=>{
 it('does not turn initial profile data into permission',async()=>{
  mocks.fetch.mockRejectedValue(new Error('rejected'));render(show());await screen.findByRole('alert');
  expect(screen.queryByText(controlUi.open)).not.toBeInTheDocument();expect(mocks.fetch).toHaveBeenCalledOnce();
 });
 it('offers management only after the current read publishes it',async()=>{
  let resolve!:(value:unknown)=>void;mocks.fetch.mockReturnValue(new Promise(r=>{resolve=r;}));
  render(show());expect(screen.queryByText(controlUi.open)).not.toBeInTheDocument();
  await act(async()=>{resolve(activation());});await screen.findByText(controlUi.open);expect(mocks.fetch).toHaveBeenCalledOnce();
 });
 it.each(['no-session','no-descriptor'])('does not infer management for %s',async scenario=>{
  mocks.fetch.mockResolvedValue({...activation(),...(scenario==='no-descriptor'?{conversation_guide_control:null}:{})});
  render(show(scenario==='no-session'?'':'verified'));await waitFor(()=>expect(mocks.fetch).toHaveBeenCalledOnce());
  await act(async()=>{await Promise.resolve();});expect(screen.queryByText(controlUi.open)).not.toBeInTheDocument();
 });
});
