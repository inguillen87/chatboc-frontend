const metrics = {
  requests: 0,
  cacheHits: 0,
  cacheMisses: 0,
  errors: 0,
  latencies: [],
  lastJobs: [],
};

function trackRequest(durationMs, { cacheHit = false } = {}) {
  metrics.requests += 1;
  if (cacheHit) {
    metrics.cacheHits += 1;
  } else {
    metrics.cacheMisses += 1;
  }
  if (Number.isFinite(durationMs)) {
    metrics.latencies.push(durationMs);
    if (metrics.latencies.length > 1000) {
      metrics.latencies.shift();
    }
  }
}

function trackError() {
  metrics.errors += 1;
}

function trackJobRun(name, durationMs) {
  metrics.lastJobs.unshift({
    name,
    durationMs,
    ranAt: new Date().toISOString(),
  });
  metrics.lastJobs = metrics.lastJobs.slice(0, 20);
}

function percentile(values, p) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.floor((sorted.length - 1) * p);
  return sorted[idx];
}

function getHealthSnapshot(cacheStats = { size: 0, ttlMs: 0 }) {
  const durations = metrics.latencies;
  return {
    requests: metrics.requests,
    cache: {
      hits: metrics.cacheHits,
      misses: metrics.cacheMisses,
      size: cacheStats.size,
      ttlMs: cacheStats.ttlMs,
      hitRate:
        metrics.cacheHits + metrics.cacheMisses === 0
          ? 0
          : Number(
              (
                (metrics.cacheHits /
                  (metrics.cacheHits + metrics.cacheMisses)) *
                100
              ).toFixed(2),
            ),
    },
    errors: metrics.errors,
    latency: {
      p50: percentile(durations, 0.5),
      p90: percentile(durations, 0.9),
      p95: percentile(durations, 0.95),
    },
    lastJobs: metrics.lastJobs,
  };
}

export { trackRequest, trackError, trackJobRun, getHealthSnapshot };
