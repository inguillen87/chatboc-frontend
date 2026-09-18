import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ClerkRuntimeProvider } from '@/components/auth/ClerkRuntimeContext';
import TenantBlueprintProvisioningPanel from '@/components/implementation/TenantBlueprintProvisioningPanel';
import { ApiError } from '@/utils/api';

const clerkState = vi.hoisted(() => ({
  mode: 'complete' as 'complete' | 'cancel' | 'error',
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
  useUser: () => ({
    isLoaded: true,
    isSignedIn: true,
    user: clerkState.user,
  }),
  useReverification: (fetcher: (...args: any[]) => Promise<any>) => async (...args: any[]) => {
    const firstResult = await fetcher(...args);
    if (firstResult?.clerk_error?.reason !== 'reverification-error') return firstResult;
    clerkState.promptCount += 1;
    if (clerkState.mode === 'cancel') {
      throw { code: 'reverification_cancelled', clerkRuntimeError: true };
    }
    if (clerkState.mode === 'error') {
      throw new Error('second factor unavailable');
    }
    return fetcher(...args);
  },
}));

vi.mock('@clerk/clerk-react/errors', () => ({
  isReverificationCancelledError: (error: unknown) =>
    Boolean(error && typeof error === 'object' && (error as { code?: string }).code === 'reverification_cancelled'),
}));

const blueprintApi = vi.hoisted(() => ({
  listTenantBlueprints: vi.fn(),
  getTenantBlueprint: vi.fn(),
  previewTenantBlueprint: vi.fn(),
  applyTenantBlueprint: vi.fn(),
}));

vi.mock('@/api/v2/tenantBlueprints', () => blueprintApi);

const clerkApi = vi.hoisted(() => ({
  syncClerkSession: vi.fn(),
}));

vi.mock('@/api/clerkAuth', () => ({
  syncClerkSession: clerkApi.syncClerkSession,
}));

const sessionHelpers = vi.hoisted(() => ({
  buildClerkProfile: vi.fn((user: any) => ({ id: user.id })),
  persistChatbocSession: vi.fn(),
}));

vi.mock('@/utils/clerkSession', () => sessionHelpers);

