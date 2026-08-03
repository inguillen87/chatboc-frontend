import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  previewTemplate: vi.fn(),
}));

vi.mock('@/features/notifications/notificationTemplatePreviewApi', async () => {
  const actual = await vi.importActual<
    typeof import('@/features/notifications/notificationTemplatePreviewApi')
  >('@/features/notifications/notificationTemplatePreviewApi');
  return {
    ...actual,
    previewNotificationTemplate: mocks.previewTemplate,
  };
});

import { notificationTemplatePreviewFixture } from '@/features/notifications/notificationTemplatePreviewTestFixture';

import NotificationTemplatePreviewPanel from './NotificationTemplatePreviewPanel';

describe('NotificationTemplatePreviewPanel', () => {
  beforeEach(() => {
    mocks.previewTemplate.mockReset();
    mocks.previewTemplate.mockResolvedValue(notificationTemplatePreviewFixture);
  });

  it('renders key/channel content and readiness without offering a send action', async () => {
    render(<NotificationTemplatePreviewPanel tenantSlug="junin" />);

    fireEvent.click(screen.getByRole('button', { name: 'key + channel' }));
    fireEvent.change(screen.getByLabelText('Template key'), {
      target: { value: 'CLAIM_UPDATE_PREVIEW' },
    });
    fireEvent.change(screen.getByLabelText('Canal'), {
      target: { value: 'whatsapp' },
    });
    fireEvent.change(screen.getByLabelText('Context JSON'), {
      target: {
        value: JSON.stringify({ claim_code: 'REC-10482', status: 'En tratamiento' }),
      },
    });
    fireEvent.change(screen.getByLabelText('Content variables JSON'), {
      target: {
        value: JSON.stringify({ '1': 'REC-10482', '2': 'En tratamiento' }),
      },
    });
    fireEvent.click(screen.getByRole('button', { name: /generar vista previa/i }));

    await waitFor(() => expect(mocks.previewTemplate).toHaveBeenCalledTimes(1));
    expect(mocks.previewTemplate).toHaveBeenCalledWith('junin', {
      key: 'claim_update_preview',
      channel: 'whatsapp',
      context: { claim_code: 'REC-10482', status: 'En tratamiento' },
      content_variables: { '1': 'REC-10482', '2': 'En tratamiento' },
    });
    expect(await screen.findByText('Caso REC-10482')).toBeInTheDocument();
    expect(screen.getByText('Actualizaci\u00f3n del caso REC-10482: En tratamiento.')).toBeInTheDocument();
    expect(screen.getAllByText('twilio').length).toBeGreaterThan(0);
    expect(screen.getByText('transport_readiness_not_checked')).toBeInTheDocument();
    expect(screen.getByText(/0 mensajes en cola, 0 enviados/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /enviar/i })).not.toBeInTheDocument();
  });

  it('validates JSON locally and renders only a safe reason_code', async () => {
    render(<NotificationTemplatePreviewPanel tenantSlug="junin" />);

    fireEvent.change(screen.getByLabelText('Template ID'), {
      target: { value: '11111111-1111-4111-8111-111111111111' },
    });
    fireEvent.change(screen.getByLabelText('Context JSON'), {
      target: { value: '{"private_value":' },
    });
    fireEvent.click(screen.getByRole('button', { name: /generar vista previa/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'reason_code: context_json_invalid',
    );
    expect(mocks.previewTemplate).not.toHaveBeenCalled();
  });

  it('requires an explicit tenant before enabling preview', () => {
    render(<NotificationTemplatePreviewPanel tenantSlug={null} />);

    expect(screen.getByRole('button', { name: /generar vista previa/i })).toBeDisabled();
    expect(screen.getByText('tenant requerido')).toBeInTheDocument();
  });
});
