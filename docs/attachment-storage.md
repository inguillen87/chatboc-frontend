# Almacenamiento de archivos para el widget

El widget puede mostrar miniaturas y enlaces de descarga si el backend
proporciona la información del archivo en la respuesta del chat. Para cada
adjunto el backend debe incluir un objeto `attachmentInfo` con al menos:

```json
{
  "url": "https://ejemplo.com/archivo.png",
  "name": "archivo.png",
  "type": "image",
  "thumbUrl": "https://ejemplo.com/thumb-archivo.png"
}
```

- **`url`**: enlace público del archivo.
- **`thumbUrl`** (opcional): imagen pequeña para previsualización.

## Opciones de almacenamiento

1. **Hosting estático simple**
   - Subir los archivos manualmente a un host público (por ejemplo `public/`
de la aplicación o un proyecto pequeño en Vercel).
   - Adecuado solo para demos o bajo volumen porque cada archivo nuevo
     requiere desplegar o copiarlo manualmente.

2. **Servicios de almacenamiento dinámico**
   - Plataformas como Cloudinary, Supabase Storage, Backblaze B2 o Amazon S3
     permiten subir archivos desde el backend y obtener una URL inmediata.
   - Suelen ofrecer planes gratuitos con límites de espacio o tráfico.
   - Es posible definir políticas de expiración automática
     (por ejemplo, borrar archivos luego de 15 días).

3. **Migración futura**
   - Si el volumen crece, se puede cambiar a un servicio más potente
     conservando el mismo flujo: el backend sube el archivo al servicio
     elegido y devuelve la URL al widget.

## Recomendaciones

- No hardcodear rutas ni nombres específicos por municipio o pyme.
- Configurar el backend para limpiar periódicamente los archivos vencidos
  si el servicio no lo hace automáticamente.
- Cuando se necesiten miniaturas, generarlas en el backend o usar
  transformaciones del proveedor de almacenamiento.

Con esta arquitectura el frontend permanece "white label" y solo consume las
URLs que recibe del backend, sin requerir cambios por cada entidad.
