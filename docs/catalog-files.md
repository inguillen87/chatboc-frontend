# Descarga de catálogos y listas

El backend expone los archivos subidos por cada empresa en una ruta pública.

```
GET /files/:nombre
```

- `:nombre` es el nombre original que cargó el administrador (PDF o Excel).
- El servidor envía los encabezados `Content-Disposition` y `Content-Type`
  para que el navegador descargue el archivo directamente.
- Cada archivo queda asociado al token de la empresa o rubro que lo subió.
  El frontend sólo muestra los enlaces que recibe desde el bot.

Ejemplo de respuesta en el chat:

```
{"text": "catalogo.pdf", "mediaUrl": "https://miapp.com/files/catalogo.pdf"}
```

Al hacer clic se descarga exactamente ese PDF sin pedir datos extra.

El bot también puede ofrecer un botón con `url` para iniciar la descarga.

```
{
  "respuesta": "Descarga directa",
  "botones": [{
    "texto": "Descargar catálogo",
    "url": "https://miapp.com/files/catalogo.pdf"
  }]
}
```
