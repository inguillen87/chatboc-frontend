const express = require('express');
const { getAttentionMessage } = require('./widgetAttention');
const { getMunicipalStats } = require('./municipalStats');

const app = express();

// Sample list of municipal incidents. In a real project this would come
// from a database. Each ticket includes location data plus the original
// question and any extra details provided by the citizen.
const municipalIncidents = [
  {
    id: 1,
    latitud: -34.6118,
    longitud: -58.4173,
    direccion: 'Av. Rivadavia 1000',
    municipio_nombre: 'CABA',
    tipo: 'municipio',
    descripcion: 'Bache en la calzada',
    pregunta: '¿Pueden arreglar el bache frente a mi casa?',
    detalles: 'Se formó un pozo profundo que dificulta el tránsito.',
    archivo_url: 'https://example.com/bache.jpg'
  },
  {
    id: 2,
    latitud: -34.6037,
    longitud: -58.3816,
    direccion: 'Calle Falsa 123',
    municipio_nombre: 'CABA',
    tipo: 'municipio',
    descripcion: 'Luminaria averiada',
    pregunta: 'La luz de la esquina no funciona',
    detalles: 'La farola está apagada desde hace varios días.',
    archivo_url: null
  }
];

app.get('/widget/attention', (req, res) => {
  res.json({ message: getAttentionMessage() });
});


});

module.exports = app;

if (require.main === module) {
  const port = process.env.PORT || 3000;
  app.listen(port, () => {
    console.log(`Server listening on port ${port}`);
  });
}
