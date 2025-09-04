import { Boton, StructuredContentItem } from './chat';

export type TicketStatus = 'nuevo' | 'abierto' | 'en-espera' | 'resuelto' | 'cerrado' | 'en_proceso';
export type TicketPriority = 'baja' | 'media' | 'alta' | 'urgente';

export interface Horario {
    start_hour: number;
    end_hour: number;
}

export interface User {
  id: string;
  nombre_usuario: string;
  email: string;
  email_usuario?: string;
  avatarUrl?: string;
  location?: string;
  phone?: string;
  horario?: Horario;
}

export interface Attachment {
  id: number;
  filename: string;
  url: string;
  size: number;
  mime_type?: string;
  thumbUrl?: string;
  thumb_url?: string;
}

export interface Message {
  id: number;
  author: 'user' | 'agent';
  agentName?: string;
  content: string; // Corresponds to 'text' in ChatMessageData
  timestamp: string; // Corresponds to 'timestamp'
  isInternalNote?: boolean;

  // Fields to align with ChatMessageData
  attachments?: Attachment[];
  botones?: Boton[];
  structuredContent?: StructuredContentItem[];

  // Optional fields from original Message type in tickets
  media_url?: string;
  ubicacion?: { lat: number; lon: number; name?: string; address?: string; };
}

export interface InformacionPersonalVecino {
  nombre?: string;
  telefono?: string;
  email?: string;
  direccion?: string;
  dni?: string;
}

export interface TicketHistoryEvent {
  status: string;
  date: string;
  notes?: string;
}

export interface TicketTimelineEvent {
  tipo: 'ticket_creado' | 'comentario' | 'estado';
  fecha: string;
  estado?: string;
  texto?: string;
  comentario?: string;
  es_admin?: boolean | number | string;
  user_id?: number;
}

export interface TicketTimelineResponse {
  estado_chat: string;
  timeline: TicketTimelineEvent[];
}

export interface Ticket {
  id: number;
  tipo: 'municipio' | 'pyme';
  nro_ticket: string;
  asunto: string;
  estado: TicketStatus;
  fecha: string; // ISO format
  categoria?: string;
  categories?: string[];
  categoria_principal?: string;
  categoria_secundaria?: string;
  categoria_simple?: string;
  direccion?: string;
  distrito?: string;
  esquinas_cercanas?: string;
  latitud?: number;
  longitud?: number;
  lat_destino?: number;
  lon_destino?: number;
  lat_origen?: number;
  lon_origen?: number;
  lat_actual?: number;
  lon_actual?: number;
  municipio_nombre?: string;
  municipio_latitud?: number;
  municipio_longitud?: number;
  origen_latitud?: number;
  origen_longitud?: number;
  avatarUrl?: string;
  history?: TicketHistoryEvent[];

  // Pyme specific fields
  telefono?: string;
  email?: string;
  email_usuario?: string;
  dni?: string;
  estado_cliente?: string;

  // Vecino specific fields
  display_name?: string;
  informacion_personal_vecino?: InformacionPersonalVecino;

  // Fields that might come from a detailed view, but good to have
  messages?: Message[];
  attachments?: Attachment[];
  activityLog?: any[];
  hasUnreadMessages?: boolean;

  // For backwards compatibility and flexibility
  user?: User;
  nombre_usuario?: string;
  title?: string; // Keep for components that might still use it
  lastMessage?: string; // Keep for components that might still use it
  description?: string;
  channel?: 'whatsapp' | 'web' | 'email' | 'phone' | 'other';
  assignedAgent?: User;
  whatsapp_conversation_id?: string;
}
