export type SurveyTipo = 'opinion' | 'votacion' | 'sondeo';
export type PreguntaTipo = 'opcion_unica' | 'multiple' | 'abierta';

export interface SurveyPreguntaOpcion {
  id: number;
  orden: number;
  texto: string;
  valor?: string;
}

export interface SurveyPregunta {
  id: number;
  orden: number;
  tipo: PreguntaTipo;
  texto: string;
  obligatoria: boolean;
  min_selecciones?: number;
  max_selecciones?: number;
  opciones?: SurveyPreguntaOpcion[];
}

export interface SurveyPublic {
  id?: number;
  slug: string;
  titulo: string;
  descripcion?: string;
  tipo: SurveyTipo;
  inicio_at: string;
  fin_at: string;
  politica_unicidad: 'por_dni' | 'por_phone' | 'por_ip' | 'por_cookie' | 'libre';
  preguntas: SurveyPregunta[];
}

export interface PublicResponsePayload {
  dni?: string | null;
  phone?: string | null;
  respuestas: Array<{
    pregunta_id: number;
    opcion_ids?: number[];
    texto_libre?: string | null;
  }>;
  utm_source?: string;
  utm_campaign?: string;
  canal?: 'qr' | 'web' | 'whatsapp' | 'email';
}

export interface SurveyAdmin extends SurveyPublic {
  id: number;
  estado: 'borrador' | 'publicada' | 'cerrada' | 'archivada';
  created_at?: string;
  updated_at?: string;
  anonimato?: boolean;
  unica_por_persona?: boolean;
}

export interface SurveyDraftPayload {
  titulo: string;
  slug?: string;
  descripcion?: string;
  tipo: SurveyTipo;
  inicio_at?: string | null;
  fin_at?: string | null;
  politica_unicidad: SurveyPublic['politica_unicidad'];
  anonimato: boolean;
  requiere_datos_contacto: boolean;
  preguntas: Array<{
    id?: number;
    orden: number;
    tipo: PreguntaTipo;
    texto: string;
    obligatoria: boolean;
    min_selecciones?: number | null;
    max_selecciones?: number | null;
    opciones?: Array<{
      id?: number;
      orden: number;
      texto: string;
      valor?: string;
    }>;
  }>;
}

export interface SurveyListResponse {
  data: SurveyAdmin[];
  meta?: {
    total: number;
    draftCount?: number;
    activeCount?: number;
  };
}

export interface SurveySummaryOptionBreakdown {
  opcion_id: number;
  texto: string;
  respuestas: number;
  porcentaje: number;
}

export interface SurveySummaryPregunta {
  pregunta_id: number;
  texto: string;
  total_respuestas: number;
  opciones: SurveySummaryOptionBreakdown[];
}

export interface SurveySummary {
  total_respuestas: number;
  participantes_unicos: number;
  tasa_completitud: number;
  preguntas: SurveySummaryPregunta[];
  canales?: Array<{ canal: string; respuestas: number }>;
  utms?: Array<{ fuente: string; campania?: string; respuestas: number }>;
}

export interface SurveyTimeseriesPoint {
  fecha: string;
  respuestas: number;
}

export interface SurveyHeatmapPoint {
  lat: number;
  lng: number;
  respuestas: number;
}

export interface SurveyAnalyticsFilters {
  desde?: string;
  hasta?: string;
  canal?: string;
  utm_source?: string;
  utm_campaign?: string;
}

export interface SurveySnapshot {
  id: number;
  etiqueta: string;
  creado_at: string;
  publicado_at?: string | null;
  rango?: string | null;
  resumen?: SurveySummary;
}

export interface SnapshotCreatePayload {
  rango?: string;
}

export interface SnapshotPublishPayload {
  snapshot_id: number;
}

export interface SnapshotVerifyPayload {
  respuesta_id: number;
  snapshot_id: number;
}
