import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ panelGet: vi.fn() }));

vi.mock('@/api/v2/client', () => ({
  panelApi: { get: mocks.panelGet },
}));

import { getInterviewInboxV2, parseInterviewInboxEnvelope } from './interviewsApi';
import {
  interviewInboxFixture,
  managedInterviewInboxFixture,
} from './interviewInboxTestFixture';

const cloneFixture = () => structuredClone(interviewInboxFixture);

describe('interview inbox v2 contract', () => {
  beforeEach(() => mocks.panelGet.mockReset());

  it('requires an explicit tenant before making a request', async () => {
    await expect(getInterviewInboxV2('')).rejects.toMatchObject({
      body: { reason_code: 'missing_tenant' },
    });
    expect(mocks.panelGet).not.toHaveBeenCalled();
  });

  it('requests the no-store tenant inbox and validates its echo', async () => {
    mocks.panelGet.mockResolvedValue(interviewInboxFixture);

    const response = await getInterviewInboxV2(' escuela-demo ');

    expect(mocks.panelGet).toHaveBeenCalledWith(
      '/api/v2/interviews/inbox?limit=50',
      {
        tenantSlug: 'escuela-demo',
        cache: 'no-store',
        headers: { 'Cache-Control': 'no-store', Pragma: 'no-cache' },
      },
    );
    expect(response).toEqual(interviewInboxFixture);
  });

  it.each([
    ['unknown contract', (payload: any) => { payload.inbox.contract_version = 'assessment.interviews.inbox.v9'; }],
    ['tenant mismatch', (payload: any) => { payload.inbox.tenant.slug = 'foreign'; }],
    ['fractional metric', (payload: any) => { payload.inbox.summary.sessions = 1.5; }],
    ['invented assignment', (payload: any) => { payload.inbox.items[0].actions.assign.enabled = true; }],
    ['invented endpoint', (payload: any) => { payload.inbox.items[0].actions.review.endpoint = '/fake-review'; }],
    ['evidence mismatch', (payload: any) => { payload.inbox.items[0].evidence.total = 2; }],
    ['raw subject reference', (payload: any) => { payload.inbox.items[0].case.subject_ref = 'dni:12345678'; }],
    ['internal definition hash', (payload: any) => { payload.inbox.items[0].program.definition_hash = 'a'.repeat(64); }],
    ['invented continuation', (payload: any) => { payload.inbox.page.continuation_available = true; }],
    ['audit mismatch', (payload: any) => { payload.inbox.items[0].audit.events_recorded = 0; }],
    ['cross-tenant item', (payload: any) => { payload.inbox.items[0].tenant_id = 8; }],
    ['summary mismatch', (payload: any) => { payload.inbox.summary.active = 0; }],
  ])('fails closed for %s', (_label, mutate) => {
    const payload = cloneFixture();
    mutate(payload);
    expect(() => parseInterviewInboxEnvelope(payload, 'escuela-demo')).toThrow(
      /contrato de bandeja incompatible/i,
    );
  });

  it('accepts a truthful empty page', () => {
    const payload = cloneFixture();
    payload.inbox.items = [];
    payload.inbox.page.returned = 0;
    payload.inbox.summary = {
      scope: 'current_page',
      sessions: 0,
      scheduled: 0,
      active: 0,
      awaiting_human_review: 0,
      with_evidence: 0,
      evidence_records: 0,
      audit_events: 0,
    };

    expect(parseInterviewInboxEnvelope(payload, 'escuela-demo')).toEqual(payload);
  });

  it('accepts a scheduled session without interviewer, checkpoint or evidence', () => {
    const payload = cloneFixture();
    const item = payload.inbox.items[0];
    item.session.status = 'scheduled';
    item.session.status_label = 'Programada';
    item.session.interviewer_user_id = null;
    item.session.started_at = null;
    item.session.consent_granted = false;
    item.case.status = 'scheduled';
    item.assignment.interviewer_user_id = null;
    item.progress.completed_steps = 0;
    item.progress.completed_required_steps = 0;
    item.progress.pending_required_steps = item.progress.required_steps;
    item.progress.percent = 0;
    item.progress.evidence_count = 0;
    item.progress.last_checkpoint_at = null;
    item.progress.can_complete = false;
    item.evidence.total = 0;
    item.evidence.by_type.audio = 0;
    item.evidence.last_captured_at = null;
    item.evidence.content_hashes_present = 0;
    item.audit.events_recorded = 0;
    item.audit.last_event = null;
    item.next_action = 'issue_consent_challenge';
    item.next_action_label = 'Solicitar consentimiento';
    payload.inbox.summary.scheduled = 1;
    payload.inbox.summary.active = 0;
    payload.inbox.summary.with_evidence = 0;
    payload.inbox.summary.evidence_records = 0;
    payload.inbox.summary.audit_events = 0;

    expect(parseInterviewInboxEnvelope(payload, 'escuela-demo')).toEqual(payload);
  });

  it('accepts an explicitly truncated page without pretending cursor support', () => {
    const payload = cloneFixture();
    payload.inbox.page.has_more = true;
    payload.inbox.page.continuation_disabled_reason_code =
      'interview_inbox_cursor_not_implemented';

    expect(parseInterviewInboxEnvelope(payload, 'escuela-demo')).toEqual(payload);
  });

  it('accepts the managed-assignment v2 contract without enabling review or follow-up', () => {
    const payload = managedInterviewInboxFixture();

    expect(parseInterviewInboxEnvelope(payload, 'escuela-demo')).toEqual(payload);
    expect(payload.inbox.items[0].actions.review.enabled).toBe(false);
    expect(payload.inbox.items[0].actions.follow_up.enabled).toBe(false);
  });

  it('accepts v2 as read-only when the operator lacks assignment capability', () => {
    const payload = managedInterviewInboxFixture();
    payload.inbox.capabilities.read_only = true;
    payload.inbox.capabilities.can_assign = false;
    payload.inbox.governance.disabled_reason_codes.assign =
      'interview_assignment_capability_required';
    payload.inbox.items[0].actions.assign = {
      action_id: 'assign',
      label: 'Asignar responsable',
      enabled: false,
      method: null,
      endpoint: null,
      disabled_reason_code: 'interview_assignment_capability_required',
    };

    expect(parseInterviewInboxEnvelope(payload, 'escuela-demo')).toEqual(payload);
  });

  it('keeps a closed session unassignable without closing the global capability', () => {
    const payload = managedInterviewInboxFixture();
    payload.inbox.items[0].session.status = 'void';
    payload.inbox.items[0].session.status_label = 'Anulada';
    payload.inbox.summary.active = 0;
    payload.inbox.items[0].actions.assign = {
      action_id: 'assign',
      label: 'Asignar responsable',
      enabled: false,
      method: null,
      endpoint: null,
      disabled_reason_code: 'interview_assignment_session_closed',
    };

    expect(payload.inbox.capabilities.can_assign).toBe(true);
    expect(parseInterviewInboxEnvelope(payload, 'escuela-demo')).toEqual(payload);
  });

  it.each([
    ['missing dialog copy', (payload: any) => { delete payload.inbox.presentation.assignment_dialog; }],
    ['wrong v2 freshness source', (payload: any) => {
      payload.inbox.freshness.source = 'assessment_case_interview_session_evidence_audit_event';
    }],
    ['wrong assignment method', (payload: any) => {
      payload.inbox.items[0].actions.assign.method = 'PATCH';
    }],
    ['cross-session assignment endpoint', (payload: any) => {
      payload.inbox.items[0].actions.assign.endpoint = '/api/v2/interviews/sessions/43/assignment';
    }],
    ['invented candidate endpoint', (payload: any) => {
      payload.inbox.items[0].actions.assign.candidates.endpoint = '/api/v2/users';
    }],
    ['assignment id and version mismatch', (payload: any) => {
      payload.inbox.items[0].assignment.version = 0;
    }],
    ['invalid assigned user label', (payload: any) => {
      payload.inbox.items[0].assignment.assigned_user_label = 9;
    }],
    ['duplicate reason code', (payload: any) => {
      payload.inbox.presentation.assignment_dialog.reasons[1].reason_code =
        'initial_assignment';
    }],
    ['invented review mutation', (payload: any) => {
      payload.inbox.items[0].actions.review.enabled = true;
    }],
    ['disabled assignment on an active session', (payload: any) => {
      payload.inbox.items[0].actions.assign = {
        action_id: 'assign',
        label: 'Asignar responsable',
        enabled: false,
        method: null,
        endpoint: null,
        disabled_reason_code: 'interview_assignment_session_closed',
      };
    }],
  ])('fails closed for managed v2 %s', (_label, mutate) => {
    const payload = managedInterviewInboxFixture();
    mutate(payload);

    expect(() => parseInterviewInboxEnvelope(payload, 'escuela-demo')).toThrow(
      /contrato de bandeja incompatible/i,
    );
  });

  it('accepts a redacted assigned-user label without rejecting the session', () => {
    const payload = managedInterviewInboxFixture();
    if (payload.inbox.items[0].assignment.managed_assignment_available) {
      payload.inbox.items[0].assignment.assigned_user_label = null;
    }

    expect(parseInterviewInboxEnvelope(payload, 'escuela-demo')).toEqual(payload);
  });
});
