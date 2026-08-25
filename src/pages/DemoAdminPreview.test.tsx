import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import type { DemoAdminPreviewResponse } from '@/features/demo/demoTypes';
import { DemoAdminPreview } from './Demo';

vi.mock('@/components/MapLibreMap', () => ({
  default: ({ heatmapData, ariaLabel }: { heatmapData: unknown[]; ariaLabel?: string }) => (
    <div data-testid="maplibre-preview" role="region" aria-label={ariaLabel}>{heatmapData.length} puntos en mapa</div>
  ),
}));

const executivePreview: DemoAdminPreviewResponse = {
  contract_version: 'demo.admin_preview.v1',
  presentation_mode: 'executive',
  sector: 'gobierno',
  title: 'Centro de comando ciudadano',
  subtitle: 'Gobierno local',
  description: 'Monitoreo ejecutivo de atención, territorio y participación.',
  modules: [
    { id: 'summary', label: 'Resumen' },
    { id: 'claims', label: 'Reclamos' },
    { id: 'heatmap', label: 'Mapa operativo' },
    { id: 'surveys', label: 'Encuestas' },
  ],
  data_provenance: {
    contract_version: 'demo.executive_provenance.v1',
    mode: 'synthetic_demo_scenario',
    synthetic: true,
    contains_synthetic: true,
    municipal_truth: false,
    suitable_for_product_demonstration: true,
    suitable_for_government_decisions: false,
    label: 'Snapshot ilustrativo para demostrar el producto.',
    scope: 'executive_snapshot',
    scenario_scope: 'Junín, Mendoza',
  },
  cards: [{ id: 'legacy', label: 'Tarjeta anterior', value: 99, detail: 'No debe duplicar la grilla.' }],
  metrics: [
    { id: 'claims', label: 'Reclamos ingresados', value: 184, unit: 'casos', period: 'Últimos 30 días' },
    { id: 'sla', label: 'Cumplimiento de SLA', value: 87, unit: '%' },
    { id: 'whatsapp', label: 'Primera respuesta por WhatsApp', value: 3.4, unit: 'min' },
    { id: 'survey', label: 'Participación en encuesta', value: 100, unit: 'votos' },
  ],
  timeline: [
    {
      id: 'timeline-1',
      time: '08:42',
      label: 'Ingreso por WhatsApp',
      detail: 'La IA clasificó el reclamo.',
      channel: 'WhatsApp',
      status: 'Clasificado',
      data_mode: 'synthetic_demo_scenario',
    },
  ],
  channel_summary: {
    contract_version: 'demo.channel_summary.v1',
    data_mode: 'synthetic_demo_scenario',
    total_interactions: 426,
    label: 'Canales y SLA del escenario',
    channels: [
      { id: 'whatsapp', label: 'WhatsApp', value: 298, share_pct: 70 },
      { id: 'web', label: 'Web', value: 128, share_pct: 30 },
    ],
    whatsapp: {
      conversations: 298,
      first_response_minutes: 3.4,
      resolved_without_handoff_pct: 72,
    },
  },
  cases: [
    {
      id: 'case-1',
      case_code: 'REC-2026-0184',
      title: 'Luminaria sin servicio',
      category: 'Alumbrado',
      status: 'En tratamiento',
      priority: 'Alta',
      channel: 'WhatsApp',
      zone: 'Barrio Norte',
      sla_status: 'Dentro de plazo',
      opened_at_label: 'Ingresó hace 18 min',
      data_mode: 'synthetic_demo_scenario',
    },
  ],
  case_sample: {
    contract_version: 'demo.case_sample.v1',
    sample: true,
    total_cases: 184,
    displayed_cases: 1,
    represented_cases_on_map: 18,
    label: 'Muestra del escenario; no representa el universo municipal.',
  },
  map: {
    enabled: true,
    sample: true,
    displayed_points: 1,
    represented_cases: 18,
    total_cases: 184,
    coverage_note: 'Una zona de muestra representa 18 de 184 reclamos del escenario.',
    title: 'Mapa operativo del escenario',
    label: 'Puntos simulados',
    data_mode: 'synthetic_demo_scenario',
    center: { lat: -33.144539, lng: -68.485729 },
    points: [
      {
        id: 'point-1',
        label: 'REC-2026-0184',
        lat: -33.144539,
        lng: -68.485729,
        zone: 'Barrio Norte',
        category: 'Alumbrado',
        status: 'En tratamiento',
        data_mode: 'synthetic_demo_scenario',
      },
    ],
  },
  survey_voting: {
    contract_version: 'demo.surveys_votings.v1',
    enabled: true,
    demo_mode: true,
    label: 'Encuestas y votaciones',
    description: 'Sondeos ciudadanos con resultados demo.',
    total_available: 6,
    seed_policy: { responses_per_item: 100, real_people: false, deterministic: true },
    items: [
      {
        id: 'survey-1',
        title: 'Votación de prioridades barriales',
        description: 'Prioridades para los próximos 90 días.',
        question: '¿Qué tema debería resolverse primero?',
        status: 'demo_publicada',
        demo_mode: true,
        data_provenance: { mode: 'synthetic', contains_synthetic: true, synthetic_responses_included: 100 },
        results: {
          total_respuestas: 100,
          options: [
            { label: 'Luminarias', count: 45, porcentaje: 45 },
            { label: 'Bacheo', count: 18, porcentaje: 18 },
            { label: 'Limpieza', count: 25, porcentaje: 25 },
            { label: 'Espacios verdes', count: 12, porcentaje: 12 },
          ],
        },
        links: { public_page_path: '/e/demo-prioridades-barriales' },
      },
    ],
  },
};

