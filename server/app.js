const express = require('express');
const { getAttentionMessage } = require('./widgetAttention');

const app = express();

app.get('/widget/attention', (req, res) => {
  res.json({ message: getAttentionMessage() });
});

module.exports = app;

if (require.main === module) {
  const port = process.env.PORT || 3000;
  app.listen(port, () => {
    console.log(`Server listening on port ${port}`);
  });
}
