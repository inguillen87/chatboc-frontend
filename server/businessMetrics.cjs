const cart = require('./cart.cjs');
const preferences = require('./preferences.cjs');

function getBusinessMetrics(session) {
  const prefs = preferences.getPreferences(session);
  const totalConsultas = prefs.length;

  const cartItems = cart.getCart(session);
  const totalProductos = Object.values(cartItems).reduce((sum, qty) => sum + qty, 0);

  const productCounts = {};
  for (const p of prefs) {
    if (p.startsWith('busqueda:')) continue;
    productCounts[p] = (productCounts[p] || 0) + 1;
  }

  let maxCount = 0;
  for (const c of Object.values(productCounts)) {
    if (c > maxCount) maxCount = c;
  }

  return [
    { label: 'Consultas', value: totalConsultas },
    { label: 'Productos en carrito', value: totalProductos },
    { label: 'Producto más consultado', value: maxCount },
  ];
}

module.exports = { getBusinessMetrics };
