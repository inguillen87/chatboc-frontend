import { apiFetch } from '@/utils/api';

export interface HeatPoint {
  lat: number;
  lng: number;
  weight?: number;
  id?: number;
  ticket?: string;
  categoria?: string;
  barrio?: string;
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

