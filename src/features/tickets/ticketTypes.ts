export interface V2Ticket {
  id: string;
  title: string;
  status: string;
  description?: string | null;
  priority?: string;
  sla_state?: string;
  sla_status?: string;
  channel?: string;
  category?: string;
  assignee?: {
    id?: string | null;
    name?: string | null;
  } | null;
  assignee_name?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  raw?: unknown;
}

export interface V2TicketListResponse {
  contract_version?: string;
  request_id?: string;
  items: V2Ticket[];
  pagination?: Record<string, unknown>;
  summary?: Record<string, unknown>;
  raw?: unknown;
}

export interface V2TicketComment {
  id: string;
  ticket_id?: string;
  body: string;
  visibility?: 'public' | 'internal' | 'private' | string;
  author_name?: string | null;
  created_at?: string | null;
  raw?: unknown;
}

export interface V2TicketEvent {
  id: string;
  ticket_id?: string;
  type: string;
  label?: string | null;
  actor_name?: string | null;
  created_at?: string | null;
  payload?: Record<string, unknown>;
  raw?: unknown;
}
