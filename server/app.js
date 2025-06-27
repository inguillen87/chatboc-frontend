const express = require('express');
const path = require('path');
const { getAttentionMessage } = require('./widgetAttention');
const { getMunicipalStats } = require('./municipalStats');
const { getFormattedProducts } = require('./catalog');
const { getBusinessMetrics } = require('./businessMetrics');
const sessionMiddleware = require('./session');
const cartRoutes = require('./cartRoutes');
const preferences = require('./preferences');

const app = express();
app.use(express.json());
app.use(sessionMiddleware);

const FILES_DIR = path.join(__dirname, 'files');


app.get('/widget/attention', (req, res) => {
  res.json({ message: getAttentionMessage() });
});

app.get('/municipal/stats', (req, res) => {
  res.json(getMunicipalStats());
});

app.get('/productos', (req, res) => {
  const q = (req.query.q || req.query.search || '').toString().trim();
  if (q) {
    preferences.addPreference(req.session, q);
  }
  res.json(getFormattedProducts());
});

app.get('/files/:name', (req, res) => {
  const filePath = path.join(FILES_DIR, req.params.name);
  res.download(filePath);
});

app.get('/pyme/metrics', (req, res) => {
  res.json(getBusinessMetrics(req.session));
});

app.post('/ask/pyme', (req, res) => {
  const pregunta = (req.body.pregunta || '').toLowerCase();
  if (pregunta.includes('ver catalogo') || pregunta.includes('ver catálogo')) {
    return res.json({ productos: getFormattedProducts() });
  }
  if (
    pregunta.includes('descargar catalogo') ||
    pregunta.includes('descargar catálogo')
  ) {
    return res.json({
      respuesta: 'Descarga directa',
      media_url: '/files/catalog.pdf',
      botones: [
        { texto: 'Descargar catálogo', url: '/files/catalog.pdf' },
      ],
    });
  }
  res.json({ reply: 'Pregunta no reconocida' });
});

app.use('/carrito', cartRoutes);

module.exports = app;

if (require.main === module) {
  const port = process.env.PORT || 3000;
  app.listen(port, () => {
    console.log(`Server listening on port ${port}`);
  });
}
