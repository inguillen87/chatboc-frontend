import { describe, expect, it } from 'vitest';
import { hasRequiredRole, isBackofficeRole, normalizeRole } from '@/utils/roles';

describe('roles helpers', () => {
  it('normalizes legacy and canonical role aliases', () => {
    expect(normalizeRole('super_admin')).toBe('superadmin');
    expect(normalizeRole('admin')).toBe('tenant_admin');
    expect(normalizeRole('empleado')).toBe('employee');
    expect(normalizeRole('tenant_admin')).toBe('tenant_admin');
    expect(normalizeRole('tenant-admin')).toBe('tenant_admin');
    expect(normalizeRole('tenant_owner')).toBe('tenant_admin');
    expect(normalizeRole('administrador')).toBe('tenant_admin');
    expect(normalizeRole('admin_pyme')).toBe('tenant_admin');
    expect(normalizeRole('municipio_admin')).toBe('tenant_admin');
    expect(normalizeRole('municipal_admin')).toBe('tenant_admin');
    expect(normalizeRole('government_admin')).toBe('tenant_admin');
    expect(normalizeRole('school_admin')).toBe('tenant_admin');
    expect(normalizeRole('employee')).toBe('employee');
    expect(normalizeRole('operador')).toBe('employee');
    expect(normalizeRole('chat_user')).toBe('end_user');
  });

  it('matches aliases between current role and allowed role list', () => {
    expect(hasRequiredRole('admin', ['tenant_admin'])).toBe(true);
    expect(hasRequiredRole('tenant-admin', ['tenant_admin'])).toBe(true);
    expect(hasRequiredRole('tenant_owner', ['tenant_admin'])).toBe(true);
    expect(hasRequiredRole('administrador', ['tenant_admin'])).toBe(true);
    expect(hasRequiredRole('municipio_admin', ['tenant_admin'])).toBe(true);
    expect(hasRequiredRole('municipal_admin', ['tenant_admin'])).toBe(true);
    expect(hasRequiredRole('government_admin', ['tenant_admin'])).toBe(true);
    expect(hasRequiredRole('agent', ['employee'])).toBe(true);
    expect(hasRequiredRole('operador', ['employee'])).toBe(true);
    expect(hasRequiredRole('super_admin', ['superadmin'])).toBe(true);
    expect(hasRequiredRole('user', ['employee', 'tenant_admin'])).toBe(false);
  });

  it('detects backoffice roles from canonical and legacy names', () => {
    expect(isBackofficeRole('tenant_admin')).toBe(true);
    expect(isBackofficeRole('admin')).toBe(true);
    expect(isBackofficeRole('administrador')).toBe(true);
    expect(isBackofficeRole('municipal_admin')).toBe(true);
    expect(isBackofficeRole('empleado')).toBe(true);
    expect(isBackofficeRole('chat_user')).toBe(false);
  });
});
