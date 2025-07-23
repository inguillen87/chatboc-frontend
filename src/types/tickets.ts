export type TicketStatus = "nuevo" | "en_proceso" | "derivado" | "resuelto" | "cerrado" | "esperando_agente_en_vivo";
export type SlaStatus = "on_track" | "nearing_sla" | "breached" | null;
export type PriorityStatus = "low" | "medium" | "high" | null;

export interface Comment {
  id: number;
  comentario: string;
  fecha: string;
  es_admin: boolean;
}

export interface Ticket {
  id: number;
  tipo: 'pyme' | 'municipio';
  nro_ticket: number;
  asunto: string;
  estado: TicketStatus;
  fecha: string;
  detalles?: string;
  comentarios?: Comment[];
  nombre_usuario?: string;
  email_usuario?: string;
  telefono?: string;
  direccion?: string;
  archivo_url?: string;
  categoria?: string;
  municipio_nombre?: string;
  latitud?: number | null;
  longitud?: number | null;
  sla_status?: SlaStatus;
  priority?: PriorityStatus;
  sla_deadline?: string;
}

export interface TicketSummary extends Omit<Ticket, 'detalles' | 'comentarios'> {
  direccion?: string;
  latitud?: number | null;
  longitud?: number | null;
  sla_status?: SlaStatus;
  priority?: PriorityStatus;
}

export const ESTADOS_ORDEN_PRIORIDAD: TicketStatus[] = ["nuevo", "en_proceso", "esperando_agente_en_vivo", "derivado", "resuelto", "cerrado"];

export const ESTADOS: Record<TicketStatus, { label: string; tailwind_class: string, icon?: React.ElementType }> = {
  nuevo: { label: "Nuevo", tailwind_class: "bg-blue-500 hover:bg-blue-600 text-white border-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600" },
  en_proceso: { label: "En Proceso", tailwind_class: "bg-yellow-500 hover:bg-yellow-600 text-black border-yellow-700 dark:bg-yellow-400 dark:hover:bg-yellow-500" },
  derivado: { label: "Derivado", tailwind_class: "bg-purple-500 hover:bg-purple-600 text-white border-purple-700 dark:bg-purple-500 dark:hover:bg-purple-600" },
  resuelto: { label: "Resuelto", tailwind_class: "bg-green-500 hover:bg-green-600 text-white border-green-700 dark:bg-green-500 dark:hover:bg-green-600" },
  cerrado: { label: "Cerrado", tailwind_class: "bg-gray-500 hover:bg-gray-600 text-white border-gray-700 dark:bg-gray-600 dark:hover:bg-gray-700" },
  esperando_agente_en_vivo: { label: "Esperando agente", tailwind_class: "bg-red-500 hover:bg-red-600 text-white border-red-700 dark:bg-red-500 dark:hover:bg-red-600" }
};

export const SLA_STATUS_INFO: Record<NonNullable<SlaStatus>, { label: string; color: string; icon?: React.ElementType }> = {
  on_track: { label: "En tiempo", color: "text-green-600 dark:text-green-400" },
  nearing_sla: { label: "Próximo a vencer", color: "text-yellow-600 dark:text-yellow-400" },
  breached: { label: "Vencido", color: "text-red-600 dark:text-red-400" },
};

export const PRIORITY_INFO: Record<NonNullable<PriorityStatus>, { label: string; color: string; badgeClass?: string }> = {
  low: { label: "Baja", color: "text-gray-500 dark:text-gray-400" },
  medium: { label: "Media", color: "text-blue-500 dark:text-blue-400" },
  high: { label: "Alta", color: "text-red-500 dark:text-red-400" },
};
