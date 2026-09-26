import React from 'react';
import {cleanup,fireEvent,render,screen,waitFor} from '@testing-library/react';
import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
const mock=vi.hoisted(()=>({list:vi.fn(),read:vi.fn()}));
vi.mock('./followUpApi',async()=>{const original=await vi.importActual<typeof import('./followUpApi')>('./followUpApi');return {...original,followUpApi:mock};});
import SuperadminFollowUpQueue from './SuperadminFollowUpQueue';
const row=(id:string,name:string,date:string|null)=>({key:id,contactId:id,tenantSlug:'org-a',organization:'Organización A',name,nextActionAt:date});
beforeEach(()=>{mock.list.mockReset().mockResolvedValue({items:[row('c1','José','2000-01-01T00:00:00Z'),row('c2','Beatriz',null)],received:2,excluded:0});mock.read.mockReset().mockResolvedValue({tenantSlug:'org-a',contactId:'c1',name:'José',notes:'',nextActionAt:null,updatedAt:null,updatedBy:null});});afterEach(cleanup);
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
