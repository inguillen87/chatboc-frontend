import { afterEach, describe, expect, it, vi } from 'vitest';
import { getDemoAccessProfiles } from '@/utils/demoAccessProfiles';

describe('demoAccessProfiles', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('returns configured demo profiles from environment', () => {
    vi.stubEnv('VITE_DEMO_SUPERADMIN_EMAIL', 'super@demo.test');
    vi.stubEnv('VITE_DEMO_SUPERADMIN_PASSWORD', 'secret-1');
    vi.stubEnv('VITE_DEMO_TENANT_EMAIL', 'tenant@demo.test');
    vi.stubEnv('VITE_DEMO_TENANT_PASSWORD', 'secret-2');
    vi.stubEnv('VITE_DEMO_TENANT_SLUG', 'demo-tenant');

    const profiles = getDemoAccessProfiles();

    expect(profiles).toHaveLength(2);
    expect(profiles[0].id).toBe('superadmin');
    expect(profiles[1].tenantSlug).toBe('demo-tenant');
  });

  it('omits profiles with missing credentials', () => {
    vi.stubEnv('VITE_DEMO_SUPERADMIN_EMAIL', '');
    vi.stubEnv('VITE_DEMO_SUPERADMIN_PASSWORD', '');

    const profiles = getDemoAccessProfiles();
    expect(profiles).toHaveLength(0);
  });
});
