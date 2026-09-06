import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import TenantImplementationCenterPage from '@/pages/TenantImplementationCenterPage';
import { ApiError, NetworkError } from '@/utils/api';

const blueprintApi = vi.hoisted(() => ({
  listTenantBlueprints: vi.fn(),
  getTenantBlueprint: vi.fn(),
  previewTenantBlueprint: vi.fn(),
  applyTenantBlueprint: vi.fn(),
}));

vi.mock('@/api/v2/tenantBlueprints', () => blueprintApi);

const governmentLaunchApi = vi.hoisted(() => ({
  previewGovernmentMesaUnicaLaunch: vi.fn(),
  applyGovernmentMesaUnicaLaunch: vi.fn(),
}));

vi.mock('@/api/v2/governmentLaunch', () => governmentLaunchApi);

const channelChecklist = vi.hoisted(() => ({ render: vi.fn() }));
const jurisdictionPanel = vi.hoisted(() => ({ render: vi.fn() }));
const provisioningReadiness = vi.hoisted(() => ({ render: vi.fn() }));

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
  modules: [
    {
      id: 'service_desk',
      label: 'Mesa única',
      summary: 'Ingreso, clasificación y seguimiento de solicitudes.',
      activation_state: 'configuration_required',
    },
    {
      id: 'accessibility',
      label: 'Accesibilidad',
      summary: 'Preferencias de lectura y formatos alternativos.',
      activation_state: 'validation_required',
    },
  ],
};
const blueprintTenant = { id: 41, slug: 'gobierno-demo', type: 'municipio' };
const blueprintChanges = {
  namespace: 'government_core',
  apply_count: 1,
  preserve_count: 1,
  apply_paths: ['configuracion.government_core.channels'],
  preserve_paths: ['configuracion.government_core.operating_model'],
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

const pageState = vi.hoisted(() => ({
  currentSlug: 'gobierno-demo' as string | null,
  tenant: { nombre: 'Gobierno Demo' } as { nombre?: string | null } | null,
  loading: false,
  user: {
    tenant_slug: 'gobierno-demo',
    rol: 'admin',
    channel_activation: {
      contract_version: 'tenant.channel_activation.v1',
      tenant: { slug: 'gobierno-demo', nombre: 'Gobierno Demo' },
      channels: [],
    },
  } as any,
}));

vi.mock('@/context/TenantContext', () => ({
  useTenant: () => ({
    currentSlug: pageState.currentSlug,
    tenant: pageState.tenant,
  }),
}));

vi.mock('@/hooks/useUser', () => ({
  useUser: () => ({
    user: pageState.user,
    loading: pageState.loading,
  }),
}));

vi.mock('@/components/profile/ChannelActivationChecklist', () => ({
  default: (props: any) => {
    channelChecklist.render(props);
    return (
      <div
        data-testid="channel-activation-checklist"
        data-tenant-slug={props.tenantSlug || ''}
        data-initial-tenant={props.initialData?.tenant?.slug || ''}
        data-highlighted={props.highlighted ? 'true' : 'false'}
        data-presentation={props.presentation || ''}
        data-return-to={props.returnTo || ''}
      >
        Contrato de implementación
      </div>
    );
  },
}));

vi.mock('@/components/implementation/TenantProvisioningReadinessPanel', () => ({
  default: (props: any) => {
    provisioningReadiness.render(props);
    return (
      <div data-testid="tenant-provisioning-readiness" data-tenant-slug={props.tenantSlug || ''}>
        Estado de implementación vigente
      </div>
    );
  },
}));

vi.mock('@/components/implementation/GovernmentJurisdictionReadinessPanel', () => ({
  default: (props: any) => {
    jurisdictionPanel.render(props);
    return (
      <div
        data-testid="government-jurisdiction-readiness"
        data-tenant-slug={props.tenantSlug || ''}
        data-can-submit={props.canSubmitEvidence ? 'true' : 'false'}
        data-can-review={props.canReview ? 'true' : 'false'}
      >
        Alcance institucional
      </div>
    );
  },
}));

const governmentLaunchDigest = 'd'.repeat(64);
const governmentLaunchPreview = {
  contract_version: 'tenant.blueprint.launch.preview.v1',
  tenant: blueprintTenant,
  blueprint: {
    id: 'government-core',
    version: blueprintMetadata.version,
    manifest_digest: blueprintDigest,
    application_receipt_id: blueprintReceipt.id,
  },
  launch: {
    id: 'mesa-unica',
    label: 'Mesa Única',
    description: 'Prepara categorías operativas.',
    source_path: 'configuration_defaults.ticket_categories',
    runtime_scope: ['ticket_categories'],
  },
  launch_digest: governmentLaunchDigest,
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
const governmentLaunchApply = {
  contract_version: 'tenant.blueprint.launch.apply.v1',
  receipt: {
    id: 'launch-receipt-1',
    contract_version: 'tenant.blueprint.launch.receipt.v1',
    tenant_id: blueprintTenant.id,
    blueprint_application_id: blueprintReceipt.id,
    blueprint_id: 'government-core',
    blueprint_version: blueprintMetadata.version,
    launch_id: 'mesa-unica',
    manifest_digest: blueprintDigest,
    launch_digest: governmentLaunchDigest,
    request_digest: requestDigest,
    status: 'applied',
    application_snapshot: {},
    applied_by_user_id: 7,
    created_at: '2026-09-05T12:00:00Z',
  },
  launch_digest: governmentLaunchDigest,
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

const renderPage = (entry = '/implementacion') => render(
  <MemoryRouter initialEntries={[entry]}>
    <TenantImplementationCenterPage />
  </MemoryRouter>,
);

const deferred = <T,>() => {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((next) => { resolve = next; });
  return { promise, resolve };
};

describe('TenantImplementationCenterPage', () => {
  beforeEach(() => {
    pageState.currentSlug = 'gobierno-demo';
    pageState.tenant = { nombre: 'Gobierno Demo' };
    pageState.loading = false;
    pageState.user = {
      tenant_slug: 'gobierno-demo',
      rol: 'admin',
      channel_activation: {
        contract_version: 'tenant.channel_activation.v1',
        tenant: { slug: 'gobierno-demo', nombre: 'Gobierno Demo' },
        channels: [],
      },
    };
    blueprintApi.listTenantBlueprints.mockReset().mockResolvedValue(blueprintCatalog);
    blueprintApi.getTenantBlueprint.mockReset().mockResolvedValue(blueprintDetail);
    blueprintApi.previewTenantBlueprint.mockReset().mockResolvedValue(blueprintPreview);
    blueprintApi.applyTenantBlueprint.mockReset().mockResolvedValue(blueprintApply);
    governmentLaunchApi.previewGovernmentMesaUnicaLaunch.mockReset().mockResolvedValue(governmentLaunchPreview);
    governmentLaunchApi.applyGovernmentMesaUnicaLaunch.mockReset().mockResolvedValue(governmentLaunchApply);
    channelChecklist.render.mockClear();
    jurisdictionPanel.render.mockClear();
    provisioningReadiness.render.mockClear();
  });

  it('uses the authorized tenant contract without inventing readiness', async () => {
    renderPage('/implementacion?tenant_slug=gobierno-demo');

    expect(screen.getByRole('heading', { name: /preparar la organización para operar/i })).toBeInTheDocument();
    expect(screen.getByTestId('tenant-provisioning-readiness')).toHaveAttribute('data-tenant-slug', 'gobierno-demo');
    expect(screen.getByTestId('channel-activation-checklist')).toHaveAttribute('data-tenant-slug', 'gobierno-demo');
    expect(screen.getByTestId('channel-activation-checklist')).toHaveAttribute('data-initial-tenant', 'gobierno-demo');
    expect(screen.getByTestId('channel-activation-checklist')).toHaveAttribute('data-presentation', 'launch-journey');
    expect(screen.getByTestId('channel-activation-checklist')).toHaveAttribute(
      'data-return-to',
      '/implementacion?tenant_slug=gobierno-demo',
    );
    expect(await screen.findByRole('heading', { name: /gobierno digital · núcleo operativo/i })).toBeInTheDocument();
    expect(screen.getByText(/no habilita módulos, proveedores, whatsapp ni ejecución/i)).toBeInTheDocument();
    expect(screen.getByText('Mesa única')).toBeInTheDocument();
    expect(screen.getAllByText('Pendiente')).toHaveLength(2);
    expect(screen.queryByTestId('government-mesa-unica-launch')).not.toBeInTheDocument();
  });

  it('does not reuse a session snapshot from another tenant', async () => {
    pageState.user.channel_activation.tenant = {
      slug: 'otro-tenant',
      nombre: 'Otro tenant',
    };

    renderPage('/implementacion?tenant_slug=gobierno-demo');

    expect(screen.getByTestId('channel-activation-checklist')).toHaveAttribute('data-tenant-slug', 'gobierno-demo');
    expect(screen.getByTestId('channel-activation-checklist')).toHaveAttribute('data-initial-tenant', '');
    expect(await screen.findByRole('heading', { name: /gobierno digital · núcleo operativo/i })).toBeInTheDocument();
  });

  it('fails closed when tenant query parameters conflict', () => {
    renderPage('/implementacion?tenant=gobierno-demo&tenant_slug=organizacion-demo');

    expect(screen.getByRole('alert')).toHaveTextContent(/no pudimos validar el espacio de trabajo/i);
    expect(screen.queryByTestId('channel-activation-checklist')).not.toBeInTheDocument();
    expect(blueprintApi.listTenantBlueprints).not.toHaveBeenCalled();
  });

  it('lets a tenant administrator preview but never renders the apply control', async () => {
    renderPage('/implementacion?tenant_slug=gobierno-demo');

    fireEvent.click(await screen.findByRole('button', { name: /previsualizar cambios/i }));
    expect(await screen.findByText(/previsualización verificada/i)).toBeInTheDocument();
    expect(document.querySelector('p div')).toBeNull();
    expect(screen.getByText(/se agregarían 1 valores faltantes/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /aplicar configuración base/i })).not.toBeInTheDocument();
    expect(screen.getByText(/tu rol puede revisar y previsualizar/i)).toBeInTheDocument();
    expect(blueprintApi.previewTenantBlueprint).toHaveBeenCalledWith('gobierno-demo', 'government-core', {
      tenantId: String(blueprintTenant.id),
      blueprintVersion: blueprintMetadata.version,
      manifestDigest: blueprintDigest,
    });
  });

  it('requires a superadmin preview and explicit confirmation before apply, then refetches state', async () => {
    pageState.user.rol = 'super_admin';
    blueprintApi.getTenantBlueprint
      .mockResolvedValueOnce(blueprintDetail)
      .mockResolvedValueOnce({ ...blueprintDetail, application_receipt: blueprintReceipt });

    renderPage('/implementacion?tenant_slug=gobierno-demo');

    await screen.findByRole('heading', { name: /gobierno digital · núcleo operativo/i });
    expect(screen.queryByRole('button', { name: /aplicar configuración base/i })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /previsualizar cambios/i }));
    fireEvent.click(await screen.findByRole('button', { name: /aplicar configuración base/i }));

    expect(screen.getByRole('alertdialog')).toHaveTextContent(/ningún módulo, proveedor o canal quedará activo/i);
    expect(blueprintApi.applyTenantBlueprint).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: /confirmar aplicación/i }));

    expect(await screen.findByText(/^configuración base aplicada$/i)).toBeInTheDocument();
    expect(blueprintApi.applyTenantBlueprint).toHaveBeenCalledWith(expect.objectContaining({
      tenantSlug: 'gobierno-demo',
      blueprintId: 'government-core',
      manifestDigest: blueprintDigest,
      expectedTenantId: String(blueprintTenant.id),
      expectedBlueprintVersion: blueprintMetadata.version,
      idempotencyKey: expect.stringMatching(/^tenant-blueprint:/),
    }));
    await waitFor(() => expect(blueprintApi.getTenantBlueprint).toHaveBeenCalledTimes(2));
    expect(blueprintApi.previewTenantBlueprint).toHaveBeenCalledTimes(2);
  });

  it('reports an idempotent replay without claiming a second write', async () => {
    pageState.user.rol = 'superadmin';
    blueprintApi.applyTenantBlueprint.mockResolvedValueOnce({
      ...blueprintApply,
      replayed: true,
      write_performed: false,
    });

    renderPage('/implementacion?tenant_slug=gobierno-demo');
    fireEvent.click(await screen.findByRole('button', { name: /previsualizar cambios/i }));
    fireEvent.click(await screen.findByRole('button', { name: /aplicar configuración base/i }));
    fireEvent.click(screen.getByRole('button', { name: /confirmar aplicación/i }));

    expect(await screen.findByText(/solicitud confirmada sin duplicar cambios/i)).toBeInTheDocument();
  });

  it('collapses an already applied blueprint into a concise, progressively disclosed receipt', async () => {
    blueprintApi.getTenantBlueprint.mockResolvedValueOnce({
      ...blueprintDetail,
      application_receipt: blueprintReceipt,
    });

    renderPage('/implementacion?tenant_slug=gobierno-demo');

    const panel = await screen.findByTestId('tenant-blueprint-panel');
    expect(panel).toHaveAttribute('data-state', 'applied-compact');
    expect(screen.getByRole('heading', { name: /^configuración base aplicada$/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /previsualizar cambios/i })).not.toBeInTheDocument();
    const details = screen.getByText(/ver detalle de la base/i).closest('details');
    expect(details).not.toBeNull();
    expect(details).not.toHaveAttribute('open');
    expect(screen.getByText('Mesa única')).toBeInTheDocument();
    expect(screen.getByTestId('government-mesa-unica-launch')).toBeInTheDocument();
    expect(screen.getByTestId('government-jurisdiction-readiness')).toHaveAttribute('data-tenant-slug', 'gobierno-demo');
    expect(screen.getByTestId('government-jurisdiction-readiness')).toHaveAttribute('data-can-submit', 'true');
    expect(screen.getByTestId('government-jurisdiction-readiness')).toHaveAttribute('data-can-review', 'false');
  });

  it('keeps tenant submission and platform review as separate role-bound actions', async () => {
    blueprintApi.getTenantBlueprint.mockResolvedValue({
      ...blueprintDetail,
      application_receipt: blueprintReceipt,
    });

    const view = renderPage('/implementacion?tenant_slug=gobierno-demo');
    const tenantPanel = await screen.findByTestId('government-jurisdiction-readiness');
    expect(tenantPanel).toHaveAttribute('data-can-submit', 'true');
    expect(tenantPanel).toHaveAttribute('data-can-review', 'false');

    pageState.user.rol = 'superadmin';
    view.rerender(
      <MemoryRouter initialEntries={['/implementacion?tenant_slug=gobierno-demo']}>
        <TenantImplementationCenterPage />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('government-jurisdiction-readiness')).toHaveAttribute('data-can-submit', 'false');
      expect(screen.getByTestId('government-jurisdiction-readiness')).toHaveAttribute('data-can-review', 'true');
    });
  });

  it('refreshes blueprint and channel journey after a confirmed government launch', async () => {
    pageState.user.rol = 'superadmin';
    blueprintApi.getTenantBlueprint.mockResolvedValue({
      ...blueprintDetail,
      application_receipt: blueprintReceipt,
    });

    renderPage('/implementacion?tenant_slug=gobierno-demo');
    expect(await screen.findByTestId('government-mesa-unica-launch')).toBeInTheDocument();
    const channelRendersBeforeApply = channelChecklist.render.mock.calls.length;
    fireEvent.click(screen.getByRole('button', { name: /previsualizar preparación/i }));
    fireEvent.click(await screen.findByRole('button', { name: /aplicar preparación/i }));
    fireEvent.click(screen.getByRole('button', { name: /confirmar y preparar/i }));

    expect(await screen.findByText(/categorías operativas preparadas/i)).toBeInTheDocument();
    await waitFor(() => expect(blueprintApi.getTenantBlueprint).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(channelChecklist.render.mock.calls.length).toBeGreaterThan(channelRendersBeforeApply));
    expect(governmentLaunchApi.applyGovernmentMesaUnicaLaunch).toHaveBeenCalledWith(expect.objectContaining({
      tenantSlug: 'gobierno-demo',
      launchDigest: governmentLaunchDigest,
      idempotencyKey: expect.stringMatching(/^government-launch:/),
    }));
  });

  it('reuses the same idempotency key after an uncertain apply error', async () => {
    pageState.user.rol = 'superadmin';
    blueprintApi.applyTenantBlueprint
      .mockRejectedValueOnce(new NetworkError('connection closed'))
      .mockResolvedValueOnce(blueprintApply);

    renderPage('/implementacion?tenant_slug=gobierno-demo');
    fireEvent.click(await screen.findByRole('button', { name: /previsualizar cambios/i }));
    fireEvent.click(await screen.findByRole('button', { name: /aplicar configuración base/i }));
    fireEvent.click(screen.getByRole('button', { name: /confirmar aplicación/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/misma identidad para evitar duplicados/i);
    fireEvent.click(screen.getByRole('button', { name: /aplicar configuración base/i }));
    fireEvent.click(screen.getByRole('button', { name: /confirmar aplicación/i }));

    await waitFor(() => expect(blueprintApi.applyTenantBlueprint).toHaveBeenCalledTimes(2));
    expect(blueprintApi.applyTenantBlueprint.mock.calls[1][0].idempotencyKey)
      .toBe(blueprintApi.applyTenantBlueprint.mock.calls[0][0].idempotencyKey);
  });

  it('keeps apply unavailable when preview fails', async () => {
    pageState.user.rol = 'superadmin';
    blueprintApi.previewTenantBlueprint.mockRejectedValueOnce(
      new ApiError('Conflict', 409, { error: { message: 'El manifiesto cambió; actualizá la previsualización.' } }),
    );

    renderPage('/implementacion?tenant_slug=gobierno-demo');
    fireEvent.click(await screen.findByRole('button', { name: /previsualizar cambios/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/el manifiesto cambió/i);
    expect(screen.queryByRole('button', { name: /aplicar configuración base/i })).not.toBeInTheDocument();
  });

  it('discards a preview that resolves after the operator changes tenant', async () => {
    pageState.user.rol = 'superadmin';
    pageState.currentSlug = 'organizacion-a';
    pageState.user.tenant_slug = 'organizacion-a';
    pageState.user.channel_activation.tenant = { slug: 'organizacion-a', nombre: 'Organización A' };
    const delayedPreview = deferred<typeof blueprintPreview>();
    blueprintApi.getTenantBlueprint.mockImplementation(async (tenantSlug: string) => ({
      ...blueprintDetail,
      tenant: {
        ...blueprintTenant,
        id: tenantSlug === 'organizacion-a' ? 41 : 84,
        slug: tenantSlug,
      },
    }));
    blueprintApi.previewTenantBlueprint.mockImplementation(
      (tenantSlug: string) => tenantSlug === 'organizacion-a'
        ? delayedPreview.promise
        : Promise.resolve({
            ...blueprintPreview,
            tenant: { ...blueprintTenant, id: 84, slug: 'organizacion-b' },
          }),
    );

    const view = renderPage('/implementacion');
    fireEvent.click(await screen.findByRole('button', { name: /previsualizar cambios/i }));
    await waitFor(() => expect(blueprintApi.previewTenantBlueprint).toHaveBeenCalledTimes(1));

    pageState.currentSlug = 'organizacion-b';
    pageState.user.tenant_slug = 'organizacion-b';
    pageState.user.channel_activation.tenant = { slug: 'organizacion-b', nombre: 'Organización B' };
    view.rerender(
      <MemoryRouter initialEntries={['/implementacion']}>
        <TenantImplementationCenterPage />
      </MemoryRouter>,
    );
    await waitFor(() => expect(blueprintApi.getTenantBlueprint).toHaveBeenCalledWith('organizacion-b', 'government-core'));

    await act(async () => { delayedPreview.resolve(blueprintPreview); });
    expect(screen.queryByText(/previsualización verificada/i)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /aplicar configuración base/i })).not.toBeInTheDocument();
  });
});
