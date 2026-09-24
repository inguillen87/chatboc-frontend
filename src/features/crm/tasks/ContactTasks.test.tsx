import React from 'react';
import {act,cleanup,fireEvent,render,screen,waitFor,within} from '@testing-library/react';
import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
const mock=vi.hoisted(()=>({capabilities:vi.fn(),list:vi.fn(),assignees:vi.fn(),detail:vi.fn(),execute:vi.fn()}));
vi.mock('./taskApi',()=>({taskApi:mock}));
import {ContactTasksEntry,TaskEditor} from './ContactTasks';
import type {TaskCapabilities,CrmTask} from './taskApi';
const identity={tenantSlug:'tasks-qa',contactId:'contact-qa'};
const cap:TaskCapabilities={available:true,tenant_slug:'tasks-qa',can_create:true,ui:{title:'Tareas del contacto',create:'Crear tarea',save:'Guardar cambios',assignee:'Responsable',due:'Vencimiento',reason:'Motivo del cambio',history:'Historial',unassigned:'Sin asignar',description:'Tareas independientes'},statuses:{todo:'Pendiente',in_progress:'En curso',done:'Completada',cancelled:'Cancelada'},priorities:{normal:'Normal',high:'Alta',urgent:'Urgente'}};
const task:CrmTask={id:'11111111-1111-4111-8111-111111111111',tenant_id:7,contact_id:'contact-qa',title:'Tarea de prueba',description:'',assignee_id:null,due_at:null,priority:'normal',status:'todo',revision:1,created_at:'2026-09-24T12:00:00Z',updated_at:'2026-09-24T12:00:00Z',permissions:{can_edit:true,statuses:[{value:'done',label:'Completada'}]}};
const props=()=>({identity,cap,task:null,assignees:[{id:9,name:'Operador QA'}],report:vi.fn(),onSaved:vi.fn(),onRevoked:vi.fn()});
beforeEach(()=>{Object.values(mock).forEach(fn=>fn.mockReset());mock.capabilities.mockResolvedValue(cap);mock.list.mockResolvedValue({items:[],total:0,counts:{todo:0,in_progress:0,done:0,cancelled:0},next_cursor:null});mock.assignees.mockResolvedValue([]);mock.detail.mockResolvedValue({task,events:[],next_before_revision:null});});afterEach(cleanup);
const review=async()=>{fireEvent.change(screen.getByLabelText('Título'),{target:{value:'Llamar al contacto'}});fireEvent.click(screen.getByRole('button',{name:'Revisar cambios'}));return screen.findByRole('alertdialog',{name:'Confirmar tarea'});};
describe('independent task workspace',()=>{
 it('does not expose task controls when the backend capability is unavailable',async()=>{
  mock.capabilities.mockResolvedValue({...cap,available:false});render(<ContactTasksEntry identity={identity}/>);
  await waitFor(()=>expect(mock.capabilities).toHaveBeenCalledOnce());expect(screen.queryByRole('button')).not.toBeInTheDocument();expect(mock.list).not.toHaveBeenCalled();
 });
 it('opens a task workspace only after an available capability response',async()=>{
  render(<ContactTasksEntry identity={identity}/>);fireEvent.click(await screen.findByRole('button',{name:'Tareas del contacto'}));
  expect(await screen.findByRole('dialog',{name:'Tareas del contacto'})).toBeVisible();await waitFor(()=>expect(mock.list).toHaveBeenCalledWith(identity,undefined));
 });
 it('canceling the confirmation never creates a task',async()=>{
  render(<TaskEditor {...props()}/>);const dialog=await review();fireEvent.click(within(dialog).getByRole('button',{name:'Volver sin guardar'}));
  expect(mock.execute).not.toHaveBeenCalled();expect(screen.getByLabelText('Título')).toHaveValue('Llamar al contacto');
 });
 it('sends once under double click and keeps the original key for an explicit retry',async()=>{
  mock.execute.mockRejectedValueOnce(new Error('network')).mockResolvedValueOnce({task});const callbacks=props();render(<TaskEditor {...callbacks}/>);
  const dialog=await review();const save=within(dialog).getByRole('button',{name:'Guardar cambios'});fireEvent.click(save);fireEvent.click(save);
  await screen.findByRole('alert');expect(mock.execute).toHaveBeenCalledOnce();expect(callbacks.onSaved).not.toHaveBeenCalled();
  const first=mock.execute.mock.calls[0][0];expect(screen.getByLabelText('Título')).toBeDisabled();
  fireEvent.click(screen.getByRole('button',{name:'Verificar y reintentar la misma operación'}));
  await waitFor(()=>expect(callbacks.onSaved).toHaveBeenCalledOnce());expect(mock.execute.mock.calls[1][0]).toEqual(first);
 });
 it('includes the selected version and reason when editing an existing task',async()=>{
  mock.execute.mockResolvedValue({task});const callbacks=props();render(<TaskEditor {...callbacks} task={task}/>);
  fireEvent.change(screen.getByLabelText('Motivo del cambio'),{target:{value:'Revisión administrativa'}});await waitFor(()=>expect(screen.getByRole('button',{name:'Revisar cambios'})).toBeEnabled());
  const dialog=await review();fireEvent.click(within(dialog).getByRole('button',{name:'Guardar cambios'}));
  await waitFor(()=>expect(mock.execute).toHaveBeenCalledOnce());expect(mock.execute.mock.calls[0][0]).toMatchObject({taskId:task.id,payload:{expected_revision:1,reason:'Revisión administrativa'}});
 });
 it('honors read-only server permissions',async()=>{
  mock.detail.mockResolvedValue({task:{...task,permissions:{can_edit:false,statuses:[]}},events:[],next_before_revision:null});
  render(<TaskEditor {...props()} task={{...task,permissions:{can_edit:false,statuses:[]}}}/>);
  await waitFor(()=>expect(mock.detail).toHaveBeenCalledOnce());expect(screen.getByLabelText('Título')).toBeDisabled();expect(screen.getByLabelText('Estado')).toBeDisabled();
 });
});
describe('task editor isolation',()=>{
 it('uses the freshly returned permissions instead of stale editable controls',async()=>{
  mock.detail.mockResolvedValue({task:{...task,permissions:{can_edit:false,statuses:[]}},events:[],next_before_revision:null});
  render(<TaskEditor {...props()} task={task}/>);
  await waitFor(()=>expect(mock.detail).toHaveBeenCalledOnce());
  expect(screen.getByLabelText('Título')).toBeDisabled();expect(screen.getByLabelText('Estado')).toBeDisabled();
 });
 it('does not restore an obsolete StrictMode detail response',async()=>{
  let resolve!:(value:unknown)=>void;mock.detail.mockReturnValueOnce(new Promise(r=>resolve=r)).mockResolvedValueOnce({task:{...task,revision:2},events:[],next_before_revision:null});
  render(<React.StrictMode><TaskEditor {...props()} task={task}/></React.StrictMode>);
  await screen.findByText(/La ficha tiene una versión anterior/);
  await act(async()=>resolve({task,events:[],next_before_revision:null}));
  expect(screen.getByText(/La ficha tiene una versión anterior/)).toBeVisible();expect(mock.execute).not.toHaveBeenCalled();
 });
 it('preserves sub-minute precision on an unchanged deadline',async()=>{
  const timed={...task,due_at:'2026-10-02T15:30:48.123Z'};
  mock.detail.mockResolvedValue({task:timed,events:[],next_before_revision:null});mock.execute.mockResolvedValue({task:timed});
  render(<TaskEditor {...props()} task={timed}/>);await waitFor(()=>expect(mock.detail).toHaveBeenCalledOnce());
  fireEvent.change(screen.getByLabelText('Motivo del cambio'),{target:{value:'Cambiar título'}});
  const dialog=await review();fireEvent.click(within(dialog).getByRole('button',{name:'Guardar cambios'}));
  await waitFor(()=>expect(mock.execute).toHaveBeenCalledOnce());
  expect(mock.execute.mock.calls[0][0].payload.due_at).toBe('2026-10-02T15:30:48.123Z');
 });
});
