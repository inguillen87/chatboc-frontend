// src/types/chat.ts
export interface AttachmentInfo {
  name: string;
  url: string;
  mimeType?: string;
  size?: number;
}
// Define cómo es un objeto Boton
export interface Boton {
  texto: string;
  url?: string;
  accion_interna?: string; // Para acciones que el frontend debe interpretar sin enviar al backend (ej. abrir panel)
  action?: string; // Valor que se envía al backend cuando se hace clic en el botón
}

// Nuevo: Define la estructura para una categoría de botones
export interface Categoria {
  titulo: string; // Título de la categoría que se mostrará en el acordeón
  botones: Boton[]; // Array de botones dentro de esa categoría
}

// Nuevo: Define la estructura para contenido estructurado dentro de un mensaje
export interface StructuredContentItem {
  label: string; // Etiqueta del dato, ej. "Precio", "Stock"
  value: string | number; // Valor del dato
  type?: 'text' | 'quantity' | 'price' | 'date' | 'url' | 'badge'; // Tipo de dato para formateo/estilo
  unit?: string; // ej. "kg", "unidades", "cajas" (para type 'quantity')
  currency?: string; // ej. "ARS", "USD" (para type 'price')
  url?: string; // Si el valor debe ser un enlace (especialmente si type es 'url')
  styleHint?: 'normal' | 'bold' | 'italic' | 'highlight' | 'success' | 'warning' | 'danger'; // Sugerencia de estilo para el valor
  badgeVariant?: 'default' | 'secondary' | 'destructive' | 'outline' | 'success' | 'warning'; // Para type 'badge'
}

// Define cómo es un objeto Mensaje
export interface Message {
  id: number; // Identificador único del mensaje
  text: string; // Texto principal o fallback del mensaje. Puede ser HTML sanitizado.
  isBot: boolean; // True si el mensaje es del bot, false si es del usuario
  timestamp: Date; // Fecha y hora del mensaje
  botones?: Boton[]; // Array de botones interactivos asociados al mensaje (si los hay)
  categorias?: Categoria[]; // Array de categorías con botones (formato anidado para acordeones)
  query?: string; // La consulta original del usuario que generó esta respuesta (opcional)

  // Campos para contenido multimedia y adjuntos
  mediaUrl?: string; // URL directa a una imagen/video (para compatibilidad o casos simples)
  locationData?: { // Datos de ubicación (para mostrar un mapa o coordenadas)
    lat: number;
    lon: number;
    name?: string; // Nombre del lugar (ej. "Plaza Independencia")
    address?: string; // Dirección formateada
  };
  attachmentInfo?: { // Información detallada de un archivo adjunto
    name: string; // Nombre del archivo (ej. "documento.pdf")
    url: string; // URL para descargar/visualizar el archivo
    mimeType?: string; // Tipo MIME del archivo (ej. "application/pdf", "image/jpeg")
    size?: number; // Tamaño del archivo en bytes (opcional)
  };

  // Campos para contenido estructurado y personalización de la UI
  structuredContent?: StructuredContentItem[]; // Array de items para mostrar datos clave-valor o tarjetas de información
  displayHint?: 'default' | 'pymeProductCard' | 'municipalInfoSummary' | 'genericTable' | 'compactList'; // Sugerencia para el frontend sobre cómo renderizar la totalidad del mensaje
  chatBubbleStyle?: 'standard' | 'compact' | 'emphasis' | 'alert'; // Para controlar el estilo visual de la burbuja del mensaje
}

// --- INTERFAZ PARA EL PAYLOAD DE ENVÍO DE MENSAJES (lo que el usuario envía al bot) ---
export interface SendPayload {
  text: string; // Texto del mensaje del usuario

  // Para adjuntos que el usuario envía (el backend los procesa y puede devolver un Message con attachmentInfo)
  es_foto?: boolean; // Deprecar en favor de attachmentInfo con mimeType. Indica si el adjunto es una foto.
  archivo_url?: string; // Deprecar en favor de attachmentInfo. URL del archivo subido por el usuario.

  es_ubicacion?: boolean; // True si el payload incluye datos de ubicación del usuario
  ubicacion_usuario?: { lat: number; lon: number; }; // Coordenadas si es_ubicacion es true

  action?: string; // Si el envío es resultado de un clic en un botón con una acción específica que el backend debe procesar

  attachmentInfo?: { // Información del archivo que el usuario está adjuntando (antes de que el backend lo confirme)
    name: string;
    url: string; // URL temporal o final del archivo subido por el usuario
    mimeType?: string;
    size?: number;
  };
}