import React from 'react';
import {act,fireEvent,render,screen,waitFor,cleanup} from '@testing-library/react';
import {afterEach,beforeEach,describe,it,expect,vi} from 'vitest';
const mocks=vi.hoisted(()=>({fetch:vi.fn(),saved:vi.fn()}));
vi.mock('@/utils/api',()=>({apiFetch:(...args:unknown[])=>mocks.fetch(...args)}));
import PrivateGuideControl from './PrivateGuideControl';
import {readControlAccess} from '@/utils/privateGuideControl';
import {tenant,descriptor,control,receipt} from '../../../tests/fixtures/guide-control.synthetic';
const access=()=>readControlAccess(descriptor(),tenant)!;
const deferred=()=>{let resolve!:(v:unknown)=>void;const promise=new Promise(r=>{resolve=r;});return {promise,resolve};};
const show=()=>render(<PrivateGuideControl access={access()} sessionKey="verified-a" onSaved={mocks.saved}/>);
const load=async()=>{fireEvent.click(screen.getByRole('button',{name:'Abrir control QA'}));await screen.findByText('Deshabilitada QA');};
const review=()=>{fireEvent.click(screen.getByRole('button',{name:'Habilitar QA'}));fireEvent.click(screen.getByRole('checkbox',{name:'Acepto la evaluación QA'}));};
beforeEach(()=>{mocks.fetch.mockReset();mocks.saved.mockReset();});afterEach(cleanup);
describe('private guide control flow',()=>{
 it('does not read or write without an explicit opening and published access',()=>{
  const view=show();expect(mocks.fetch).not.toHaveBeenCalled();
  view.rerender(<PrivateGuideControl access={null} sessionKey="verified-a" onSaved={mocks.saved}/>);
  expect(screen.queryByRole('button')).not.toBeInTheDocument();
 });
 it('requires acknowledgement and cancellation performs no mutation',async()=>{
  mocks.fetch.mockResolvedValue(control());show();await load();
  fireEvent.click(screen.getByRole('button',{name:'Habilitar QA'}));
  expect(screen.getByRole('button',{name:'Confirmar QA'})).toBeDisabled();
  fireEvent.click(screen.getByRole('button',{name:'Cancelar QA'}));
  expect(mocks.fetch).toHaveBeenCalledOnce();expect(mocks.saved).not.toHaveBeenCalled();
 });
 it('performs preflight, one mutation and a confirming read',async()=>{
  const pending=deferred();mocks.fetch.mockResolvedValueOnce(control()).mockReturnValueOnce(pending.promise).mockResolvedValueOnce(receipt()).mockResolvedValueOnce(control(true,1));
  show();await load();review();const button=screen.getByRole('button',{name:'Confirmar QA'});
  act(()=>{button.dispatchEvent(new MouseEvent('click',{bubbles:true}));button.dispatchEvent(new MouseEvent('click',{bubbles:true}));});
  expect(mocks.fetch).toHaveBeenCalledTimes(2);
  await act(async()=>{pending.resolve(control());await pending.promise;});
  await screen.findByText('Confirmado QA');expect(mocks.saved).toHaveBeenCalledOnce();
  const writes=mocks.fetch.mock.calls.filter(call=>call[1].method==='PUT');expect(writes).toHaveLength(1);
  expect(writes[0][1].body).toMatchObject({tenant,enabled:true,expected_revision:control().revision,acknowledge_evaluation_only:true});
  expect(mocks.fetch).toHaveBeenCalledTimes(4);
 });
 it('does not send a mutation after a preflight revision change',async()=>{
  mocks.fetch.mockResolvedValueOnce(control()).mockResolvedValueOnce(control(false,2));show();await load();review();fireEvent.click(screen.getByRole('button',{name:'Confirmar QA'}));
  await screen.findByRole('alert');expect(mocks.fetch).toHaveBeenCalledTimes(2);expect(mocks.saved).not.toHaveBeenCalled();
  expect(screen.queryByRole('button',{name:'Habilitar QA'})).not.toBeInTheDocument();
 });
 it('never retries an uncertain write or announces unverified success',async()=>{
  mocks.fetch.mockResolvedValueOnce(control()).mockResolvedValueOnce(control()).mockRejectedValueOnce(new Error('PRIVATE RESPONSE'));
  show();await load();review();fireEvent.click(screen.getByRole('button',{name:'Confirmar QA'}));
  expect(await screen.findByRole('alert')).toHaveTextContent('No confirmado QA');expect(screen.queryByText('PRIVATE RESPONSE')).not.toBeInTheDocument();
  expect(mocks.fetch).toHaveBeenCalledTimes(3);expect(mocks.saved).not.toHaveBeenCalled();
 });
 it('discards an old-session preflight without making a write',async()=>{
  const pending=deferred();mocks.fetch.mockResolvedValueOnce(control()).mockReturnValueOnce(pending.promise);
  const view=show();await load();review();fireEvent.click(screen.getByRole('button',{name:'Confirmar QA'}));
  view.rerender(<PrivateGuideControl access={access()} sessionKey="verified-b" onSaved={mocks.saved}/>);
  await act(async()=>{pending.resolve(control());await pending.promise;});
  expect(mocks.fetch).toHaveBeenCalledTimes(2);expect(mocks.saved).not.toHaveBeenCalled();expect(screen.getByRole('button',{name:'Abrir control QA'})).toBeVisible();
 });
 it('requires final readback before notifying its parent',async()=>{
  mocks.fetch.mockResolvedValueOnce(control()).mockResolvedValueOnce(control()).mockResolvedValueOnce(receipt()).mockResolvedValueOnce(control(false,2));
  show();await load();review();fireEvent.click(screen.getByRole('button',{name:'Confirmar QA'}));
  await screen.findByRole('alert');expect(mocks.saved).not.toHaveBeenCalled();
 });
 it('respects server denial and does not retain data after access is removed',async()=>{
  mocks.fetch.mockResolvedValue({...control(),can_enable:false,can_disable:false});const view=show();await load();
  expect(screen.queryByRole('button',{name:'Habilitar QA'})).not.toBeInTheDocument();
  view.rerender(<PrivateGuideControl access={null} sessionKey="verified-a" onSaved={mocks.saved}/>);
  expect(screen.queryByText('Documento QA')).not.toBeInTheDocument();
 });
});

