import React from 'react';
import {fireEvent,render,screen,waitFor} from '@testing-library/react';
import {beforeEach,describe,expect,it,vi} from 'vitest';

const apiFetch=vi.hoisted(()=>vi.fn());
vi.mock('@/utils/api',()=>({apiFetch}));
import {InstitutionalAnswerFeedback} from './InstitutionalAnswerFeedback';
import type {KnowledgeWorkspace} from './institutionalAssistantContract';

const workspace={tenant:{id:46,slug:'tierra-del-fuego'},revision:'a'.repeat(64)} as unknown as KnowledgeWorkspace;

describe('answer feedback',()=>{
  beforeEach(()=>{apiFetch.mockReset();apiFetch.mockResolvedValue({received:true});});

  it('sends only the topic, the version and yes or no, once',async()=>{
    render(<InstitutionalAnswerFeedback workspace={workspace} nodeId="rupe"/>);
    fireEvent.click(screen.getByRole('button',{name:'No'}));
    await waitFor(()=>expect(apiFetch).toHaveBeenCalledTimes(1));
    const [url,options]=apiFetch.mock.calls[0];
    expect(url).toBe('/api/public/tenants/tierra-del-fuego/institutional-assistant/feedback');
    expect(options.body).toEqual({revision:'a'.repeat(64),node_id:'rupe',helpful:false});
    expect(options).toMatchObject({method:'POST',skipAuth:true,omitCredentials:true,omitChatSessionId:true});
    expect(screen.queryByRole('button',{name:'Sí'})).not.toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('Lo vamos a revisar');
  });

  it('thanks the reader even when the mark could not be sent',async()=>{
    apiFetch.mockRejectedValue(new Error('offline'));
    render(<InstitutionalAnswerFeedback workspace={workspace} nodeId="rupe"/>);
    fireEvent.click(screen.getByRole('button',{name:'Sí'}));
    await waitFor(()=>expect(apiFetch).toHaveBeenCalled());
    expect(screen.getByRole('status')).toHaveTextContent('Gracias por avisarnos.');
  });

  it('asks again for another topic',()=>{
    const {rerender}=render(<InstitutionalAnswerFeedback workspace={workspace} nodeId="rupe"/>);
    fireEvent.click(screen.getByRole('button',{name:'Sí'}));
    rerender(<InstitutionalAnswerFeedback workspace={workspace} nodeId="cud"/>);
    expect(screen.getByRole('button',{name:'Sí'})).toBeInTheDocument();
  });
});
