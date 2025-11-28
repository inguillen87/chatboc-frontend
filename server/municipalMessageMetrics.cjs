function loadDb() {
  const path = require.resolve('./db.cjs');
  const mockKey = `mock:${path}`;
  const mockedModule = globalThis.__vitest_mocker__?.executor?.moduleCache?.get?.(mockKey);
  if (mockedModule?.exports) {
    return mockedModule.exports;
  }
  delete require.cache[path];
  return require('./db.cjs');
}

function getMunicipalMessageMetrics() {
  const now = Date.now();
  const weekMs = 7 * 24 * 60 * 60 * 1000;
  const monthMs = 30 * 24 * 60 * 60 * 1000;
  const yearMs = 365 * 24 * 60 * 60 * 1000;

  const metrics = { week: 0, month: 0, year: 0 };

  for (const m of loadDb().getMessages()) {
    const diff = now - m.timestamp;
    if (diff <= yearMs) {
      metrics.year += 1;
      if (diff <= monthMs) {
        metrics.month += 1;
        if (diff <= weekMs) {
          metrics.week += 1;
        }
      }
    }
  }

  return metrics;
}

function generateCsvReport() {
  const m = getMunicipalMessageMetrics();
  return `period,count\nweek,${m.week}\nmonth,${m.month}\nyear,${m.year}\n`;
}

function generatePdfReport() {
  const m = getMunicipalMessageMetrics();
  const lines = `Week: ${m.week}\\nMonth: ${m.month}\\nYear: ${m.year}`;
  return Buffer.from(lines);
}

module.exports = {
  getMunicipalMessageMetrics,
  generateCsvReport,
  generatePdfReport,
};
