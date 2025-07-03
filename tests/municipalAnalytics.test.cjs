const assert = require('assert');
const path = require('path');

const db = require(path.join('..','server','db'));
const { getMunicipalAnalytics } = require(path.join('..','server','municipalAnalytics'));

db.__setTickets([
  { municipality: 'Alpha', category: 'baches', responseMs: 3600000 },
  { municipality: 'Alpha', category: 'baches', responseMs: 7200000 },
  { municipality: 'Beta', category: 'limpieza', responseMs: 3600000 },
]);

const analytics = getMunicipalAnalytics();

assert.strictEqual(analytics.municipalities.length, 2, 'two municipalities');
const alpha = analytics.municipalities.find(m => m.name === 'Alpha');
assert.strictEqual(alpha.totalTickets, 2, 'alpha total');
assert.strictEqual(alpha.categories.baches, 2, 'alpha category count');
assert.strictEqual(alpha.averageResponseHours, 1.5, 'alpha avg hours');

const beta = analytics.municipalities.find(m => m.name === 'Beta');
assert.strictEqual(beta.totalTickets, 1, 'beta total');
assert.strictEqual(beta.categories.limpieza, 1, 'beta category');

console.log('Municipal analytics tests passed');
