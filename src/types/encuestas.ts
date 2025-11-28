export type SurveyTipo = 'opinion' | 'votacion' | 'sondeo' | 'planificacion';
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

export interface SurveyChannelAsset {
  canal?: string;
  titulo?: string | null;
  descripcion?: string | null;
  imagen?: string | null;
  imagen_url?: string | null;
  image?: string | null;
  image_url?: string | null;
  header?: string | null;
  header_image_url?: string | null;
  portada_url?: string | null;
  footer?: string | null;
  nota?: string | null;
  texto?: string | null;
  [key: string]: unknown;
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
  requiere_datos_contacto?: boolean;
  puntos_recompensa?: number;
  preguntas: SurveyPregunta[];
  portada_url?: string | null;
  imagen_portada?: string | null;
  header_image_url?: string | null;
  cover_image_url?: string | null;
  banner_url?: string | null;
  municipio_id?: number | string | null;
  municipio_nombre?: string | null;
  municipio_slug?: string | null;
  canales?: SurveyChannelAsset[] | Record<string, SurveyChannelAsset | undefined>;
  recursos?: Record<string, unknown>;
  difusion?: Record<string, unknown>;
  assets?: Record<string, unknown>;
  branding?: Record<string, unknown>;
  [key: string]: unknown;
}

export type SurveyLocationPrecision = 'gps' | 'manual' | 'estimada';

export interface SurveyLocationMetadata {
  pais?: string;
  provincia?: string;
  ciudad?: string;
  barrio?: string;
  codigoPostal?: string;
  lat?: number;
  lng?: number;
  precision?: SurveyLocationPrecision;
  origen?: 'gps' | 'usuario' | 'ip' | 'backend';
}

export interface SurveyDemographicMetadata {
  genero?: string;
  generoDescripcion?: string;
  rangoEtario?: string;
  nivelEducativo?: string;
  situacionLaboral?: string;
  ocupacion?: string;
  tiempoResidencia?: string;
  ubicacion?: SurveyLocationMetadata;
}

export interface SurveyAnalyticsMetadata {
  demographics?: SurveyDemographicMetadata;
  answeredQuestions?: number;
  totalQuestions?: number;
  submittedAt?: string;
  canal?: string;
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
  metadata?: SurveyAnalyticsMetadata;
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
  puntos_recompensa?: number;
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

export interface SurveyDemographicBreakdownItem {
  clave?: string | null;
  etiqueta?: string | null;
  respuestas: number;
  porcentaje?: number;
}

export type SurveyDemographicBreakdowns = {
  [key: string]: SurveyDemographicBreakdownItem[] | undefined;
  genero?: SurveyDemographicBreakdownItem[];
  generos?: SurveyDemographicBreakdownItem[];
  rango_etario?: SurveyDemographicBreakdownItem[];
  rangos_etarios?: SurveyDemographicBreakdownItem[];
  rangoEtario?: SurveyDemographicBreakdownItem[];
  rangosEtarios?: SurveyDemographicBreakdownItem[];
  pais?: SurveyDemographicBreakdownItem[];
  paises?: SurveyDemographicBreakdownItem[];
  provincia?: SurveyDemographicBreakdownItem[];
  provincias?: SurveyDemographicBreakdownItem[];
  ciudad?: SurveyDemographicBreakdownItem[];
  ciudades?: SurveyDemographicBreakdownItem[];
  barrio?: SurveyDemographicBreakdownItem[];
  barrios?: SurveyDemographicBreakdownItem[];
};

export interface SurveySummary {
  total_respuestas: number;
  participantes_unicos: number;
  tasa_completitud: number;
  preguntas: SurveySummaryPregunta[];
  canales?: Array<{ canal: string; respuestas: number }>;
  utms?: Array<{ fuente: string; campania?: string; respuestas: number }>;
  demografia?: SurveyDemographicBreakdowns;
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
  genero?: string;
  rango_etario?: string;
  pais?: string;
  provincia?: string;
  ciudad?: string;
  barrio?: string;
  bbox?: string | [number, number, number, number] | null;
}

export interface SurveyResponseAnswer {
  pregunta?: string;
  opcion?: string;
  opciones?: string[];
  respuesta?: string;
  texto?: string;
  texto_libre?: string;
  valor?: string;
  resumen?: string;
}

export interface SurveyResponseRecord {
  id?: number | string;
  respuesta_id?: number | string;
  respondido_at?: string | null;
  creado_at?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  canal?: string | null;
  utm_source?: string | null;
  utm_campaign?: string | null;
  origen?: string | null;
  metadata?: Record<string, unknown> | null;
  respuestas?: SurveyResponseAnswer[];
  resumen?: Array<{ pregunta?: string; respuesta?: string }> | string | null;
}

export interface SurveyResponseList {
  data: SurveyResponseRecord[];
  meta?: {
    total?: number;
    limit?: number;
    offset?: number;
  };
}

export interface SurveyResponseFilters {
  limit?: number;
  offset?: number;
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
