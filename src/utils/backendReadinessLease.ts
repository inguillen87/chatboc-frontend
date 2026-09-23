/** A readiness observation is short-lived, never a permanent session guarantee. */
export const READINESS_LEASE_MS = 30_000;

type Lease = { promise: Promise<void>; readyAt: number | null };

export class BackendReadinessLeases {
  private readonly entries = new Map<string, Lease>();

  get(key: string, now = Date.now()): Promise<void> | null {
    const entry = this.entries.get(key);
    if (!entry) return null;
    // Pending callers share work. A clock rollback invalidates a settled lease.
    if (entry.readyAt === null || (now >= entry.readyAt && now - entry.readyAt < READINESS_LEASE_MS)) {
      return entry.promise;
    }
    this.entries.delete(key);
    return null;
  }

  track(key: string, promise: Promise<void>): Promise<void> {
    const entry: Lease = { promise, readyAt: null };
    const tracked = promise.then(() => {
      if (this.entries.get(key) === entry) entry.readyAt = Date.now();
    }, (error: unknown) => {
      if (this.entries.get(key) === entry) this.entries.delete(key);
      throw error;
    });
    entry.promise = tracked;
    this.entries.set(key, entry);
    return tracked;
  }

  /** Forget a completed observation, but never start a second concurrent probe. */
  invalidateSettled(key: string): void {
    const entry = this.entries.get(key);
    if (entry && entry.readyAt !== null) this.entries.delete(key);
  }

  clear(): void { this.entries.clear(); }
}
