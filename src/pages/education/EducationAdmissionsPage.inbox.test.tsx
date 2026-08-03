import type React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { interviewInboxFixture } from '@/features/interviews/interviewInboxTestFixture';

const mocks = vi.hoisted(() => ({
  useTenant: vi.fn(),
  useInbox: vi.fn(),
  useResume: vi.fn(),
}));

vi.mock('@/context/TenantContext', () => ({ useTenant: mocks.useTenant }));
vi.mock('@/features/interviews/useInterviewInbox', () => ({
  useInterviewInbox: mocks.useInbox,
}));
vi.mock('@/features/interviews/useInterviewResume', () => ({
  useInterviewResume: mocks.useResume,
}));
vi.mock('@/components/education/EducationShell', () => ({
  default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));
vi.mock('@/features/interviews/InterviewInboxPanel', () => ({
  default: () => <div>Bandeja lista</div>,
}));

import EducationAdmissionsPage from './EducationAdmissionsPage';

const renderPage = (path = '/t/escuela-demo/educacion/staff/admisiones') =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route
          path="/t/:tenant/educacion/staff/admisiones"
          element={<EducationAdmissionsPage />}
        />
      </Routes>
    </MemoryRouter>,
  );

const baseQuery = {
  isLoading: false,
  isError: false,
  isFetching: false,
  error: null,
  data: undefined,
  refetch: vi.fn(),
};

describe('EducationAdmissionsPage interview inbox states', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.useTenant.mockReturnValue({
      currentSlug: 'escuela-demo',
      isLoadingTenant: false,
      tenantError: null,
    });
    mocks.useResume.mockReturnValue(baseQuery);
    mocks.useInbox.mockReturnValue(baseQuery);
  });

  it('renders an accessible loading state', () => {
    mocks.useInbox.mockReturnValue({ ...baseQuery, isLoading: true });
    renderPage();

    expect(screen.getByRole('heading', { name: 'Cargando' })).toBeInTheDocument();
    expect(screen.getByText(/progreso y evidencia verificable/i)).toBeInTheDocument();
  });

  it('renders backend-driven empty copy', () => {
    const data = structuredClone(interviewInboxFixture);
    data.inbox.items = [];
    data.inbox.page.returned = 0;
    data.inbox.summary.sessions = 0;
    data.inbox.summary.active = 0;
    data.inbox.summary.with_evidence = 0;
    data.inbox.summary.evidence_records = 0;
    data.inbox.summary.audit_events = 0;
    mocks.useInbox.mockReturnValue({ ...baseQuery, data });
    renderPage();

    expect(
      screen.getByRole('heading', { name: data.inbox.presentation.empty_title }),
    ).toBeInTheDocument();
    expect(screen.getByText(data.inbox.presentation.empty_description)).toBeInTheDocument();
  });

  it('renders an error with a working retry action', () => {
    const refetch = vi.fn();
    mocks.useInbox.mockReturnValue({
      ...baseQuery,
      isError: true,
      error: new Error('fallo de bandeja'),
      refetch,
    });
    renderPage();

    expect(screen.getByRole('heading', { name: 'No pudimos cargar los datos' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }));
    expect(refetch).toHaveBeenCalledTimes(1);
  });

  it('renders the inbox only when a compatible contract is available', () => {
    mocks.useInbox.mockReturnValue({ ...baseQuery, data: interviewInboxFixture });
    renderPage();

    expect(mocks.useInbox).toHaveBeenCalledWith('escuela-demo', { enabled: true });
    expect(screen.getByText('Bandeja lista')).toBeInTheDocument();
  });
});
