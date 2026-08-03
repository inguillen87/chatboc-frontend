import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ panelGet: vi.fn(), panelPost: vi.fn() }));

vi.mock('@/api/v2/client', () => ({
  panelApi: { get: mocks.panelGet, post: mocks.panelPost },
}));

import {
  assignInterviewSessionV2,
  createInterviewAssignmentIdempotencyKey,
  getInterviewAssignmentCandidatesV2,
  parseInterviewAssignmentCandidatesEnvelope,
  parseInterviewAssignmentEnvelope,
} from './interviewAssignmentApi';
import type { InterviewAssignmentRequest } from './interviewsTypes';

const candidatesFixture = () => ({
  ok: true,
  contract_version: 'assessment.interviews.api.v1',
  request_id: 'request-candidates-1',
  assignment_candidates: {
    contract_version: 'assessment.interviews.assignment_candidates.v1',
    tenant: { id: 7, slug: 'escuela-demo' },
    candidates: [
      {
        user_id: 11,
        display_name: 'Ana Operadora',
        role_label: 'Operadora',
        can_conduct: true,
      },
      {
        user_id: 12,
        display_name: 'Luis Supervisor',
        role_label: 'Supervisor',
        can_conduct: true,
      },
    ],
    presentation: {
      empty_title: 'No hay responsables disponibles',
      empty_description: 'Solicitá acceso al administrador.',
    },
  },
});

const request: InterviewAssignmentRequest = {
  assignee_user_id: 11,
  reason_code: 'availability',
  expected_assignment_version: 2,
};

const expectation = {
  tenantId: 7,
  tenantSlug: 'escuela-demo',
  sessionId: 42,
  currentAssignmentId: 17,
  currentAssigneeUserId: 9,
};

const assignmentFixture = () => ({
  ok: true,
  contract_version: 'assessment.interviews.assignment.v1',
  request_id: 'request-assignment-1',
  assignment: {
    contract_version: 'interview.assignment.v1',
    id: 18,
    tenant_id: 7,
    interview_session_id: 42,
    version: 3,
    assignee_user_id: 11,
    previous_assignee_user_id: 9,
    assigned_by_user_id: 4,
    reason_code: 'availability',
    supersedes_assignment_id: 17,
    created_at: '2026-08-02T12:00:00Z',
    history_immutable: true,
  },
  idempotency_replayed: false,
});

