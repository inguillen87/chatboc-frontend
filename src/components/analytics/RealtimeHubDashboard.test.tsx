import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import RealtimeHubDashboard from './RealtimeHubDashboard';
import type { RealtimeHubResponse } from '@/services/analyticsService';

vi.mock('@/components/LazyMapLibreMap', () => ({
  default: () => <div data-testid="mock-map">mapa realtime</div>,
}));

vi.mock('@/utils/safeLocalStorage', () => ({
  safeLocalStorage: {
    getItem: vi.fn(() => null),
    setItem: vi.fn(),
  },
}));

const realtimeHubFixture = (): RealtimeHubResponse => ({
  totals: {
    events: 9,
    survey_responses: 4,
    survey_comments: 2,
    live_chat_comments: 1,
  },
  survey_operations: {
    contract_version: 'analytics.survey_operations.v1',
    status: 'live',
    headline: '8 senales de participacion en los ultimos 30 minutos.',
    window_minutes: 30,
    responses: 4,
    comments: 2,
    vote_events: 2,
    engagement: 8,
    live_signal: true,
    recommended_actions: [
      { id: 'moderate_comments', label: 'Moderar comentarios', route: '/admin/encuestas?focus=comments' },
      { id: 'review_live_results', label: 'Revisar resultados en vivo', route: '/admin/encuestas?focus=live' },
    ],
  },
  top_channels: [{ channel: 'whatsapp', count: 5 }],
  top_events: [{ event: 'survey.vote.created', count: 2 }],
  sentiment: { positive: 2, neutral: 1, negative: 0 },
  comments: [
    { channel: 'survey', text: 'Queremos mas turnos online', sentiment: 'neutral', created_at: '2026-06-30T12:00:00Z' },
  ],
  hotspots: [{ label: 'Centro', count: 3 }],
  recommendations: ['Abrir refuerzo por WhatsApp.'],
  ui: {
    labels: {
      survey_ops_title: 'Encuestas y votaciones en vivo',
      survey_ops_quiet: 'Sin actividad de encuestas en este periodo',
      option_all: 'Todos',
      sections_top_channels: 'Canales',
      sections_top_events: 'Eventos',
      sections_sentiment: 'Sentimiento',
      sections_live_comments: 'Comentarios en vivo',
      sections_hotspots_recommendations: 'Hotspots y acciones',
      sections_map: 'Mapa en tiempo real',
      sections_segments: 'Segmentos',
      empty: 'Sin datos',
    },
  },
});

describe('RealtimeHubDashboard', () => {
  it('renders survey operations as a live command center', () => {
    render(<RealtimeHubDashboard data={realtimeHubFixture()} />);

    expect(screen.getByText('Encuestas y votaciones en vivo')).toBeInTheDocument();
    expect(screen.getByText('Actividad en vivo')).toBeInTheDocument();
    expect(screen.getByText('8 senales de participacion en los ultimos 30 minutos.')).toBeInTheDocument();
    expect(screen.getByText('Participaciones')).toBeInTheDocument();
    expect(screen.getByText('Eventos voto')).toBeInTheDocument();
    expect(screen.getByText('Engagement')).toBeInTheDocument();
    expect(screen.getByText('Moderar comentarios')).toBeInTheDocument();
    expect(screen.getByText('Revisar resultados en vivo')).toBeInTheDocument();
    expect(screen.getByText('Queremos mas turnos online')).toBeInTheDocument();
  });
});
