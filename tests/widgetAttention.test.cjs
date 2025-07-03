const assert = require('assert');
const path = require('path');

const { getAttentionMessage, DEFAULT_MESSAGE } = require(path.join('..','server','widgetAttention'));

// Test default message when env variable is not set
delete process.env.ATTENTION_BUBBLE_CHOICES;
assert.strictEqual(getAttentionMessage(), DEFAULT_MESSAGE, 'should return default when no env provided');

// Test random message selection
process.env.ATTENTION_BUBBLE_CHOICES = 'Hola|Probando';
const seen = new Set();
for (let i = 0; i < 20; i++) {
  seen.add(getAttentionMessage());
}
assert(seen.has('Hola') && seen.has('Probando'), 'should rotate between provided messages');

console.log('All tests passed');
