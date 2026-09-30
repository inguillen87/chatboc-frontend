import React from 'react';
import {MemoryRouter} from 'react-router-dom';
import {cleanup,render,screen} from '@testing-library/react';
import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
import {workspace} from '../../../../tests/fixtures/institutional-assistant.synthetic';
const mocks=vi.hoisted(()=>({fetch:vi.fn(),verified:true}));
vi.mock('@/utils/api',()=>({apiFetch:(...args:unknown[])=>mocks.fetch(...args)}));
vi.mock('@/context/TenantContext',()=>({useTenant:()=>({currentSlug:'qa-knowledge'})}));
vi.mock('@/hooks/useUser',()=>({useUser:()=>({user:{id:701,tenant_slug:'qa-knowledge'},loading:false,hasVerifiedSession:mocks.verified})}));
import {KnowledgeSourcesPage} from './KnowledgeSourcesPage';
beforeEach(()=>{mocks.fetch.mockReset();mocks.verified=true;mocks.fetch.mockResolvedValue(workspace());});
afterEach(cleanup);
const show=(path='/admin/knowledge')=>render(<MemoryRouter initialEntries={[path]}><KnowledgeSourcesPage/></MemoryRouter>);
describe('knowledge source console uses real state',()=>{
 it('replaces fixed document cards and numbers with the server workspace',async()=>{
  show();await screen.findByRole('heading',{name:workspace().ui.heading});
  expect(mocks.fetch).toHaveBeenCalledOnce();
  expect(screen.queryByText('Normativa Municipal V2.pdf')).not.toBeInTheDocument();
  expect(screen.queryByText(/Chunks indexados: 145|Hoy 10:30 AM|Ayer 18:45 PM/)).not.toBeInTheDocument();
  expect(screen.getByText(workspace().tenant.name)).toBeVisible();
 });
 it('does not query without a verified session',()=>{mocks.verified=false;show();expect(mocks.fetch).not.toHaveBeenCalled();});
 it('does not use a previous tenant when an explicit request is invalid',()=>{show('/admin/knowledge?tenant_slug=../other');expect(mocks.fetch).not.toHaveBeenCalled();});
});
