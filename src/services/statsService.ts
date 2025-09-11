import { apiFetch } from '@/utils/api';

export interface HeatPoint {
  lat: number;
  lng: number;
  weight?: number;
  id?: number;
  ticket?: string;
  categoria?: string;
  direccion?: string;
  distrito?: string;
  tipo_ticket?: string;
  estado?: string;
}

export interface TicketStatsResponse {
  charts?: { title: string; data: Record<string, number> }[];
  heatmap?: HeatPoint[];
}

export interface TicketStatsParams {
  tipo?: string;
  fecha_inicio?: string;
  fecha_fin?: string;
  categoria?: string;
  distrito?: string;
}

export const getTicketStats = async (
  params?: TicketStatsParams,
): Promise<TicketStatsResponse> => {
  try {
    const qs = new URLSearchParams();
    Object.entries(params || {}).forEach(([k, v]) => {
      if (v) qs.append(k, String(v));
    });
    const query = qs.toString();
    return await apiFetch<TicketStatsResponse>(
      `/estadisticas/tickets${query ? `?${query}` : ''}`,
    );
  } catch (err) {
    console.error('Error fetching ticket stats:', err);
    throw err;
  }
};

export interface HeatmapParams {
  tipo_ticket?: string;
  municipio_id?: number;
  rubro_id?: number;
  fecha_inicio?: string;
  fecha_fin?: string;
  categoria?: string;
  estado?: string;
  distrito?: string;
}

export const getHeatmapPoints = async (
  params?: HeatmapParams,
): Promise<HeatPoint[]> => {
  const qs = new URLSearchParams();
  Object.entries(params || {}).forEach(([k, v]) => {
    if (v !== undefined && v !== null) qs.append(k, String(v));
  });
  const query = qs.toString();
  const data = await apiFetch<any[]>(
    `/estadisticas/mapa_calor/datos${query ? `?${query}` : ''}`,
  );
  return data
    .map((p) => ({
      lat: Number(p.location?.lat),
      lng: Number(p.location?.lng),
      weight: p.weight,
      id: p.id,
      ticket: p.ticket,
      categoria: p.categoria,
      direccion: p.direccion,
      distrito: p.distrito,
      tipo_ticket: p.tipo_ticket,
      estado: p.estado,
    }))
    .filter((p) => !Number.isNaN(p.lat) && !Number.isNaN(p.lng));
};

