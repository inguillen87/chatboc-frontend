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
    title: 'Votación de prioridades barriales (DEMO NO OFICIAL)',
    description: 'DEMO NO OFICIAL — Votación no vinculante creada exclusivamente para validar Chatboc.',
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
  it('shows the question, ranked animated bars and clear vote CTA without boilerplate disclaimers', () => {
    render(
      <ExecutiveSurveyPanel
        surveyVoting={surveyVoting}
        inventoryLabel="1 de 6 encuestas"
        fallbackTitle="Encuestas"
      />,
    );

    expect(screen.getByRole('heading', { name: '¿Qué tema debería resolverse primero?' })).toBeVisible();
    expect(screen.getByText('Votación de prioridades barriales')).toBeVisible();
    expect(screen.queryByText(/DEMO NO OFICIAL/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Base sintética determinística/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Sin denominador/i)).not.toBeInTheDocument();

    const distribution = screen.getByRole('region', {
      name: 'Resultados de Votación de prioridades barriales',
    });
    const progressbars = within(distribution).getAllByRole('progressbar');
    expect(progressbars[0]).toHaveAccessibleName('Luminarias: 45 %');
    expect(progressbars[1]).toHaveAccessibleName('Limpieza: 25 %');
    expect(progressbars[0].firstElementChild).toHaveClass('transition-[width]', 'motion-reduce:transition-none');
    expect(screen.getByRole('link', { name: 'Votar en esta encuesta' })).toHaveAttribute(
      'href',
      '/e/demo-prioridades-barriales',
    );
  });

  it('shows segmentation dimensions cleanly without repeated disclaimers', () => {
    render(
      <ExecutiveSurveyPanel
        surveyVoting={surveyVoting}
        inventoryLabel="1 de 6 encuestas"
        fallbackTitle="Encuestas"
      />,
    );

    expect(screen.getByRole('heading', { name: 'Quiénes respondieron' })).toBeVisible();
    expect(screen.getByText('Norte')).toBeVisible();
    expect(screen.queryByText('WhatsApp')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Canal' }));
    expect(screen.getByText('WhatsApp')).toBeVisible();
    expect(screen.getByText('Web')).toBeVisible();
    expect(screen.queryByText('Chat web')).not.toBeInTheDocument();
  });

  it('updates the top result bars and CTA when selecting another survey from the list', () => {
    render(
      <ExecutiveSurveyPanel
        surveyVoting={multiSurveyVoting}
        inventoryLabel="3 de 6 encuestas"
        fallbackTitle="Encuestas"
      />,
    );

    expect(screen.getByRole('heading', { name: 'Otras encuestas' })).toBeVisible();

    const leaderTrigger = screen.getByRole('button', { name: /Destino del presupuesto participativo/i });
    const firstTrigger = screen.getByRole('button', { name: /Votación de prioridades barriales/i });
    const thirdTrigger = screen.getByRole('button', { name: /Horarios de atención municipal/i });

    expect(leaderTrigger).toHaveAttribute('aria-expanded', 'true');
    expect(firstTrigger).toHaveAttribute('aria-expanded', 'false');
    expect(thirdTrigger).toHaveAttribute('aria-expanded', 'false');
    const detailRegionId = leaderTrigger.getAttribute('aria-controls');
    const detailRegion = detailRegionId ? document.getElementById(detailRegionId) : null;
    expect(detailRegion).toBeVisible();
    expect(screen.getAllByRole('link', { name: 'Votar en esta encuesta' })).toHaveLength(1);
    expect(screen.getByRole('link', { name: 'Votar en esta encuesta' })).toHaveAttribute(
      'href',
      '/e/demo-presupuesto-participativo',
    );

    firstTrigger.focus();
    expect(firstTrigger).toHaveFocus();
    fireEvent.click(firstTrigger);

    expect(firstTrigger).toHaveAttribute('aria-expanded', 'true');
    expect(leaderTrigger).toHaveAttribute('aria-expanded', 'false');
    expect(detailRegion).toHaveAccessibleName('Votación de prioridades barriales: resultados visibles');
    expect(screen.getByRole('region', { name: 'Resultados de Votación de prioridades barriales' })).toBeVisible();
    expect(screen.getByRole('link', { name: 'Votar en esta encuesta' })).toHaveAttribute(
      'href',
      '/e/demo-prioridades-barriales',
    );
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
    expect(screen.getByText('Todavía no hay encuestas publicadas en esta vista.')).toBeVisible();
  });
});
