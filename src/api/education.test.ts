import { beforeEach, describe, expect, it, vi } from 'vitest';

const apiFetchMock = vi.fn();

vi.mock('@/utils/api', () => ({
  apiFetch: (...args: unknown[]) => apiFetchMock(...args),
  ApiError: class ApiError extends Error {
    status: number;
    body?: Record<string, unknown>;
    constructor(message: string, status: number, body?: Record<string, unknown>) {
      super(message);
      this.status = status;
      this.body = body;
    }
  },
}));

import { educationApi } from '@/api/education';
import { ApiError } from '@/utils/api';

describe('education api contracts', () => {
  beforeEach(() => {
    apiFetchMock.mockReset();
  });

  it('uses canonical guardian lookup endpoint before legacy singular route', async () => {
    apiFetchMock.mockResolvedValueOnce({ ok: true });

    await educationApi.lookupGuardian({ document_number: '123' });

    expect(apiFetchMock).toHaveBeenCalledWith(
      '/api/v1/education/guardians/lookup',
      expect.objectContaining({ method: 'POST', body: { document_number: '123' } }),
    );
  });

  it('falls back to legacy guardian verify route only when canonical is unavailable', async () => {
    apiFetchMock
      .mockRejectedValueOnce(new ApiError('missing', 404))
      .mockResolvedValueOnce({ ok: true });

    await educationApi.verifyGuardian({ verification_code: '999999' });

    expect(apiFetchMock).toHaveBeenNthCalledWith(
      1,
      '/api/v1/education/guardians/verify',
      expect.objectContaining({ method: 'POST' }),
    );
    expect(apiFetchMock).toHaveBeenNthCalledWith(
      2,
      '/api/v1/education/guardian/verify',
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('normalizes family context from the me endpoint contract', async () => {
    apiFetchMock.mockResolvedValueOnce({
      family_context: {
        selected_student_id: 'student-1',
        students: [{ id: 'student-1', full_name: 'Nombre desde backend' }],
      },
    });

    const context = await educationApi.getFamilyContext();

    expect(context.selected_student_id).toBe('student-1');
    expect(context.students?.[0]?.full_name).toBe('Nombre desde backend');
    expect(apiFetchMock).toHaveBeenCalledWith(
      '/api/v1/education/me/family-context',
      expect.objectContaining({ method: 'GET' }),
    );
  });
});
