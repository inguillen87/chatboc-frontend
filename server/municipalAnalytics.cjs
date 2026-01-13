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

function getAgeRange(age) {
  if (age < 18) return '0-17';
  if (age < 30) return '18-29';
  if (age < 50) return '30-49';
  return '50+';
}

function getMunicipalAnalytics() {
  const tickets = loadDb().getTickets();
  const statsMap = new Map();
  const genderTotals = {};
  const ageTotals = {};
  for (const t of tickets) {
    const key = t.municipality;
    if (!statsMap.has(key)) {
      statsMap.set(key, {
        total: 0,
        categories: {},
        totalResponseMs: 0,
        gender: {},
        ages: {},
      });
    }
    const s = statsMap.get(key);
    s.total += 1;
    s.categories[t.category] = (s.categories[t.category] || 0) + 1;
    s.totalResponseMs += t.responseMs || 0;
    if (t.gender) {
      s.gender[t.gender] = (s.gender[t.gender] || 0) + 1;
      genderTotals[t.gender] = (genderTotals[t.gender] || 0) + 1;
    }
    if (typeof t.age === 'number') {
      const range = getAgeRange(t.age);
      s.ages[range] = (s.ages[range] || 0) + 1;
      ageTotals[range] = (ageTotals[range] || 0) + 1;
    }
  }
  const result = [];
  for (const [name, s] of statsMap.entries()) {
    const avgMs = s.total ? s.totalResponseMs / s.total : 0;
    result.push({
      name,
      totalTickets: s.total,
      categories: s.categories,
      averageResponseHours: +(avgMs / 3600000).toFixed(2),
      gender: s.gender,
      ageRanges: s.ages,
    });
  }
  return { municipalities: result, genderTotals, ageRanges: ageTotals };
}

module.exports = { getMunicipalAnalytics };
