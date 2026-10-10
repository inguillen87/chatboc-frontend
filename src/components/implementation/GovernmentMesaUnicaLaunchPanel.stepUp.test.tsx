import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ClerkRuntimeProvider } from '@/components/auth/ClerkRuntimeContext';
import GovernmentMesaUnicaLaunchPanel from '@/components/implementation/GovernmentMesaUnicaLaunchPanel';
import { ApiError } from '@/utils/api';

const clerkState = vi.hoisted(() => ({
  mode: 'complete' as 'complete' | 'cancel',
  promptCount: 0,
  getToken: vi.fn(),
  user: {
    id: 'user_clerk_superadmin',
    firstName: 'Marcelo',
    lastName: 'Guillén',
    emailAddresses: [],
    phoneNumbers: [],
    externalAccounts: [],
  },
}));

vi.mock('@clerk/clerk-react', () => ({
  useAuth: () => ({
    getToken: clerkState.getToken,
    isLoaded: true,
    isSignedIn: true,
    userId: clerkState.user.id,
  }),
  useUser: () => ({ isLoaded: true, isSignedIn: true, user: clerkState.user }),
  useReverification: (fetcher: (...args: any[]) => Promise<any>) => async (...args: any[]) => {
    const firstResult = await fetcher(...args);
    if (firstResult?.clerk_error?.reason !== 'reverification-error') return firstResult;
    clerkState.promptCount += 1;
    if (clerkState.mode === 'cancel') {
      throw { code: 'reverification_cancelled', clerkRuntimeError: true };
    }
    return fetcher(...args);
  },
}));

vi.mock('@clerk/clerk-react/errors', () => ({
  isReverificationCancelledError: (error: unknown) =>
    Boolean(error && typeof error === 'object' && (error as { code?: string }).code === 'reverification_cancelled'),
}));

const launchApi = vi.hoisted(() => ({
  previewGovernmentMesaUnicaLaunch: vi.fn(),
  applyGovernmentMesaUnicaLaunch: vi.fn(),
}));

vi.mock('@/api/v2/governmentLaunch', () => launchApi);

const clerkApi = vi.hoisted(() => ({ syncClerkSession: vi.fn() }));
vi.mock('@/api/clerkAuth', () => ({ syncClerkSession: clerkApi.syncClerkSession }));

const sessionHelpers = vi.hoisted(() => ({
  buildClerkProfile: vi.fn((user: any) => ({ id: user.id })),
  persistChatbocSession: vi.fn(),
}));
vi.mock('@/utils/clerkSession', () => sessionHelpers);

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
    to_create: [{ name: 'Baches', canonical_name: 'baches', type: 'ticket' }],
    already_present: [],
    conflicts: [],
    summary: { desired: 1, existing: 0, create: 1, preserve: 0, conflict: 0 },
  },
  write_performed: false,
  runtime_activation_performed: false,
  operational_defaults_materialized: false,
  provider_activation_performed: false,
  external_calls_performed: false,
  demo_data_created: false,
};
const applyResult = {
  contract_version: 'tenant.blueprint.launch.apply.v1',
  receipt: {
    id: 'launch-receipt-41',
    contract_version: 'tenant.blueprint.launch.receipt.v1',
    tenant_id: 41,
    blueprint_application_id: 'blueprint-receipt-41',
    blueprint_id: 'government-core',
    blueprint_version: '1.0.0',
    launch_id: 'mesa-unica',
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
    created: [{ id: 18, name: 'Baches', type: 'ticket' }],
    already_present: [],
    conflicts: [],
    summary: { desired: 1, created: 1, preserved: 0, conflict: 0 },
  },
  replayed: false,
  write_performed: true,
  runtime_activation_performed: false,
  runtime_activation_scope: ['ticket_categories'],
  operational_defaults_materialized: true,
  provider_activation_performed: false,
  external_calls_performed: false,
  demo_data_created: false,
};
const runtime = {
  enabled: true,
  loading: false,
  publishableKey: 'pk_test_step_up',
  source: 'env' as const,
  environment: 'development',
  productionReady: false,
  socialProviders: ['google'],
  readyForSessionSync: true,
};

