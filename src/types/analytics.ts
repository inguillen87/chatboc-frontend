export interface AnalyticsEvent {
  id: string;
  tenant_id: string;
  timestamp: string;
  event_type: 'message_in' | 'ticket_created' | 'order_created' | 'survey_answer' | 'handoff_human' | 'status_changed';
  channel: 'whatsapp' | 'web' | 'telegram' | 'mercadolibre';
  metadata: Record<string, any>;
  geo?: {
    lat: number;
    lng: number;
  };
}

export interface AnalyticsSummary {
  total_interactions: number;
  active_users: number;
  avg_response_time: number; // seconds
  conversion_rate?: number; // for pyme
  top_categories: { category: string; count: number }[];
  volume_by_day: { date: string; count: number }[];
  heatmap_points: { lat: number; lng: number; weight: number }[];
  ai_insights: string[];
}
