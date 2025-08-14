// --- src/types/index.ts ---

export type TicketStatus = "nuevo" | "en curso" | "derivado" | "resuelto" | "cerrado";

export interface Comment {
  id: number;
  comentario: string;
  fecha: string;
  es_admin: boolean;
}

export interface InformacionPersonalVecino {
  nombre?: string;
  telefono?: string;
  email?: string;
  direccion?: string;
  dni?: string;
}

export interface Ticket {
  id: number;
  nro_ticket: string;
  pregunta: string;
  asunto?: string;
  fecha: string;
  estado: TicketStatus;
  display_name?: string;
  informacion_personal_vecino?: InformacionPersonalVecino;
  nombre_empresa?: string;
  email?: string;
  telefono?: string;
  /** Coordenadas GPS opcionales */
  latitud?: number | null;
  longitud?: number | null;
}
export * from "./product";
