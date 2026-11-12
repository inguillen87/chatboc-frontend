import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import ExecutiveSurveyPanel, { type ExecutiveSurveyVoting } from './ExecutiveSurveyPanel';

const surveyVoting: ExecutiveSurveyVoting = {
  title: 'Encuestas y votaciones',
  description: 'Sondeos ciudadanos con resultados demo.',
  totalAvailable: 6,
  realPeople: false,
  items: [{
    id: 'survey-1',
    title: 'Votación de prioridades barriales',
    description: 'Prioridades para los próximos 90 días.',
    question: '¿Qué tema debería resolverse primero?',
    status: 'demo_publicada',
    totalResponses: 100,
    seededResponses: 100,
    interactiveDemoResponses: 0,
    verifiedCitizenResponses: 0,
    hasPartitionedDemoComposition: true,
    isSynthetic: true,
    publicPagePath: '/e/demo-prioridades-barriales',
    segmentScope: 'seeded_synthetic_responses_only',
    options: [
      { id: 'luminarias', label: 'Luminarias', count: 45, percentage: 45 },
      { id: 'bacheo', label: 'Bacheo', count: 18, percentage: 18 },
      { id: 'limpieza', label: 'Limpieza', count: 25, percentage: 25 },
      { id: 'verdes', label: 'Espacios verdes', count: 12, percentage: 12 },
    ],
    segments: [
      {
        key: 'zona',
        items: [
          { id: 'norte', label: 'Norte', count: 60 },
          { id: 'centro', label: 'Centro', count: 40 },
        ],
      },
      {
        key: 'canal',
        items: [
          { id: 'web', label: 'web', count: 55 },
          { id: 'whatsapp', label: 'whatsapp', count: 45 },
        ],
      },
    ],
  }],
};

const multiSurveyVoting: ExecutiveSurveyVoting = {
  ...surveyVoting,
  items: [
    surveyVoting.items[0],
    {
      ...surveyVoting.items[0],
      id: 'survey-2',
      title: 'Destino del presupuesto participativo',
      description: 'Selección de proyectos para el próximo trimestre.',
      question: '¿Qué proyecto debería priorizarse?',
      totalResponses: 160,
      seededResponses: 160,
      publicPagePath: '/e/demo-presupuesto-participativo',
      options: [
        { id: 'plaza', label: 'Plaza central', count: 96, percentage: 60 },
        { id: 'ciclovia', label: 'Ciclovía', count: 64, percentage: 40 },
      ],
      segments: [],
      segmentScope: null,
    },
    {
      ...surveyVoting.items[0],
      id: 'survey-3',
      title: 'Horarios de atención municipal',
      description: null,
      question: '¿Qué franja horaria resulta más conveniente?',
      totalResponses: 80,
      seededResponses: 80,
      publicPagePath: '/e/demo-horarios-atencion',
      options: [
        { id: 'manana', label: 'Mañana', count: 44, percentage: 55 },
        { id: 'tarde', label: 'Tarde', count: 36, percentage: 45 },
      ],
      segments: [],
      segmentScope: null,
    },
  ],
};

