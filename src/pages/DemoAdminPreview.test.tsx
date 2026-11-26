import React from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { DEMO_DATA_NOTICE } from '@/features/demo/demoPresentationLabels';
import type { DemoAdminPreviewResponse } from '@/features/demo/demoTypes';
import { DemoAdminPreview } from './Demo';

vi.mock('@/components/MapLibreMap', () => ({
  default: ({
    heatmapData,
    ariaLabel,
    evidence,
    showHeatmap,
    showPoints,
    showEvidenceBadge,
    heatmapRadiusScale,
    heatmapIntensityScale,
  }: {
    heatmapData: unknown[];
    ariaLabel?: string;
    evidence?: { label?: string; synthetic?: boolean };
    showHeatmap?: boolean;
    showPoints?: boolean;
    showEvidenceBadge?: boolean;
    heatmapRadiusScale?: number;
    heatmapIntensityScale?: number;
  }) => (
    <div
      data-testid="maplibre-preview"
      data-evidence-label={evidence?.label}
      data-evidence-synthetic={String(evidence?.synthetic)}
      data-show-evidence-badge={String(showEvidenceBadge)}
      data-show-heatmap={String(Boolean(showHeatmap))}
      data-show-points={String(Boolean(showPoints))}
      data-radius-scale={String(heatmapRadiusScale ?? '')}
      data-intensity-scale={String(heatmapIntensityScale ?? '')}
      role="region"
      aria-label={ariaLabel}
    >
      {heatmapData.length} puntos en mapa
    </div>
  ),
}));

