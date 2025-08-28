import { apiFetch } from '@/utils/api';

export interface HeatPoint { lat: number; lng: number; weight?: number }

export interface TicketStatsResponse {
  charts?: { title: string; data: Record<string, number> }[];
  heatmap?: HeatPoint[];
}

export const getTicketStats = async (): Promise<TicketStatsResponse> => {
  try {
    return await apiFetch<TicketStatsResponse>('/tickets/stats');
  } catch (err) {
    console.error('Error fetching ticket stats:', err);
    throw err;
  }
};

