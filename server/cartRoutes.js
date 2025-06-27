const express = require('express');
const router = express.Router();
const cart = require('./cart');

router.get('/', (req, res) => {
  res.json(cart.getCart(req.session));
});

router.post('/', (req, res) => {
  const { nombre, cantidad } = req.body || {};
  if (nombre) {
    cart.addItem(req.session, nombre, Number(cantidad) || 1);
  }
  res.json(cart.getCart(req.session));
});

router.put('/', (req, res) => {
  const { nombre, cantidad } = req.body || {};
  if (nombre) {
    cart.updateItem(req.session, nombre, Number(cantidad) || 1);
  }
  res.json(cart.getCart(req.session));
});

router.delete('/', (req, res) => {
  const { nombre } = req.body || {};
  if (nombre) {
    cart.removeItem(req.session, nombre);
  }
  res.json(cart.getCart(req.session));
});

module.exports = router;
