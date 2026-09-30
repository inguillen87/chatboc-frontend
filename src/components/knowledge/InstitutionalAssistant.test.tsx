import React from 'react';
import {act,cleanup,fireEvent,render,screen,waitFor} from '@testing-library/react';
import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
import {workspace,node,reply} from '../../../tests/fixtures/institutional-assistant.synthetic';
const mocks=vi.hoisted(()=>({fetch:vi.fn()}));
vi.mock('@/utils/api',()=>({apiFetch:(...args:unknown[])=>mocks.fetch(...args)}));
import InstitutionalAssistant from './InstitutionalAssistant';
const deferred=()=>{let resolve!:(value:any)=>void;const promise=new Promise<any>(r=>{resolve=r;});return{promise,resolve};};
const view=(slug='qa-knowledge',sessionKey='actor-a')=><InstitutionalAssistant tenantSlug={slug} sessionKey={sessionKey}/>;
beforeEach(()=>{mocks.fetch.mockReset();mocks.fetch.mockResolvedValue(workspace());});afterEach(cleanup);
describe('institutional workspace inside the application',()=>{
 it('uses the verified organization, canonical answer and source labels',async()=>{
  render(view());await screen.findByRole('heading',{name:'Información y orientación'});
  expect(screen.getByText('Institución de prueba')).toBeVisible();expect(screen.getByText(node().text)).toBeVisible();
  mocks.fetch.mockResolvedValueOnce(reply());fireEvent.click(screen.getByRole('button',{name:'Consultar requisitos'}));
  expect(await screen.findByRole('heading',{name:'Requisitos de la consulta'})).toBeVisible();
  expect(screen.getByRole('link',{name:'Referencia institucional'})).toHaveAttribute('href','https://example.org/informacion');
  expect(screen.queryByText(node().text)).not.toBeInTheDocument();
 });
 it('submits a typed question once and shows the canonical response',async()=>{
  render(view());await screen.findByLabelText('Escribí tu consulta');const pending=deferred();mocks.fetch.mockReturnValueOnce(pending.promise);
  fireEvent.change(screen.getByLabelText('Escribí tu consulta'),{target:{value:'¿Qué documentos necesito?'}});
  const form=screen.getByLabelText('Escribí tu consulta').closest('form')!;fireEvent.submit(form);fireEvent.submit(form);
  expect(mocks.fetch).toHaveBeenCalledTimes(2);expect(mocks.fetch.mock.calls[1][1].body.question).toBe('¿Qué documentos necesito?');
  await act(async()=>{pending.resolve(reply());await pending.promise;});expect(await screen.findByRole('heading',{name:'Requisitos de la consulta'})).toBeVisible();
 });
 it('removes answers after rejection and recovers only by a fresh read',async()=>{
  render(view());await screen.findByText(node().text);mocks.fetch.mockRejectedValueOnce(new Error('PRIVATE BODY'));
  fireEvent.click(screen.getByRole('button',{name:'Consultar requisitos'}));await screen.findByRole('alert');
  expect(screen.queryByText(node().text)).not.toBeInTheDocument();expect(screen.queryByText('PRIVATE BODY')).not.toBeInTheDocument();
  mocks.fetch.mockResolvedValueOnce(workspace());fireEvent.click(screen.getByRole('button',{name:'Volver a consultar'}));await screen.findByText(node().text);
 });
 it('does not restore a response after switching the verified actor',async()=>{
  const pending=deferred();mocks.fetch.mockReturnValueOnce(pending.promise);const mounted=render(view());
  mocks.fetch.mockResolvedValueOnce(workspace({tenant:{id:701,slug:'qa-knowledge',name:'Nueva sesión'}}));mounted.rerender(view('qa-knowledge','actor-b'));
  await screen.findByText('Nueva sesión');await act(async()=>{pending.resolve(workspace());await pending.promise;});expect(screen.queryByText('Institución de prueba')).not.toBeInTheDocument();
 });
 it('requires confirmation before publication and verifies readback',async()=>{
  render(view());await screen.findByRole('button',{name:'Habilitar en el agente'});fireEvent.click(screen.getByRole('button',{name:'Habilitar en el agente'}));
  expect(mocks.fetch).toHaveBeenCalledOnce();fireEvent.click(screen.getByRole('button',{name:'Cancelar'}));expect(mocks.fetch).toHaveBeenCalledOnce();
  fireEvent.click(screen.getByRole('button',{name:'Habilitar en el agente'}));mocks.fetch.mockResolvedValue(workspace({revision:'c'.repeat(64),visibility:'public'}));
  fireEvent.click(screen.getByRole('button',{name:'Confirmar cambio'}));expect(await screen.findByRole('button',{name:'Retirar del agente'})).toBeVisible();
  expect(mocks.fetch.mock.calls[1][1].method).toBe('PUT');expect(mocks.fetch.mock.calls[2][1].method).toBe('GET');
 });
 it('does not re-send an uncertain publication',async()=>{
  render(view());await screen.findByRole('button',{name:'Habilitar en el agente'});fireEvent.click(screen.getByRole('button',{name:'Habilitar en el agente'}));
  mocks.fetch.mockRejectedValueOnce(new Error('network'));fireEvent.click(screen.getByRole('button',{name:'Confirmar cambio'}));await screen.findByRole('alert');
  expect(mocks.fetch).toHaveBeenCalledTimes(2);expect(screen.queryByRole('button',{name:'Confirmar cambio'})).not.toBeInTheDocument();
 });
 it('offers larger type without changing the answer or making requests',async()=>{render(view());await screen.findByText(node().text);fireEvent.click(screen.getByRole('button',{name:'Texto ampliado'}));expect(screen.getByTestId('institutional-assistant')).toHaveClass('institutional-assistant--large');expect(mocks.fetch).toHaveBeenCalledOnce();});
 it('does not create a workspace without a verified session',()=>{render(<InstitutionalAssistant tenantSlug="qa-knowledge"/>);expect(mocks.fetch).not.toHaveBeenCalled();});
});
describe('source evidence and inclusive navigation',()=>{
 it('keeps distinct options even when they lead to the same next menu',async()=>{
  const value=workspace();value.knowledge!.initial.actions=[{code:'1',label:'Para mí',target:'requirements'},{code:'2',label:'Para una persona que acompaño',target:'requirements'}];
  mocks.fetch.mockResolvedValue(value);render(view());
  expect(await screen.findByRole('button',{name:'Para mí'})).toBeVisible();expect(screen.getByRole('button',{name:'Para una persona que acompaño'})).toBeVisible();
 });
 it('renders supplied evidence text as text, not active HTML',async()=>{
  const value=workspace();value.knowledge!.initial.sources[0].excerpts=[{page:1,text:'<script>source</script> Texto de la fuente.'}];
  mocks.fetch.mockResolvedValue(value);const mounted=render(view());await screen.findByText(node().text);
  expect(mounted.container.querySelectorAll('script')).toHaveLength(0);expect(screen.getByText('<script>source</script> Texto de la fuente.')).toBeInTheDocument();
 });
});
describe('published institution view',()=>{
 it('serves the same published content without management controls or panel credentials',async()=>{
  mocks.fetch.mockResolvedValue(workspace({visibility:'public',can_edit:false}));
  render(<InstitutionalAssistant tenantSlug="qa-knowledge" mode="public"/>);
  await screen.findByText(node().text);
  expect(screen.queryByRole('button',{name:'Incorporar conocimiento'})).not.toBeInTheDocument();
  expect(screen.queryByRole('button',{name:'Habilitar en el agente'})).not.toBeInTheDocument();
  expect(mocks.fetch.mock.calls[0][0]).toBe('/api/public/tenants/qa-knowledge/institutional-assistant');
  expect(mocks.fetch.mock.calls[0][1]).toMatchObject({skipAuth:true,omitEntityToken:true,omitCredentials:true,persistTenantSlug:false});
 });
 it('does not show a private response on the public institution page',async()=>{
  mocks.fetch.mockResolvedValue(workspace());
  const mounted=render(<InstitutionalAssistant tenantSlug="qa-knowledge" mode="public"/>);
  await act(async()=>{await Promise.resolve();});
  expect(mounted.container).toBeEmptyDOMElement();
 });
});
