import React from 'react';
import {fireEvent,render,screen,waitFor} from '@testing-library/react';
import {beforeEach,describe,expect,it,vi} from 'vitest';
import type {KnowledgeSource,KnowledgeWorkspace} from './institutionalAssistantContract';

const read=vi.hoisted(()=>vi.fn());
vi.mock('./institutionalAssistantSource',()=>({readKnowledgeSource:read,knowledgeSourceReadMessage:()=>'No pudimos abrir el documento.'}));
import {InstitutionalDocumentDownload,isHandoutSource} from './InstitutionalDocumentDownload';

const source=(over:Record<string,unknown>={})=>({id:'form',title:'Planilla de inscripción',sha256:'a'.repeat(64),page_count:1,
  document_visibility:'public',delivery:{contract_version:'chatboc.knowledge_source_delivery.v1',format:'pdf',mime_type:'application/pdf',
    filename:'Planilla.pdf',sha256:'a'.repeat(64),byte_size:161627,document_visibility:'public',publicly_accessible:true},...over}) as unknown as KnowledgeSource;
const workspace={tenant:{id:7,slug:'demo'},revision:'b'.repeat(64)} as unknown as KnowledgeWorkspace;

describe('InstitutionalDocumentDownload',()=>{
  beforeEach(()=>{read.mockReset();
    Object.assign(URL,{createObjectURL:vi.fn(()=>'blob:demo'),revokeObjectURL:vi.fn()});});
  it('treats only a published original document as a handout',()=>{
    expect(isHandoutSource(source())).toBe(true);
    expect(isHandoutSource(source({document_visibility:'private'}))).toBe(false);
    expect(isHandoutSource(source({delivery:{...source().delivery,publicly_accessible:false}}))).toBe(false);
    expect(isHandoutSource(source({delivery:{...source().delivery,format:'text'}}))).toBe(false);
    expect(isHandoutSource(source({delivery:undefined}))).toBe(false);
  });
  it('downloads the verified document in one tap and says where to find it',async()=>{
    read.mockResolvedValue({blob:new Blob(['%PDF-']),text:null,filename:'Planilla.pdf',format:'pdf'});
    const click=vi.spyOn(HTMLAnchorElement.prototype,'click').mockImplementation(()=>{});
    render(<InstitutionalDocumentDownload workspace={workspace} source={source()} mode="public"/>);
    const button=screen.getByRole('button',{name:/Descargar Planilla de inscripción/});
    expect(button).toHaveTextContent('PDF · 158 KB');
    fireEvent.click(button);
    await waitFor(()=>expect(screen.getByRole('status')).toHaveTextContent('Listo. Buscá el archivo en tus descargas.'));
    expect(read).toHaveBeenCalledWith(workspace,expect.objectContaining({id:'form'}),'public',expect.any(Object));
    expect(click).toHaveBeenCalledTimes(1);
    click.mockRestore();
  });
  it('explains a failed download without leaving the button stuck',async()=>{
    read.mockRejectedValue(new Error('x'));
    render(<InstitutionalDocumentDownload workspace={workspace} source={source()} mode="public"/>);
    fireEvent.click(screen.getByRole('button',{name:/Descargar/}));
    await waitFor(()=>expect(screen.getByRole('status')).toHaveTextContent('No pudimos abrir el documento.'));
    expect(screen.getByRole('button',{name:/Descargar/})).toBeEnabled();
  });
});