const executivePreview: DemoAdminPreviewResponse = {
  contract_version: 'demo.admin_preview.v1',
  presentation_mode: 'executive',
  sector: 'gobierno',
  title: 'Centro de gestión ciudadana',
  subtitle: 'Gobierno local',
  description: 'Atención, reclamos, participación y territorio.',
  modules: [
    { id: 'summary', label: 'Resumen' },
    { id: 'claims', label: 'Reclamos' },
    { id: 'heatmap', label: 'Territorio' },
    { id: 'surveys', label: 'Participación' },
  ],
  data_provenance: {
    contract_version: 'demo.executive_provenance.v1',
    mode: 'synthetic_demo_scenario',
    synthetic: true,
    contains_synthetic: true,
    municipal_truth: false,
    suitable_for_product_demonstration: true,
    suitable_for_government_decisions: false,
    label: 'Escenario demostrativo sintético de Junín.',
    scope: 'executive_snapshot',
    scenario_scope: 'Junín, Mendoza',
  },
  cards: [{ id: 'legacy', label: 'Tarjeta anterior', value: 99, detail: 'No debe duplicar la grilla.' }],
  metrics: [
    { id: 'claims', label: 'Reclamos ingresados', value: 184, unit: 'casos', period: 'últimos 30 días simulados', detail: '38 permanecen abiertos en el escenario' },
    { id: 'sla', label: 'Cumplimiento de SLA', value: 87, unit: '%', detail: 'Objetivo demostrativo: 85%' },
    { id: 'whatsapp', label: 'Primera respuesta por WhatsApp', value: 3.4, unit: 'min', detail: 'Mediana del escenario demostrativo' },
    { id: 'survey', label: 'Participación en encuesta', value: 100, unit: 'respuestas sintéticas', detail: 'Base sintética de Junín Participa (DEMO NO OFICIAL). Luminarias lidera con 45%' },
  ],
  timeline: [
    {
      id: 'timeline-1',
      time: '08:42',
      label: 'Ingreso por WhatsApp',
      detail: 'El asistente clasificó el reclamo.',
      channel: 'WhatsApp',
      status: 'done',
      data_mode: 'synthetic_demo_scenario',
    },
  ],
  channel_summary: {
    contract_version: 'demo.channel_summary.v1',
    data_mode: 'synthetic_demo_scenario',
    total_interactions: 426,
    label: 'Distribución de canales del escenario demostrativo',
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
      opened_at_label: '08:40 del día simulado',
      data_mode: 'synthetic_demo_scenario',
    },
  ],
  case_sample: {
    contract_version: 'demo.case_sample.v1',
    sample: true,
    total_cases: 184,
    displayed_cases: 1,
    represented_cases_on_map: 18,
    label: 'Muestra del escenario.',
  },
  map: {
    enabled: true,
    sample: true,
    displayed_points: 2,
    represented_cases: 30,
    total_cases: 184,
    title: 'Mapa de demanda',
    label: 'Puntos simulados',
    data_mode: 'synthetic_demo_scenario',
    center: { lat: -33.144539, lng: -68.485729 },
    points: [
      {
        id: 'point-1',
        label: 'Luminaria fuera de servicio',
        lat: -33.1422,
        lng: -68.4824,
        zone: 'Centro',
        category: 'Alumbrado',
        status: 'assigned',
        weight: 18,
        data_mode: 'synthetic_demo_scenario',
      },
      {
        id: 'point-2',
        label: 'Mantenimiento de calzada',
        lat: -33.1379,
        lng: -68.4921,
        zone: 'Noroeste',
        category: 'Bacheo',
        status: 'in_progress',
        weight: 12,
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
        title: 'Votación de prioridades barriales (DEMO NO OFICIAL)',
        description: 'DEMO NO OFICIAL — Votación no vinculante.',
        question: '¿Qué tema debería resolverse primero?',
        status: 'demo_publicada',
        demo_mode: true,
        data_provenance: { mode: 'synthetic', contains_synthetic: true, synthetic_responses_included: 100 },
        results: {
          total_respuestas: 100,
          segment_scope: 'seeded_synthetic_responses_only',
          segments: {
            zona: [
              { label: 'Oeste', count: 35 },
              { label: 'Centro', count: 25 },
            ],
            canal: [
              { label: 'whatsapp', count: 58 },
              { label: 'web', count: 42 },
            ],
          },
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
  it('renders a single unified notice, four clean KPIs and one footer source line', () => {
    render(
      <DemoAdminPreview
        sector="gobierno"
        rubro="Municipio"
        preview={executivePreview}
        requestedPresentationMode="executive"
      />,
    );

    expect(screen.getAllByRole('note')).toHaveLength(1);
    expect(screen.getByRole('note')).toHaveTextContent(DEMO_DATA_NOTICE);
    expect(screen.getByRole('heading', { level: 2, name: 'Centro de gestión ciudadana' })).toBeVisible();
    expect(screen.getByRole('navigation', { name: 'Secciones del panel' })).toBeVisible();

    const grid = document.querySelector('[data-executive-overview-scorecards] ul');
    expect(grid?.tagName).toBe('UL');
    const kpiItems = within(grid as HTMLElement).getAllByRole('listitem');
    expect(kpiItems).toHaveLength(4);
    expect(screen.getByText('184 casos')).toBeVisible();
    expect(screen.getByText('87%')).toBeVisible();
    expect(screen.getByText('3,4 min')).toBeVisible();
    expect(screen.getByText('100 respuestas')).toBeVisible();
    expect(screen.queryByText(/respuestas sintéticas/i)).not.toBeInTheDocument();
    expect(screen.queryByText('demo.admin_preview.v1')).not.toBeInTheDocument();
    expect(screen.queryByText('Tarjeta anterior')).not.toBeInTheDocument();

    const sourceFooter = document.querySelector('[data-executive-overview-source-footer]');
    expect(sourceFooter).toHaveTextContent('Fuente: Datos de ejemplo de la demo (Junín, Mendoza).');
    expect(screen.getByRole('heading', { level: 3, name: 'Por dónde entran las consultas' })).toBeVisible();
    expect(screen.getByRole('meter', { name: 'WhatsApp: 298, 70 %' })).toHaveAttribute('aria-valuenow', '70');
  });

  it('blocks legacy metrics and maps when the requested executive contract is unavailable', () => {
    const onRetry = vi.fn();
    render(
      <DemoAdminPreview
        sector="gobierno"
        requestedPresentationMode="executive"
        preview={{
          contract_version: 'demo.admin_preview.v1',
          title: 'Panel legacy',
          cards: [{ id: 'legacy-kpi', label: 'Métrica legacy', value: 999 }],
          map: {
            enabled: true,
            points: [{ id: 'legacy-map', label: 'Punto legacy', lat: -33.1, lng: -68.4 }],
          },
        }}
        activeTarget="map"
        onRetry={onRetry}
      />,
    );

    expect(screen.getByRole('heading', { name: 'Panel momentáneamente no disponible' })).toBeVisible();
    expect(screen.queryByText('Métrica legacy')).not.toBeInTheDocument();
    expect(screen.queryByText('Punto legacy')).not.toBeInTheDocument();
    expect(screen.queryByTestId('maplibre-preview')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('keeps legacy compatibility when executive presentation was not requested', () => {
    render(
      <DemoAdminPreview
        sector="empresas"
        preview={{
          contract_version: 'demo.admin_preview.v1',
          title: 'Panel operativo',
          cards: [{ id: 'legacy-kpi', label: 'Operaciones', value: 12 }],
        }}
      />,
    );

    expect(screen.queryByTestId('demo-executive-contract-unavailable')).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: 'Panel operativo' })).toBeVisible();
    expect(screen.getByText('12')).toBeVisible();
  });

  it('shows segmented claims sections and never labels synthetic cases as session events', () => {
    render(
      <DemoAdminPreview
        sector="gobierno"
        preview={executivePreview}
        activeTarget="claims"
      />,
    );

    expect(screen.getByRole('heading', { level: 3, name: 'Cómo están hoy' })).toBeVisible();
    expect(screen.getByRole('heading', { level: 3, name: 'Por categoría' })).toBeVisible();
    expect(screen.getByRole('heading', { level: 3, name: 'Por zona' })).toBeVisible();
    expect(screen.getByRole('heading', { level: 3, name: 'Últimos reclamos' })).toBeVisible();
    expect(screen.getByText('REC-2026-0184')).toBeVisible();
    expect(screen.getByText('Luminaria sin servicio')).toBeVisible();
    expect(screen.getByText('Hoy, 08:40')).toBeVisible();
    expect(screen.queryByText('Sesión actual')).not.toBeInTheDocument();
  });

  it('renders Territory with map, category filter, ranked zones, density scaling and no raw coordinates', async () => {
    render(
      <DemoAdminPreview
        sector="gobierno"
        preview={executivePreview}
        activeTarget="map"
      />,
    );

    expect(screen.getByRole('heading', { level: 3, name: 'Mapa' })).toBeVisible();
    expect(screen.getByRole('heading', { level: 3, name: 'Zonas con más casos' })).toBeVisible();
    expect(screen.getByRole('heading', { level: 3, name: 'Por categoría' })).toBeVisible();

    const map = await screen.findByTestId('maplibre-preview');
    expect(map).toHaveTextContent('2 puntos en mapa');
    expect(map).toHaveAttribute('data-show-evidence-badge', 'false');
    expect(map).toHaveAttribute('data-show-heatmap', 'true');
    expect(map).toHaveAttribute('data-show-points', 'true');
    expect(screen.queryByText(/-33\.14220/)).not.toBeInTheDocument();

    // Filter by category updates both map and zones list
    const filterGroup = screen.getByRole('group', { name: 'Filtrar por categoría' });
    fireEvent.click(within(filterGroup).getByRole('button', { name: 'Alumbrado' }));
    expect(screen.getByTestId('maplibre-preview')).toHaveTextContent('1 puntos en mapa');
    const zonesList = screen.getByRole('list', { name: 'Zonas con más casos' });
    expect(within(zonesList).getByText('Centro')).toBeVisible();
    expect(within(zonesList).queryByText('Noroeste')).not.toBeInTheDocument();

    // Density layer increases radius & intensity scale and hides points
    fireEvent.click(screen.getByRole('button', { name: 'Densidad' }));
    expect(screen.getByTestId('maplibre-preview')).toHaveAttribute('data-show-heatmap', 'true');
    expect(screen.getByTestId('maplibre-preview')).toHaveAttribute('data-show-points', 'false');
    expect(Number(screen.getByTestId('maplibre-preview').getAttribute('data-radius-scale'))).toBeGreaterThan(2);
    expect(Number(screen.getByTestId('maplibre-preview').getAttribute('data-intensity-scale'))).toBeGreaterThan(2);

    fireEvent.click(screen.getByRole('button', { name: 'Puntos' }));
    expect(screen.getByTestId('maplibre-preview')).toHaveAttribute('data-show-heatmap', 'false');
    expect(screen.getByTestId('maplibre-preview')).toHaveAttribute('data-show-points', 'true');
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

    expect(screen.getByRole('heading', { level: 3, name: '¿Qué tema debería resolverse primero?' })).toBeVisible();
    expect(screen.getByText('Votación de prioridades barriales')).toBeVisible();
    expect(screen.getByRole('progressbar', { name: 'Luminarias: 45 %' })).toHaveAttribute('aria-valuenow', '45');
    expect(screen.getByRole('button', { name: 'Zona' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByText('Oeste')).toBeVisible();
    expect(screen.getByRole('link', { name: 'Votar en esta encuesta' })).toHaveAttribute(
      'href',
      '/e/demo-prioridades-barriales',
    );
    expect(screen.queryByText('55', { exact: true })).not.toBeInTheDocument();
  });

  it('keeps reloaded session cases labeled as current session activity', () => {
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
            label: 'Actividad de esta sesión.',
          },
        }}
        activeTarget="claims"
      />,
    );

    expect(screen.getByText('Sesión actual')).toBeVisible();
    expect(screen.getByText('REAL-DEMO-7101')).toBeVisible();
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
            ticket: {
              ticket_id: 991,
              nro_ticket: 'JN-PUBLIC-991',
              categoria: 'Arbolado',
              direccion: 'Plaza central',
            },
          },
        ]}
      />,
    );

    expect(screen.getByText('Sesión actual')).toBeVisible();
    expect(screen.getByRole('note')).toHaveTextContent('Actividad de tu sesión de prueba');
    expect(screen.getByText('JN-PUBLIC-991')).toBeVisible();
    expect(screen.queryByText('REC-2026-0184')).not.toBeInTheDocument();
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

    expect(screen.getByRole('note')).toHaveTextContent('Actividad de tu sesión de prueba');
    expect(screen.getByText('Sesión actual')).toBeVisible();
    expect(screen.getByText('Datos de ejemplo')).toBeVisible();
    expect(screen.getByText('100 votos')).toBeVisible();
  });
});
