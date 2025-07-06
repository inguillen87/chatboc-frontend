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

# Configuración de Mapeo de Catálogos (Nueva Funcionalidad)

Para facilitar la importación de catálogos de productos desde archivos CSV o Excel de las PYMES, se ha introducido un sistema de configuración de mapeo de columnas. Esto permite a los administradores (o a las PYMES, si se les da el permiso) definir cómo las columnas de sus archivos se corresponden con los campos estándar del sistema.

## Interfaz de Usuario y Flujo

La gestión de mapeos de catálogo y la subida de archivos de catálogo ahora se integran principalmente en la página de **Perfil de la PYME (`/perfil`)**.

### 1. Desde el Perfil de la PYME (`/perfil`):

Dentro de la tarjeta "Cargar Catálogo de Productos" (o "Trámites"):

*   **Subida Simplificada de Archivo:**
    *   El usuario selecciona un archivo (CSV, Excel) y hace clic en "Subir y Procesar Catálogo".
    *   **Lógica de Procesamiento:**
        1.  Si la PYME **no tiene configuraciones de mapeo guardadas**, el sistema redirige al usuario a la página de creación de mapeo (`/admin/pyme/:pymeId/catalog-mappings/new`). El archivo seleccionado se pasa automáticamente a esta página para que el usuario no tenga que volverlo a cargar. La página de mapeo intentará entonces la auto-detección de columnas.
        2.  Si la PYME **tiene una o más configuraciones de mapeo guardadas**, el sistema (actualmente, de forma simplificada) intentará usar la primera configuración encontrada para procesar el archivo directamente.
            *   *(Mejora Futura: Permitir marcar un mapeo como "predeterminado" o seleccionar uno si hay varios).*
            *   Esto requiere un endpoint en el backend (ej. `POST /api/pymes/{pymeId}/process-catalog-file`) que acepte el archivo y el `mappingId` para procesarlo.
        3.  Se muestra un mensaje de éxito o error en la página de perfil.

*   **Configurar Formatos de Archivo (Gestión Avanzada):**
    *   Un botón o enlace discreto (ej. "Configurar Formatos de Archivo...") abre un diálogo modal.
    *   **Diálogo "Mis Formatos de Archivo de Catálogo":**
        *   Lista las configuraciones de mapeo guardadas para la PYME.
        *   Cada configuración muestra su nombre y botones para:
            *   **Editar**: Navega a la página de edición de mapeo (`/admin/pyme/:pymeId/catalog-mappings/:mappingId`).
            *   **Eliminar**: Pide confirmación y luego elimina la configuración.
        *   Un botón **"Crear Nuevo Formato"**: Navega a la página de creación de mapeo (`/admin/pyme/:pymeId/catalog-mappings/new`), esta vez sin un archivo precargado.

### 2. Página de Creación/Edición de Mapeo (`/admin/pyme/:pymeId/catalog-mappings/...`):

Esta página es donde se define o modifica una configuración de mapeo específica. Sus funcionalidades principales son:

1.  **Nombre de la Configuración**: Permite al usuario asignar un nombre descriptivo a la configuración de mapeo (ej. "Mapeo Estándar Productos", "Lista Proveedor X").
2.  **Carga de Archivo de Ejemplo** (si no se precargó desde `/perfil`):
    *   El usuario sube un archivo CSV o Excel de ejemplo. Este archivo se utiliza para extraer los nombres de las columnas.
    *   Si la página se cargó con un archivo precargado (desde el flujo de `/perfil`), este archivo se usa automáticamente.
3.  **Opciones de Lectura del Archivo**:
    *   **Tiene Encabezados**: Checkbox para indicar si la primera fila del archivo (después de saltar filas) contiene los nombres de las columnas.
    *   **Filas a Saltar**: Número de filas al inicio del archivo que deben ignorarse.
    *   **Delimitador CSV**: Para especificar el delimitador.
    *   **Hoja de Excel**: Para seleccionar la hoja a usar en archivos Excel.
4.  **Mapeo de Columnas**:
    *   Muestra "Campos del Sistema" y desplegables con las columnas del archivo del usuario.
    *   **Auto-detección y Sugerencias**: Al procesar las columnas del archivo, el sistema sugiere mapeos automáticamente (marcados con ✨). El umbral de similitud es `0.45`.
5.  **Guardar Configuración**:
    *   Guarda la configuración para uso futuro. Al crear, redirige a la URL de edición.

### Funcionalidades Principales de la Página de Mapeo Detallado:

1.  **Nombre de la Configuración**: Permite al usuario asignar un nombre descriptivo a la configuración de mapeo (ej. "Mapeo Estándar Productos", "Lista Proveedor X").
2.  **Carga de Archivo de Ejemplo**:
    *   El usuario sube un archivo CSV o Excel de ejemplo. Este archivo se utiliza para extraer los nombres de las columnas.
    *   El archivo en sí no se almacena en el backend como parte de esta configuración, solo se usa para el análisis de columnas durante la configuración.
