import { AttachmentInfo, Boton, StructuredContentItem } from "./chat";

export type TicketStatus =
  | "nuevo"
  | "abierto"
  | "en-espera"
  | "resuelto"
  | "cerrado"
  | "en_proceso"
  | "esperando_agente_en_vivo"
  | "en_vivo";
export type TicketPriority = "baja" | "media" | "alta" | "urgente";

export type TicketSlaClockState =
  | "due"
  | "overdue"
  | "healthy"
  | "satisfied"
  | "paused"
  | "inactive"
  | "unknown";

export interface TicketSlaClock {
  state: TicketSlaClockState;
  due_at: string | null;
  fulfilled_at: string | null;
  remaining_seconds: number | null;
  known: boolean;
  overdue: boolean;
}

export interface TicketSlaContract {
  contract_version: string | null;
  evaluated_at: string | null;
  state: TicketSlaClockState;
  known: boolean;
  overdue: boolean;
  paused: boolean;
  clocks: {
    first_response: TicketSlaClock;
    next_update: TicketSlaClock;
    resolution: TicketSlaClock;
  };
}

export interface Horario {
  start_hour: number;
  end_hour: number;
}

export interface User {
  id: string | number;
  nombre_usuario: string;
  email: string;
  email_usuario?: string;
  avatarUrl?: string;
  avatar_source?: string;
  avatar_consent?: boolean | string | number | null;
  location?: string;
  phone?: string;
  horario?: Horario;
  categoria_ids?: number[];
  categorias?: { id: number; nombre: string }[];
}

export interface AttachmentAnalysisData {
  url?: string;
  thumbnail_url?: string;
  [key: string]: unknown;
}

export interface AttachmentAnalysis {
  datos_estructurados?: AttachmentAnalysisData;
  structured_data?: AttachmentAnalysisData;
  [key: string]: unknown;
}

export interface Attachment {
  id: number;
  filename: string;
  url: string;
  downloadUrl?: string;
  download_url?: string;
  storage_url?: string;
  storage_provider?: string;
  storage_access?: "public" | "signed" | "external" | string;
  is_private?: boolean;
  isPrivate?: boolean;
  securityLabel?: string;
  source?: string;
  origin?: string;
  status?: string;
  kind?: string;
  flow_id?: string;
  interaction_id?: string | number;
  size?: number;
  mime_type?: string;
  mimeType?: string;
  thumbUrl?: string;
  thumb_url?: string;
  thumbnail_url?: string;
  thumbnailUrl?: string;
  analisis?: AttachmentAnalysis;
  analysis?: AttachmentAnalysis;
  datos_estructurados?: AttachmentAnalysisData;
}

export interface Message {
  id: number | string;
  author: "user" | "agent";
  agentName?: string;
  content: string; // Corresponds to 'text' in ChatMessageData
  timestamp: string; // Corresponds to 'timestamp'
  isInternalNote?: boolean;
  readAt?: string | null;
  lastReadBy?: string | null;

  // Fields to align with ChatMessageData
  attachments?: Attachment[];
  archivos_adjuntos?: Attachment[];
  botones?: Boton[];
  structuredContent?: StructuredContentItem[];

  // Optional fields from original Message type in tickets
  media_url?: string;
  ubicacion?: { lat: number; lon: number; name?: string; address?: string };
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
  tipo: "ticket_creado" | "comentario" | "estado";
  fecha: string;
  estado?: string;
  texto?: string;
  comentario?: string;
  es_admin?: boolean | number | string;
  user_id?: number;
}

export interface TicketRealtimeViewer {
  viewer_id?: string | null;
  viewer_key?: string | null;
  viewer_user_id?: string | number | null;
  viewer_anon_id?: string | null;
  viewer_role?: string | null;
  viewer_label?: string | null;
  viewer_name?: string | null;
  session_id?: string | null;
  presence_status?: string | null;
  effective_presence_status?: string | null;
  last_read_comment_id?: string | number | null;
  read_at?: string | null;
  updated_at?: string | null;
  is_current_viewer?: boolean;
  unread_count?: number;
  has_unread?: boolean;
}

export interface TicketRealtimeState {
  viewers: TicketRealtimeViewer[];
  active_viewers: TicketRealtimeViewer[];
  read_states: TicketRealtimeViewer[];
  summary?: {
    active_count?: number;
    idle_count?: number;
    read_count?: number;
    last_read_comment_id?: string | number | null;
  } | null;
}

export interface TicketCollaborationState {
  latest_comment_id?: string | number | null;
  latest_read_at?: string | null;
  unread_count?: number;
  has_unread?: boolean;
  unread_viewer_count?: number;
  active_viewers_count?: number;
  idle_viewer_count?: number;
  idle_window_minutes?: number;
}

export interface TicketCrmQueueBadge {
  id?: string;
  label?: string;
  tone?: string;
}

export interface TicketCrmQueue {
  contract_version?: string;
  id?: string;
  ticket_type?: string;
  state?: string;
  score?: number;
  label?: string;
  reason?: string;
  next_team_action?: string;
  requires_admin_response?: boolean;
  badges?: TicketCrmQueueBadge[];
  signals?: Record<string, unknown>;
}


export interface UnifiedConversationStreamItem {
  id: string;
  timestamp: string;
  source?: string | null;
  stream_type?: string | null;
  actor_type: 'agent' | 'citizen' | 'system';
  preview_text: string;
  status?: string | null;
  badge?: string | null;
  is_read?: boolean;
  is_unread?: boolean;
  payload?: Record<string, unknown> | null;
  raw?: Record<string, unknown> | null;
}