describe('managed interview assignment API', () => {
  beforeEach(() => {
    mocks.panelGet.mockReset();
    mocks.panelPost.mockReset();
  });

  it('loads only the backend-advertised tenant-scoped candidate source', async () => {
    mocks.panelGet.mockResolvedValue(candidatesFixture());

    const result = await getInterviewAssignmentCandidatesV2(
      ' escuela-demo ',
      7,
      {
        method: 'GET',
        endpoint: '/api/v2/interviews/assignment-candidates',
      },
    );

    expect(mocks.panelGet).toHaveBeenCalledWith(
      '/api/v2/interviews/assignment-candidates',
      {
        tenantSlug: 'escuela-demo',
        cache: 'no-store',
        headers: { 'Cache-Control': 'no-store', Pragma: 'no-cache' },
      },
    );
    expect(result.assignment_candidates.candidates[0].display_name).toBe(
      'Ana Operadora',
    );
  });

  it.each([
    ['tenant mismatch', (payload: any) => { payload.assignment_candidates.tenant.id = 8; }],
    ['duplicate candidate', (payload: any) => {
      payload.assignment_candidates.candidates[1].user_id = 11;
    }],
    ['blank backend label', (payload: any) => {
      payload.assignment_candidates.candidates[0].display_name = ' ';
    }],
    ['unauthorized option', (payload: any) => {
      payload.assignment_candidates.candidates[0].can_conduct = false;
    }],
    ['unknown contract', (payload: any) => {
      payload.assignment_candidates.contract_version = 'assignment_candidates.v9';
    }],
    ['missing request id', (payload: any) => { delete payload.request_id; }],
    ['unexpected candidate PII', (payload: any) => {
      payload.assignment_candidates.candidates[0].email = 'private@example.com';
    }],
  ])('rejects candidate %s fail-closed', (_label, mutate) => {
    const payload = candidatesFixture();
    mutate(payload);

    expect(() =>
      parseInterviewAssignmentCandidatesEnvelope(payload, 7, 'escuela-demo'),
    ).toThrow(/contrato de asignación incompatible/i);
  });

  it('posts the exact optimistic version and idempotency key, then validates ACK', async () => {
    mocks.panelPost.mockResolvedValue(assignmentFixture());

    const result = await assignInterviewSessionV2(
      expectation,
      {
        method: 'POST',
        endpoint: '/api/v2/interviews/sessions/42/assignment',
      },
      request,
      'interview-assignment:11111111-1111-4111-8111-111111111111',
    );

    expect(mocks.panelPost).toHaveBeenCalledWith(
      '/api/v2/interviews/sessions/42/assignment',
      request,
      {
        tenantSlug: 'escuela-demo',
        cache: 'no-store',
        headers: {
          'Idempotency-Key':
            'interview-assignment:11111111-1111-4111-8111-111111111111',
          'Cache-Control': 'no-store',
          Pragma: 'no-cache',
        },
      },
    );
    expect(result.assignment.version).toBe(3);
  });

  it.each([
    ['envelope contract', (payload: any) => {
      payload.contract_version = 'assessment.interviews.api.v1';
    }],
    ['missing request id', (payload: any) => { delete payload.request_id; }],
    ['cross-tenant ACK', (payload: any) => { payload.assignment.tenant_id = 8; }],
    ['cross-session ACK', (payload: any) => {
      payload.assignment.interview_session_id = 43;
    }],
    ['stale version ACK', (payload: any) => { payload.assignment.version = 2; }],
    ['wrong assignee ACK', (payload: any) => {
      payload.assignment.assignee_user_id = 12;
    }],
    ['wrong predecessor ACK', (payload: any) => {
      payload.assignment.supersedes_assignment_id = 16;
    }],
    ['mutable history ACK', (payload: any) => {
      payload.assignment.history_immutable = false;
    }],
    ['leaked idempotency key', (payload: any) => {
      payload.assignment.idempotency_key = 'private-operation-key';
    }],
  ])('rejects %s rather than claiming assignment success', (_label, mutate) => {
    const payload = assignmentFixture();
    mutate(payload);

    expect(() => parseInterviewAssignmentEnvelope(payload, expectation, request)).toThrow(
      /contrato de asignación incompatible/i,
    );
  });

  it('refuses an endpoint not advertised by the managed contract', async () => {
    await expect(
      assignInterviewSessionV2(
        expectation,
        { method: 'POST', endpoint: '/api/v2/interviews/sessions/43/assignment' },
        request,
        'interview-assignment:11111111-1111-4111-8111-111111111111',
      ),
    ).rejects.toMatchObject({
      body: { reason_code: 'interview_assignment_contract_invalid' },
    });
    expect(mocks.panelPost).not.toHaveBeenCalled();
  });

  it('does not create ledger churn by reassigning a managed version to the same user', async () => {
    await expect(
      assignInterviewSessionV2(
        expectation,
        {
          method: 'POST',
          endpoint: '/api/v2/interviews/sessions/42/assignment',
        },
        { ...request, assignee_user_id: 9 },
        'interview-assignment:11111111-1111-4111-8111-111111111111',
      ),
    ).rejects.toMatchObject({
      body: { reason_code: 'interview_assignment_contract_invalid' },
    });
    expect(mocks.panelPost).not.toHaveBeenCalled();
  });

  it('creates a cryptographic operation identity', () => {
    expect(createInterviewAssignmentIdempotencyKey()).toMatch(
      /^interview-assignment:[0-9a-f-]{36}$/i,
    );
  });
});
