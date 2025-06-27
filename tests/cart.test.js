const assert = require('assert');
const cart = require('../server/cart');

const session = {};

cart.addItem(session, 'ProductoA', 2);
assert.strictEqual(cart.getCart(session)['ProductoA'], 2, 'add item');

cart.addItem(session, 'ProductoA', 1);
assert.strictEqual(cart.getCart(session)['ProductoA'], 3, 'increment existing');

cart.updateItem(session, 'ProductoA', 5);
assert.strictEqual(cart.getCart(session)['ProductoA'], 5, 'update quantity');

cart.removeItem(session, 'ProductoA');
assert.strictEqual(cart.getCart(session)['ProductoA'], undefined, 'remove item');

console.log('Cart tests passed');
