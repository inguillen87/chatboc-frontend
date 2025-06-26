const express = require('express');
const { getAttentionMessage } = require('./widgetAttention');
const { getMunicipalStats } = require('./municipalStats');

const app = express();

app.get('/widget/attention', (req, res) => {
  res.json({ message: getAttentionMessage() });
});

app.get('/municipal/stats', (req, res) => {
  res.json(getMunicipalStats());
});

app.get('/municipal/analytics', (req, res) => {
  res.json(getMunicipalStats());
});

module.exports = app;

if (require.main === module) {
  const port = process.env.PORT || 3000;
  app.listen(port, () => {
    console.log(`Server listening on port ${port}`);
  });
}
