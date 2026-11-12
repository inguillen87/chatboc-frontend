import React from 'react';
import {fireEvent,render,screen,waitFor} from '@testing-library/react';
import {beforeEach,describe,expect,it,vi} from 'vitest';
const service=vi.hoisted(()=>({uploadFile:vi.fn(),commitImport:vi.fn()}));
vi.mock('../../services/importService',()=>({importService:service}));
vi.mock('@/context/TenantContext',()=>({useTenant:()=>({currentSlug:'org-demo'})}));
import ImportWizard from './ImportWizard';
const preview={
  upload_id:41,total_detected:1,confidence:.94,warnings:[],errors:[],error_details:[],
  columns:[{key:'nombre',label:'Nombre'}],items_preview:[{nombre:'Producto de prueba'}],
};
describe('ImportWizard failure UX',()=>{
  beforeEach(()=>{service.uploadFile.mockReset().mockResolvedValue(preview);service.commitImport.mockReset();vi.spyOn(console,'error').mockImplementation(()=>{});});
  it('does not use a browser alert or expose technical commit details',async()=>{
    service.commitImport.mockRejectedValue(new Error('https://internal.example/import?token=private ECONNREFUSED'));
    const alertSpy=vi.spyOn(window,'alert');
    const {container}=render(<ImportWizard tenantId={12} tenantSlug="org-demo" onComplete={vi.fn()}/>);
    const input=container.querySelector('input[type=file]') as HTMLInputElement;
    fireEvent.change(input,{target:{files:[new File(['sku,nombre'],'catalogo.csv',{type:'text/csv'})]}});
    fireEvent.click(screen.getByRole('button',{name:'Subir y Analizar'}));
    await screen.findByText('Detectados: 1 productos');
    const buttons=screen.getAllByRole('button',{name:'Confirmar 1 items'});
    fireEvent.click(buttons[0]);
    expect(await screen.findByRole('alert')).toHaveTextContent('No pudimos confirmar la importación');
    expect(screen.getByRole('alert')).toHaveTextContent('evitar una importación duplicada');
    expect(screen.getByRole('alert')).not.toHaveTextContent('internal.example');
    expect(screen.getByRole('alert')).not.toHaveTextContent('ECONNREFUSED');
    expect(alertSpy).not.toHaveBeenCalled();expect(service.commitImport).toHaveBeenCalledTimes(1);
  });
  it('shows a bounded upload error instead of the thrown server detail',async()=>{
    service.uploadFile.mockRejectedValue({status:413,message:'private server path'});
    const {container}=render(<ImportWizard tenantId={12} tenantSlug="org-demo" onComplete={vi.fn()}/>);
    const input=container.querySelector('input[type=file]') as HTMLInputElement;
    fireEvent.change(input,{target:{files:[new File(['x'],'large.csv',{type:'text/csv'})]}});
    fireEvent.click(screen.getByRole('button',{name:'Subir y Analizar'}));
    expect(await screen.findByRole('alert')).toHaveTextContent('Archivo demasiado grande');
    expect(screen.getByRole('alert')).not.toHaveTextContent('private server path');
  });
});
