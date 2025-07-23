export type TicketStatus = 'nuevo' | 'abierto' | 'en-espera' | 'resuelto' | 'cerrado';
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
  id: string;
  title: string;
  status: TicketStatus;
  priority: TicketPriority;
  user: User;
  agentId?: string;
  createdAt: string;
  updatedAt: string;
  lastMessage: string;
  messages: Message[];
  attachments: Attachment[];
  activityLog: {
    type: 'status_change' | 'assignment' | 'note';
    timestamp: string;
    content: string;
  }[];
}
