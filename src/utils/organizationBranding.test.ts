import { describe, expect, it } from 'vitest';
import {
  buildPublishBrandingPayload,
  buildRestoreBrandingPayload,
  calculateBrandingColorPair,
  formatContrastLabel,
  isValidBrandingHex,
  normalizeBrandingHex,
  readOrganizationBranding,
  resolveBrandingError,
} from './organizationBranding';

describe('organizationBranding', () => {
  it('validates and normalizes #RRGGBB hex colors', () => {
    expect(isValidBrandingHex('#346600')).toBe(true);
    expect(isValidBrandingHex('#98c400')).toBe(true);
    expect(normalizeBrandingHex(' #98c400 ')).toBe('#98C400');

    expect(isValidBrandingHex('#346')).toBe(false);
    expect(isValidBrandingHex('346600')).toBe(false);
    expect(isValidBrandingHex('#GGGGGG')).toBe(false);
    expect(isValidBrandingHex('#346600FF')).toBe(false);
    expect(isValidBrandingHex('')).toBe(false);
    expect(normalizeBrandingHex('not-a-color')).toBeNull();
  });

  it('computes sRGB relative luminance contrast matching backend formula', () => {
    const juninPrimary = calculateBrandingColorPair('#346600');
    expect(juninPrimary.background).toBe('#346600');
    expect(juninPrimary.foreground).toBe('#FFFFFF');
    expect(juninPrimary.contrast).toBeCloseTo(6.893, 2);
    expect(formatContrastLabel(juninPrimary.contrast)).toBe('6,9:1 · AA');

    const juninAccent = calculateBrandingColorPair('#98C400');
    expect(juninAccent.background).toBe('#98C400');
    expect(juninAccent.foreground).toBe('#000000');
    expect(juninAccent.contrast).toBeCloseTo(10.231, 2);
    expect(formatContrastLabel(juninAccent.contrast)).toBe('10,2:1 · AAA');

    expect(calculateBrandingColorPair('#000000')).toEqual({
      background: '#000000',
      foreground: '#FFFFFF',
      contrast: 21,
    });
    expect(calculateBrandingColorPair('#FFFFFF')).toEqual({
      background: '#FFFFFF',
      foreground: '#000000',
      contrast: 21,
    });
  });

  it('builds exact publish and restore payloads', () => {
    expect(
      buildPublishBrandingPayload(
        { enabled: true, primary_color: '#346600', accent_color: '#98c400' },
        'rev-sha256-abc',
      ),
    ).toEqual({
      organization_branding: {
        operation: 'publish',
        values: {
          enabled: true,
          primary_color: '#346600',
          accent_color: '#98C400',
        },
      },
      expected_revision: 'rev-sha256-abc',
    });

    expect(buildRestoreBrandingPayload(2, 'rev-sha256-abc')).toEqual({
      organization_branding: {
        operation: 'restore',
        version: 2,
      },
      expected_revision: 'rev-sha256-abc',
    });
  });

  it('parses organization_branding snapshots and rejects tenant mismatch', () => {
    const raw = {
      contract_version: 'organization.branding.v1',
      tenant: { id: 17, slug: 'junin' },
      revision: 'a'.repeat(64),
      version: 3,
      values: {
        enabled: true,
        primary_color: '#346600',
        accent_color: '#98C400',
      },
      history: [
        {
          version: 2,
          values: {
            enabled: true,
            primary_color: '#0055AA',
            accent_color: '#FFAA00',
          },
        },
      ],
      can_edit: true,
      reason_code: 'ready',
      message: '',
      appearance: {
        active: true,
        primary: { background: '#346600', foreground: '#FFFFFF', contrast: 6.893 },
        accent: { background: '#98C400', foreground: '#000000', contrast: 10.231 },
      },
      presets: [
        {
          id: 'junin-verde',
          label: 'Verde institucional',
          primary_color: '#346600',
          accent_color: '#98C400',
        },
      ],
      heading: 'Paleta del espacio',
      scope_note: 'Aplica al portal público.',
      save_endpoint: '/api/admin/tenants/junin/config',
    };

    const parsed = readOrganizationBranding(raw, 'junin', 17);
    expect(parsed).not.toBeNull();
    expect(parsed?.heading).toBe('Paleta del espacio');
    expect(parsed?.values.primary_color).toBe('#346600');
    expect(parsed?.presets).toHaveLength(1);
    expect(parsed?.history).toHaveLength(1);

    expect(readOrganizationBranding(raw, 'otro-tenant', 17)).toBeNull();
    expect(readOrganizationBranding(raw, 'junin', 999)).toBeNull();
  });

  it('maps 412, 428 and 403 branding errors clearly', () => {
    expect(
      resolveBrandingError({
        status: 412,
        body: { reason_code: 'branding_revision_conflict' },
      }),
    ).toMatchObject({
      kind: 'conflict',
      reasonCode: 'branding_revision_conflict',
      message: expect.stringContaining('Otra persona cambió la marca'),
    });

    expect(resolveBrandingError({ status: 428, body: {} })).toMatchObject({
      kind: 'precondition',
    });

    expect(
      resolveBrandingError({
        status: 403,
        body: { reason_code: 'branding_full_required' },
      }),
    ).toMatchObject({
      kind: 'forbidden',
      reasonCode: 'branding_full_required',
      message: expect.stringMatching(/Full/i),
    });

    expect(
      resolveBrandingError({
        status: 403,
        body: { reason_code: 'branding_forbidden' },
      }),
    ).toMatchObject({
      kind: 'forbidden',
      reasonCode: 'branding_forbidden',
      message: expect.stringMatching(/permisos/i),
    });
  });
});
