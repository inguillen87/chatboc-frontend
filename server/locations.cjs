const express = require('express');
const router = express.Router();

// Mock location data
const locations = [
  { lat: -34.6037, lng: -58.3816 },
  { lat: -34.6037, lng: -58.4816 },
  { lat: -34.6037, lng: -58.2816 },
  { lat: -34.5037, lng: -58.3816 },
  { lat: -34.7037, lng: -58.3816 },
];

router.get('/locations', (req, res) => {
  res.json(locations);
});

module.exports = router;