describe('ExecutiveSurveyPanel', () => {
  it('turns the API distribution into a truthful executive readout', () => {
    render(
      <ExecutiveSurveyPanel
        surveyVoting={surveyVoting}
        inventoryLabel="1 visible de 6 encuestas demo"
        fallbackTitle="Encuestas"
      />,
    );

    expect(screen.getByText('1 visible de 6 encuestas demo')).toBeVisible();
    expect(screen.getByText('Base sintética determinística: las respuestas no pertenecen a personas reales ni representan opinión pública municipal.')).toBeVisible();
    expect(screen.getByText('Sin denominador')).toBeVisible();
    expect(screen.getByText('20 p.p.')).toBeVisible();
    expect(screen.getByText(/Luminarias encabeza la distribución con 45%/)).toBeVisible();

    const distribution = screen.getByRole('region', {
      name: 'Distribución de respuestas de Votación de prioridades barriales',
    });
    const progressbars = within(distribution).getAllByRole('progressbar');
    expect(progressbars[0]).toHaveAccessibleName('Luminarias: 45 %');
    expect(progressbars[1]).toHaveAccessibleName('Limpieza: 25 %');
    expect(screen.getByRole('link', { name: 'Abrir encuesta demo' })).toHaveAttribute(
      'href',
      '/e/demo-prioridades-barriales',
    );
  });

  it('shows only segmentation dimensions delivered by the contract', () => {
    const partitionedVoting: ExecutiveSurveyVoting = {
      ...surveyVoting,
      items: [{
        ...surveyVoting.items[0],
        totalResponses: 102,
        interactiveDemoResponses: 2,
        options: [
          { id: 'luminarias', label: 'Luminarias', count: 47, percentage: 46.08 },
          { id: 'bacheo', label: 'Bacheo', count: 18, percentage: 17.65 },
          { id: 'limpieza', label: 'Limpieza', count: 25, percentage: 24.51 },
          { id: 'verdes', label: 'Espacios verdes', count: 12, percentage: 11.76 },
        ],
      }],
    };
    render(
      <ExecutiveSurveyPanel
        surveyVoting={partitionedVoting}
        inventoryLabel="1 visible de 6 encuestas demo"
        fallbackTitle="Encuestas"
      />,
    );

    expect(screen.getByText('Norte')).not.toBeVisible();
    fireEvent.click(screen.getByText('Cortes descriptivos'));
    expect(screen.getByText('Norte')).toBeVisible();
    expect(screen.getByText('60 · 60%')).toBeVisible();
    expect(screen.queryByText('60 · 58,8%')).not.toBeInTheDocument();
    expect(screen.queryByText('WhatsApp')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Canal' }));
    expect(screen.getByText('WhatsApp')).toBeVisible();
    expect(screen.getByText('Web')).toBeVisible();
    expect(screen.queryByText('Chat web')).not.toBeInTheDocument();
    expect(screen.getByText('Segmentación calculada exclusivamente sobre la base sintética del escenario.')).toBeVisible();
  });

  it('renders one accessible detail view and keeps the remaining surveys compact', () => {
    render(
      <ExecutiveSurveyPanel
        surveyVoting={multiSurveyVoting}
        inventoryLabel="3 visibles de 6 encuestas demo"
        fallbackTitle="Encuestas"
      />,
    );

    expect(screen.getByText('3 visibles de 6 encuestas demo')).toBeVisible();
    expect(screen.getByText('2 de 3 en detalle')).toBeVisible();
    expect(screen.getByLabelText('Síntesis global de encuestas')).toHaveTextContent(
      /Destino del presupuesto participativo.*mayor volumen visible/i,
    );

    const leaderTrigger = screen.getByRole('button', { name: /Destino del presupuesto participativo/i });
    const firstTrigger = screen.getByRole('button', { name: /Votación de prioridades barriales/i });
    const thirdTrigger = screen.getByRole('button', { name: /Horarios de atención municipal/i });

    expect(leaderTrigger).toHaveAttribute('aria-expanded', 'true');
    expect(firstTrigger).toHaveAttribute('aria-expanded', 'false');
    expect(thirdTrigger).toHaveAttribute('aria-expanded', 'false');
    const detailRegionId = leaderTrigger.getAttribute('aria-controls');
    const detailRegion = detailRegionId ? document.getElementById(detailRegionId) : null;
    expect(detailRegionId).toBeTruthy();
    expect(detailRegion).not.toBeNull();
    expect(detailRegion).toBeVisible();
    expect(screen.getAllByRole('link', { name: 'Abrir encuesta demo' })).toHaveLength(1);
    expect(screen.getByRole('link', { name: 'Abrir encuesta demo' })).toHaveAttribute(
      'href',
      '/e/demo-presupuesto-participativo',
    );
    expect(screen.queryByRole('region', { name: 'Distribución de respuestas de Votación de prioridades barriales' })).not.toBeInTheDocument();

    firstTrigger.focus();
    expect(firstTrigger).toHaveFocus();
    fireEvent.click(firstTrigger);

    expect(firstTrigger).toHaveAttribute('aria-expanded', 'true');
    expect(leaderTrigger).toHaveAttribute('aria-expanded', 'false');
    expect(screen.getByText('1 de 3 en detalle')).toBeVisible();
    expect(detailRegion).toHaveAccessibleName('Votación de prioridades barriales: análisis visible');
    expect(screen.getByRole('region', { name: 'Distribución de respuestas de Votación de prioridades barriales' })).toBeVisible();
    expect(screen.getByRole('link', { name: 'Abrir encuesta demo' })).toHaveAttribute(
      'href',
      '/e/demo-prioridades-barriales',
    );
    expect(screen.queryByRole('region', { name: 'Distribución de respuestas de Destino del presupuesto participativo' })).not.toBeInTheDocument();
  });

  it('keeps an explicit empty state instead of fabricating metrics', () => {
    render(
      <ExecutiveSurveyPanel
        surveyVoting={null}
        inventoryLabel={null}
        fallbackTitle="Encuestas y votaciones"
      />,
    );

    expect(screen.getByRole('heading', { name: 'Encuestas y votaciones' })).toBeVisible();
    expect(screen.getByText('Sin encuestas publicadas en este contrato')).toBeVisible();
    expect(screen.getByText(/no genera métricas sustitutas/i)).toBeVisible();
  });
});
