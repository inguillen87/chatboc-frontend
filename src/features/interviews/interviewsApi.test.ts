import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  panelGet: vi.fn(),
}));

vi.mock('@/api/v2/client', () => ({
  panelApi: {
    get: mocks.panelGet,
  },
}));

import {
  getInterviewResumeV2,
  normalizeInterviewSessionId,
  parseInterviewResumeEnvelope,
} from './interviewsApi';
import { interviewResumeFixture } from './interviewsTestFixture';

describe('interview resume v2 contract', () => {
  beforeEach(() => {
    mocks.panelGet.mockReset();
  });

  it('requests the tenant-scoped session without cache or legacy fallback', async () => {
    mocks.panelGet.mockResolvedValue(interviewResumeFixture);

    const response = await getInterviewResumeV2('42', ' escuela-demo ');

    expect(mocks.panelGet).toHaveBeenCalledWith(
      '/api/v2/interviews/sessions/42',
      {
        tenantSlug: 'escuela-demo',
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-store',
          Pragma: 'no-cache',
        },
      },
    );
    expect(response).toEqual(interviewResumeFixture);
    expect(mocks.panelGet.mock.calls[0][1]).not.toHaveProperty('legacyFallbackPath');
  });

  it('rejects incompatible or cross-session payloads instead of rendering them', () => {
    expect(() =>
      parseInterviewResumeEnvelope(
        { ...interviewResumeFixture, contract_version: 'assessment.interviews.api.v0' },
        42,
      ),
    ).toThrow(/contrato de reanudacion incompatible/i);

    expect(() => parseInterviewResumeEnvelope(interviewResumeFixture, 999)).toThrow(
      /contrato de reanudacion incompatible/i,
    );
  });

  it('normalizes only positive safe integer session identifiers', () => {
    expect(normalizeInterviewSessionId('42')).toBe(42);
    expect(normalizeInterviewSessionId('0')).toBeNull();
    expect(normalizeInterviewSessionId('3.5')).toBeNull();
    expect(normalizeInterviewSessionId('not-a-session')).toBeNull();
  });
});
