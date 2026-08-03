import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getCandidates: vi.fn(),
  assignSession: vi.fn(),
  createIdempotencyKey: vi.fn(),
}));

vi.mock('./interviewAssignmentApi', () => ({
  getInterviewAssignmentCandidatesV2: mocks.getCandidates,
  assignInterviewSessionV2: mocks.assignSession,
  createInterviewAssignmentIdempotencyKey: mocks.createIdempotencyKey,
}));

import InterviewInboxPanel from './InterviewInboxPanel';
import {
  interviewInboxFixture,
  managedInterviewInboxFixture,
} from './interviewInboxTestFixture';

const candidatesFixture = {
  ok: true,
  contract_version: 'assessment.interviews.api.v1',
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
};

describe('InterviewInboxPanel', () => {
  beforeEach(() => {
    mocks.getCandidates.mockReset();
    mocks.assignSession.mockReset();
    mocks.createIdempotencyKey.mockReset();
    mocks.getCandidates.mockResolvedValue(candidatesFixture);
    mocks.assignSession.mockResolvedValue({ ok: true });
    mocks.createIdempotencyKey.mockReturnValue(
      'interview-assignment:11111111-1111-4111-8111-111111111111',
    );
  });

  it('renders source-backed progress, evidence, audit and governed actions', () => {
    render(
      <MemoryRouter>
        <InterviewInboxPanel
          inbox={interviewInboxFixture.inbox}
          tenantSlug="escuela-demo"
        />
      </MemoryRouter>,
    );

    expect(screen.getByRole('heading', { name: 'Entrevistas y evaluaciones' })).toBeInTheDocument();
    expect(screen.getByText('Ingreso institucional')).toBeInTheDocument();
    expect(screen.getByRole('progressbar', { name: 'Progreso 50%' })).toBeInTheDocument();
    expect(screen.getByText('audio: 1')).toBeInTheDocument();
    expect(screen.getByText(/Auditoría: 3 eventos/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Abrir checkpoint' })).toHaveAttribute(
      'href',
      '/t/escuela-demo/educacion/staff/admisiones/42',
    );
    expect(screen.getByRole('button', { name: 'Asignar responsable' })).toBeDisabled();
    expect(screen.getByText(/Caso 12 · identidad protegida/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Registrar revisión' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Marcar seguimiento' })).toBeDisabled();
    expect(screen.queryByText(/private-audio-object/i)).toBeNull();
    expect(screen.queryByText(/opaque-42/i)).toBeNull();
  });

  it('does not create a resume link when the backend capability is closed', () => {
    const inbox = structuredClone(interviewInboxFixture.inbox);
    inbox.capabilities.can_view_resume = false;
    inbox.items[0].actions.view_resume.enabled = false;
    inbox.items[0].actions.view_resume.disabled_reason_code =
      'interview_conduct_capability_required';

    render(
      <MemoryRouter>
        <InterviewInboxPanel inbox={inbox} tenantSlug="escuela-demo" />
      </MemoryRouter>,
    );

    expect(screen.queryByRole('link', { name: 'Abrir checkpoint' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Abrir checkpoint' })).toBeDisabled();
  });

  it('states the page limit when records are truncated without continuation', () => {
    const inbox = structuredClone(interviewInboxFixture.inbox);
    inbox.page.has_more = true;
    inbox.page.continuation_disabled_reason_code =
      'interview_inbox_cursor_not_implemented';

    render(
      <MemoryRouter>
        <InterviewInboxPanel inbox={inbox} tenantSlug="escuela-demo" />
      </MemoryRouter>,
    );

    expect(screen.getByRole('status')).toHaveTextContent(
      /limitada a 50 sesiones.*continuación todavía no está disponible/i,
    );
  });

  it('assigns an authorized candidate with backend copy, optimistic version and refresh', async () => {
    const inbox = managedInterviewInboxFixture().inbox;
    const onRefresh = vi.fn().mockResolvedValue(undefined);

    render(
      <MemoryRouter>
        <InterviewInboxPanel
          inbox={inbox}
          tenantSlug="escuela-demo"
          onRefresh={onRefresh}
        />
      </MemoryRouter>,
    );

    expect(screen.getByText('Responsable: Responsable actual')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Registrar revisión' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Marcar seguimiento' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Asignar responsable' }));

    expect(await screen.findByRole('dialog')).toHaveAccessibleName('Asignar responsable');
    await waitFor(() => expect(mocks.getCandidates).toHaveBeenCalledTimes(1));
    expect(mocks.getCandidates).toHaveBeenCalledWith(
      'escuela-demo',
      7,
      {
        method: 'GET',
        endpoint: '/api/v2/interviews/assignment-candidates',
      },
    );
    fireEvent.change(screen.getByLabelText('Responsable'), {
      target: { value: '11' },
    });
    fireEvent.change(screen.getByLabelText('Motivo de la asignación'), {
      target: { value: 'availability' },
    });
    const submit = screen.getByRole('button', { name: 'Confirmar asignación' });
    fireEvent.click(submit);
    fireEvent.click(submit);

    await waitFor(() => expect(mocks.assignSession).toHaveBeenCalledTimes(1));
    expect(mocks.assignSession).toHaveBeenCalledWith(
      {
        tenantId: 7,
        tenantSlug: 'escuela-demo',
        sessionId: 42,
        currentAssignmentId: 17,
        currentAssigneeUserId: 9,
      },
      {
        method: 'POST',
        endpoint: '/api/v2/interviews/sessions/42/assignment',
      },
      {
        assignee_user_id: 11,
        reason_code: 'availability',
        expected_assignment_version: 2,
      },
      'interview-assignment:11111111-1111-4111-8111-111111111111',
    );
    await waitFor(() => expect(onRefresh).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('never auto-retries an ambiguous POST and reuses its operation key manually', async () => {
    mocks.assignSession
      .mockRejectedValueOnce(new Error('network ended after write'))
      .mockResolvedValueOnce({ ok: true });

    render(
      <MemoryRouter>
        <InterviewInboxPanel
          inbox={managedInterviewInboxFixture().inbox}
          tenantSlug="escuela-demo"
          onRefresh={vi.fn().mockResolvedValue(undefined)}
        />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Asignar responsable' }));
    await screen.findByRole('dialog');
    fireEvent.change(await screen.findByLabelText('Responsable'), {
      target: { value: '11' },
    });
    fireEvent.change(screen.getByLabelText('Motivo de la asignación'), {
      target: { value: 'availability' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar asignación' }));

    expect(
      await screen.findByText('No pudimos registrar la asignación.'),
    ).toBeInTheDocument();
    expect(mocks.assignSession).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }));

    await waitFor(() => expect(mocks.assignSession).toHaveBeenCalledTimes(2));
    expect(mocks.assignSession.mock.calls[0][3]).toBe(
      mocks.assignSession.mock.calls[1][3],
    );
    expect(mocks.createIdempotencyKey).toHaveBeenCalledTimes(1);
  });

  it('uses backend candidate failure and retry labels without issuing a POST', async () => {
    mocks.getCandidates
      .mockRejectedValueOnce(new Error('candidate lookup failed'))
      .mockResolvedValueOnce(candidatesFixture);

    render(
      <MemoryRouter>
        <InterviewInboxPanel
          inbox={managedInterviewInboxFixture().inbox}
          tenantSlug="escuela-demo"
        />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Asignar responsable' }));
    expect(
      await screen.findByText('No pudimos cargar los responsables autorizados.'),
    ).toBeInTheDocument();
    expect(mocks.getCandidates).toHaveBeenCalledTimes(1);
    expect(mocks.assignSession).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }));

    await waitFor(() => expect(mocks.getCandidates).toHaveBeenCalledTimes(2));
    expect(await screen.findByText('Ana Operadora · Operadora')).toBeInTheDocument();
  });

  it('rotates the operation identity only after an explicit assignment change', async () => {
    mocks.assignSession
      .mockRejectedValueOnce(new Error('ambiguous response'))
      .mockResolvedValueOnce({ ok: true });
    mocks.createIdempotencyKey
      .mockReturnValueOnce('interview-assignment:key-one')
      .mockReturnValueOnce('interview-assignment:key-two');

    render(
      <MemoryRouter>
        <InterviewInboxPanel
          inbox={managedInterviewInboxFixture().inbox}
          tenantSlug="escuela-demo"
          onRefresh={vi.fn().mockResolvedValue(undefined)}
        />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Asignar responsable' }));
    fireEvent.change(await screen.findByLabelText('Responsable'), {
      target: { value: '11' },
    });
    fireEvent.change(screen.getByLabelText('Motivo de la asignación'), {
      target: { value: 'availability' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar asignación' }));
    await screen.findByText('No pudimos registrar la asignación.');

    fireEvent.change(screen.getByLabelText('Responsable'), {
      target: { value: '12' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar asignación' }));

    await waitFor(() => expect(mocks.assignSession).toHaveBeenCalledTimes(2));
    expect(mocks.assignSession.mock.calls[0][3]).toBe('interview-assignment:key-one');
    expect(mocks.assignSession.mock.calls[1][3]).toBe('interview-assignment:key-two');
    expect(mocks.createIdempotencyKey).toHaveBeenCalledTimes(2);
  });

  it('locks the stale UI after ACK even if the inbox refresh fails', async () => {
    const onRefresh = vi.fn().mockRejectedValue(new Error('refresh failed'));
    render(
      <MemoryRouter>
        <InterviewInboxPanel
          inbox={managedInterviewInboxFixture().inbox}
          tenantSlug="escuela-demo"
          onRefresh={onRefresh}
        />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Asignar responsable' }));
    fireEvent.change(await screen.findByLabelText('Responsable'), {
      target: { value: '11' },
    });
    fireEvent.change(screen.getByLabelText('Motivo de la asignación'), {
      target: { value: 'availability' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar asignación' }));

    await waitFor(() => expect(onRefresh).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(screen.getByRole('button', { name: 'Asignar responsable' })).toBeDisabled();
    expect(mocks.assignSession).toHaveBeenCalledTimes(1);
  });

  it('surfaces secure-random failure without issuing an assignment POST', async () => {
    mocks.createIdempotencyKey.mockImplementation(() => {
      throw new Error('secure random unavailable');
    });
    render(
      <MemoryRouter>
        <InterviewInboxPanel
          inbox={managedInterviewInboxFixture().inbox}
          tenantSlug="escuela-demo"
        />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Asignar responsable' }));
    fireEvent.change(await screen.findByLabelText('Responsable'), {
      target: { value: '11' },
    });
    fireEvent.change(screen.getByLabelText('Motivo de la asignación'), {
      target: { value: 'availability' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar asignación' }));

    expect(
      await screen.findByText('No pudimos registrar la asignación.'),
    ).toBeInTheDocument();
    expect(mocks.assignSession).not.toHaveBeenCalled();
  });
});
