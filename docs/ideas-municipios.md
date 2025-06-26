# Ideas para municipios

Este documento agrupa conceptos para mejorar la atención ciudadana.

## Consultar incidentes abiertos

Para listar los tickets en curso de un municipio podés hacer una
petición GET a `/municipal/incidents`. La respuesta incluye la pregunta
original, detalles extras y cualquier archivo adjunto.

Ejemplo de respuesta:

```json
[
  {
    "id": 1,
    "descripcion": "Bache en la calzada",
    "pregunta": "¿Pueden arreglar el bache frente a mi casa?",
    "detalles": "Se formó un pozo profundo que dificulta el tránsito.",
    "archivo_url": "https://example.com/bache.jpg",
    "latitud": -34.6118,
    "longitud": -58.4173,
    "direccion": "Av. Rivadavia 1000",
    "municipio_nombre": "CABA",
    "tipo": "municipio"
  }
]
```
