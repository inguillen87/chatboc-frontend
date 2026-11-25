import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import OrganizationPaletteCard from './OrganizationPaletteCard';
import { organizationBrandingService, type OrganizationBrandingService } from '@/services/organizationBrandingService';
import { ApiError } from '@/utils/api';
import type { OrganizationBrandingSnapshot } from '@/utils/organizationBranding';

const apiFetchMock = vi.fn();

vi.mock('@/utils/api', async () => {
  const actual = await vi.importActual<typeof import('@/utils/api')>('@/utils/api');
  return {
    ...actual,
    apiFetch: (...args: unknown[]) => apiFetchMock(...args),
  };
});

const makeSnapshot = (
  overrides: Partial<OrganizationBrandingSnapshot> = {},
): OrganizationBrandingSnapshot => ({
  contract_version: 'organization.branding.v1',
  tenant: { id: 42, slug: 'junin' },
  revision: 'a'.repeat(64),
  version: 2,
  values: {
    enabled: true,
    primary_color: '#0055AA',
    accent_color: '#FFAA00',
  },
  history: [
    {
      version: 1,
      values: {
        enabled: true,
        primary_color: '#1D4ED8',
        accent_color: '#0EA5E9',
      },
    },
    {
      version: 0,
      values: {
        enabled: false,
        primary_color: '#2563EB',
        accent_color: '#14B8A6',
      },
    },
  ],
  can_edit: true,
  reason_code: 'ready',
  message: '',
  appearance: {
    active: true,
    primary: { background: '#0055AA', foreground: '#FFFFFF', contrast: 7.51 },
    accent: { background: '#FFAA00', foreground: '#000000', contrast: 10.67 },
  },
  presets: [
    {
      id: 'junin',
      label: 'Verde Junín',
      primary_color: '#346600',
      accent_color: '#98C400',
    },
    {
      id: 'institucional',
      label: 'Azul cívico',
      primary_color: '#0F4C81',
      accent_color: '#F59E0B',
    },
  ],
  heading: 'Paleta del espacio',
  scope_note: 'Se aplica a los botones y pestañas del portal público.',
  save_endpoint: '/api/admin/tenants/junin/config',
  ...overrides,
});

const makeService = (
  overrides: Partial<OrganizationBrandingService> = {},
): OrganizationBrandingService => ({
  getBranding: vi.fn(),
  publishBranding: vi.fn(),
  restoreBranding: vi.fn(),
  ...overrides,
});

