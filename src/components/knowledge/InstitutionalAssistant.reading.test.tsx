import React from 'react';
import {act,cleanup,fireEvent,render,screen,waitFor} from '@testing-library/react';
import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
import {workspace,node,reply} from '../../../tests/fixtures/institutional-assistant.synthetic';
const mocks=vi.hoisted(()=>({fetch:vi.fn()}));
vi.mock('@/utils/api',()=>({apiFetch:(...args:unknown[])=>mocks.fetch(...args)}));
import InstitutionalAssistant from './InstitutionalAssistant';
const view=(sessionKey='actor-a')=><InstitutionalAssistant tenantSlug="qa-knowledge" sessionKey={sessionKey}/>;
const deferred=()=>{let resolve!:(value:any)=>void;const promise=new Promise<any>(r=>{resolve=r;});return{promise,resolve};};
beforeEach(()=>{mocks.fetch.mockReset();mocks.fetch.mockResolvedValue(workspace());});afterEach(cleanup);
describe('institutional reading and review',()=>{
 it('opens sources as a labelled dialog, preserving draft and returning focus',async()=>{
  render(view());const input=await screen.findByLabelText('Escribí tu consulta');
  fireEvent.change(input,{target:{value:'Consulta que todavía estoy escribiendo'}});
  const trigger=screen.getByRole('button',{name:'Documentos y fuentes'});trigger.focus();fireEvent.click(trigger);
  const dialog=await screen.findByRole('dialog',{name:'Documentos y fuentes'});
  expect(dialog).toBeVisible();expect(screen.getByRole('heading',{name:'Documentos y fuentes'})).toHaveFocus();
  fireEvent.keyDown(dialog,{key:'Escape'});
  await waitFor(()=>expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  await waitFor(()=>expect(trigger).toHaveFocus());expect(input).toHaveValue('Consulta que todavía estoy escribiendo');
  expect(mocks.fetch).toHaveBeenCalledOnce();
 });
 it('focuses cancel and blocks a background submission during publication review',async()=>{
  render(view());const input=await screen.findByLabelText('Escribí tu consulta');
  fireEvent.change(input,{target:{value:'Pregunta en borrador'}});const form=input.closest('form')!;
  const trigger=screen.getByRole('button',{name:'Habilitar en el agente'});trigger.focus();fireEvent.click(trigger);
  await screen.findByRole('dialog',{name:'Habilitar en el agente'});
  expect(screen.getByRole('button',{name:'Cancelar'})).toHaveFocus();
  fireEvent.submit(form);expect(mocks.fetch).toHaveBeenCalledOnce();
  fireEvent.click(screen.getByRole('button',{name:'Cancelar'}));
  await waitFor(()=>expect(trigger).toHaveFocus());expect(input).toHaveValue('Pregunta en borrador');
 });
 it('announces and focuses a source-uncovered answer instead of losing keyboard position',async()=>{
  render(view());const input=await screen.findByLabelText('Escribí tu consulta');
  mocks.fetch.mockResolvedValueOnce({...reply(),nodes:[],text:workspace().ui.unknown});
  fireEvent.change(input,{target:{value:'¿Y un dato no documentado?'}});fireEvent.submit(input.closest('form')!);
  const notice=await screen.findByText(workspace().ui.unknown);
  await waitFor(()=>expect(notice).toHaveFocus());expect(notice).toHaveAttribute('role','status');
 });
 it('uses a multiline question field and does not submit with Shift+Enter or composition',async()=>{
  render(view());const input=await screen.findByLabelText('Escribí tu consulta');expect(input.tagName).toBe('TEXTAREA');
  fireEvent.change(input,{target:{value:'Primera línea\nSegunda línea'}});
  fireEvent.keyDown(input,{key:'Enter',shiftKey:true});fireEvent.keyDown(input,{key:'Enter',isComposing:true,keyCode:229});
  expect(mocks.fetch).toHaveBeenCalledOnce();mocks.fetch.mockResolvedValueOnce(reply());
  fireEvent.keyDown(input,{key:'Enter'});await screen.findByRole('heading',{name:'Requisitos de la consulta'});
  expect(mocks.fetch).toHaveBeenCalledTimes(2);expect(mocks.fetch.mock.calls[1][1].body.question).toContain('\n');
 });
 it('removes the source dialog when the verified actor changes',async()=>{
  const mounted=render(view());await screen.findByText(node().text);
  fireEvent.click(screen.getByRole('button',{name:'Documentos y fuentes'}));await screen.findByRole('dialog');
  mocks.fetch.mockResolvedValueOnce(workspace({tenant:{id:701,slug:'qa-knowledge',name:'Nueva sesión'}}));mounted.rerender(view('actor-b'));
  await screen.findByText('Nueva sesión');expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
 });
 it('locks navigation while the selected import is being read, without uploading it',async()=>{
  const mounted=render(view());await screen.findByText(node().text);const pending=deferred();
  const file=new File(['{}'],'version.json',{type:'application/json'});Object.defineProperty(file,'text',{value:()=>pending.promise});
  fireEvent.change(mounted.container.querySelector('input[type=file]')!,{target:{files:[file]}});
  const topic=screen.getByRole('button',{name:'Documentación y requisitos'});expect(topic).toBeDisabled();
  fireEvent.click(topic);expect(mocks.fetch).toHaveBeenCalledOnce();
  await act(async()=>{pending.resolve('{}');await pending.promise;});await screen.findByRole('dialog',{name:'Incorporar conocimiento'});
  expect(mocks.fetch).toHaveBeenCalledOnce();
 });
});

describe('reading boundaries',()=>{
 it('keeps input labels unique for two surfaces of the same organization',async()=>{
  const instance=render(<>{view('one')}{view('two')}</>);const inputs=await screen.findAllByLabelText('Escribí tu consulta');
  expect(inputs).toHaveLength(2);expect(new Set(inputs.map(input=>input.id)).size).toBe(2);
  expect(instance.container.querySelectorAll('textarea')).toHaveLength(2);
 });
 it('does not confirm after the reviewed organization session has been removed',async()=>{
  const mounted=render(view());await screen.findByText(node().text);
  fireEvent.click(screen.getByRole('button',{name:'Habilitar en el agente'}));const confirm=await screen.findByRole('button',{name:'Confirmar cambio'});
  mounted.rerender(<InstitutionalAssistant tenantSlug="qa-knowledge"/>);fireEvent.click(confirm);
  expect(mocks.fetch).toHaveBeenCalledOnce();expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
 });
 it('discards a file preparation that completes after a session change',async()=>{
  const mounted=render(view());await screen.findByText(node().text);const pending=deferred();
  const file=new File(['{}'],'version.json',{type:'application/json'});Object.defineProperty(file,'text',{value:()=>pending.promise});
  fireEvent.change(mounted.container.querySelector('input[type=file]')!,{target:{files:[file]}});
  mocks.fetch.mockResolvedValueOnce(workspace({tenant:{id:701,slug:'qa-knowledge',name:'Nueva cuenta'}}));mounted.rerender(view('other'));
  await screen.findByText('Nueva cuenta');await act(async()=>{pending.resolve('{}');await pending.promise;});
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();expect(mocks.fetch.mock.calls.filter(call=>call[1]?.method==='PUT')).toHaveLength(0);
 });
});
describe('focus after an unconfirmed change',()=>{
 it('moves focus to the existing error without retrying the publication',async()=>{
  render(view());await screen.findByText(node().text);
  fireEvent.click(screen.getByRole('button',{name:'Habilitar en el agente'}));
  const confirm=await screen.findByRole('button',{name:'Confirmar cambio'});
  mocks.fetch.mockRejectedValueOnce(new Error('PRIVATE NETWORK DETAIL'));
  fireEvent.click(confirm);fireEvent.click(confirm);
  const alert=await screen.findByRole('alert');await waitFor(()=>expect(alert).toHaveFocus());
  expect(mocks.fetch.mock.calls.filter(call=>call[1]?.method==='PUT')).toHaveLength(1);
  expect(screen.queryByText('PRIVATE NETWORK DETAIL')).not.toBeInTheDocument();
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
 });
});
