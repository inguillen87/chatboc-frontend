import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ClerkRuntimeProvider, type ClerkRuntimeValue } from '@/components/auth/ClerkRuntimeContext';
import GovernmentMesaUnicaLaunchPanel from '@/components/implementation/GovernmentMesaUnicaLaunchPanel';
import { ApiError, NetworkError } from '@/utils/api';

const launchApi = vi.hoisted(() => ({
  previewGovernmentMesaUnicaLaunch: vi.fn(),
  applyGovernmentMesaUnicaLaunch: vi.fn(),
}));

vi.mock('@/api/v2/governmentLaunch', () => launchApi);

const runtime: ClerkRuntimeValue = {
  enabled: false,
  loading: false,
  publishableKey: '',
  source: 'disabled',
  socialProviders: [],
  readyForSessionSync: false,
};
const manifestDigest = 'a'.repeat(64);
const launchDigest = 'b'.repeat(64);
const preview = {
  contract_version: 'tenant.blueprint.launch.preview.v1',
  tenant: { id: 41, slug: 'gobierno-demo', type: 'municipio' },
  blueprint: {
    id: 'government-core',
    version: '1.0.0',
    manifest_digest: manifestDigest,
    application_receipt_id: 'blueprint-receipt-41',
  },
  launch: {
    id: 'mesa-unica',
    label: 'Mesa Única',
    description: 'Prepara las categorías operativas.',
    source_path: 'configuration_defaults.ticket_categories',
    runtime_scope: ['ticket_categories'],
  },
  launch_digest: launchDigest,
  changes: {
    to_create: [{ name: 'Baches y calzada', canonical_name: 'baches y calzada', type: 'ticket' }],
    already_present: [{
      desired_name: 'Luminarias',
      canonical_name: 'luminarias',
      category: { id: 7, name: 'Luminarias', type: 'ticket' },
      preserved: true,
    }],
    conflicts: [],
    summary: { desired: 2, existing: 1, create: 1, preserve: 1, conflict: 0 },
  },
  write_performed: false,
  runtime_activation_performed: false,
  operational_defaults_materialized: false,
  provider_activation_performed: false,
  external_calls_performed: false,
  demo_data_created: false,
} as const;
const applied = {
  contract_version: 'tenant.blueprint.launch.apply.v1',
  receipt: {
    id: 'launch-receipt-41',
    contract_version: 'tenant.blueprint.launch.receipt.v1',
    tenant_id: preview.tenant.id,
    blueprint_application_id: preview.blueprint.application_receipt_id,
    blueprint_id: preview.blueprint.id,
    blueprint_version: preview.blueprint.version,
    launch_id: preview.launch.id,
    manifest_digest: manifestDigest,
    launch_digest: launchDigest,
    request_digest: 'c'.repeat(64),
    status: 'applied',
    application_snapshot: {},
    applied_by_user_id: 9,
    created_at: '2026-09-05T15:00:00Z',
  },
  launch_digest: launchDigest,
  changes: {
    created: [{ id: 18, name: 'Baches y calzada', type: 'ticket' }],
    already_present: preview.changes.already_present,
    conflicts: [],
    summary: { desired: 2, created: 1, preserved: 1, conflict: 0 },
  },
  replayed: false,
  write_performed: true,
  runtime_activation_performed: false,
  runtime_activation_scope: ['ticket_categories'],
  operational_defaults_materialized: true,
  provider_activation_performed: false,
  external_calls_performed: false,
  demo_data_created: false,
} as const;

const renderPanel = ({
  tenantSlug = 'gobierno-demo',
  canApply = true,
  onApplied,
}: {
  tenantSlug?: string;
  canApply?: boolean;
  onApplied?: () => void;
} = {}) => render(
  <ClerkRuntimeProvider value={runtime}>
    <GovernmentMesaUnicaLaunchPanel
      tenantSlug={tenantSlug}
      canApply={canApply}
      onApplied={onApplied}
    />
  </ClerkRuntimeProvider>,
);

