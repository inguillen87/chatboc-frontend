import { describe, expect, it } from 'vitest';

import { extractRubroKey, extractRubroLabel } from './rubros';

describe('rubro helpers', () => {
  it('normalizes flat demo catalog rubros from backend contracts', () => {
    const rubro = {
      key: 'ferreteria',
      label: 'ProObra Ferreteria',
      sector: 'empresas',
      slug: 'ferreteria',
      tenant_slug: 'ferreteria',
    };

    expect(extractRubroKey(rubro)).toBe('ferreteria');
    expect(extractRubroLabel(rubro)).toBe('ProObra Ferreteria');
  });
});
