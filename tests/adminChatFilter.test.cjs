const assert = require('assert');
const path = require('path');

const { filterLoginPrompt } = require(path.join('..','src','utils','adminChatFilter.js'));

const text = 'Por favor, iniciá sesión para ver el catálogo';
const buttons = [
  { texto: 'Login', action: 'login' },
  { texto: 'Otro', action: 'ver' }
];

const admin = filterLoginPrompt(text, buttons, 'admin');
assert.strictEqual(admin.text, '', 'admin text removed');
assert.strictEqual(admin.buttons.length, 1, 'login button filtered');
assert.strictEqual(admin.buttons[0].action, 'ver');

const user = filterLoginPrompt(text, buttons, 'usuario');
assert.strictEqual(user.text, text, 'user text kept');
assert.strictEqual(user.buttons.length, 2, 'user buttons kept');

console.log('Admin chat filter tests passed');