const blueprintDigest = 'a'.repeat(64);
const requestDigest = 'b'.repeat(64);
const configurationDigest = 'c'.repeat(64);
const blueprintMetadata = {
  id: 'government-core',
  version: '1.0.0',
  label: 'Gobierno digital · núcleo operativo',
  description: 'Configuración base institucional reutilizable.',
  manifest_digest: blueprintDigest,
  supported_tenant_types: ['municipio', 'gobierno'],
  modules: [{
    id: 'service_desk',
    label: 'Mesa única',
    summary: 'Ingreso, clasificación y seguimiento de solicitudes.',
    activation_state: 'configuration_required',
  }],
};
const blueprintTenant = { id: 41, slug: 'gobierno-demo', type: 'municipio' };
const blueprintChanges = {
  namespace: 'government_core',
  apply_count: 1,
  preserve_count: 0,
  apply_paths: ['configuracion.government_core.channels'],
  preserve_paths: [],
};
const blueprintReceipt = {
  id: 'receipt-1',
  contract_version: 'tenant.blueprint.application.v1',
  tenant_id: blueprintTenant.id,
  blueprint_id: blueprintMetadata.id,
  blueprint_version: blueprintMetadata.version,
  manifest_digest: blueprintDigest,
  request_digest: requestDigest,
  status: 'applied',
  application_snapshot: {},
  applied_by_user_id: 7,
  created_at: '2026-09-05T12:00:00Z',
};
const blueprintCatalog = {
  contract_version: 'tenant.blueprint.manifest.v1',
  blueprints: [blueprintMetadata],
};
const blueprintDetail = {
  contract_version: 'tenant.blueprint.detail.v1',
  tenant: blueprintTenant,
  blueprint: { ...blueprintMetadata, configuration_defaults: {} },
  application_receipt: null,
  runtime_activation_performed: false,
  external_calls_performed: false,
};
const blueprintPreview = {
  contract_version: 'tenant.blueprint.preview.v1',
  tenant: blueprintTenant,
  blueprint: blueprintMetadata,
  changes: blueprintChanges,
  configuration_digest_after_apply: configurationDigest,
  write_performed: false,
  runtime_activation_performed: false,
  external_calls_performed: false,
};
const blueprintApply = {
  contract_version: 'tenant.blueprint.apply.v1',
  receipt: blueprintReceipt,
  changes: blueprintChanges,
  replayed: false,
  write_performed: true,
  runtime_activation_performed: false,
  external_calls_performed: false,
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

const renderPanel = () => render(
  <ClerkRuntimeProvider value={runtime}>
    <TenantBlueprintProvisioningPanel tenantSlug="gobierno-demo" canApply />
  </ClerkRuntimeProvider>,
);

const previewAndConfirm = async () => {
  fireEvent.click(await screen.findByRole('button', { name: /previsualizar cambios/i }));
  fireEvent.click(await screen.findByRole('button', { name: /aplicar configuración base/i }));
  fireEvent.click(screen.getByRole('button', { name: /confirmar aplicación/i }));
};

const stepUpError = () => new ApiError(
  'Reverification required',
  403,
  {
    contract_version: 'auth.assurance.error.v1',
    status_code: 403,
    reason_code: 'step_up_required',
    retryable: false,
    error: { code: 403, message: 'Esta acción sensible requiere verificar nuevamente ambos factores.' },
    clerk_error: {
      type: 'forbidden',
      reason: 'reverification-error',
      metadata: { reverification: 'strict_mfa' },
    },
  },
);

describe('TenantBlueprintProvisioningPanel Clerk step-up', () => {
  beforeEach(() => {
    clerkState.mode = 'complete';
    clerkState.promptCount = 0;
    clerkState.getToken.mockReset().mockResolvedValue('fresh-clerk-token');
    blueprintApi.listTenantBlueprints.mockReset().mockResolvedValue(blueprintCatalog);
    blueprintApi.getTenantBlueprint.mockReset().mockResolvedValue(blueprintDetail);
    blueprintApi.previewTenantBlueprint.mockReset().mockResolvedValue(blueprintPreview);
    blueprintApi.applyTenantBlueprint.mockReset().mockResolvedValue(blueprintApply);
    clerkApi.syncClerkSession.mockReset().mockResolvedValue({
      contract_version: 'auth.clerk.v1',
      auth_provider: 'clerk',
      auth_intent: 'tenant_owner',
      session_transport: 'cookie',
      user: { id: 7, rol: 'superadmin', tenant_slug: 'platform' },
      tenant: { id: 1, slug: 'platform' },
      onboarding: { required: false },
    });
    sessionHelpers.buildClerkProfile.mockClear();
    sessionHelpers.persistChatbocSession.mockClear();
  });

  it('applies immediately when the backend does not require step-up', async () => {
    renderPanel();
    await previewAndConfirm();

    expect(await screen.findByText(/^configuración base aplicada$/i)).toBeInTheDocument();
    expect(blueprintApi.applyTenantBlueprint).toHaveBeenCalledTimes(1);
    expect(clerkState.promptCount).toBe(0);
    expect(clerkState.getToken).not.toHaveBeenCalled();
    expect(clerkApi.syncClerkSession).not.toHaveBeenCalled();
  });

  it('handles step_up_required, refreshes the Chatboc cookie, and retries once with the exact same key', async () => {
    blueprintApi.applyTenantBlueprint
      .mockRejectedValueOnce(stepUpError())
      .mockResolvedValueOnce(blueprintApply);

    renderPanel();
    await previewAndConfirm();

    expect(await screen.findByText(/^configuración base aplicada$/i)).toBeInTheDocument();
    expect(clerkState.promptCount).toBe(1);
    expect(clerkState.getToken).toHaveBeenCalledTimes(1);
    expect(clerkState.getToken).toHaveBeenCalledWith({ skipCache: true });
    expect(clerkApi.syncClerkSession).toHaveBeenCalledWith(
      'fresh-clerk-token',
      { id: clerkState.user.id },
      { intent: 'tenant_owner' },
    );
    expect(sessionHelpers.persistChatbocSession).toHaveBeenCalledWith(
      expect.objectContaining({ auth_provider: 'clerk' }),
      clerkState.user.id,
      'tenant_owner',
    );
    expect(blueprintApi.applyTenantBlueprint).toHaveBeenCalledTimes(2);
    const firstInput = blueprintApi.applyTenantBlueprint.mock.calls[0][0];
    const secondInput = blueprintApi.applyTenantBlueprint.mock.calls[1][0];
    expect(secondInput).toBe(firstInput);
    expect(secondInput.idempotencyKey).toBe(firstInput.idempotencyKey);
    expect(clerkState.getToken.mock.invocationCallOrder[0])
      .toBeLessThan(clerkApi.syncClerkSession.mock.invocationCallOrder[0]);
    expect(clerkApi.syncClerkSession.mock.invocationCallOrder[0])
      .toBeLessThan(blueprintApi.applyTenantBlueprint.mock.invocationCallOrder[1]);
  });

  it('does not open a loop for future explicit, non-retryable MFA enrollment evidence', async () => {
    blueprintApi.applyTenantBlueprint.mockRejectedValueOnce(new ApiError(
      'MFA enrollment required',
      403,
      {
        contract_version: 'auth.assurance.error.v1',
        status_code: 403,
        reason_code: 'mfa_enrollment_required',
        retryable: false,
        no_retry: true,
        error: {
          code: 403,
          message: 'Esta acción sensible requiere configurar un segundo factor antes de continuar.',
        },
        clerk_error: {
          type: 'forbidden',
          reason: 'mfa-enrollment-required',
          metadata: {
            reverification: 'strict_mfa',
            enrollment_required: true,
            retry_after_reverification: false,
          },
        },
      },
    ));

    renderPanel();
    await previewAndConfirm();

    expect(await screen.findByRole('alert')).toHaveTextContent(/configurar un segundo factor/i);
    expect(blueprintApi.applyTenantBlueprint).toHaveBeenCalledTimes(1);
    expect(clerkState.promptCount).toBe(0);
    expect(clerkState.getToken).not.toHaveBeenCalled();
    expect(clerkApi.syncClerkSession).not.toHaveBeenCalled();
  });

  it('rejects a malformed reverification hint without prompting or retrying', async () => {
    blueprintApi.applyTenantBlueprint.mockRejectedValueOnce(new ApiError(
      'Malformed step-up response',
      403,
      {
        contract_version: 'auth.assurance.error.v1',
        status_code: 403,
        reason_code: 'step_up_required',
        retryable: false,
        error: { code: 403, message: 'La política de verificación recibida no es válida.' },
        clerk_error: {
          type: 'forbidden',
          reason: 'reverification-error',
          metadata: { reverification: 'unknown_policy' },
        },
      },
    ));

    renderPanel();
    await previewAndConfirm();

    expect(await screen.findByRole('alert')).toHaveTextContent(/política de verificación recibida no es válida/i);
    expect(blueprintApi.applyTenantBlueprint).toHaveBeenCalledTimes(1);
    expect(clerkState.promptCount).toBe(0);
    expect(clerkState.getToken).not.toHaveBeenCalled();
  });

  it('rejects a lookalike hint that lacks the versioned assurance contract', async () => {
    blueprintApi.applyTenantBlueprint.mockRejectedValueOnce(new ApiError(
      'Untrusted step-up response',
      403,
      {
        reason_code: 'step_up_required',
        retryable: false,
        error: { code: 403, message: 'La respuesta de seguridad no pudo validarse.' },
        clerk_error: {
          type: 'forbidden',
          reason: 'reverification-error',
          metadata: { reverification: 'strict_mfa' },
        },
      },
    ));

    renderPanel();
    await previewAndConfirm();

    expect(await screen.findByRole('alert')).toHaveTextContent(/respuesta de seguridad no pudo validarse/i);
    expect(blueprintApi.applyTenantBlueprint).toHaveBeenCalledTimes(1);
    expect(clerkState.promptCount).toBe(0);
    expect(clerkState.getToken).not.toHaveBeenCalled();
  });

  it('reports a human-safe cancellation and never executes the protected retry', async () => {
    clerkState.mode = 'cancel';
    blueprintApi.applyTenantBlueprint.mockRejectedValueOnce(stepUpError());

    renderPanel();
    await previewAndConfirm();

    expect(await screen.findByRole('alert')).toHaveTextContent(/verificación adicional fue cancelada/i);
    expect(blueprintApi.applyTenantBlueprint).toHaveBeenCalledTimes(1);
    expect(clerkState.promptCount).toBe(1);
    expect(clerkState.getToken).not.toHaveBeenCalled();
    expect(clerkApi.syncClerkSession).not.toHaveBeenCalled();
  });

  it('reports a human-safe Clerk verification error without treating it as an ambiguous write', async () => {
    clerkState.mode = 'error';
    blueprintApi.applyTenantBlueprint.mockRejectedValueOnce(stepUpError());

    renderPanel();
    await previewAndConfirm();

    expect(await screen.findByRole('alert')).toHaveTextContent(/no pudimos completar la verificación adicional/i);
    expect(blueprintApi.applyTenantBlueprint).toHaveBeenCalledTimes(1);
    expect(clerkState.promptCount).toBe(1);
    expect(clerkState.getToken).not.toHaveBeenCalled();
    expect(clerkApi.syncClerkSession).not.toHaveBeenCalled();
  });

  it('stops with a human-safe error when the fresh Clerk token is unavailable', async () => {
    clerkState.getToken.mockResolvedValueOnce(null);
    blueprintApi.applyTenantBlueprint.mockRejectedValueOnce(stepUpError());

    renderPanel();
    await previewAndConfirm();

    expect(await screen.findByRole('alert')).toHaveTextContent(/no pudimos renovar la sesión segura/i);
    expect(blueprintApi.applyTenantBlueprint).toHaveBeenCalledTimes(1);
    expect(clerkState.promptCount).toBe(1);
    expect(clerkState.getToken).toHaveBeenCalledTimes(1);
    expect(clerkApi.syncClerkSession).not.toHaveBeenCalled();
  });

  it('does not call the protected action when the refreshed Chatboc session cannot be synchronized', async () => {
    clerkApi.syncClerkSession.mockRejectedValueOnce(new Error('cookie exchange unavailable'));
    blueprintApi.applyTenantBlueprint.mockRejectedValueOnce(stepUpError());

    renderPanel();
    await previewAndConfirm();

    expect(await screen.findByRole('alert')).toHaveTextContent(/no pudimos renovar la sesión segura/i);
    expect(blueprintApi.applyTenantBlueprint).toHaveBeenCalledTimes(1);
    expect(clerkState.promptCount).toBe(1);
    expect(clerkState.getToken).toHaveBeenCalledTimes(1);
    expect(clerkApi.syncClerkSession).toHaveBeenCalledTimes(1);
    expect(sessionHelpers.persistChatbocSession).not.toHaveBeenCalled();
  });

  it('consumes at most one protected retry when assurance is still rejected', async () => {
    blueprintApi.applyTenantBlueprint
      .mockRejectedValueOnce(stepUpError())
      .mockRejectedValueOnce(stepUpError());

    renderPanel();
    await previewAndConfirm();

    expect(await screen.findByRole('alert')).toHaveTextContent(/no pudo confirmarse con la sesión renovada/i);
    expect(blueprintApi.applyTenantBlueprint).toHaveBeenCalledTimes(2);
    expect(clerkState.promptCount).toBe(1);
    await waitFor(() => expect(clerkApi.syncClerkSession).toHaveBeenCalledTimes(1));
  });
});
