import { Boton, StructuredContentItem } from './chat';

export type TicketStatus = 'nuevo' | 'abierto' | 'en-espera' | 'resuelto' | 'cerrado' | 'en_proceso';
export type TicketPriority = 'baja' | 'media' | 'alta' | 'urgente';

export interface User {
  id: string;
  nombre_usuario: string;
  email: string;
  avatarUrl?: string;
  location?: string;
  phone?: string;
}

export interface Attachment {
  id: number;
  filename: string;
  url: string;
  size: number;
  mime_type?: string;
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


export interface Ticket {
  id: number;
  tipo: 'municipio' | 'pyme';
  nro_ticket: string;
  asunto: string;
  estado: TicketStatus;
  fecha: string; // ISO format
  categoria?: string;
  direccion?: string;
  latitud?: number;
  longitud?: number;
  avatarUrl?: string;

  // Pyme specific fields
  telefono?: string;
  email?: string;
  dni?: string;
  estado_cliente?: string;

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
}
