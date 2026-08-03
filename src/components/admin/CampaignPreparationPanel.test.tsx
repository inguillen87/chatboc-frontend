import '@testing-library/jest-dom/vitest';

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  listTemplates: vi.fn(),
  prepareCampaign: vi.fn(),
  previewTemplate: vi.fn(),
  createIdempotencyKey: vi.fn(),
}));

vi.mock('@/features/campaigns/campaignPreparationApi', async () => {
  const actual = await vi.importActual<
    typeof import('@/features/campaigns/campaignPreparationApi')
  >('@/features/campaigns/campaignPreparationApi');
  return {
    ...actual,
    listCampaignNotificationTemplates: mocks.listTemplates,
    prepareCampaign: mocks.prepareCampaign,
    createCampaignIdempotencyKey: mocks.createIdempotencyKey,
  };
});

vi.mock('@/features/notifications/notificationTemplatePreviewApi', async () => {
  const actual = await vi.importActual<
    typeof import('@/features/notifications/notificationTemplatePreviewApi')
  >('@/features/notifications/notificationTemplatePreviewApi');
  return {
    ...actual,
    previewNotificationTemplate: mocks.previewTemplate,
  };
});

import { CampaignPreparationError } from '@/features/campaigns/campaignPreparationApi';
import { campaignPreparationFixture } from '@/features/campaigns/campaignPreparationTestFixture';
import { notificationTemplatePreviewFixture } from '@/features/notifications/notificationTemplatePreviewTestFixture';

import CampaignPreparationPanel from './CampaignPreparationPanel';

const template = {
  id: '11111111-1111-4111-8111-111111111111',
  key: 'municipal_update',
  channel: 'whatsapp' as const,
  subject_template: null,
  body_template: 'Hola $name',
  message_template_registry_id: 31,
  is_active: true,
};

describe('CampaignPreparationPanel', () => {
  beforeEach(() => {
    mocks.listTemplates.mockReset();
    mocks.prepareCampaign.mockReset();
    mocks.previewTemplate.mockReset();
    mocks.createIdempotencyKey.mockReset();
    mocks.listTemplates.mockResolvedValue([template]);
    mocks.createIdempotencyKey.mockReturnValue(
      'crm:test:11111111-1111-4111-8111-111111111111',
    );
  });

  it('previews then prepares held receipts without claiming delivery', async () => {
    mocks.previewTemplate.mockResolvedValue(notificationTemplatePreviewFixture);
    mocks.prepareCampaign.mockResolvedValue(campaignPreparationFixture);

    render(
      <CampaignPreparationPanel
        tenantSlug="municipalidad-junin"
        selectedCount={3}
        selectedContactIds={['contact-1', 'contact-2', 'contact-3']}
      />,
    );

    await waitFor(() =>
      expect(screen.getByLabelText('Plantilla activa')).toHaveValue(template.id),
    );
    fireEvent.change(screen.getByLabelText('Contexto nombrado (JSON)'), {
      target: { value: '{"name":"vecino"}' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Probar contenido/ }));

    await waitFor(() =>
      expect(mocks.previewTemplate).toHaveBeenCalledWith('municipalidad-junin', {
        template_id: template.id,
        context: { name: 'vecino' },
        content_variables: {},
      }),
    );
    expect(screen.getByText('Transporte no verificado')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Crear recibos en espera' }));
    await waitFor(() => expect(mocks.prepareCampaign).toHaveBeenCalledTimes(1));
    expect(mocks.prepareCampaign).toHaveBeenCalledWith(
      'municipalidad-junin',
      {
        template_id: template.id,
        context: { name: 'vecino' },
        content_variables: {},
        contact_ids: ['contact-1', 'contact-2', 'contact-3'],
        max_per_week: 2,
        min_interval_hours: 24,
      },
      'crm:test:11111111-1111-4111-8111-111111111111',
    );
    expect(await screen.findByText('held / not_attempted')).toBeInTheDocument();
    expect(screen.getByText('Transporte no intentado')).toBeInTheDocument();
    expect(screen.queryByText(/^Entregados$/)).not.toBeInTheDocument();
  });

  it('keeps the same idempotency key for a manual retry and never auto-retries', async () => {
    mocks.prepareCampaign
      .mockRejectedValueOnce(
        new CampaignPreparationError({
          reasonCode: 'campaign_preparation_unavailable',
        }),
      )
      .mockResolvedValueOnce(campaignPreparationFixture);

    render(
      <CampaignPreparationPanel
        tenantSlug="municipalidad-junin"
        selectedCount={1}
        selectedContactIds={['contact-1']}
      />,
    );
    await waitFor(() =>
      expect(screen.getByLabelText('Plantilla activa')).toHaveValue(template.id),
    );

    fireEvent.click(screen.getByRole('button', { name: 'Crear recibos en espera' }));
    expect(await screen.findByText('campaign preparation unavailable')).toBeInTheDocument();
    expect(mocks.prepareCampaign).toHaveBeenCalledTimes(1);
    expect(
      screen.getByRole('button', { name: 'Reintentar misma preparaci\u00f3n' }),
    ).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole('button', { name: 'Reintentar misma preparaci\u00f3n' }),
    );
    await waitFor(() => expect(mocks.prepareCampaign).toHaveBeenCalledTimes(2));
    expect(mocks.prepareCampaign.mock.calls[0][2]).toBe(
      mocks.prepareCampaign.mock.calls[1][2],
    );
    expect(mocks.createIdempotencyKey).toHaveBeenCalledTimes(1);
  });

  it('shows selected identities that cannot enter the tenant-scoped queue', async () => {
    render(
      <CampaignPreparationPanel
        tenantSlug="municipalidad-junin"
        selectedCount={3}
        selectedContactIds={['contact-1']}
      />,
    );

    expect(
      await screen.findByText(/2 seleccionados no tienen una identidad Contact/),
    ).toBeInTheDocument();
  });
});
