const DEFAULT_TTL_MS = 10 * 60 * 1000;

class MemoryCache {
  constructor(ttlMs = DEFAULT_TTL_MS) {
    this.ttlMs = ttlMs;
    this.store = new Map();
  }

  get(key) {
    const record = this.store.get(key);
    if (!record) return null;
    const { value, expiresAt } = record;
    if (Date.now() > expiresAt) {
      this.store.delete(key);
      return null;
    }
    return value;
  }

  set(key, value, ttlMs = this.ttlMs) {
    const expiresAt = Date.now() + ttlMs;
    this.store.set(key, { value, expiresAt });
  }

  clear() {
    this.store.clear();
  }

  stats() {
    return {
      size: this.store.size,
      ttlMs: this.ttlMs,
    };
  }
}

module.exports = {
  MemoryCache,
  cache: new MemoryCache(),
};
