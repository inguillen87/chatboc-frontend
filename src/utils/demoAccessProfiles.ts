export interface DemoAccessProfile {
  id: 'superadmin' | 'enterprise_tenant';
  label: string;
  email: string;
  password: string;
  tenantSlug?: string;
}

const resolveEnvValue = (key: string) => {
  const value = (import.meta.env as Record<string, string | undefined>)[key];
  return typeof value === 'string' ? value.trim() : '';
};

const toProfile = (
  id: DemoAccessProfile['id'],
  label: string,
  emailKey: string,
  passwordKey: string,
  tenantSlugKey?: string,
): DemoAccessProfile | null => {
  const email = resolveEnvValue(emailKey);
  const password = resolveEnvValue(passwordKey);
  if (!email || !password) return null;

  const tenantSlug = tenantSlugKey ? resolveEnvValue(tenantSlugKey) : undefined;

  return {
    id,
    label,
    email,
    password,
    tenantSlug: tenantSlug || undefined,
  };
};

export const getDemoAccessProfiles = (): DemoAccessProfile[] => {
  const profiles = [
    toProfile(
      'superadmin',
      'Demo Super Admin',
      'VITE_DEMO_SUPERADMIN_EMAIL',
      'VITE_DEMO_SUPERADMIN_PASSWORD',
    ),
    toProfile(
      'enterprise_tenant',
      'Demo Tenant Enterprise',
      'VITE_DEMO_TENANT_EMAIL',
      'VITE_DEMO_TENANT_PASSWORD',
      'VITE_DEMO_TENANT_SLUG',
    ),
  ];

  return profiles.filter((profile): profile is DemoAccessProfile => Boolean(profile));
};
