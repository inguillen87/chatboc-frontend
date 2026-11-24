import {renderHook,waitFor} from '@testing-library/react';
import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
import {readPublicBrandIdentity} from '@/utils/publicBrandIdentity';

const api=vi.hoisted(()=>({getTenantPublicInfoFlexible:vi.fn()}));
vi.mock('@/api/tenant',()=>api);
import {resetPrivateWorkspaceBrandThemeCache,usePrivateWorkspaceBrandTheme} from './usePrivateWorkspaceBrandTheme';

// Synthetic organization; values only exercise the contracts.
const brand=readPublicBrandIdentity({contract_version:'public.brand_identity.v1',palette:['#112233','#445566','#778899'],
  gradient_stops:[{color:'#112233',x:0.1,y:0.1},{color:'#445566',x:0.9,y:0.9}],
  typography:{family:'Synthetic Sans',fallback:'system-ui',letter_spacing:'-0.02em'},logo:{mark:'https://assets.example.test/mark.png'}})!;
const info=(slug='org-sintetica',extra={})=>({slug,brand_identity:brand,
  workspace_appearance:{tenantSlug:slug,version:1,primary:'#AA5500',accent:'#0055AA'},...extra});
const identity={tenantSlug:'org-sintetica',name:'Organización sintética',logoUrl:null};
const root=document.documentElement;

beforeEach(()=>{resetPrivateWorkspaceBrandThemeCache();api.getTenantPublicInfoFlexible.mockReset();
  root.removeAttribute('style');delete root.dataset.brandIdentity;document.body.removeAttribute('style');});
afterEach(()=>{root.removeAttribute('style');document.body.removeAttribute('style');});

describe('private panel white label',()=>{
  it('applies the organization palette, accents and typography, and restores them on close',async()=>{
    api.getTenantPublicInfoFlexible.mockResolvedValue(info());
    const view=renderHook(()=>usePrivateWorkspaceBrandTheme(identity,true));
    await waitFor(()=>expect(view.result.current).toEqual(brand));
    expect(api.getTenantPublicInfoFlexible).toHaveBeenCalledWith('org-sintetica');
    expect(root.dataset.brandIdentity).toBe('published');
    expect(root.style.getPropertyValue('--brand-accent-1')).toBe('#112233');
    expect(root.style.getPropertyValue('--primary')).not.toBe('');
    expect(document.body.style.fontFamily).toContain('Synthetic Sans');
    expect(document.body.style.letterSpacing).toBe('-0.02em');
    view.unmount();
    expect(root.dataset.brandIdentity).toBeUndefined();
    expect(root.style.getPropertyValue('--brand-accent-1')).toBe('');
    expect(root.style.getPropertyValue('--primary')).toBe('');
    expect(document.body.style.fontFamily).toBe('');
  });

  it('ignores a public profile of another organization and keeps the platform look',async()=>{
    api.getTenantPublicInfoFlexible.mockResolvedValue(info('otra-org'));
    const view=renderHook(()=>usePrivateWorkspaceBrandTheme(identity,true));
    await waitFor(()=>expect(api.getTenantPublicInfoFlexible).toHaveBeenCalled());
    await Promise.resolve();
    expect(view.result.current).toBeNull();
    expect(root.dataset.brandIdentity).toBeUndefined();
  });

  it('does nothing outside the panel and reads each organization once',async()=>{
    api.getTenantPublicInfoFlexible.mockResolvedValue(info());
    renderHook(()=>usePrivateWorkspaceBrandTheme(identity,false));
    expect(api.getTenantPublicInfoFlexible).not.toHaveBeenCalled();
    const first=renderHook(()=>usePrivateWorkspaceBrandTheme(identity,true));
    await waitFor(()=>expect(first.result.current).toEqual(brand));
    first.unmount();
    const second=renderHook(()=>usePrivateWorkspaceBrandTheme(identity,true));
    expect(second.result.current).toEqual(brand);
    expect(api.getTenantPublicInfoFlexible).toHaveBeenCalledTimes(1);
  });

  it('keeps the platform look when the profile cannot be read',async()=>{
    api.getTenantPublicInfoFlexible.mockRejectedValue(new Error('unavailable'));
    const view=renderHook(()=>usePrivateWorkspaceBrandTheme(identity,true));
    await waitFor(()=>expect(api.getTenantPublicInfoFlexible).toHaveBeenCalled());
    expect(view.result.current).toBeNull();
    expect(document.body.style.fontFamily).toBe('');
  });
});
