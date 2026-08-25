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
