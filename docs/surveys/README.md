# Plantillas y seed de encuestas municipales

Este directorio incluye herramientas para acelerar la carga de encuestas orientadas a gobiernos locales sin tener que diseñarlas manualmente desde el panel.

## Plantillas disponibles

Las plantillas se definen en [`municipal-templates.json`](./municipal-templates.json) e incluyen variables `{{municipality}}` que se reemplazan automáticamente al momento de crear cada encuesta. Cada plantilla respeta la estructura esperada por el backend (`titulo`, `slug`, `descripcion`, `tipo`, `politica_unicidad`, etc.).

Se incluyen plantillas orientadas a:

1. Servicios públicos, mantenimiento urbano y obras 2025.
2. Seguridad ciudadana y patrullaje preventivo.
3. Movilidad, transporte y agenda cultural.
4. Participación digital, ciudad sustentable y puntos limpios.
5. Intención de voto 2025, agenda económica e inflación en hogares.
6. Consulta hídrica 2026 frente a escenarios de sequía.

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

## Respuestas de demostración

El script [`scripts/seedSurveyResponses.mjs`](../../scripts/seedSurveyResponses.mjs) genera respuestas aleatorias con metadatos demográficos, UTM y coordenadas GPS para visualizar mapas de calor en los tableros.

### Opciones principales

- `--slug` (**obligatorio**): slug público de la encuesta publicada.
- `--count`: cantidad de respuestas a simular (por defecto 50).
- `--scenario`: perfil demográfico preconfigurado. Disponible para `mendoza-sustentable-2025`, `mendoza-intencion-voto-2025`, `mendoza-costo-vida-2025` y `mendoza-agua-2026`. Si no se especifica se intenta detectar según el slug.
- `--municipality`: etiqueta de municipio/ciudad a incluir en los metadatos.
- `--center` y `--radius`: coordenadas y radio (en km) para concentrar el muestreo manualmente.
- `--dry-run`: muestra un ejemplo de payload sin enviar respuestas al backend.

### Ejemplo

```bash
CHATBOC_API_URL="https://chatbot-backend-2e14.onrender.com" \
  node scripts/seedSurveyResponses.mjs \
  --slug ciudad-sustentable-2025-junin-mendoza \
  --count 120 \
  --scenario mendoza-sustentable-2025 \
  --municipality "Junín, Mendoza"
```

El comando anterior distribuye 120 respuestas con ubicaciones en Junín, canales mixtos (web, WhatsApp, QR) y preguntas respondidas según los sesgos configurados para la agenda sustentable 2025.
