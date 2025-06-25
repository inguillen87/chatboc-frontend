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
  mediaUrl?: string;
  locationData?: { lat: number; lon: number; };
}

// --- NUEVA INTERFAZ PARA EL PAYLOAD DE ENVÍO DE MENSAJES ---
export interface SendPayload {
  text: string;
  es_foto?: boolean;
  archivo_url?: string;
  es_ubicacion?: boolean;
  ubicacion_usuario?: { lat: number; lon: number; };
  action?: string;
}
// -----------------------------------------------------------