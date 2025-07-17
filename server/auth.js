const express = require('express');
const { findUser } = require('./users');

const router = express.Router();

router.post('/login', (req, res) => {
  const { email, password } = req.body;
  const user = findUser(email, password);
  if (user) {
    req.session.userId = user.id;
    res.json({
      id: user.id,
      email: user.email,
      role: user.role,
      name: user.name,
    });
  } else {
    res.status(401).json({ error: 'Invalid credentials' });
  }
});

router.post('/logout', (req, res) => {
  req.session.destroy();
  res.status(204).send();
});

router.get('/me', (req, res) => {
  if (req.session.userId) {
    const user = users.find((u) => u.id === req.session.userId);
    if (user) {
      res.json({
        id: user.id,
        email: user.email,
        role: user.role,
        name: user.name,
      });
    } else {
      res.status(404).json({ error: 'User not found' });
    }
  } else {
    res.status(401).json({ error: 'Not authenticated' });
  }
});

module.exports = router;
