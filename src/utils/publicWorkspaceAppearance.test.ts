import { describe, expect, it } from 'vitest';
import { readPublicWorkspaceAppearance } from './publicWorkspaceAppearance';

const projection = (overrides: Record<string, unknown> = {}) => ({
  contract_version: 'organization.workspace_appearance.v1',
  tenant: { id: 46, slug: 'tierra-del-fuego' },
  version: 3,
  appearance: {
    active: true,
    primary: { background: '#353535', foreground: '#FFFFFF', contrast: 12.27 },
    accent: { background: '#fd8d00', foreground: '#000000', contrast: 8.98 },
  },
  ...overrides,
});

describe('readPublicWorkspaceAppearance', () => {
  it('reads the exact active projection for the same organization', () => {
    expect(readPublicWorkspaceAppearance(projection(), 'Tierra-Del-Fuego')).toEqual({
      tenantSlug: 'tierra-del-fuego', version: 3, primary: '#353535', accent: '#FD8D00',
    });
  });

  it.each([
    ['absent', null],
    ['another contract', projection({ contract_version: 'organization.branding.v1' })],
    ['another organization', projection({ tenant: { id: 22, slug: 'junin' } })],
    ['an organization without id', projection({ tenant: { slug: 'tierra-del-fuego' } })],
    ['an inactive palette', projection({ appearance: { ...projection().appearance, active: false } })],
    ['a truthy but not true flag', projection({ appearance: { ...projection().appearance, active: 'true' } })],
    ['a malformed color', projection({ appearance: { ...projection().appearance, primary: { background: 'red', foreground: '#FFFFFF' } } })],
    ['a foreground outside the contract', projection({ appearance: { ...projection().appearance, accent: { background: '#FD8D00', foreground: '#111111' } } })],
    ['a non-integer version', projection({ version: '3' })],
    ['an array', [projection()]],
  ])('returns no appearance for %s', (_case, payload) => {
    expect(readPublicWorkspaceAppearance(payload, 'tierra-del-fuego')).toBeNull();
  });

  it('requires the slug the page is actually showing', () => {
    expect(readPublicWorkspaceAppearance(projection(), null)).toBeNull();
    expect(readPublicWorkspaceAppearance(projection(), 'junin')).toBeNull();
  });
});
