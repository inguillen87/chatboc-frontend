import { beforeEach, describe, expect, it } from 'vitest';

import { purgeLegacyPublicSurveyPersistence } from './publicSurveyPrivacy';

const QUEUE_KEY = 'chatboc_offline_draft_queue';

describe('public survey browser privacy migration', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('purges every public survey draft and only legacy response queue entries', () => {
    window.localStorage.setItem(
      'chatboc:survey:draft:tenant-a:consulta',
      JSON.stringify({ answers: { 1: { texto: 'privado' } }, dni: '12345678' }),
    );
    window.localStorage.setItem(
      'chatboc:survey:draft:tenant-b:votacion',
      JSON.stringify({ phone: '5491112345678' }),
    );
    window.localStorage.setItem('unrelated-key', 'keep-me');
    window.localStorage.setItem(
      QUEUE_KEY,
      JSON.stringify([
        { id: 'response-1', type: 'survey_response', payload: { dni: '12345678' } },
        { id: 'ticket-1', type: 'create_ticket_draft', payload: { title: 'Sin luz' } },
        { id: 'draft-1', type: 'survey_draft', payload: { title: 'Encuesta futura' } },
        'unknown-legacy-entry',
      ]),
    );

    expect(purgeLegacyPublicSurveyPersistence()).toEqual({
      removedDrafts: 2,
      removedQueuedResponses: 1,
    });

    expect(window.localStorage.getItem('chatboc:survey:draft:tenant-a:consulta')).toBeNull();
    expect(window.localStorage.getItem('chatboc:survey:draft:tenant-b:votacion')).toBeNull();
    expect(window.localStorage.getItem('unrelated-key')).toBe('keep-me');
    expect(JSON.parse(window.localStorage.getItem(QUEUE_KEY) ?? '[]')).toEqual([
      { id: 'ticket-1', type: 'create_ticket_draft', payload: { title: 'Sin luz' } },
      { id: 'draft-1', type: 'survey_draft', payload: { title: 'Encuesta futura' } },
      'unknown-legacy-entry',
    ]);
  });

  it('does not rewrite malformed or unrelated queue contents', () => {
    window.localStorage.setItem(QUEUE_KEY, '{malformed');
    purgeLegacyPublicSurveyPersistence();
    expect(window.localStorage.getItem(QUEUE_KEY)).toBe('{malformed');

    const unrelated = JSON.stringify([{ id: 'ticket-1', type: 'create_ticket_draft' }]);
    window.localStorage.setItem(QUEUE_KEY, unrelated);
    purgeLegacyPublicSurveyPersistence();
    expect(window.localStorage.getItem(QUEUE_KEY)).toBe(unrelated);
  });
});
