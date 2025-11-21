
export function getCart(session) {
  if (!session.cart) {
    session.cart = {};
  }
  return session.cart;
}

export function addItem(session, name, qty = 1) {
  const cart = getCart(session);
  cart[name] = (cart[name] || 0) + qty;
}

export function updateItem(session, name, qty) {
  const cart = getCart(session);
  cart[name] = qty;
}

export function removeItem(session, name) {
  const cart = getCart(session);
  delete cart[name];
}

export function clearCart(session) {
  session.cart = {};
}
