function getCart(session) {
  if (!session.cart) {
    session.cart = {};
  }
  return session.cart;
}

function addItem(session, name, qty = 1) {
  const cart = getCart(session);
  cart[name] = (cart[name] || 0) + qty;
}

function updateItem(session, name, qty) {
  const cart = getCart(session);
  cart[name] = qty;
}

function removeItem(session, name) {
  const cart = getCart(session);
  delete cart[name];
}

function clearCart(session) {
  session.cart = {};
}

module.exports = {
  getCart,
  addItem,
  updateItem,
  removeItem,
  clearCart,
};