const stepUpError = () => new ApiError(
  'Reverification required',
  403,
  {
    contract_version: 'auth.assurance.error.v1',
    status_code: 403,
    reason_code: 'step_up_required',
    retryable: false,
    error: { code: 403, message: 'Esta acción requiere verificación reciente.' },
    clerk_error: {
      type: 'forbidden',
      reason: 'reverification-error',
      metadata: { reverification: 'strict_mfa' },
    },
  },
);

const renderPanel = () => render(
  <ClerkRuntimeProvider value={runtime}>
    <GovernmentMesaUnicaLaunchPanel tenantSlug="gobierno-demo" canApply />
  </ClerkRuntimeProvider>,
);

const previewAndApply = async () => {
  fireEvent.click(screen.getByRole('button', { name: /previsualizar preparación/i }));
  fireEvent.click(await screen.findByRole('button', { name: /aplicar preparación/i }));
  fireEvent.click(screen.getByRole('button', { name: /confirmar y preparar/i }));
};

describe('GovernmentMesaUnicaLaunchPanel Clerk step-up', () => {
  beforeEach(() => {
    clerkState.mode = 'complete';
    clerkState.promptCount = 0;
    clerkState.getToken.mockReset().mockResolvedValue('fresh-clerk-token');
    launchApi.previewGovernmentMesaUnicaLaunch.mockReset().mockResolvedValue(preview);
    launchApi.applyGovernmentMesaUnicaLaunch.mockReset().mockResolvedValue(applyResult);
    clerkApi.syncClerkSession.mockReset().mockResolvedValue({
      contract_version: 'auth.clerk.v1',
      auth_provider: 'clerk',
      auth_intent: 'tenant_owner',
      session_transport: 'cookie',
      user: { id: 9, rol: 'superadmin', tenant_slug: 'platform' },
      tenant: { id: 1, slug: 'platform' },
      onboarding: { required: false },
    });
    sessionHelpers.buildClerkProfile.mockClear();
    sessionHelpers.persistChatbocSession.mockClear();
  });

  it('refreshes the verified session and retries once with the exact same digest and key', async () => {
    launchApi.applyGovernmentMesaUnicaLaunch
      .mockRejectedValueOnce(stepUpError())
      .mockResolvedValueOnce(applyResult);
    renderPanel();
    await previewAndApply();

    expect(await screen.findByText(/categorías operativas preparadas/i)).toBeInTheDocument();
    expect(clerkState.promptCount).toBe(1);
    expect(clerkState.getToken).toHaveBeenCalledWith({ skipCache: true });
    expect(clerkApi.syncClerkSession).toHaveBeenCalledWith(
      'fresh-clerk-token',
      { id: clerkState.user.id },
      { intent: 'tenant_owner' },
    );
    expect(launchApi.applyGovernmentMesaUnicaLaunch).toHaveBeenCalledTimes(2);
    const firstInput = launchApi.applyGovernmentMesaUnicaLaunch.mock.calls[0][0];
    const secondInput = launchApi.applyGovernmentMesaUnicaLaunch.mock.calls[1][0];
    expect(secondInput).toBe(firstInput);
    expect(secondInput.launchDigest).toBe(firstInput.launchDigest);
    expect(secondInput.idempotencyKey).toBe(firstInput.idempotencyKey);
  });

  it('does not retry or report success when the operator cancels verification', async () => {
    clerkState.mode = 'cancel';
    launchApi.applyGovernmentMesaUnicaLaunch.mockRejectedValueOnce(stepUpError());
    renderPanel();
    await previewAndApply();

    expect(await screen.findByRole('alert')).toHaveTextContent(/verificación adicional fue cancelada/i);
    expect(launchApi.applyGovernmentMesaUnicaLaunch).toHaveBeenCalledTimes(1);
    expect(screen.queryByText(/categorías operativas preparadas/i)).not.toBeInTheDocument();
  });
});
