const assert = require('assert');
const cart = require('../server/cart');
const prefs = require('../server/preferences');
const { getBusinessMetrics } = require('../server/businessMetrics');

const session = {};
cart.addItem(session, 'ProductoA', 2);
cart.addItem(session, 'ProductoB', 1);
prefs.addPreference(session, 'ProductoA');
prefs.addPreference(session, 'ProductoB');
prefs.addPreference(session, 'ProductoA');

const metrics = getBusinessMetrics(session);
assert.strictEqual(metrics.length, 3, 'three metrics returned');
assert.strictEqual(metrics[0].value, 3, 'consultas count');
assert.strictEqual(metrics[1].value, 3, 'cart products count');
assert.strictEqual(metrics[2].value, 2, 'top product count');

console.log('Business metrics tests passed');
