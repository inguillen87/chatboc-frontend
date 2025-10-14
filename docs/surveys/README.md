# Plantillas y seed de encuestas municipales

Este directorio incluye herramientas para acelerar la carga de encuestas orientadas a gobiernos locales sin tener que diseñarlas manualmente desde el panel.

## Plantillas disponibles

Las plantillas se definen en [`municipal-templates.json`](./municipal-templates.json) e incluyen variables `{{municipality}}` que se reemplazan automáticamente al momento de crear cada encuesta. Cada plantilla respeta la estructura esperada por el backend (`titulo`, `slug`, `descripcion`, `tipo`, `politica_unicidad`, etc.).

Se incluyen cuatro temáticas base:

1. Servicios públicos y mantenimiento urbano.
2. Seguridad ciudadana y patrullaje preventivo.
3. Movilidad y transporte urbano.
4. Agenda cultural y turística.

## Script de seed

El script [`scripts/seedMunicipalSurveys.mjs`](../../scripts/seedMunicipalSurveys.mjs) permite crear estas encuestas en lote utilizando la API administrativa.

### Requisitos

- Node.js 18 o superior (para contar con `fetch` nativo).
- Un token JWT válido de panel con permisos de administración.
- La URL base del backend de Chatboc (por ejemplo `https://chatbot-backend-2e14.onrender.com`).

### Uso

```bash
# Solo mostrar qué encuestas se generarían
CHATBOC_API_URL="https://chatbot-backend-2e14.onrender.com" \
  node scripts/seedMunicipalSurveys.mjs \
  --municipalities "Junín Mendoza, San Martín Mendoza, Rivadavia Mendoza" \
  --dry-run

# Crear y publicar las encuestas en producción
echo "<TOKEN>" | pbcopy # copiar el token JWT al portapapeles
CHATBOC_API_URL="https://chatbot-backend-2e14.onrender.com" \
CHATBOC_ADMIN_TOKEN="<TOKEN>" \
npm run seed:surveys -- \
  --municipalities "Junín Mendoza, San Martín Mendoza, Rivadavia Mendoza" \
  --publish
```

- `--dry-run` evita realizar llamadas a la API y solo lista los slugs que se prepararían.
- `--publish` publica automáticamente cada encuesta una vez creada.
- También se aceptan las banderas `--api` y `--token` para definir la URL y el token sin variables de entorno.

### Slugs generados

El script arma slugs legibles combinando la plantilla y el nombre del municipio (`servicios-publicos-junin-mendoza`, etc.). Si el slug supera los 80 caracteres se trunca automáticamente.

### Errores y reintentos

Si una petición falla, el script lo reporta en consola y continúa con el resto de las encuestas. Al final muestra un resumen con los slugs creados o pendientes para que puedas reintentar de forma manual.

## Personalización

- Podés duplicar `municipal-templates.json` para agregar nuevas temáticas o ajustar los textos.
- Respetá la estructura de preguntas (`tipo`, `opciones`, rangos mínimos/máximos) para evitar errores de validación del backend.
- Las plantillas son independientes del frontend y no introducen contenido específico en los componentes de React, manteniendo la interfaz "white label".
