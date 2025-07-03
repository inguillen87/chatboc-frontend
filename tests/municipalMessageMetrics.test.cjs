const assert = require('assert');
const path = require('path');

const db = require(path.join('..','server','db'));
const { getMunicipalMessageMetrics } = require(path.join('..','server','municipalMessageMetrics'));

const now = Date.now();

// messages: 2 days ago, 8 days ago, 20 days ago, 370 days ago
const msgs = [
  { municipality: 'Alpha', timestamp: now - 2 * 86400000 },
  { municipality: 'Alpha', timestamp: now - 8 * 86400000 },
  { municipality: 'Beta', timestamp: now - 20 * 86400000 },
  { municipality: 'Beta', timestamp: now - 370 * 86400000 },
];

db.__setMessages(msgs);

const metrics = getMunicipalMessageMetrics();
assert.strictEqual(metrics.week, 1, 'week count');
assert.strictEqual(metrics.month, 3, 'month count');
assert.strictEqual(metrics.year, 3, 'year count');

console.log('Municipal message metrics tests passed');