describe('reviewed source and confirmed changes',()=>{
 it('requires a new review when the source changes without a configuration change',async()=>{
  const changed=control();changed.installed_guide.source.sha256='f'.repeat(64);
  mocks.fetch.mockResolvedValueOnce(control()).mockResolvedValueOnce(changed);
  show();await load();review();fireEvent.click(screen.getByRole('button',{name:'Confirmar QA'}));
  await screen.findByRole('alert');expect(mocks.fetch).toHaveBeenCalledTimes(2);expect(mocks.saved).not.toHaveBeenCalled();
 });
 it('does not accept a new artifact in the mutation receipt',async()=>{
  const changed=receipt();changed.control.installed_guide.guide_sha256='f'.repeat(64);
  mocks.fetch.mockResolvedValueOnce(control()).mockResolvedValueOnce(control()).mockResolvedValueOnce(changed);
  show();await load();review();fireEvent.click(screen.getByRole('button',{name:'Confirmar QA'}));
  await screen.findByRole('alert');expect(mocks.fetch).toHaveBeenCalledTimes(3);expect(mocks.saved).not.toHaveBeenCalled();
 });
 it('can revoke a guide whose file has become unavailable',async()=>{
  const enabled={...control(true,1),can_enable:false,installed_guide:null};
  const disabled={...control(false,2),can_enable:false,installed_guide:null};
  mocks.fetch.mockResolvedValueOnce(enabled).mockResolvedValueOnce(enabled).mockResolvedValueOnce({...receipt(false,2),control:disabled}).mockResolvedValueOnce(disabled);
  show();fireEvent.click(screen.getByRole('button',{name:'Abrir control QA'}));await screen.findByText('Habilitada QA');
  fireEvent.click(screen.getByRole('button',{name:'Deshabilitar QA'}));fireEvent.click(screen.getByRole('checkbox'));fireEvent.click(screen.getByRole('button',{name:'Confirmar QA'}));
  await screen.findByText('Confirmado QA');expect(mocks.saved).toHaveBeenCalledOnce();
  const body=mocks.fetch.mock.calls.find(call=>call[1].method==='PUT')![1].body;
  expect(body.enabled).toBe(false);expect(body).not.toHaveProperty('expected_guide_sha256');
 });
});
