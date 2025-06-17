// --- src/types/index.ts ---

export type TicketStatus = "nuevo" | "en curso" | "derivado" | "resuelto" | "cerrado";

export interface Comment {
  id: number;
  comentario: string;
  fecha: string;
  es_admin: boolean;
}

export interface Ticket {
  id: number;
  nro_ticket: string;
  pregunta: string;
  asunto?: string;
  fecha: string;
  estado: TicketStatus;
  nombre_vecino?: string;
  nombre_empresa?: string;
  email?: string;
  telefono?: string;
  /** Coordenadas GPS opcionales */
  latitud?: number | null;
  longitud?: number | null;
}
export * from "./product";
