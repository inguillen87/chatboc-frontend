import { describe, expect, it } from 'vitest';

import {
  formatDemoTrialUsage,
  normalizeDemoTrialUpgrade,
  normalizeDemoTrialUsage,
  resolveInitialDemoTrialUsage,
  retainValidDemoTrialUsage,
  type DemoTrialUsage,
} from './trialUsage';

const validUsage: DemoTrialUsage = {
  channel: 'chat',
  limit: 5,
  used: 1,
  remaining: 4,
};

describe('demo trial usage', () => {
  it('normalizes valid usage and formats every requested state', () => {
    expect(normalizeDemoTrialUsage(validUsage)).toEqual(validUsage);
    expect(formatDemoTrialUsage({ ...validUsage, used: 0, remaining: 5 })).toBe(
      'Tenés 5 consultas de prueba',
    );
    expect(formatDemoTrialUsage(validUsage)).toBe('Te quedan 4 de 5 consultas de prueba');
    expect(formatDemoTrialUsage({ ...validUsage, used: 4, remaining: 1 })).toBe(
      'Te queda 1 consulta de prueba',
    );
    expect(formatDemoTrialUsage({ ...validUsage, used: 5, remaining: 0 })).toBe(
      'Usaste tus 5 consultas de prueba',
    );
  });

  it.each([
    { ...validUsage, remaining: -1 },
    { ...validUsage, used: -1 },
    { ...validUsage, limit: -1 },
    { ...validUsage, remaining: Number.NaN },
    { ...validUsage, remaining: 6 },
    { ...validUsage, channel: 'voice' },
  ])('ignores invalid usage and retains the last valid value', (candidate) => {
    expect(retainValidDemoTrialUsage(validUsage, candidate)).toBe(validUsage);
  });

  it('derives the untouched initial allowance from the versioned policy', () => {
    expect(
      resolveInitialDemoTrialUsage(undefined, {
        contract_version: 'demo.trial_policy.v1',
        scope: 'demo-session',
        max_messages: 5,
      }),
    ).toEqual({ channel: 'chat', limit: 5, used: 0, remaining: 5 });
  });

  it('normalizes only backend-provided continuation labels and destinations', () => {
    expect(
      normalizeDemoTrialUpgrade({
        title: 'Sigamos con una prueba guiada.',
        cta_label: 'Dejar datos',
        lead_capture_endpoint: '/api/public/lead-capture',
      }),
    ).toEqual({
      title: 'Sigamos con una prueba guiada.',
      actions: [
        {
          id: 'trial-upgrade',
          label: 'Dejar datos',
          leadCaptureEndpoint: '/api/public/lead-capture',
        },
      ],
    });
    expect(normalizeDemoTrialUpgrade({ title: '', create_account_url: '/register' })).toBeNull();
    expect(
      normalizeDemoTrialUpgrade({ cta_label: 'Continuar', create_account_url: 'javascript:alert(1)' }),
    ).toBeNull();
  });
});
