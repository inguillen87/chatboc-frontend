import { describe, it, expect, beforeEach } from 'vitest';
import * as cart from 'server/cart.js';

describe('cart', () => {
  let session;

  beforeEach(() => {
    session = {};
  });

  it('should add an item to the cart', () => {
    cart.addItem(session, 'ProductoA', 2);
    expect(cart.getCart(session)['ProductoA']).toBe(2);
  });

  it('should increment an existing item in the cart', () => {
    cart.addItem(session, 'ProductoA', 2);
    cart.addItem(session, 'ProductoA', 1);
    expect(cart.getCart(session)['ProductoA']).toBe(3);
  });

  it('should update the quantity of an item in the cart', () => {
    cart.addItem(session, 'ProductoA', 2);
    cart.updateItem(session, 'ProductoA', 5);
    expect(cart.getCart(session)['ProductoA']).toBe(5);
  });

  it('should remove an item from the cart', () => {
    cart.addItem(session, 'ProductoA', 2);
    cart.removeItem(session, 'ProductoA');
    expect(cart.getCart(session)['ProductoA']).toBeUndefined();
  });
});
