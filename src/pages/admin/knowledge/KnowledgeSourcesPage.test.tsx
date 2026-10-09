import React from 'react';
import {MemoryRouter,Route,Routes} from 'react-router-dom';
import {cleanup,render,screen} from '@testing-library/react';
import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
import {workspace} from '../../../../tests/fixtures/institutional-assistant.synthetic';
const mocks=vi.hoisted(()=>({fetch:vi.fn(),verified:true,profileVerified:true,currentSlug:'qa-knowledge',role:'tenant_admin',sessionSlug:'qa-knowledge'}));
vi.mock('@/utils/api',()=>({apiFetch:(...args:unknown[])=>mocks.fetch(...args)}));
vi.mock('@/context/TenantContext',()=>({useTenant:()=>({currentSlug:mocks.currentSlug})}));
vi.mock('@/hooks/useUser',()=>({useUser:()=>({user:{id:701,tenant_slug:mocks.sessionSlug,rol:mocks.role},loading:false,hasVerifiedSession:mocks.verified,organizationProfileVerified:mocks.profileVerified})}));
import {KnowledgeSourcesPage} from './KnowledgeSourcesPage';
beforeEach(()=>{mocks.fetch.mockReset();mocks.verified=true;mocks.profileVerified=true;mocks.currentSlug='qa-knowledge';mocks.sessionSlug='qa-knowledge';mocks.role='tenant_admin';mocks.fetch.mockResolvedValue(workspace());});
afterEach(cleanup);
const show=(path='/admin/knowledge')=>render(<MemoryRouter initialEntries={[path]}><Routes><Route path="/admin/knowledge" element={<KnowledgeSourcesPage/>}/><Route path="/403" element={<div>Acceso denegado</div>}/></Routes></MemoryRouter>);
describe('knowledge source console uses real state',()=>{
 it('replaces fixed document cards and numbers with the server workspace',async()=>{
  show();await screen.findByRole('heading',{name:workspace().ui.heading});
  expect(mocks.fetch).toHaveBeenCalledOnce();
  expect(screen.queryByText('Normativa Municipal V2.pdf')).not.toBeInTheDocument();
  expect(screen.queryByText(/Chunks indexados: 145|Hoy 10:30 AM|Ayer 18:45 PM/)).not.toBeInTheDocument();
  expect(screen.getByText(workspace().tenant.name)).toBeVisible();
 });
 it('does not query without a verified session',()=>{mocks.verified=false;show();expect(mocks.fetch).not.toHaveBeenCalled();});
 it('does not trust a stored organization before /api/me has been verified',()=>{mocks.profileVerified=false;show();expect(mocks.fetch).not.toHaveBeenCalled();});
 it('does not use a previous tenant when an explicit request is invalid',()=>{show('/admin/knowledge?tenant_slug=../other');expect(mocks.fetch).not.toHaveBeenCalled();});
 it('uses the verified session organization instead of the last public tenant',async()=>{
  mocks.currentSlug='previous-public-space';show();await screen.findByRole('heading',{name:workspace().ui.heading});
  expect(mocks.fetch.mock.calls[0][0]).toBe('/api/admin/tenants/qa-knowledge/institutional-assistant');
  expect(mocks.fetch.mock.calls[0][1]).toMatchObject({tenantSlug:'qa-knowledge',omitEntityToken:true,persistTenantSlug:false});
 });
 it('rejects a tenant operator requesting another organization before loading private knowledge',()=>{
  show('/admin/knowledge?tenant_slug=another-organization');expect(mocks.fetch).not.toHaveBeenCalled();expect(screen.getByText('Acceso denegado')).toBeVisible();
 });
 it('allows a scoped delegate in their verified organization',async()=>{
  mocks.role='empleado';show();await screen.findByRole('heading',{name:workspace().ui.heading});expect(mocks.fetch).toHaveBeenCalledOnce();
 });
 it('uses the organization explicitly chosen by SuperAdmin without mixing a stored scope',async()=>{
  mocks.role='superadmin';mocks.currentSlug='previous-public-space';mocks.sessionSlug='another-organization';
  show('/admin/knowledge?tenant_slug=qa-knowledge');await screen.findByRole('heading',{name:workspace().ui.heading});
  expect(mocks.fetch.mock.calls[0][0]).toBe('/api/admin/tenants/qa-knowledge/institutional-assistant');
 });
 it('rejects ambiguous duplicate tenant selectors',()=>{
  mocks.role='superadmin';show('/admin/knowledge?tenant_slug=qa-knowledge&tenant_slug=another-organization');expect(mocks.fetch).not.toHaveBeenCalled();expect(screen.getByText('Acceso denegado')).toBeVisible();
 });
});
