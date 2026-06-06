import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import TicketsPanelPage from '@/pages/TicketsPanel';

const getIdentityCoverageMock = vi.fn();
const trackFrontendEventMock = vi.fn();

vi.mock('@/hooks/useRequireRole', () => ({
  default: vi.fn(),
}));

vi.mock('@/context/TenantContext', () => ({
  useTenant: () => ({ currentSlug: 'municipio-demo' }),
}));

vi.mock('@/api/client', () => ({
  apiClient: {
    getIdentityCoverage: (...args: unknown[]) => getIdentityCoverageMock(...args),
  },
}));

vi.mock('@/utils/frontendTelemetry', () => ({
  trackFrontendEvent: (...args: unknown[]) => trackFrontendEventMock(...args),
}));

vi.mock('@/components/tickets/NewTicketsPanel', () => ({
  default: () => <div>tickets-panel-body</div>,
}));

vi.mock('@/context/TicketContext', () => ({
  TicketProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock('@/components/errors/SectionErrorBoundary', () => ({
  default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock('@/components/enterprise/EnterpriseTopNav', () => ({
  default: () => <div>top-nav</div>,
}));

vi.mock('@/components/enterprise/EnterprisePageHeader', () => ({
  default: ({ title }: { title: string }) => <h1>{title}</h1>,
}));

describe('TicketsPanel request_id support surface', () => {
  beforeEach(() => {
    getIdentityCoverageMock.mockReset();
    trackFrontendEventMock.mockReset();
    vi.stubGlobal('navigator', {
      clipboard: {
        writeText: vi.fn().mockResolvedValue(undefined),
      },
    });
  });

  it('renders and copies request_id for identity coverage alerts', async () => {
    getIdentityCoverageMock.mockResolvedValueOnce({
      contract_version: 'analytics.identity_coverage.v1',
      request_id: 'req-coverage-123',
      alert_count: 1,
      slo_status: 'below_target',
      alerts: [{ message: 'Falta identidad en WhatsApp', channel: 'whatsapp' }],
    });

    render(<TicketsPanelPage />);

    expect(await screen.findByText(/request_id: req-coverage-123/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /copiar request_id/i }));

    await waitFor(() => {
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith('req-coverage-123');
    });

    expect(trackFrontendEventMock).toHaveBeenCalledWith(
      'support_request_id_copied',
      expect.objectContaining({
        request_id: 'req-coverage-123',
        source: 'tickets_identity_coverage',
      }),
    );
  });

  it('uses the compact shell when rendered inside the profile tab', async () => {
    getIdentityCoverageMock.mockResolvedValueOnce({
      contract_version: 'analytics.identity_coverage.v1',
      request_id: 'req-ok',
      alert_count: 0,
      slo_status: 'ok',
      alerts: [],
    });

    render(<TicketsPanelPage embedded tenantSlugOverride="municipio-demo" />);

    expect(await screen.findByText('tickets-panel-body')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: /reclamos y conversaciones/i })).not.toBeInTheDocument();
    expect(screen.queryByText('top-nav')).not.toBeInTheDocument();
  });
});
