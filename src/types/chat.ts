// src/types/chat.ts
export interface AttachmentInfo {
  name: string;
  url: string;
  thumbUrl?: string;
  thumb_url?: string;
  thumbnail_url?: string;
  thumbnailUrl?: string;
  mimeType?: string;
  size?: number;
}
// Define cómo es un objeto Boton
export interface Boton {
  texto: string;
  url?: string;
  accion_interna?: string; // Para acciones que el frontend debe interpretar sin enviar al backend (ej. abrir panel)
  action?: string; // Valor que se envía al backend cuando se hace clic en el botón
  action_id?: string; // Compatibilidad con 'action_id' enviado desde algunos endpoints del backend
  payload?: any;
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

// Nuevo: Define la estructura de un Post (Evento o Noticia)
export interface Post {
  id: number | string;
  titulo: string;
  subtitulo?: string;
  contenido: string;
  tipo_post: 'noticia' | 'evento';
  imagen_url?: string;
  image?: string; // compatibilidad con "image"
  imageUrl?: string; // alias adicional para imagen
  fecha_evento_inicio?: string; // ISO 8601 string
  fecha_evento_fin?: string; // ISO 8601 string
  url?: string; // Un enlace principal
  enlace?: string; // alias para URL
  link?: string; // alias adicional
  facebook?: string; // enlaces opcionales a redes
  instagram?: string;
  youtube?: string;
}

export interface MenuRow {
  id: string;
  title: string;
  description?: string;
}

export interface MenuSection {
  title?: string;
  rows: MenuRow[];
}

export interface InteractiveListConfig {
  buttonLabel: string;
  title?: string; // Title for the list/modal header
  sections: MenuSection[];
}

// Define cómo es un objeto Mensaje
export interface Message {
  id: number | string; // Identificador único del mensaje
  text: string; // Texto principal o fallback del mensaje. Puede ser HTML sanitizado.
  isBot: boolean; // True si el mensaje es del bot, false si es del usuario
  timestamp: Date; // Fecha y hora del mensaje
  origen?: 'chat' | 'email'; // Nuevo campo para diferenciar el origen del mensaje
  botones?: Boton[]; // Array de botones interactivos asociados al mensaje (si los hay)
  categorias?: Categoria[]; // Array de categorías con botones (formato anidado para acordeones)
  menu_sections?: MenuSection[]; // Sections for structured menus
  interactive_list?: InteractiveListConfig; // Config for opening a list in a drawer/modal
  query?: string; // La consulta original del usuario que generó esta respuesta (opcional)
  isError?: boolean; // Indica si el mensaje representa un estado de error
  ticketId?: number; // Ticket asociado cuando el backend crea uno

  // Campos para contenido multimedia y adjuntos
  mediaUrl?: string; // URL directa a una imagen/video (para compatibilidad o casos simples)
  audioUrl?: string; // URL a un archivo de audio para ser reproducido
  locationData?: { // Datos de ubicación (para mostrar un mapa o coordenadas)
    lat: number;
    lon: number;
    name?: string; // Nombre del lugar (ej. "Plaza Independencia")
    address?: string; // Dirección formateada
  };
  attachmentInfo?: { // Información detallada de un archivo adjunto
    id?: string | number;
    name: string; // Nombre del archivo (ej. "documento.pdf")
    url: string; // URL para descargar/visualizar el archivo
    thumbUrl?: string; // URL a una miniatura de la imagen/PDF
    thumb_url?: string;
    thumbnail_url?: string;
    thumbnailUrl?: string;
    mimeType?: string; // Tipo MIME del archivo (ej. "application/pdf", "image/jpeg")
    size?: number; // Tamaño del archivo en bytes (opcional)
    type?: string; // Tipo de adjunto derivado (image, pdf, audio, etc.)
    extension?: string; // Extensión de archivo normalizada
    isUploading?: boolean; // Marca si el adjunto está en proceso de subida
  };

  // Campos para contenido estructurado y personalización de la UI
  structuredContent?: StructuredContentItem[]; // Array de items para mostrar datos clave-valor o tarjetas de información
  displayHint?: 'default' | 'pymeProductCard' | 'municipalInfoSummary' | 'genericTable' | 'compactList'; // Sugerencia para el frontend sobre cómo renderizar la totalidad del mensaje
  chatBubbleStyle?: 'standard' | 'compact' | 'emphasis' | 'alert'; // Para controlar el estilo visual de la burbuja del mensaje
  posts?: Post[]; // Array de posts para mostrar como tarjetas de eventos/noticias
  socialLinks?: Record<string, string>; // Enlaces generales a redes sociales
  listItems?: string[]; // Lista de elementos para mostrar como viñetas numeradas o con emojis
}

// --- INTERFAZ PARA EL PAYLOAD DE ENVÍO DE MENSAJES (lo que el usuario envía al bot) ---
export interface SendPayload {
  text: string; // Texto del mensaje del usuario

  /**
   * Indica desde qué parte de la interfaz se originó el mensaje.
   * Permite ajustar el payload que se envía al backend (ej. preservar emojis en botones).
   */
  source?: 'input' | 'button' | 'system';

  // Para adjuntos que el usuario envía (el backend los procesa y puede devolver un Message con attachmentInfo)
  es_foto?: boolean; // Deprecar en favor de attachmentInfo con mimeType. Indica si el adjunto es una foto.
  archivo_url?: string; // Deprecar en favor de attachmentInfo. URL del archivo subido por el usuario.

  es_ubicacion?: boolean; // True si el payload incluye datos de ubicación del usuario
  ubicacion_usuario?: { lat: number; lon: number; }; // Coordenadas si es_ubicacion es true
  location?: { lat: number, lon: number }; // NUEVO: Para el envío de ubicación desde el widget

  action?: string; // Si el envío es resultado de un clic en un botón con una acción específica que el backend debe procesar
  payload?: any; // Datos adicionales asociados a la acción del botón

  attachmentInfo?: { // Información del archivo que el usuario está adjuntando (antes de que el backend lo confirme)
    name: string;
    url: string; // URL temporal o final del archivo subido por el usuario
    thumbUrl?: string;
    thumb_url?: string;
    thumbnail_url?: string;
    thumbnailUrl?: string;
    mimeType?: string;
    size?: number;
  };
}