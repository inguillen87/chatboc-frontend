import { afterEach, describe, expect, it, vi } from 'vitest';
import { BackendReadinessLeases, READINESS_LEASE_MS } from './backendReadinessLease';

afterEach(() => { vi.useRealTimers(); });

describe('finite backend readiness leases', () => {
  it('shares in-flight verification without declaring it ready', () => {
    const leases = new BackendReadinessLeases();
    const pending = leases.track('a', new Promise<void>(() => {}));
    expect(leases.get('a', 999_999_999)).toBe(pending);
  });
  it('expires readiness at the exact boundary instead of caching success forever', async () => {
    vi.useFakeTimers(); vi.setSystemTime(1_000);
    const leases = new BackendReadinessLeases();
    const result = leases.track('a', Promise.resolve()); await result;
    expect(leases.get('a', 1_000 + READINESS_LEASE_MS - 1)).toBe(result);
    expect(leases.get('a', 1_000 + READINESS_LEASE_MS)).toBeNull();
  });
  it('invalidates a settled observation after a clock rollback', async () => {
    vi.useFakeTimers(); vi.setSystemTime(1_000);
    const leases = new BackendReadinessLeases();
    await leases.track('a', Promise.resolve());
    expect(leases.get('a', 999)).toBeNull();
  });
  it('does not retain a failed attempt', async () => {
    const leases = new BackendReadinessLeases();
    await expect(leases.track('a', Promise.reject(new Error('failed')))).rejects.toThrow('failed');
    expect(leases.get('a')).toBeNull();
  });
  it('a late failed flight cannot delete a newer attempt after invalidation', async () => {
    const leases = new BackendReadinessLeases();
    let reject!: (error: Error) => void;
    const old = leases.track('a', new Promise<void>((_, fail) => { reject = fail; }));
    const rejected = expect(old).rejects.toThrow('old');
    leases.clear();
    const replacement = leases.track('a', Promise.resolve()); await replacement;
    reject(new Error('old')); await rejected;
    expect(leases.get('a')).toBe(replacement);
  });
  it('separates hosts and declared releases', async () => {
    const leases = new BackendReadinessLeases();
    const a = leases.track('host:revision-a', Promise.resolve()); await a;
    expect(leases.get('host:revision-b')).toBeNull();
    expect(leases.get('other:revision-a')).toBeNull();
  });
});
