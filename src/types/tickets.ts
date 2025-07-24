export type TicketStatus = 'nuevo' | 'abierto' | 'en-espera' | 'resuelto' | 'cerrado' | 'en_proceso';
export type TicketPriority = 'baja' | 'media' | 'alta' | 'urgente';

export interface User {
  id: string;
  name: string;
  email: string;
  avatarUrl?: string;
  location?: string;
  phone?: string;
}

export interface Message {
  id: string;
  author: 'user' | 'agent';
  agentName?: string;
  content: string;
  timestamp: string;
  isInternalNote?: boolean;
}

export interface Attachment {
  id: string;
  filename: string;
  url: string;
  size: number;
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
  name?: string;
  title?: string; // Keep for components that might still use it
  lastMessage?: string; // Keep for components that might still use it
}