3.  **Opciones de Lectura del Archivo**:
    *   **Tiene Encabezados**: Checkbox para indicar si la primera fila del archivo (después de saltar filas) contiene los nombres de las columnas. Si no, se generan nombres genéricos (Columna 1, Columna 2, ...).
    *   **Filas a Saltar**: Número de filas al inicio del archivo que deben ignorarse antes de leer los encabezados o los datos.
    *   **Delimitador CSV** (solo para archivos CSV/TXT): Permite especificar el delimitador (ej. `,`, `;`, `|`). Si se deja vacío, se intenta auto-detectar.
    *   **Hoja de Excel** (solo para archivos Excel): Si el archivo Excel tiene múltiples hojas, permite seleccionar cuál usar. Se listan las hojas detectadas.
4.  **Mapeo de Columnas**:
    *   La interfaz muestra una lista de "Campos del Sistema" (ej. Nombre del Producto, SKU, Precio, Stock, Descripción, etc.).
    *   Para cada campo del sistema, el usuario puede seleccionar una columna de su archivo (extraída del archivo de ejemplo) desde un desplegable.
    *   **Auto-detección y Sugerencias**: Al cargar un archivo de ejemplo y procesar sus columnas, el sistema automáticamente intenta sugerir mapeos.
        *   La lógica se basa en la similitud de nombres entre las columnas del usuario y las etiquetas/claves de los campos del sistema (usando distancia Levenshtein y normalización de strings).
        *   Las sugerencias se preseleccionan en los desplegables y se marcan visualmente (ej. con un ícono ✨).
        *   El usuario puede aceptar la sugerencia o cambiarla manualmente.
        *   El umbral de similitud actual para una sugerencia es `0.45` (en una escala de 0 a 1).
    *   El usuario puede optar por no mapear un campo del sistema seleccionando "No mapear / Ignorar".
5.  **Guardar Configuración**:
    *   Al guardar, se almacena el nombre de la configuración, los mapeos de columnas seleccionados y las opciones de lectura del archivo.
    *   Esta configuración guardada podrá ser utilizada posteriormente por el backend al procesar un archivo de catálogo real subido por la PYME.

## Lógica de Auto-detección (`src/utils/columnMatcher.ts`)

La utilidad `columnMatcher.ts` contiene la lógica para sugerir mapeos:

*   `normalizeString(str)`: Convierte strings a minúsculas y elimina caracteres no alfanuméricos para una comparación más robusta.
*   `levenshteinDistance(s1, s2)`: Calcula la distancia Levenshtein entre dos strings.
*   `calculateSimilarity(s1, s2)`: Devuelve un score de similitud (0-1) basado en la distancia Levenshtein, normalizado por la longitud de la cadena más larga.
*   `DEFAULT_SYSTEM_FIELDS`: Una lista predefinida de los campos que el sistema espera para los productos.
*   `SIMILARITY_THRESHOLD`: Actualmente `0.45`. Solo las coincidencias con una similitud igual o superior a este umbral se consideran para sugerencias automáticas.
*   `suggestMappings(userColumns, systemFields)`:
    *   Itera sobre cada `systemField`.
    *   Para cada `systemField`, compara su `label` y su `key` con todas las `userColumns` no utilizadas aún.
    *   Toma la `userColumn` que tenga la mayor similitud (si supera el `SIMILARITY_THRESHOLD`).
    *   Devuelve una lista de mapeos sugeridos.

## API Endpoints Relacionados (Backend - Asumido)

Aunque la implementación de la auto-detección es en el frontend, la gestión de las configuraciones de mapeo guardadas requerirá los siguientes endpoints en el backend (cuya definición exacta y comportamiento son manejados por el equipo de backend):

*   `POST /api/pymes/{pyme_id}/catalog-mappings`
    *   Body: `{ name: string, mappings: Record<string, string | null>, fileSettings: { hasHeaders: boolean, skipRows: number, delimiter?: string, sheetName?: string } }`
    *   Crea una nueva configuración de mapeo para la PYME.
*   `GET /api/pymes/{pyme_id}/catalog-mappings`
    *   Lista todas las configuraciones de mapeo guardadas para una PYME.
*   `GET /api/pymes/{pyme_id}/catalog-mappings/{mapping_id}`
    *   Obtiene una configuración de mapeo específica.
*   `PUT /api/pymes/{pyme_id}/catalog-mappings/{mapping_id}`
    *   Actualiza una configuración de mapeo existente.
*   `DELETE /api/pymes/{pyme_id}/catalog-mappings/{mapping_id}`
    *   Elimina una configuración de mapeo.

*(Nota: La implementación real de estos endpoints y el procesamiento de catálogos usando estos mapeos es responsabilidad del backend).*

## Próximos Pasos / Mejoras Futuras (Frontend)

*   Permitir a las PYMES (no solo administradores) gestionar sus propios mapeos si la lógica de roles lo permite.
*   Interfaz para seleccionar una configuración de mapeo al subir un catálogo de productos real.
*   Refinamiento del algoritmo de similitud o permitir al usuario ajustar el umbral de sensibilidad si es necesario.
*   Pruebas de integración de la UI para la página de mapeo.
*   Posibilidad de previsualizar algunas filas del archivo parseado con el mapeo aplicado antes de guardar la configuración.
