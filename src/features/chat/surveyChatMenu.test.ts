import { describe, expect, it } from 'vitest';

import { isSurveyMenuNavigationAction, normalizeSurveyChatMenu } from './surveyChatMenu';

const surveyItem = (index: number) => ({
  id: index,
  slug: `prioridad-${index}`,
  titulo: `Prioridad barrial ${index}`,
  descripcion: `Consulta territorial ${index}`,
  tipo: index === 1 ? 'votacion' : 'encuesta',
  public_url: `https://preview.chatboc.ar/e/prioridad-${index}`,
  whatsapp_share_url: `https://wa.me/?text=prioridad-${index}`,
  demo_mode: true,
  seed: { responses: 100, real_people: false },
  results: { total_respuestas: index === 1 ? 101 : 100, seeded_responses: 100 },
});

describe('normalizeSurveyChatMenu', () => {
  it('normalizes the structured survey contract without depending on raw Markdown', () => {
    const menu = normalizeSurveyChatMenu({
      fuente: 'demo_encuestas_menu_v1',
      message_body: '*Encuestas*\nAbrir: https://preview.chatboc.ar/e/prioridad-1',
      data: {
        surveys_votings: {
          contract_version: 'demo.surveys_votings.v1',
          label: 'Encuestas y votaciones',
          description: 'Consultas activas del territorio.',
          total_available: 6,
          items: [surveyItem(1), surveyItem(2), surveyItem(3)],
        },
      },
    });

    expect(menu).toMatchObject({
      title: 'Encuestas y votaciones',
      description: 'Consultas activas del territorio.',
      totalAvailable: 6,
    });
    expect(menu?.items).toHaveLength(3);
    expect(menu?.items[0]).toMatchObject({
      title: 'Prioridad barrial 1',
      type: 'voting',
      responseCount: 101,
      demoResponses: true,
      publicUrl: 'https://preview.chatboc.ar/e/prioridad-1',
    });
  });

  it('drops unsafe or incomplete links instead of rendering them as actions', () => {
    const menu = normalizeSurveyChatMenu({
      accion_backend: 'demo_encuestas_menu',
      demo_surveys: [
        surveyItem(1),
        { ...surveyItem(2), public_url: 'javascript:alert(1)' },
        { ...surveyItem(3), public_url: '/e/prioridad-3', whatsapp_share_url: 'data:text/html,bad' },
      ],
    });

    expect(menu?.items.map((item) => item.title)).toEqual(['Prioridad barrial 1', 'Prioridad barrial 3']);
    expect(menu?.items[1].publicUrl).toBe('/e/prioridad-3');
    expect(menu?.items[1].whatsappShareUrl).toBeNull();
  });
});

describe('isSurveyMenuNavigationAction', () => {
  it('keeps pagination/back actions and removes per-survey open/share duplication', () => {
    expect(isSurveyMenuNavigationAction({ texto: 'Ver más', action_id: 'mostrar_menu_encuestas::2' })).toBe(true);
    expect(isSurveyMenuNavigationAction({ texto: 'Volver', action_id: 'volver_menu_municipio' })).toBe(true);
    expect(isSurveyMenuNavigationAction({ texto: 'Abrir plaza', url: '/e/plaza', type: 'url' })).toBe(false);
    expect(isSurveyMenuNavigationAction({ texto: 'Compartir', action_id: 'chatboc_survey_share::plaza' })).toBe(false);
  });
});
