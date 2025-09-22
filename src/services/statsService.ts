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
  categoria?: string | string[];
  estado?: string | string[];
  distrito?: string;
  barrio?: string;
  genero?: string | string[];
  edad_min?: string | number;
  edad_max?: string | number;
  sugerencia?: string | string[];
  prioridad?: string | string[];
}

export const getTicketStats = async (
  params?: TicketStatsParams,
): Promise<TicketStatsResponse> => {
  try {
    const qs = new URLSearchParams();
    Object.entries(params || {}).forEach(([k, v]) => {
      if (Array.isArray(v)) {
        v.filter(Boolean).forEach((val) => qs.append(k, String(val)));
      } else if (v) {
        qs.append(k, String(v));
      }
    });
    const query = qs.toString();
    const resp = await apiFetch<TicketStatsResponse>(
      `/estadisticas/tickets${query ? `?${query}` : ''}`,
    );

    const charts = resp?.charts || [];
    const heatmap = Array.isArray(resp?.heatmap)
      ? resp!.heatmap
          .map((p: any) => {
            const district = p.distrito ?? p.barrio;
            const lat = Number(p.location?.lat ?? p.lat);
            const lng = Number(p.location?.lng ?? p.lng);
            return {
              ...p,
              lat,
              lng,
              distrito: district,
              barrio: district,
            } as HeatPoint;
          })
          .filter((p) => !Number.isNaN(p.lat) && !Number.isNaN(p.lng))
      : [];

    return { charts, heatmap };
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
  categoria?: string | string[];
  estado?: string | string[];
  distrito?: string;
  barrio?: string;
  genero?: string | string[];
  edad_min?: string | number;
  edad_max?: string | number;
  sugerencia?: string | string[];
}

export const getHeatmapPoints = async (
  params?: HeatmapParams,
): Promise<HeatPoint[]> => {
  try {
    const qs = new URLSearchParams();
    Object.entries(params || {}).forEach(([k, v]) => {
      if (Array.isArray(v)) {
        v.filter((val) => val !== undefined && val !== null && String(val) !== '')
          .forEach((val) => qs.append(k, String(val)));
      } else if (v !== undefined && v !== null && String(v) !== '') {
        qs.append(k, String(v));
      }
    });
    const query = qs.toString();
    const data = await apiFetch<any[]>(
      `/estadisticas/mapa_calor/datos${query ? `?${query}` : ''}`,
    );
    if (!Array.isArray(data)) return [];
    return data
      .map((p) => {
        const district = p.distrito ?? p.barrio;
        return {
          lat: Number(p.location?.lat),
          lng: Number(p.location?.lng),
          weight: p.weight,
          id: p.id,
          ticket: p.ticket,
          categoria: p.categoria,
          direccion: p.direccion,
          distrito: district,
          barrio: district,
          tipo_ticket: p.tipo_ticket,
          estado: p.estado,
        };
      })
      .filter((p) => !Number.isNaN(p.lat) && !Number.isNaN(p.lng));
  } catch (err) {
    console.error('Error fetching heatmap points:', err);
    throw err;
  }
};

type MunicipalStatesPayload =
  | string[]
  | {
      estados?: unknown;
      states?: unknown;
      data?: unknown;
      [key: string]: unknown;
    };

const normalizeStatesResponse = (payload: MunicipalStatesPayload): string[] => {
  const potentialLists: unknown[] = [];
  if (Array.isArray(payload)) {
    potentialLists.push(payload);
  } else if (payload && typeof payload === 'object') {
    potentialLists.push(payload.estados, payload.states, payload.data);
  }

  for (const value of potentialLists) {
    if (Array.isArray(value)) {
      return value
        .map((item) => (typeof item === 'string' ? item.trim() : ''))
        .filter((item): item is string => item.length > 0);
    }
  }

  return [];
};

export const getMunicipalTicketStates = async (): Promise<string[]> => {
  try {
    const payload = await apiFetch<MunicipalStatesPayload>('/municipal/estados');
    return normalizeStatesResponse(payload);
  } catch (err) {
    console.error('Error fetching municipal ticket states:', err);
    throw err;
  }
};

