const assert = require('assert');
const path = require('path');
const { getFormattedProducts } = require(path.join('..', 'server', 'catalog'));

const products = getFormattedProducts();
assert(Array.isArray(products), 'returns array');
assert(products.length >= 3, 'at least three products');

const camisa = products.find(p => p.nombre === 'Camisa Oxford');
assert(camisa, 'Camisa Oxford present');
assert(Array.isArray(camisa.variants) && camisa.variants.length === 1, 'groups variants');

console.log('Catalog tests passed');