const previewAndOpenConfirmation = async () => {
  fireEvent.click(screen.getByRole('button', { name: /previsualizar preparación/i }));
  fireEvent.click(await screen.findByRole('button', { name: /aplicar preparación/i }));
};

const deferred = <T,>() => {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((next) => { resolve = next; });
  return { promise, resolve };
};

describe('GovernmentMesaUnicaLaunchPanel', () => {
  beforeEach(() => {
    launchApi.previewGovernmentMesaUnicaLaunch.mockReset().mockResolvedValue(preview);
    launchApi.applyGovernmentMesaUnicaLaunch.mockReset().mockResolvedValue(applied);
  });

  it('does nothing automatically and exposes the bounded, read-only preview first', () => {
    renderPanel();

    expect(launchApi.previewGovernmentMesaUnicaLaunch).not.toHaveBeenCalled();
    expect(launchApi.applyGovernmentMesaUnicaLaunch).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: /previsualizar preparación/i })).toBeInTheDocument();
    expect(screen.getByText(/sólo categorías de tickets/i)).toBeInTheDocument();
    expect(screen.getByText(/no crea personas/i)).toBeInTheDocument();
    expect(screen.getByText(/no activa canales ni proveedores/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /aplicar preparación/i })).not.toBeInTheDocument();
  });

  it('lets a tenant admin preview but never exposes or executes apply', async () => {
    renderPanel({ canApply: false });
    fireEvent.click(screen.getByRole('button', { name: /previsualizar preparación/i }));

    expect(await screen.findByText(/previsualización verificada · sin escrituras/i)).toBeInTheDocument();
    expect(screen.getByText(/categorías faltantes/i)).toBeInTheDocument();
    expect(screen.getByText(/categorías existentes/i)).toBeInTheDocument();
    expect(screen.getByText(/sólo un superadmin puede aplicar/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /aplicar preparación/i })).not.toBeInTheDocument();
    expect(launchApi.applyGovernmentMesaUnicaLaunch).not.toHaveBeenCalled();
  });

  it('requires an explicit superadmin confirmation and applies the exact reviewed scope', async () => {
    const onApplied = vi.fn();
    renderPanel({ onApplied });
    await previewAndOpenConfirmation();

    expect(screen.getByRole('alertdialog')).toHaveTextContent(/no crea personas, casos o datos demo/i);
    expect(screen.getByRole('alertdialog')).toHaveTextContent(/verificación reciente/i);
    expect(launchApi.applyGovernmentMesaUnicaLaunch).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: /confirmar y preparar/i }));

    expect(await screen.findByText(/categorías operativas preparadas/i)).toBeInTheDocument();
    expect(launchApi.applyGovernmentMesaUnicaLaunch).toHaveBeenCalledWith({
      tenantSlug: preview.tenant.slug,
      launchDigest,
      idempotencyKey: expect.stringMatching(/^government-launch:/),
      expected: {
        tenantId: preview.tenant.id,
        blueprintVersion: preview.blueprint.version,
        manifestDigest,
        blueprintApplicationReceiptId: preview.blueprint.application_receipt_id,
      },
    });
    expect(onApplied).toHaveBeenCalledTimes(1);
    expect(launchApi.previewGovernmentMesaUnicaLaunch).toHaveBeenCalledTimes(2);
  });

  it('closes confirmation and denies apply if authorization is removed mid-flow', async () => {
    const view = renderPanel();
    await previewAndOpenConfirmation();
    expect(screen.getByRole('alertdialog')).toBeInTheDocument();

    view.rerender(
      <ClerkRuntimeProvider value={runtime}>
        <GovernmentMesaUnicaLaunchPanel tenantSlug="gobierno-demo" canApply={false} />
      </ClerkRuntimeProvider>,
    );

    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument());
    expect(screen.queryByRole('button', { name: /aplicar preparación/i })).not.toBeInTheDocument();
    expect(launchApi.applyGovernmentMesaUnicaLaunch).not.toHaveBeenCalled();
  });

  it('blocks apply when the preview reports a conflict and keeps detail progressive', async () => {
    launchApi.previewGovernmentMesaUnicaLaunch.mockResolvedValueOnce({
      ...preview,
      changes: {
        to_create: [],
        already_present: [],
        conflicts: [{
          desired_name: 'Luminarias',
          canonical_name: 'luminarias',
          reason_code: 'ambiguous_existing_categories',
          matches: [
            { id: 7, name: 'Luminarias', type: 'ticket' },
            { id: 8, name: ' luminarias ', type: 'ticket' },
          ],
        }],
        summary: { desired: 1, existing: 2, create: 0, preserve: 0, conflict: 1 },
      },
    });
    renderPanel();
    fireEvent.click(screen.getByRole('button', { name: /previsualizar preparación/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/preparación está bloqueada/i);
    expect(screen.queryByRole('button', { name: /aplicar preparación/i })).not.toBeInTheDocument();
    const details = screen.getByText(/ver categorías, conflictos y trazabilidad/i).closest('details');
    expect(details).not.toHaveAttribute('open');
  });

  it('reports a replay without claiming another write', async () => {
    launchApi.applyGovernmentMesaUnicaLaunch.mockResolvedValueOnce({
      ...applied,
      replayed: true,
      write_performed: false,
    });
    renderPanel();
    await previewAndOpenConfirmation();
    fireEvent.click(screen.getByRole('button', { name: /confirmar y preparar/i }));

    expect(await screen.findByText(/preparación confirmada sin duplicar cambios/i)).toBeInTheDocument();
  });

  it('reuses the same idempotency key after an uncertain apply result', async () => {
    launchApi.applyGovernmentMesaUnicaLaunch
      .mockRejectedValueOnce(new NetworkError('connection closed'))
      .mockResolvedValueOnce(applied);
    renderPanel();
    await previewAndOpenConfirmation();
    fireEvent.click(screen.getByRole('button', { name: /confirmar y preparar/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/misma operación sin duplicar cambios/i);
    fireEvent.click(screen.getByRole('button', { name: /aplicar preparación/i }));
    fireEvent.click(screen.getByRole('button', { name: /confirmar y preparar/i }));

    await waitFor(() => expect(launchApi.applyGovernmentMesaUnicaLaunch).toHaveBeenCalledTimes(2));
    expect(launchApi.applyGovernmentMesaUnicaLaunch.mock.calls[1][0].idempotencyKey)
      .toBe(launchApi.applyGovernmentMesaUnicaLaunch.mock.calls[0][0].idempotencyKey);
  });

  it('invalidates a stale preview after a definitive conflict', async () => {
    launchApi.applyGovernmentMesaUnicaLaunch.mockRejectedValueOnce(new ApiError(
      'Conflict',
      409,
      { error: { message: 'La preparación cambió; ejecutá preview nuevamente.' } },
    ));
    renderPanel();
    await previewAndOpenConfirmation();
    fireEvent.click(screen.getByRole('button', { name: /confirmar y preparar/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/preparación cambió/i);
    expect(screen.getByRole('button', { name: /previsualizar preparación/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /aplicar preparación/i })).not.toBeInTheDocument();
  });

  it('discards a preview after a tenant switch even if the operator returns to the same slug', async () => {
    const delayed = deferred<typeof preview>();
    launchApi.previewGovernmentMesaUnicaLaunch.mockReturnValueOnce(delayed.promise);
    const view = renderPanel({ tenantSlug: 'organizacion-a' });
    fireEvent.click(screen.getByRole('button', { name: /previsualizar preparación/i }));

    view.rerender(
      <ClerkRuntimeProvider value={runtime}>
        <GovernmentMesaUnicaLaunchPanel tenantSlug="organizacion-b" canApply />
      </ClerkRuntimeProvider>,
    );
    view.rerender(
      <ClerkRuntimeProvider value={runtime}>
        <GovernmentMesaUnicaLaunchPanel tenantSlug="organizacion-a" canApply />
      </ClerkRuntimeProvider>,
    );
    await act(async () => { delayed.resolve(preview); });

    expect(screen.queryByText(/previsualización verificada/i)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /previsualizar preparación/i })).toBeInTheDocument();
  });
});
