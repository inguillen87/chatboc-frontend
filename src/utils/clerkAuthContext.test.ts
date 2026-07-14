import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  clearClerkAuthContext,
  persistClerkAuthContext,
  readClerkAuthContext,
  resolvePortalAuthTenantSlug,
  sanitizeClerkReturnPath,
} from './clerkAuthContext';
import { safeSessionStorage } from './safeLocalStorage';

describe('clerkAuthContext', () => {
  beforeEach(() => {
    safeSessionStorage.clear();
    vi.useRealTimers();
  });

  it('persists a tenant portal intent without allowing external redirects', () => {
    persistClerkAuthContext({
      intent: 'tenant_portal',
      tenantSlug: 'Junin',
      returnTo: 'https://evil.test/steal',
    });

    expect(readClerkAuthContext()).toMatchObject({
      intent: 'tenant_portal',
      tenantSlug: 'junin',
      returnTo: null,
    });
  });

  it('keeps same-origin paths and clears completed context', () => {
    persistClerkAuthContext({
      intent: 'tenant_owner',
      returnTo: '/perfil?tab=tickets',
    });

    expect(readClerkAuthContext()?.returnTo).toBe('/perfil?tab=tickets');
    clearClerkAuthContext();
    expect(readClerkAuthContext()).toBeNull();
  });

  it('rejects protocol-relative and auth callback loops', () => {
    expect(sanitizeClerkReturnPath('//evil.test')).toBeNull();
    expect(sanitizeClerkReturnPath('/sso-callback')).toBeNull();
    expect(sanitizeClerkReturnPath('/t/junin/portal/dashboard')).toBe('/t/junin/portal/dashboard');
  });

  it('uses the route tenant before any stale persisted tenant', () => {
    expect(resolvePortalAuthTenantSlug({
      pathname: '/t/junin/user/login',
      currentSlug: 'tenant-viejo',
    })).toBe('junin');
  });

  it('keeps generic portal auth unscoped without explicit tenant context', () => {
    expect(resolvePortalAuthTenantSlug({
      pathname: '/user/login',
      currentSlug: 'tenant-viejo',
    })).toBeNull();
    expect(resolvePortalAuthTenantSlug({
      pathname: '/user/register',
      search: '?tenant_slug=Junin',
      currentSlug: 'tenant-viejo',
    })).toBe('junin');
    expect(resolvePortalAuthTenantSlug({
      pathname: '/user/register',
      currentSlug: 'junin',
      hasWidgetToken: true,
    })).toBe('junin');
  });
});
