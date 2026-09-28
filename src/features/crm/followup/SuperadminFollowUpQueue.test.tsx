import React from 'react';
import {act,cleanup,fireEvent,render,screen,waitFor,within} from '@testing-library/react';
import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
const mock=vi.hoisted(()=>({list:vi.fn(),read:vi.fn(),save:vi.fn()}));
vi.mock('./followUpApi',async()=>{const original=await vi.importActual<typeof import('./followUpApi')>('./followUpApi');return {...original,followUpApi:mock};});
import SuperadminFollowUpQueue from './SuperadminFollowUpQueue';
const row=(id:string,name:string,date:string|null)=>({key:id,contactId:id,tenantSlug:'org-a',organization:'Organización A',name,nextActionAt:date});
beforeEach(()=>{vi.useFakeTimers({toFake:['Date']});vi.setSystemTime(new Date('2030-01-15T12:00:00Z'));mock.save.mockReset();mock.list.mockReset().mockResolvedValue({items:[row('c1','José','2000-01-01T00:00:00Z'),row('c2','Beatriz',null)],received:2,excluded:0});mock.read.mockReset().mockResolvedValue({tenantSlug:'org-a',contactId:'c1',name:'José',notes:'',nextActionAt:null,updatedAt:null,updatedBy:null});});afterEach(()=>{cleanup();vi.useRealTimers();});
describe('platform follow-up queue',()=>{
  it('filters loaded records without requesting again and searches accented names',async()=>{
    render(<SuperadminFollowUpQueue/>);await screen.findByRole('button',{name:'Seguimiento de José en Organización A'});
    fireEvent.click(screen.getByRole('button',{name:/Vencidos/}));expect(screen.queryByRole('button',{name:/Seguimiento de Beatriz/})).not.toBeInTheDocument();
    fireEvent.change(screen.getByRole('searchbox'),{target:{value:'jose'}});expect(screen.getByRole('button',{name:/Seguimiento de José/})).toBeVisible();expect(mock.list).toHaveBeenCalledOnce();
  });
  it('surfaces urgent work and lets the operator jump directly to overdue contacts',async()=>{
    render(<SuperadminFollowUpQueue/>);await screen.findByRole('button',{name:'Seguimiento de José en Organización A'});
    const attention=screen.getByRole('status',{name:'Atención requerida'});
    expect(attention).toHaveTextContent('1 vencido');expect(attention).toHaveTextContent('0 para hoy');
    fireEvent.click(screen.getByRole('button',{name:'Ver vencidos'}));
    expect(screen.getByRole('button',{name:/Seguimiento de José/})).toBeVisible();
    expect(screen.queryByRole('button',{name:/Seguimiento de Beatriz/})).not.toBeInTheDocument();
    expect(mock.list).toHaveBeenCalledOnce();
  });
  it('offers a one-click reset when filters leave the agenda empty',async()=>{
    render(<SuperadminFollowUpQueue/>);await screen.findByRole('button',{name:/Seguimiento de José/});
    fireEvent.change(screen.getByRole('searchbox'),{target:{value:'persona inexistente'}});
    expect(screen.getByText('No hay contactos que coincidan con estos filtros.')).toBeVisible();
    fireEvent.click(screen.getByRole('button',{name:'Limpiar búsqueda y prioridad'}));
    expect(screen.getByRole('searchbox')).toHaveValue('');
    expect(screen.getByRole('button',{name:/Seguimiento de José/})).toBeVisible();
    expect(screen.getByRole('button',{name:/Seguimiento de Beatriz/})).toBeVisible();
    expect(mock.list).toHaveBeenCalledOnce();
  });
  it('reads the exact contact when opening its follow-up editor',async()=>{
    render(<SuperadminFollowUpQueue/>);fireEvent.click(await screen.findByRole('button',{name:'Seguimiento de José en Organización A'}));
    expect(await screen.findByRole('dialog',{name:'Seguimiento del contacto'})).toBeVisible();expect(mock.read).toHaveBeenCalledWith(expect.objectContaining({tenantSlug:'org-a',contactId:'c1'}));
  });
  it('clears all former rows when refresh fails',async()=>{
    render(<SuperadminFollowUpQueue/>);await screen.findByRole('button',{name:/Seguimiento de José/});mock.list.mockRejectedValueOnce({status:403});
    fireEvent.click(screen.getByRole('button',{name:'Actualizar agenda'}));await screen.findByRole('alert');expect(screen.queryByRole('button',{name:/Seguimiento de José/})).not.toBeInTheDocument();
    expect(mock.list).toHaveBeenCalledTimes(2);
  });
});