describe('DemoAdminPreview executive snapshot', () => {
  it('renders an explicit synthetic provenance notice and one responsive KPI grid', () => {
    render(<DemoAdminPreview sector="gobierno" rubro="Municipio" preview={executivePreview} />);

    expect(screen.getByRole('note', { name: /advertencia sobre los datos/i })).toHaveTextContent(
      'Escenario demostrativo · datos simulados',
    );
    expect(screen.getByRole('note')).toHaveTextContent('No representa datos oficiales ni relevamiento municipal.');
    expect(screen.getByRole('note')).toHaveTextContent('Ámbito del escenario: Junín, Mendoza');
    expect(screen.queryByRole('note', { name: 'Fuentes separadas del panel demostrativo' })).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: 'Centro de comando ciudadano' })).toBeVisible();
    expect(screen.getByRole('navigation', { name: 'Secciones del panel ejecutivo' })).toBeVisible();

    const grid = document.querySelector('[data-demo-kpi-list]');
    expect(grid).toHaveClass('grid-cols-2', 'lg:grid-cols-4');
    expect(screen.getByText('184 casos')).toBeVisible();
    expect(screen.getByText('87 %')).toBeVisible();
    expect(screen.getAllByText('3,4 min')).toHaveLength(2);
    expect(screen.getByText('100 votos')).toBeVisible();
    expect(screen.queryByText('Tarjeta anterior')).not.toBeInTheDocument();

    expect(screen.getByRole('heading', { level: 3, name: 'Canales y SLA del escenario' })).toBeVisible();
    expect(screen.getByText('298', { exact: true })).toBeVisible();
    expect(screen.getByRole('progressbar', { name: 'WhatsApp: 70 %' })).toHaveAttribute('aria-valuenow', '70');
    expect(screen.getByRole('heading', { level: 3, name: 'Recorrido visible para el equipo' })).toBeVisible();
  });

  it('shows synthetic cases as a fallback and never labels them as real session events', () => {
    render(
      <DemoAdminPreview
        sector="gobierno"
        preview={executivePreview}
        activeTarget="claims"
      />,
    );

    expect(screen.getByRole('heading', { level: 3, name: 'Reclamos y casos operativos' })).toBeVisible();
    expect(screen.getByText('Casos simulados')).toBeVisible();
    expect(screen.getByText('REC-2026-0184')).toBeVisible();
    expect(screen.getByText('Luminaria sin servicio')).toBeVisible();
    expect(screen.getByText('Muestra visible: 1 de 184 casos del escenario.')).toBeVisible();
    expect(screen.queryByText('Eventos reales de esta sesión', { exact: true })).not.toBeInTheDocument();
  });

  it('renders the existing territorial map with an explicit synthetic source label', async () => {
    render(
      <DemoAdminPreview
        sector="gobierno"
        preview={executivePreview}
        activeTarget="map"
      />,
    );

    expect(screen.getByRole('heading', { level: 3, name: 'Mapa operativo del escenario' })).toBeVisible();
    expect(screen.getByText('Puntos simulados')).toBeVisible();
    expect(await screen.findByTestId('maplibre-preview')).toHaveTextContent('1 puntos en mapa');
    expect(screen.getByRole('region', { name: /1 zonas muestran 18 de 184 casos/i })).toBeVisible();
    expect(screen.getByText('Una zona de muestra representa 18 de 184 reclamos del escenario.')).toBeVisible();
  });

  it('renders the seeded survey contract instead of treating runtime tickets as responses', () => {
    render(
      <DemoAdminPreview
        sector="gobierno"
        preview={executivePreview}
        activeTarget="surveys"
        runtimeEvents={[{ id: 'ticket:55', ticketId: '55', status: 'abierto', updatedAt: '2026-08-25T12:00:00Z' }]}
      />,
    );

    expect(screen.getByRole('heading', { level: 3, name: 'Encuestas y votaciones' })).toBeVisible();
    expect(screen.getByText('Base sintética determinística: las respuestas no pertenecen a personas reales ni representan opinión pública municipal.')).toBeVisible();
    expect(screen.getByText('Votación de prioridades barriales')).toBeVisible();
    expect(screen.getByText('100 respuestas sintéticas')).toBeVisible();
    expect(screen.getByRole('progressbar', { name: 'Luminarias: 45 %' })).toHaveAttribute('aria-valuenow', '45');
    expect(screen.getByRole('link', { name: 'Abrir encuesta demo' })).toHaveAttribute('href', '/e/demo-prioridades-barriales');
    expect(screen.queryByText('55', { exact: true })).not.toBeInTheDocument();
  });

  it('keeps reloaded session cases and their counts labeled as observed session data', () => {
    render(
      <DemoAdminPreview
        sector="gobierno"
        preview={{
          ...executivePreview,
          data_provenance: {
            ...executivePreview.data_provenance,
            mode: 'mixed_partitioned',
            synthetic: false,
            contains_synthetic: true,
          },
          cases: [{
            id: 'session-case-1',
            case_code: 'REAL-DEMO-7101',
            title: 'Luminaria reportada en la sesión',
            data_mode: 'session_generated_events',
          }],
          case_sample: null,
          channel_summary: {
            contract_version: 'demo.channel_summary.v1',
            data_mode: 'session_generated_events',
            total_interactions: null,
            total_cases: 1,
            observed_cases: 1,
            label: 'Solo actividad observada en esta sesión.',
          },
        }}
        activeTarget="claims"
      />,
    );

    expect(screen.getByText('Eventos reales de esta sesión')).toBeVisible();
    expect(screen.getByText('REAL-DEMO-7101')).toBeVisible();
    expect(screen.queryByText('Casos simulados')).not.toBeInTheDocument();
  });

  it('renders only real session cases when runtime activity exists', () => {
    render(
      <DemoAdminPreview
        sector="gobierno"
        preview={{
          ...executivePreview,
          data_provenance: {
            ...executivePreview.data_provenance,
            mode: 'mixed_partitioned',
            synthetic: false,
            contains_synthetic: true,
          },
        }}
        activeTarget="claims"
        runtimeEvents={[
          {
            id: 'ticket:991',
            ticketId: '991',
            status: 'abierto',
            updatedAt: '2026-08-25T12:00:00Z',
            ticket: { ticket_id: 991, categoria: 'Arbolado', direccion: 'Plaza central' },
          },
        ]}
      />,
    );

    expect(screen.getByText('Eventos reales de esta sesión')).toBeVisible();
    expect(screen.getByRole('note', { name: 'Fuentes separadas del panel demostrativo' })).toHaveTextContent(
      'Actividad de esta sesión + encuesta demo separada',
    );
    expect(screen.getByRole('note')).toHaveTextContent('partición sintética separada');
    expect(screen.getByText('991')).toBeVisible();
    expect(screen.queryByText('REC-2026-0184')).not.toBeInTheDocument();
    expect(screen.queryByText('Casos simulados')).not.toBeInTheDocument();
  });

  it('labels KPI sources independently for a mixed partitioned response', () => {
    render(
      <DemoAdminPreview
        sector="gobierno"
        preview={{
          ...executivePreview,
          data_provenance: {
            ...executivePreview.data_provenance,
            mode: 'mixed_partitioned',
            synthetic: false,
            contains_synthetic: true,
          },
          session_activity: { has_session_data: true, items: [] },
          metrics: [
            {
              id: 'claims',
              label: 'Reclamos de esta sesión',
              value: 1,
              unit: 'caso',
              data_mode: 'session_generated_events',
            },
            {
              id: 'survey',
              label: 'Participación en encuesta',
              value: 100,
              unit: 'votos',
              data_mode: 'synthetic_demo_scenario',
            },
          ],
        }}
      />,
    );

    expect(screen.getByText('Fuentes separadas')).toBeVisible();
    expect(screen.getByText('Sesión actual')).toBeVisible();
    expect(screen.getByText('Demo sintética')).toBeVisible();
    expect(screen.getByText('100 votos')).toBeVisible();
    expect(screen.queryByText(/únicamente actividad generada/i)).not.toBeInTheDocument();
  });
});
