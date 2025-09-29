function formatDate(date) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function toHours(deltaMs) {
  return deltaMs / (1000 * 60 * 60);
}

function toMinutes(deltaMs) {
  return deltaMs / (1000 * 60);
}

function percentile(values, p) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const rank = (p / 100) * (sorted.length - 1);
  const low = Math.floor(rank);
  const high = Math.ceil(rank);
  if (low === high) return sorted[low];
  const weight = rank - low;
  return sorted[low] + (sorted[high] - sorted[low]) * weight;
}

function average(values) {
  if (!values.length) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function sum(values) {
  return values.reduce((acc, value) => acc + value, 0);
}

function groupBy(list, iteratee) {
  return list.reduce((acc, item) => {
    const key = iteratee(item);
    if (!acc.has(key)) {
      acc.set(key, []);
    }
    acc.get(key).push(item);
    return acc;
  }, new Map());
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

module.exports = {
  formatDate,
  toHours,
  toMinutes,
  percentile,
  average,
  sum,
  groupBy,
  clamp,
};
