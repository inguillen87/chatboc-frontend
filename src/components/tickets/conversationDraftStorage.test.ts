import { beforeEach, describe, expect, it } from 'vitest';

import {
  buildConversationDraftStorageKey,
  persistConversationDraft,
  readConversationDraft,
  removeConversationDraft,
} from './conversationDraftStorage';

const scope = {
  tenant: 'Junin',
  sourceModel: 'MunicipioTicket',
  ticketId: 419,
  operator: 'id-10',
};

describe('conversationDraftStorage', () => {
  beforeEach(() => window.localStorage.clear());

  it('stores a versioned envelope under the full conversation and operator scope', () => {
    const key = buildConversationDraftStorageKey(scope);
    persistConversationDraft(key, 'Seguimiento del caso');

    expect(key).toBe('chatboc:ticket-composer-draft:v1:junin:municipioticket:419:id-10');
    expect(JSON.parse(window.localStorage.getItem(key) || '{}')).toMatchObject({
      version: 1,
      text: 'Seguimiento del caso',
    });
    expect(readConversationDraft(key)).toBe('Seguimiento del caso');
  });

  it('fails closed for malformed or unknown draft versions', () => {
    const key = buildConversationDraftStorageKey(scope);
    window.localStorage.setItem(key, JSON.stringify({ version: 2, text: 'No compatible' }));
    expect(readConversationDraft(key)).toBe('');
    expect(window.localStorage.getItem(key)).toBeNull();

    window.localStorage.setItem(key, '{malformed');
    expect(readConversationDraft(key)).toBe('');
    expect(window.localStorage.getItem(key)).toBeNull();
  });

  it('deletes drafts older than seven days instead of retaining sensitive text indefinitely', () => {
    const key = buildConversationDraftStorageKey(scope);
    window.localStorage.setItem(key, JSON.stringify({
      version: 1,
      text: 'Contenido vencido',
      updatedAt: new Date(Date.now() - (8 * 24 * 60 * 60 * 1_000)).toISOString(),
    }));

    expect(readConversationDraft(key)).toBe('');
    expect(window.localStorage.getItem(key)).toBeNull();
  });

  it('removes only the draft revision text that completed successfully', () => {
    const key = buildConversationDraftStorageKey(scope);
    persistConversationDraft(key, 'Borrador más nuevo');

    removeConversationDraft(key, 'Borrador anterior');
    expect(readConversationDraft(key)).toBe('Borrador más nuevo');

    removeConversationDraft(key, 'Borrador más nuevo');
    expect(readConversationDraft(key)).toBe('');
  });
});
