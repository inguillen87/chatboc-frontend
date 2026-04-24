import { getMessages } from './db.js';

let cachedMetrics = null;
let lastMessagesRef = null;
let lastComputationTime = 0;
const CACHE_TTL = 10000; // 10 seconds

export function getMunicipalMessageMetrics() {
  const now = Date.now();

  // Check cache validity: within TTL
  if (cachedMetrics && (now - lastComputationTime < CACHE_TTL)) {
    return cachedMetrics;
  }

  const currentMessages = getMessages();

  // Check if messages reference is same, even if TTL expired
  if (cachedMetrics && currentMessages === lastMessagesRef) {
    lastComputationTime = now;
    return cachedMetrics;
  }

  const weekMs = 7 * 24 * 60 * 60 * 1000;
  const monthMs = 30 * 24 * 60 * 60 * 1000;
  const yearMs = 365 * 24 * 60 * 60 * 1000;

  const metrics = { week: 0, month: 0, year: 0 };

  for (const m of currentMessages) {
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

  // Update cache
  cachedMetrics = metrics;
  lastMessagesRef = currentMessages;
  lastComputationTime = now;

  return metrics;
}

export function generateCsvReport(metrics) {
  const m = metrics || getMunicipalMessageMetrics();
  return `period,count\nweek,${m.week}\nmonth,${m.month}\nyear,${m.year}\n`;
}

export function generatePdfReport() {
  const m = getMunicipalMessageMetrics();
  const lines = `Week: ${m.week}\nMonth: ${m.month}\nYear: ${m.year}`;
  return Buffer.from(lines);
}
