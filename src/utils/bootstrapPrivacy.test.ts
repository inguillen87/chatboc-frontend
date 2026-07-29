import { beforeEach, describe, expect, it } from 'vitest';

import { runBootstrapPrivacyMigrations } from './bootstrapPrivacy';

describe('bootstrap privacy migrations', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('purges legacy public survey PII without requiring SurveyForm to mount', () => {
    window.localStorage.setItem(
      'chatboc:survey:draft:global:legacy',
      JSON.stringify({ dni: '12345678', answers: { 1: { texto: 'privado' } } }),
    );
    window.localStorage.setItem('unrelated-key', 'preserved');

    expect(runBootstrapPrivacyMigrations()).toMatchObject({ removedDrafts: 1 });
    expect(window.localStorage.getItem('chatboc:survey:draft:global:legacy')).toBeNull();
    expect(window.localStorage.getItem('unrelated-key')).toBe('preserved');
  });
});
