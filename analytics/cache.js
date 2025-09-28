const DEFAULT_TTL_MS = Number(process.env.ANALYTICS_CACHE_TTL_MS || 10 * 60 * 1000);

class ResponseCache {
  constructor() {
    this.store = new Map();
  }

  get(key) {
    const hit = this.store.get(key);
    if (!hit) return null;
    if (Date.now() > hit.expiresAt) {
      this.store.delete(key);
      return null;
    }
    return hit.value;
  }

  set(key, value, ttlMs = DEFAULT_TTL_MS) {
    const expiresAt = Date.now() + Math.max(ttlMs, 1000);
    this.store.set(key, { value, expiresAt });
  }

  invalidate(prefix) {
    if (!prefix) {
      this.store.clear();
      return;
    }
    for (const key of this.store.keys()) {
      if (key.startsWith(prefix)) {
        this.store.delete(key);
      }
    }
  }

  stats() {
    return {
      size: this.store.size,
      ttlMs: DEFAULT_TTL_MS,
    };
  }
}

const cache = new ResponseCache();

export { ResponseCache, cache, DEFAULT_TTL_MS };
export default cache;
