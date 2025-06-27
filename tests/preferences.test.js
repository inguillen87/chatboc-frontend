const assert = require('assert');
const prefs = require('../server/preferences');

const session = {};

prefs.addPreference(session, 'busqueda:camisa');
prefs.addPreference(session, 'Camisa Oxford');

assert.deepStrictEqual(prefs.getPreferences(session), ['busqueda:camisa', 'Camisa Oxford'], 'records preferences');

prefs.clearPreferences(session);
assert.deepStrictEqual(prefs.getPreferences(session), [], 'clears preferences');

console.log('Preferences tests passed');
