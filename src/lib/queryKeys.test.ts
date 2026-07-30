import { describe, expect, it } from 'vitest';

import { queryKeys } from './queryKeys';

describe('tenant-scoped survey query keys', () => {
  it('never shares admin, PII, snapshots or analytics caches across tenants', () => {
    expect(queryKeys.surveys.admin(42, 'junin')).not.toEqual(queryKeys.surveys.admin(42, 'mendoza'));
    expect(queryKeys.surveys.adminList('default', 'junin')).not.toEqual(
      queryKeys.surveys.adminList('default', 'mendoza'),
    );
    expect(queryKeys.surveys.responses(42, '{"limit":10}', 'junin')).not.toEqual(
      queryKeys.surveys.responses(42, '{"limit":10}', 'mendoza'),
    );
    expect(queryKeys.surveys.snapshots(42, 'junin')).not.toEqual(
      queryKeys.surveys.snapshots(42, 'mendoza'),
    );
    expect(queryKeys.surveys.analytics('summary', 42, 'junin')).not.toEqual(
      queryKeys.surveys.analytics('summary', 42, 'mendoza'),
    );
  });

  it('normalizes tenant casing without treating an absent tenant as global', () => {
    expect(queryKeys.surveys.admin(42, '  JuNiN ')).toEqual(queryKeys.surveys.admin(42, 'junin'));
    expect(queryKeys.surveys.admin(42)).toContain('unscoped');
  });
});