describe('OrganizationPaletteCard', () => {
  beforeEach(() => {
    apiFetchMock.mockReset();
  });

  it('renders heading, switch, color inputs, presets, previews and history', () => {
    const snapshot = makeSnapshot();
    render(<OrganizationPaletteCard tenantSlug="junin" initialBranding={snapshot} service={makeService()} />);

    expect(screen.getByRole('heading', { name: 'Paleta del espacio' })).toBeInTheDocument();
    expect(screen.getByRole('switch', { name: /Usar la paleta de la organización/i })).toBeChecked();
    expect(screen.getByLabelText(/^Color primario$/i)).toHaveValue('#0055AA');
    expect(screen.getByLabelText(/^Color de acento$/i)).toHaveValue('#FFAA00');
    expect(screen.getByLabelText(/Selector visual de color primario/i)).toHaveValue('#0055aa');
    expect(screen.getByLabelText(/Selector visual de color de acento/i)).toHaveValue('#ffaa00');
    expect(screen.getByRole('button', { name: /Verde Junín/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Azul cívico/i })).toBeInTheDocument();
    expect(screen.getByText('Versión 1')).toBeInTheDocument();
    expect(screen.getByText('Versión 0')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Publicar/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /Descartar/i })).toBeDisabled();
  });

  it('validates #RRGGBB hex input and blocks publish until fixed', async () => {
    const user = userEvent.setup();
    render(
      <OrganizationPaletteCard
        tenantSlug="junin"
        initialBranding={makeSnapshot()}
        service={makeService()}
      />,
    );

    const primaryInput = screen.getByLabelText(/^Color primario$/i);
    await user.clear(primaryInput);
    await user.type(primaryInput, '#123');

    expect(primaryInput).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByText(/hexadecimal válido en formato #RRGGBB/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Publicar/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /Descartar/i })).toBeEnabled();

    await user.click(screen.getByRole('button', { name: /Descartar/i }));
    expect(primaryInput).toHaveValue('#0055AA');
    expect(primaryInput).toHaveAttribute('aria-invalid', 'false');
  });

  it('calculates contrast and foreground preview for #346600 (white, ~6,9:1) and #98C400 (black)', async () => {
    const user = userEvent.setup();
    render(
      <OrganizationPaletteCard
        tenantSlug="junin"
        initialBranding={makeSnapshot()}
        service={makeService()}
      />,
    );

    await user.click(screen.getByRole('button', { name: /Verde Junín/i }));

    const primaryPreview = screen.getByTestId('palette-preview-primary');
    expect(primaryPreview).toHaveStyle({
      backgroundColor: '#346600',
      color: '#FFFFFF',
    });
    expect(screen.getByTestId('palette-contrast-primary')).toHaveTextContent('6,9:1 · AA');
    expect(screen.getByTestId('palette-contrast-primary')).toHaveTextContent(/Texto blanco/i);

    const accentPreview = screen.getByTestId('palette-preview-accent');
    expect(accentPreview).toHaveStyle({
      backgroundColor: '#98C400',
      color: '#000000',
    });
    expect(screen.getByTestId('palette-contrast-accent')).toHaveTextContent('10,2:1 · AAA');
    expect(screen.getByTestId('palette-contrast-accent')).toHaveTextContent(/Texto negro/i);
  });

  it('publishes with the exact PUT body and expected_revision via apiFetch', async () => {
    const user = userEvent.setup();
    const initial = makeSnapshot({ revision: '1'.repeat(64) });
    const saved = makeSnapshot({
      revision: '2'.repeat(64),
      version: 3,
      values: { enabled: false, primary_color: '#346600', accent_color: '#98C400' },
    });

    apiFetchMock.mockResolvedValueOnce({
      contract_version: 'organization.branding_save.v1',
      saved: true,
      tenant: { id: 42, slug: 'junin' },
      brand: saved,
    });

    const onUpdated = vi.fn();
    render(
      <OrganizationPaletteCard
        tenantSlug="junin"
        initialBranding={initial}
        service={organizationBrandingService}
        onBrandingUpdated={onUpdated}
      />,
    );

    await user.click(screen.getByRole('button', { name: /Verde Junín/i }));
    await user.click(screen.getByRole('switch', { name: /Usar la paleta de la organización/i }));
    await user.click(screen.getByRole('button', { name: /Publicar/i }));

    await waitFor(() => {
      expect(apiFetchMock).toHaveBeenCalledTimes(1);
    });

    const [calledPath, calledOptions] = apiFetchMock.mock.calls[0];
    expect(calledPath).toBe('/api/admin/tenants/junin/config');
    expect(calledOptions.method).toBe('PUT');
    expect(calledOptions.body).toEqual({
      organization_branding: {
        operation: 'publish',
        values: {
          enabled: false,
          primary_color: '#346600',
          accent_color: '#98C400',
        },
      },
      expected_revision: '1'.repeat(64),
    });

    expect(await screen.findByText(/Paleta publicada correctamente \(versión 3\)/i)).toBeInTheDocument();
    expect(onUpdated).toHaveBeenCalledWith(expect.objectContaining({ revision: '2'.repeat(64), version: 3 }));
  });

  it('handles 412 conflict by notifying, reloading latest revision and preserving the user draft', async () => {
    const user = userEvent.setup();
    const initial = makeSnapshot({ revision: 'a'.repeat(64), version: 2 });
    const serverLatest = makeSnapshot({
      revision: 'b'.repeat(64),
      version: 3,
      values: { enabled: true, primary_color: '#112233', accent_color: '#445566' },
    });
    const afterRetry = makeSnapshot({
      revision: 'c'.repeat(64),
      version: 4,
      values: { enabled: true, primary_color: '#346600', accent_color: '#98C400' },
    });

    const service = makeService({
      publishBranding: vi
        .fn()
        .mockRejectedValueOnce(
          new ApiError('Precondition Failed', 412, {
            reason_code: 'branding_revision_conflict',
          }),
        )
        .mockResolvedValueOnce(afterRetry),
      getBranding: vi.fn().mockResolvedValueOnce(serverLatest),
    });

    render(
      <OrganizationPaletteCard
        tenantSlug="junin"
        initialBranding={initial}
        service={service}
      />,
    );

    await user.click(screen.getByRole('button', { name: /Verde Junín/i }));
    await user.click(screen.getByRole('button', { name: /Publicar/i }));

    expect(
      await screen.findByText(/Otra persona cambió la marca\. Recargamos la versión vigente y conservamos tu borrador\./i),
    ).toBeInTheDocument();
    expect(service.getBranding).toHaveBeenCalledWith('junin', 42);

    // Draft MUST stay preserved (not overwritten by #112233 / #445566 from serverLatest)
    expect(screen.getByLabelText(/^Color primario$/i)).toHaveValue('#346600');
    expect(screen.getByLabelText(/^Color de acento$/i)).toHaveValue('#98C400');
    expect(screen.getByText('v3')).toBeInTheDocument();

    // Re-publishing uses the reloaded revision ('b'.repeat(64)) with the preserved draft
    await user.click(screen.getByRole('button', { name: /Publicar/i }));
    await waitFor(() => {
      expect(service.publishBranding).toHaveBeenNthCalledWith(
        2,
        'junin',
        'b'.repeat(64),
        { enabled: true, primary_color: '#346600', accent_color: '#98C400' },
        { saveEndpoint: '/api/admin/tenants/junin/config', expectedTenantId: 42 },
      );
    });
  });

  it('restores a previous version sending operation restore with expected_revision', async () => {
    const user = userEvent.setup();
    const initial = makeSnapshot({ revision: 'd'.repeat(64), version: 2 });
    const restored = makeSnapshot({
      revision: 'e'.repeat(64),
      version: 3,
      values: { enabled: true, primary_color: '#1D4ED8', accent_color: '#0EA5E9' },
    });

    apiFetchMock.mockResolvedValueOnce({
      contract_version: 'organization.branding_save.v1',
      saved: true,
      tenant: { id: 42, slug: 'junin' },
      brand: restored,
    });

    render(
      <OrganizationPaletteCard
        tenantSlug="junin"
        initialBranding={initial}
        service={organizationBrandingService}
      />,
    );

    await user.click(screen.getByRole('button', { name: /Restaurar versión 1/i }));

    await waitFor(() => {
      expect(apiFetchMock).toHaveBeenCalledTimes(1);
    });
    const [calledPath, calledOptions] = apiFetchMock.mock.calls[0];
    expect(calledPath).toBe('/api/admin/tenants/junin/config');
    expect(calledOptions.method).toBe('PUT');
    expect(calledOptions.body).toEqual({
      organization_branding: {
        operation: 'restore',
        version: 1,
      },
      expected_revision: 'd'.repeat(64),
    });

    expect(await screen.findByText(/Versión 1 restaurada correctamente/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^Color primario$/i)).toHaveValue('#1D4ED8');
    expect(screen.getByLabelText(/^Color de acento$/i)).toHaveValue('#0EA5E9');
  });

  it('renders read-only state and displays message when can_edit is false', () => {
    const readOnlySnapshot = makeSnapshot({
      can_edit: false,
      reason_code: 'branding_full_required',
      message: 'Disponible solo para organizaciones con plan Full activo.',
    });

    render(
      <OrganizationPaletteCard
        tenantSlug="junin"
        initialBranding={readOnlySnapshot}
        service={makeService()}
      />,
    );

    expect(
      screen.getByText('Disponible solo para organizaciones con plan Full activo.'),
    ).toBeInTheDocument();
    expect(screen.getByRole('switch', { name: /Usar la paleta de la organización/i })).toBeDisabled();
    expect(screen.getByLabelText(/^Color primario$/i)).toBeDisabled();
    expect(screen.getByLabelText(/^Color de acento$/i)).toBeDisabled();
    expect(screen.getByLabelText(/Selector visual de color primario/i)).toBeDisabled();
    expect(screen.getByLabelText(/Selector visual de color de acento/i)).toBeDisabled();
    expect(screen.getByRole('button', { name: /Verde Junín/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /Publicar/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /Descartar/i })).toBeDisabled();
    for (const restoreBtn of screen.getAllByRole('button', { name: /Restaurar/i })) {
      expect(restoreBtn).toBeDisabled();
    }
  });
});
