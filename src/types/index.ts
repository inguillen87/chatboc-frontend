// --- src/types/index.ts ---

// Tipos relacionados con Tickets, movidos y consolidados desde TicketsPanel.tsx

export type TicketStatus =
  | "nuevo"
  | "en_proceso"
  | "derivado"
  | "resuelto"
  | "cerrado"
  | "esperando_agente_en_vivo"
  | "en_vivo";
export type SlaStatus = "on_track" | "nearing_sla" | "breached" | null;
export type PriorityStatus = "low" | "medium" | "high" | null;

export interface Comment {
  id: number;
  comentario: string; // Puede contener texto o la info del adjunto en formato especial si no hay campos dedicados
  fecha: string;
  es_admin: boolean;
  archivo_url?: string;    // URL directa al archivo adjunto al comentario
  nombre_archivo?: string; // Nombre original del archivo adjunto al comentario
  tipo_mime?: string;      // Tipo MIME del archivo adjunto al comentario
}

export interface Ticket {
  id: number;
  tipo: 'pyme' | 'municipio'; // Tipo de entidad que gestiona/recibe el ticket
  nro_ticket: number;         // Número identificador del ticket (era string, ahora number)
  asunto: string;             // Asunto principal o título breve del ticket
  estado: TicketStatus;
  fecha: string;              // Fecha de creación del ticket

  detalles?: string;           // Descripción más detallada del problema o solicitud
  comentarios?: Comment[];     // Historial de comentarios asociados al ticket

  // Información del usuario/reportante
  nombre_usuario?: string;     // Nombre del usuario que creó el ticket
  email_usuario?: string;
  telefono?: string;           // Teléfono del usuario que creó el ticket
  direccion?: string;          // Dirección física relacionada con el ticket (si aplica)

  archivo_url?: string;        // URL a un archivo adjunto principal del ticket (diferente de los adjuntos en comentarios)
  categoria?: string;          // Categoría asignada al ticket
  municipio_nombre?: string;   // Nombre del municipio (relevante si tipo='municipio')
  municipio_latitud?: number;  // Latitud del municipio u origen de la cuadrilla
  municipio_longitud?: number; // Longitud del municipio u origen de la cuadrilla
  origen_latitud?: number;     // Latitud específica de salida si difiere del municipio
  origen_longitud?: number;    // Longitud específica de salida si difiere del municipio
  tiempo_estimado?: string;    // Tiempo estimado de llegada o resolución

  // Coordenadas geográficas
  latitud?: number | null;
  longitud?: number | null;

  // Información de SLA y Prioridad
  sla_status?: SlaStatus;
  priority?: PriorityStatus;
  sla_deadline?: string;       // Fecha límite para el cumplimiento del SLA
}

// TicketSummary para vistas de lista, omite campos pesados como detalles y comentarios.
export interface TicketSummary extends Omit<Ticket, 'detalles' | 'comentarios'> {
  // Los campos omitidos ya no están, pero podemos añadir/reafirmar campos que SÍ deben estar si es necesario.
  // En este caso, la definición de TicketPanel.tsx para TicketSummary no añadía campos extra,
  // solo omitía. Así que esta definición basada en la Ticket consolidada es suficiente.
  // Si TicketSummary necesitara campos que no están en Ticket (lo cual sería raro),
  // se podrían añadir aquí:
  // campo_extra_summary?: string;
}

// Interfaz para la gestión de plantillas de respuesta, usada en GestionPlantillasPage.tsx
export interface GestionResponseTemplate {
  id: string; // o number, según la implementación del backend
  name: string;
  text: string;
  keywords?: string[];
  is_active?: boolean;
  // Opcional: incluir campos de auditoría si el backend los devuelve y son útiles en la UI
  // created_at?: string;
  // updated_at?: string;
}


// Otros tipos de la aplicación (como Product) se mantienen
export * from "./product";
