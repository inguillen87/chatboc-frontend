import { describe, expect, it } from 'vitest';

import {
  FARO_TDF_ENTRY_PATH,
  resolveFaroTdfDestination,
} from './vercelFaroRouting';

describe('Faro TDF branded host routing', () => {
  it('rewrites only the branded root and preserves its query string', () => {
    const destination = resolveFaroTdfDestination(
      'https://faro-tdf.vercel.app/?campaign=presentacion',
    );

    expect(destination?.pathname).toBe(FARO_TDF_ENTRY_PATH);
    expect(destination?.search).toBe('?campaign=presentacion');
  });

  it('leaves the existing Preview alias and Faro subpaths untouched', () => {
    expect(resolveFaroTdfDestination('https://chatboc-r2-preview.vercel.app/')).toBeNull();
    expect(
      resolveFaroTdfDestination('https://faro-tdf.vercel.app/images/og-tdf-discapacidad.png'),
    ).toBeNull();
  });
});