describe('follow-up agenda navigation', () => {
  it.each([
    ['Ver vencidos', '2000-01-01T00:00:00Z'],
    ['Ver hoy', null],
    ['Revisar fechas', 'fecha no verificable'],
  ])('clears a conflicting search when jumping with %s', async (label, date) => {
    mock.list.mockResolvedValue({items:[row('c1','José',label==='Ver hoy'?new Date(new Date().setHours(23,59,0,0)).toISOString():date),row('c2','Beatriz',null)],received:2,excluded:0});
    render(<SuperadminFollowUpQueue/>);
    await screen.findByRole('button',{name:/Seguimiento de José/});
    fireEvent.change(screen.getByRole('searchbox'),{target:{value:'beatriz'}});
    expect(screen.queryByRole('button',{name:/Seguimiento de José/})).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button',{name:label}));
    expect(screen.getByRole('searchbox')).toHaveValue('');
    expect(screen.getByRole('button',{name:/Seguimiento de José/})).toBeVisible();
    expect(screen.queryByRole('button',{name:/Seguimiento de Beatriz/})).not.toBeInTheDocument();
    expect(mock.list).toHaveBeenCalledOnce();
    expect(screen.getByTestId('followup-results-summary')).toHaveFocus();
  });

  it('keeps the search when toggling ordinary priority filters', async () => {
    render(<SuperadminFollowUpQueue/>);
    await screen.findByRole('button',{name:/Seguimiento de José/});
    fireEvent.change(screen.getByRole('searchbox'),{target:{value:'jose'}});
    fireEvent.click(screen.getByRole('button',{name:/Vencidos/}));
    expect(screen.getByRole('searchbox')).toHaveValue('jose');
    expect(mock.list).toHaveBeenCalledOnce();
  });

  it('moves keyboard focus to the results after clearing empty filters', async () => {
    render(<SuperadminFollowUpQueue/>);
    await screen.findByRole('button',{name:/Seguimiento de José/});
    fireEvent.change(screen.getByRole('searchbox'),{target:{value:'sin coincidencias'}});
    fireEvent.click(screen.getByRole('button',{name:'Limpiar búsqueda y prioridad'}));
    expect(screen.getByTestId('followup-results-summary')).toHaveFocus();
    expect(mock.list).toHaveBeenCalledOnce();
  });

  it('restores focus to the same contact when closing without saving', async () => {
    render(<SuperadminFollowUpQueue/>);
    const contact=await screen.findByRole('button',{name:/Seguimiento de José/});
    contact.focus();fireEvent.click(contact);
    await screen.findByLabelText('Notas del responsable');
    fireEvent.keyDown(screen.getByRole('dialog'),{key:'Escape',code:'Escape'});
    await waitFor(()=>expect(contact).toHaveFocus());
    expect(mock.list).toHaveBeenCalledOnce();
  });

  it.each(['success','denied'])('restores a stable agenda focus while a saved contact refreshes: %s', async outcome => {
    let resolve!: (value: unknown)=>void;
    let reject!: (reason: unknown)=>void;
    const pending=new Promise((yes,no)=>{resolve=yes;reject=no;});
    mock.save.mockResolvedValue({tenantSlug:'org-a',contactId:'c1',name:'José',notes:'Nota actualizada',nextActionAt:null,updatedAt:null,updatedBy:null});
    render(<SuperadminFollowUpQueue/>);
    const contact=await screen.findByRole('button',{name:/Seguimiento de José/});
    contact.focus();fireEvent.click(contact);
    fireEvent.change(await screen.findByLabelText('Notas del responsable'),{target:{value:'Nota actualizada'}});
    fireEvent.click(screen.getByRole('button',{name:'Revisar seguimiento'}));
    const confirmation=await screen.findByRole('alertdialog',{name:'Confirmar seguimiento'});
    fireEvent.click(within(confirmation).getByRole('button',{name:'Guardar seguimiento'}));
    await screen.findByText('Seguimiento guardado y verificado en el servidor.');
    mock.list.mockReturnValueOnce(pending);
    fireEvent.keyDown(screen.getByRole('dialog'),{key:'Escape',code:'Escape'});
    await waitFor(()=>expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    const heading=screen.getByRole('heading',{name:'Agenda de próximos contactos'});
    await waitFor(()=>expect(heading).toHaveFocus());
    expect(mock.list).toHaveBeenCalledTimes(2);
    expect(mock.save).toHaveBeenCalledOnce();
    // A late response must not steal focus if the operator already moved on.
    screen.getByRole('searchbox').focus();
    await act(async()=>{if(outcome==='success')resolve({items:[],received:0,excluded:0});else reject({status:403});});
    expect(screen.getByRole('searchbox')).toHaveFocus();
    expect(screen.queryByRole('button',{name:/Seguimiento de José/})).not.toBeInTheDocument();
    if(outcome==='denied')expect(screen.getByRole('alert')).toBeVisible();
  });
});

describe('repeated agenda jumps',()=>{
  it('refocuses the result summary when the same shortcut is used twice',async()=>{
    render(<SuperadminFollowUpQueue/>);await screen.findByRole('button',{name:/Seguimiento de José/});
    fireEvent.click(screen.getByRole('button',{name:'Ver vencidos'}));
    expect(screen.getByTestId('followup-results-summary')).toHaveFocus();
    screen.getByRole('searchbox').focus();
    fireEvent.click(screen.getByRole('button',{name:'Ver vencidos'}));
    expect(screen.getByTestId('followup-results-summary')).toHaveFocus();
    expect(mock.list).toHaveBeenCalledOnce();
    expect(mock.save).not.toHaveBeenCalled();
  });
});
