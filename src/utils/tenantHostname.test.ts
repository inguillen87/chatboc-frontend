import { describe, expect, it } from 'vitest';

import {
  isDeploymentPlatformHostname,
  isTenantSlugDeploymentHostnameMirror,
  readTenantSlugFromHostname,
} from '@/utils/tenantHostname';

describe('tenant hostname resolution', () => {
  it.each([
    'chatboc-frontend-di3xo3v72-marcelos-projects-c26aa499.vercel.app',
    'chatboc-frontend-git-codex-ju-14e8e5-marcelos-projects-c26aa499.vercel.app',
    'chatboc-frontend.vercel.app',
    'vercel.app',
  ])('keeps Vercel deployment host %s unscoped', (hostname) => {
    expect(isDeploymentPlatformHostname(hostname)).toBe(true);
    expect(readTenantSlugFromHostname(hostname)).toBeNull();
  });

  it('keeps canonical tenant subdomains working', () => {
    expect(readTenantSlugFromHostname('junin.chatboc.ar')).toBe('junin');
    expect(readTenantSlugFromHostname('Rio-Grande.chatboc.ar.')).toBe('rio-grande');
    expect(readTenantSlugFromHostname('municipio.organismo.gob.ar')).toBe('municipio');
  });

  it.each([
    'chatboc.ar',
    'www.chatboc.ar',
    'app.chatboc.ar',
    'panel.chatboc.ar',
    'localhost',
    'tenant.localhost',
    '127.0.0.1',
    '::1',
  ])('does not fabricate a tenant from platform host %s', (hostname) => {
    expect(readTenantSlugFromHostname(hostname)).toBeNull();
  });

  it('recognizes only the stale ambient slug mirrored from the active Vercel host', () => {
    const hostname = 'chatboc-frontend-git-main-team.vercel.app';

    expect(
      isTenantSlugDeploymentHostnameMirror('chatboc-frontend-git-main-team', hostname),
    ).toBe(true);
    expect(isTenantSlugDeploymentHostnameMirror('junin', hostname)).toBe(false);
    expect(
      isTenantSlugDeploymentHostnameMirror(
        'chatboc-frontend-git-main-team',
        'www.chatboc.ar',
      ),
    ).toBe(false);
  });
});
