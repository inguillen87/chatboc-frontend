import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import source from '../../tests/fixtures/organization-profile-settings.json';
import { readOrganizationProfile, readProfileSaveReceipt } from '@/utils/organizationProfileSettings';
import { useOrganizationProfileSave } from './useOrganizationProfileSave';
const api=vi.hoisted(()=>vi.fn());
vi.mock('@/utils/api',()=>({apiFetch:api,getErrorMessage:(error:any,fallback:string)=>error?.message||fallback}));
const profile=()=>readOrganizationProfile(structuredClone(source),'tenant-a')!;
const changed=()=>({...profile().values,nombre_empresa:'Nombre editado'});
const receipt=()=>{const p=profile();p.values=changed();p.revision='b'.repeat(64);return {
  contract_version:'organization.profile_save.v1',ok:true,saved:true,provider_calls_performed:false,tenant:p.tenant,profile:p};};
afterEach(()=>{api.mockReset();vi.useRealTimers();});

describe('institutional profile save and conflict recovery',()=>{
  it('sends only changed organization values and the original version',async()=>{
    api.mockResolvedValue(receipt());const {result}=renderHook(()=>useOrganizationProfileSave('a:admin',profile()));
    let answer;await act(async()=>{answer=await result.current.save(changed());});
    expect(answer).toMatchObject({values:{nombre_empresa:'Nombre editado'}});
    expect(api).toHaveBeenCalledWith('/api/admin/tenants/tenant-a/config',expect.objectContaining({method:'PUT',
      tenantSlug:'tenant-a',body:{organization_profile:{nombre_empresa:'Nombre editado'},expected_revision:profile().revision}}));
    expect(result.current.needsReview).toBe(false);
  });
  it('does not call the server for unchanged values',async()=>{
    const {result}=renderHook(()=>useOrganizationProfileSave('a',profile()));
    await act(async()=>{await result.current.save(profile().values);});expect(api).not.toHaveBeenCalled();
  });
  it('allows only one pending write',async()=>{
    let finish:(value:any)=>void;api.mockImplementation(()=>new Promise(resolve=>{finish=resolve;}));
    const {result}=renderHook(()=>useOrganizationProfileSave('a',profile()));
    let pending:Promise<any>;act(()=>{pending=result.current.save(changed());void result.current.save(changed());});
    expect(api).toHaveBeenCalledTimes(1);await act(async()=>{finish!(receipt());await pending;});
  });
  it.each([412,409,428,503,500])('requires review after HTTP %s without resending',async(status)=>{
    api.mockRejectedValue({status,message:'Revisá la versión'});
    const {result}=renderHook(()=>useOrganizationProfileSave('a',profile()));
    await act(async()=>{await result.current.save(changed());});
    expect(result.current.needsReview).toBe(true);
    await act(async()=>{await result.current.save(changed());});expect(api).toHaveBeenCalledTimes(1);
    api.mockResolvedValue({organization_profile:receipt().profile});
    await act(async()=>{await result.current.review();});
    expect(result.current.latest?.revision).toBe('b'.repeat(64));expect(result.current.needsReview).toBe(true);
    act(()=>{result.current.acceptReview();});expect(result.current.needsReview).toBe(false);
    expect(api).toHaveBeenCalledTimes(2);
  });
  it.each([401,403,404])('denied status %s prevents review and writes',async(status)=>{
    api.mockRejectedValue({status,message:'Denied'});const {result}=renderHook(()=>useOrganizationProfileSave('a',profile()));
    await act(async()=>{await result.current.save(changed());});expect(result.current.denied).toBe(true);
    await act(async()=>{await result.current.review();await result.current.save(changed());});
    expect(api).toHaveBeenCalledTimes(1);
  });
  it('discards a late result after changing organization or permission scope',async()=>{
    let finish:(value:any)=>void;api.mockImplementation(()=>new Promise(resolve=>{finish=resolve;}));
    const {result,rerender}=renderHook(({scope})=>useOrganizationProfileSave(scope,profile()),{initialProps:{scope:'a:admin'}});
    let pending:Promise<any>;act(()=>{pending=result.current.save(changed());});
    rerender({scope:'b:reader'});let answer;await act(async()=>{finish!(receipt());answer=await pending;});
    expect(answer).toBeNull();expect(result.current.needsReview).toBe(false);expect(result.current.pending).toBe(false);
  });
  it('does not accept a receipt from another organization',async()=>{
    const bad=receipt();bad.profile.tenant.slug='tenant-b';api.mockResolvedValue(bad);
    const {result}=renderHook(()=>useOrganizationProfileSave('a',profile()));
    await act(async()=>{expect(await result.current.save(changed())).toBeNull();});
    expect(result.current.needsReview).toBe(true);
  });
  it('time bounds the response without claiming a remote rollback',async()=>{
    vi.useFakeTimers();api.mockImplementation(()=>new Promise(()=>{}));
    const {result}=renderHook(()=>useOrganizationProfileSave('a',profile()));
    let pending:Promise<any>;act(()=>{pending=result.current.save(changed());});
    await act(async()=>{await vi.advanceTimersByTimeAsync(15001);await pending;});
    expect(result.current.pending).toBe(false);expect(result.current.needsReview).toBe(true);
  });
  it('has no save authority without the backend contract',async()=>{
    const {result}=renderHook(()=>useOrganizationProfileSave('a',null));
    await act(async()=>{await result.current.save(changed());});expect(api).not.toHaveBeenCalled();
  });
});
