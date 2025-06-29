// src/types/chat.ts

// Define cómo es un objeto Botón
export interface Boton {
  texto: string;
  url?: string;
  accion_interna?: string;
  action?: string;
}

// Define cómo es un objeto Mensaje
export interface Message {
  id: number;
  text: string;
  isBot: boolean;
  timestamp: Date;
  botones?: Boton[];
  query?: string;
  mediaUrl?: string; // Puede coexistir o ser reemplazado/deprecado por attachmentInfo.url
  locationData?: { lat: number; lon: number; };
  attachmentInfo?: {
    name: string;
    url: string;
    mimeType?: string;
    size?: number;
    // La extensión y el 'type' (AttachmentType de utils/attachment.ts)
    // se pueden derivar en el frontend a partir de name o mimeType,
    // o el backend podría añadirlos aquí si es conveniente.
  };
}

// --- NUEVA INTERFAZ PARA EL PAYLOAD DE ENVÍO DE MENSAJES ---
export interface SendPayload {
  text: string;
  es_foto?: boolean; // Considerar deprecación si mimeType/attachmentInfo es suficiente
  archivo_url?: string; // Considerar deprecación si attachmentInfo.url es suficiente
  es_ubicacion?: boolean;
  ubicacion_usuario?: { lat: number; lon: number; };
  action?: string;
  attachmentInfo?: { // Nuevo campo para enviar información del archivo subido
    name: string;
    url: string;
    mimeType?: string;
    size?: number;
  };
}
// -----------------------------------------------------------