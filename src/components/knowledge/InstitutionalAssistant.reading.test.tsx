import React from 'react';
import {act,cleanup,fireEvent,render,screen,waitFor,within} from '@testing-library/react';
import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
import {workspace,node,reply} from '../../../tests/fixtures/institutional-assistant.synthetic';
const mocks=vi.hoisted(()=>({fetch:vi.fn()}));
vi.mock('@/utils/api',()=>({apiFetch:(...args:unknown[])=>mocks.fetch(...args)}));
import InstitutionalAssistant from './InstitutionalAssistant';
const view=(sessionKey='actor-a')=><InstitutionalAssistant tenantSlug="qa-knowledge" sessionKey={sessionKey}/>;
const deferred=()=>{let resolve!:(value:any)=>void;const promise=new Promise<any>(r=>{resolve=r;});return{promise,resolve};};
beforeEach(()=>{mocks.fetch.mockReset();mocks.fetch.mockResolvedValue(workspace());});afterEach(cleanup);
describe('institutional reading and review',()=>{
 it('keeps enlarged source reading local to its assistant and preserves the draft and focus',async()=>{
  render(<>{view('large-reader')}{view('regular-reader')}</>);
  await screen.findAllByLabelText('Escribí tu consulta');
  const [largeReader,regularReader]=screen.getAllByTestId('institutional-assistant');
  const first=within(largeReader),second=within(regularReader);
  const input=first.getByLabelText('Escribí tu consulta');
  fireEvent.change(input,{target:{value:'Consulta en borrador'}});
  fireEvent.click(first.getByRole('button',{name:'Texto ampliado'}));
  const sourceTrigger=first.getByRole('button',{name:'Documentos y fuentes'});
  fireEvent.click(sourceTrigger);
  const enlarged=await screen.findByRole('dialog',{name:'Documentos y fuentes'});
  expect(enlarged).toHaveClass('institutional-assistant-dialog--large');
  fireEvent.keyDown(enlarged,{key:'Escape'});
  await waitFor(()=>expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  await waitFor(()=>expect(sourceTrigger).toHaveFocus());
  expect(input).toHaveValue('Consulta en borrador');
  fireEvent.click(second.getByRole('button',{name:'Documentos y fuentes'}));
  const regular=await screen.findByRole('dialog',{name:'Documentos y fuentes'});
  expect(regular).not.toHaveClass('institutional-assistant-dialog--large');
  fireEvent.keyDown(regular,{key:'Escape'});
  await waitFor(()=>expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  expect(first.getByRole('button',{name:'Texto ampliado'})).toHaveAttribute('aria-pressed','true');
  expect(second.getByRole('button',{name:'Texto ampliado'})).toHaveAttribute('aria-pressed','false');
  expect(mocks.fetch).toHaveBeenCalledTimes(2);
 });
 it('carries enlarged reading into the review without changing confirmation or draft behavior',async()=>{
  render(view());const input=await screen.findByLabelText('Escribí tu consulta');
  fireEvent.change(input,{target:{value:'Borrador conservado'}});
  fireEvent.click(screen.getByRole('button',{name:'Texto ampliado'}));
  const trigger=screen.getByRole('button',{name:'Habilitar en el agente'});
  fireEvent.click(trigger);
  expect(await screen.findByRole('dialog',{name:'Habilitar en el agente'})).toHaveClass('institutional-assistant-dialog--large');
  expect(screen.getByRole('button',{name:'Cancelar'})).toHaveFocus();
  fireEvent.submit(input.closest('form')!);
  expect(mocks.fetch).toHaveBeenCalledOnce();
  fireEvent.click(screen.getByRole('button',{name:'Cancelar'}));
  await waitFor(()=>expect(trigger).toHaveFocus());
  expect(input).toHaveValue('Borrador conservado');
  expect(screen.getByRole('button',{name:'Texto ampliado'})).toHaveAttribute('aria-pressed','true');
 });
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

describe('explicit workspace recovery focus',()=>{
 it('focuses the mounted result after an initial failure and a deferred retry GET',async()=>{
  mocks.fetch.mockRejectedValueOnce(new Error('read failed'));render(view());
  const retry=await screen.findByRole('button',{name:'Reintentar'}),pending=deferred();
  mocks.fetch.mockReturnValueOnce(pending.promise);retry.focus();fireEvent.click(retry);
  expect(screen.queryByRole('button',{name:'Reintentar'})).not.toBeInTheDocument();
  expect(screen.queryByRole('heading',{name:node().title})).not.toBeInTheDocument();
  expect(mocks.fetch.mock.calls.map(call=>call[1].method)).toEqual(['GET','GET']);
  await act(async()=>{pending.resolve(workspace());await pending.promise;});
  const result=await screen.findByRole('heading',{name:node().title});
  await waitFor(()=>expect(result).toHaveFocus());
 });
 it('recovers a rejected question with a fresh GET and focuses its new revision without re-POSTing',async()=>{
  render(view());const input=await screen.findByLabelText('Escribí tu consulta');
  mocks.fetch.mockRejectedValueOnce({status:412});fireEvent.change(input,{target:{value:'Consulta de la revisión anterior'}});fireEvent.submit(input.closest('form')!);
  const alert=await screen.findByRole('alert');await waitFor(()=>expect(alert).toHaveFocus());
  const retry=screen.getByRole('button',{name:'Volver a consultar'}),pending=deferred();
  mocks.fetch.mockReturnValueOnce(pending.promise);retry.focus();fireEvent.click(retry);
  expect(mocks.fetch.mock.calls.map(call=>call[1].method)).toEqual(['GET','POST','GET']);
  expect(mocks.fetch.mock.calls[2][0]).toBe('/api/admin/tenants/qa-knowledge/institutional-assistant');
  const fresh=workspace({revision:'c'.repeat(64)});fresh.knowledge!.initial.title='Menú de la revisión recuperada';
  await act(async()=>{pending.resolve(fresh);await pending.promise;});
  const result=await screen.findByRole('heading',{name:'Menú de la revisión recuperada'});
  await waitFor(()=>expect(result).toHaveFocus());expect(screen.getByLabelText('Escribí tu consulta')).toHaveValue('Consulta de la revisión anterior');
  expect(mocks.fetch.mock.calls.filter(call=>call[1].method==='POST')).toHaveLength(1);
 });
 it('focuses the workspace heading when a retry successfully reads an empty workspace',async()=>{
  mocks.fetch.mockRejectedValueOnce(new Error('read failed'));render(view());
  const retry=await screen.findByRole('button',{name:'Reintentar'});
  mocks.fetch.mockResolvedValueOnce(workspace({knowledge:null,revision:null,visibility:'empty'}));retry.focus();fireEvent.click(retry);
  await screen.findByRole('heading',{name:workspace().ui.empty});
  await waitFor(()=>expect(screen.getByRole('heading',{name:workspace().ui.heading})).toHaveFocus());
  expect(mocks.fetch.mock.calls.map(call=>call[1].method)).toEqual(['GET','GET']);
 });
 it('does not capture focus when the initial workspace finishes loading',async()=>{
  const pending=deferred();mocks.fetch.mockReturnValueOnce(pending.promise);
  render(<><button type="button">Control externo</button>{view()}</>);const outside=screen.getByRole('button',{name:'Control externo'});outside.focus();
  await act(async()=>{pending.resolve(workspace());await pending.promise;});
  await screen.findByRole('heading',{name:node().title});expect(outside).toHaveFocus();
 });
 it('retires a pending retry on session change without moving focus or restoring its result',async()=>{
  mocks.fetch.mockRejectedValueOnce(new Error('read failed'));const mounted=render(<><button type="button">Control externo</button>{view()}</>);
  const retry=await screen.findByRole('button',{name:'Reintentar'}),pending=deferred();
  mocks.fetch.mockReturnValueOnce(pending.promise);retry.focus();fireEvent.click(retry);
  mocks.fetch.mockResolvedValueOnce(workspace({tenant:{id:701,slug:'qa-knowledge',name:'Nueva sesión'}}));
  mounted.rerender(<><button type="button">Control externo</button>{view('actor-b')}</>);await screen.findByText('Nueva sesión');
  const outside=screen.getByRole('button',{name:'Control externo'});outside.focus();
  const retired=workspace();retired.knowledge!.initial.title='Resultado retirado';
  await act(async()=>{pending.resolve(retired);await pending.promise;});
  expect(outside).toHaveFocus();expect(screen.queryByText('Resultado retirado')).not.toBeInTheDocument();
  expect(mocks.fetch.mock.calls.map(call=>call[1].method)).toEqual(['GET','GET','GET']);
 });
 it('keeps focus in a source dialog opened before the recovery frame runs',async()=>{
  const frames:FrameRequestCallback[]=[],raf=vi.spyOn(globalThis,'requestAnimationFrame').mockImplementation(callback=>{frames.push(callback);return frames.length;});
  try{
   mocks.fetch.mockRejectedValueOnce(new Error('read failed'));render(view());
   const retry=await screen.findByRole('button',{name:'Reintentar'});retry.focus();fireEvent.click(retry);
   await screen.findByRole('heading',{name:node().title});const recoveryFrame=frames.at(-1)!;expect(recoveryFrame).toBeTypeOf('function');
   fireEvent.click(screen.getByRole('button',{name:'Documentos y fuentes'}));
   const title=await screen.findByRole('heading',{name:'Documentos y fuentes'});expect(title).toHaveFocus();
   act(()=>recoveryFrame(0));expect(title).toHaveFocus();expect(mocks.fetch).toHaveBeenCalledTimes(2);
  }finally{raf.mockRestore();}
 });
 it('does not execute a queued recovery focus after a newer canonical request',async()=>{
  const frames:FrameRequestCallback[]=[],raf=vi.spyOn(globalThis,'requestAnimationFrame').mockImplementation(callback=>{frames.push(callback);return frames.length;});
  try{
   mocks.fetch.mockRejectedValueOnce(new Error('read failed'));render(<><button type="button">Control externo</button>{view()}</>);
   fireEvent.click(await screen.findByRole('button',{name:'Reintentar'}));await screen.findByRole('heading',{name:node().title});const recoveryFrame=frames.at(-1)!;
   const pending=deferred();mocks.fetch.mockReturnValueOnce(pending.promise);fireEvent.click(screen.getByRole('button',{name:'Consultar requisitos'}));
   const outside=screen.getByRole('button',{name:'Control externo'});outside.focus();act(()=>recoveryFrame(0));expect(outside).toHaveFocus();
   await act(async()=>{pending.resolve(reply());await pending.promise;});await screen.findByRole('heading',{name:'Requisitos de la consulta'});
   act(()=>recoveryFrame(0));expect(outside).toHaveFocus();expect(mocks.fetch.mock.calls.map(call=>call[1].method)).toEqual(['GET','GET','GET']);
  }finally{raf.mockRestore();}
 });
 it('does not execute a queued recovery focus after the actor changes',async()=>{
  const frames:FrameRequestCallback[]=[],raf=vi.spyOn(globalThis,'requestAnimationFrame').mockImplementation(callback=>{frames.push(callback);return frames.length;});
  try{
   mocks.fetch.mockRejectedValueOnce(new Error('read failed'));const mounted=render(<><button type="button">Control externo</button>{view()}</>);
   fireEvent.click(await screen.findByRole('button',{name:'Reintentar'}));await screen.findByRole('heading',{name:node().title});const recoveryFrame=frames.at(-1)!;
   mocks.fetch.mockResolvedValueOnce(workspace({tenant:{id:701,slug:'qa-knowledge',name:'Nueva sesión'}}));
   mounted.rerender(<><button type="button">Control externo</button>{view('actor-b')}</>);await screen.findByText('Nueva sesión');
   const outside=screen.getByRole('button',{name:'Control externo'});outside.focus();act(()=>recoveryFrame(0));expect(outside).toHaveFocus();
  }finally{raf.mockRestore();}
 });
});