export interface TicketHistoryPagination {
  contract_version?: string;
  direction?: string;
  order?: string;
  limit: number;
  returned_count?: number;
  has_more: boolean;
  next_cursor: string | null;
}

export interface TicketTimelineResponse {
  estado_chat: string;
  timeline: TicketTimelineEvent[];
  historial_chat?: Array<Record<string, unknown>> | null;
  realtime_state?: TicketRealtimeState | null;
  unified_conversation_stream?: UnifiedConversationStreamItem[] | Array<Record<string, unknown>> | null;
  pagination?: TicketHistoryPagination | null;
  has_more?: boolean;
  next_cursor?: string | null;
}

export interface TicketWorkflowInstance {
  contract_version: "ticket.workflow.instance.v2" | string;
  current_state: string;
  canonical_state?: string | null;
  next_states: string[];
  can_transition: boolean;
  final_state: boolean;
  blocked_reason?: string | null;
}

export interface Ticket {
  id: number;
  tenant_id?: number; // Added for Pyme support
  tipo: "municipio" | "pyme";
  nro_ticket: string; // For Pyme this is a string representation of an Integer
  asunto: string;
  estado: TicketStatus;
  fecha: string; // ISO format
  categoria?: string;
  categories?: string[];
  categoria_principal?: string;
  categoria_secundaria?: string;
  categoria_simple?: string;
  direccion?: string;
  direccion_exacta_aproximada?: string;
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
  coordinates?: { lat?: number; lng?: number } | [number, number];
  location?: {
    address?: string;
    direccion?: string;
    lat?: number;
    lng?: number;
    latitude?: number;
    longitude?: number;
    map_search_url?: string;
  };
  ubicacion_geografica?: {
    direccion?: string;
    address?: string;
    latitud?: number;
    longitud?: number;
    lat?: number;
    lng?: number;
    map_search_url?: string;
  };
  map_search_url?: string;
  has_location?: boolean;
  tiempo_estimado?: string;
  avatarUrl?: string;
  avatar_url?: string;
  avatar_source?: string;
  avatar_consent?: boolean | string | number | null;
  avatarConsent?: boolean | string | number | null;
  avatar_is_consented?: boolean | string | number | null;
  contact_avatar_url?: string;
  profile_picture_url?: string;
  profile_picture_consent?: boolean | string | number | null;
  nombre_y_avatar_whatsapp?: {
    nombre?: string | null;
    avatar_url?: string | null;
    avatar_source?: string | null;
    avatar_consent?: boolean | string | number | null;
    avatar_policy?: string | null;
  } | null;
  history?: TicketHistoryEvent[];

  categoria_id?: number;
  categoria_ids?: number[];
  categorias?: { id: number; nombre?: string }[];

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
  archivos_adjuntos?: Attachment[];
  activityLog?: any[];
  hasUnreadMessages?: boolean;

  assignedAgentId?: string | number;
  assigned_agent_id?: string | number;
  assigned_user_id?: string | number;
  asigned_user_id?: string | number;

  // For backwards compatibility and flexibility
  user?: User;
  nombre_usuario?: string;
  title?: string; // Keep for components that might still use it
  lastMessage?: string; // Keep for components that might still use it
  description?: string;
  pregunta?: string;
  detalles?: string | Record<string, unknown> | null;
  channel?: "whatsapp" | "web" | "email" | "phone" | "other";
  assignedAgent?: User;
  whatsapp_conversation_id?: string;
  foto_url_directa?: string;
  archivo_url?: string | null;
  imagen_url?: string | null;
  attachment_info?: AttachmentInfo | null;

  // Tenant/Branding info
  tenant_slug?: string;
  tenant_logo?: string;
  tenant_theme?: any;

  // Operational context
  sla_status?: string | null;
  sla?: TicketSlaContract | Record<string, unknown> | null;
  sla_evaluation?: TicketSlaContract | Record<string, unknown> | null;
  operational_badges?:
    | string[]
    | Array<{ label?: string; text?: string; value?: string }>;
  operational_metrics?:
    | Record<string, unknown>
    | Array<{ label?: string; value?: string | number | null }>;
  priority?: string | number | null;
  priority_score?: number | null;
  priority_breakdown?: Record<string, unknown> | null;
  crm_queue?: TicketCrmQueue | null;
  recommended_next_action?: string | null;
  allowed_actions?: Array<string | Record<string, unknown>> | null;
  actions?: Array<string | Record<string, unknown>> | null;
  next_steps?: Array<string | Record<string, unknown>> | null;
  datos_extra?: Record<string, unknown> | null;
  ai_enrichment?: Record<string, unknown> | null;
  ai_hints?: Record<string, unknown> | null;
  ai_operator_brief?: Record<string, unknown> | null;
  handoff?: Record<string, unknown> | null;
  assisted_request?: Record<string, unknown> | null;
  public_follow_up?: Record<string, unknown> | null;
  detail_endpoint?: string | null;
  messages_endpoint?: string | null;
  timeline_endpoint?: string | null;
  ai_enrichment_endpoint?: string | null;
  source_model?: string | null;
  ticket_type?: string | null;
  contract_version?: string | null;
  admin_preview_endpoint?: string | null;
  school_case?: Record<string, unknown> | null;
  realtime_state?: TicketRealtimeState | null;
  collaboration_state?: TicketCollaborationState | null;
  next_states?: string[] | null;
  workflow?: TicketWorkflowInstance | null;
  socket_room?: string | null;
}
