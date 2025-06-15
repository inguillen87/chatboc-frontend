# AGENT Guidelines for Chatboc Frontend

Estas son las pautas de desarrollo para este proyecto. Deben respetarse en toda la base de código.

## 1. UI controlada por el backend
- La interfaz se adapta a lo que indique el backend.
- Si el backend solicita ubicación, se muestra el modal para pedir GPS.
- Si el backend devuelve coordenadas `lat,lng` o dirección, se muestran en el mapa.
- Cualquier sugerencia, botón o texto siempre proviene del backend. No inventar contenido en el frontend.

## 2. Checklist para Frontend
- No se hardcodean textos por municipio/pyme en React ni en archivos TSX/JSX.
- Todo texto, botón o nombre de trámite llega como parte de la respuesta JSON del backend.
- Solo se muestra el mapa si el backend provee ubicación o pide dirección/GPS.
- Al sumar un municipio nuevo, solo se actualizan archivos de configuración/JSON. No modificar componentes ni lógica para personalizar.
- El frontend debe ser 100% "white label". Recibe la información y la muestra sin personalizaciones locales.
