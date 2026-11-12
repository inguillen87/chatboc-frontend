// @vitest-environment node
import { fileURLToPath } from 'node:url';
import { build } from 'vite';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { getFranchisePartnerConfig } from './franchisePartnerConfig';

afterEach(() => vi.unstubAllEnvs());

describe('franchise partner configuration', () => {
  it('omits missing and blank configuration', () => {
    vi.stubEnv('VITE_FRANCHISE_PARTNER_NAME', undefined);
    vi.stubEnv('VITE_FRANCHISE_SALES_URL', '   ');
    expect(getFranchisePartnerConfig()).toEqual({ partnerName: undefined, salesUrl: undefined });
  });

  it('keeps configured text and destination, trimming surrounding whitespace', () => {
    vi.stubEnv('VITE_FRANCHISE_PARTNER_NAME', '  Socio de prueba  ');
    vi.stubEnv('VITE_FRANCHISE_SALES_URL', '  https://example.test/franquicias  ');
    expect(getFranchisePartnerConfig()).toEqual({
      partnerName: 'Socio de prueba', salesUrl: 'https://example.test/franquicias',
    });
  });

  it('reads the current configuration on each call', () => {
    vi.stubEnv('VITE_FRANCHISE_PARTNER_NAME', 'Primer socio');
    expect(getFranchisePartnerConfig().partnerName).toBe('Primer socio');
    vi.stubEnv('VITE_FRANCHISE_PARTNER_NAME', 'Segundo socio');
    expect(getFranchisePartnerConfig().partnerName).toBe('Segundo socio');
  });

  it('does not serialize unrelated public build metadata into the partner module', async () => {
    // Isolated synthetic inputs: no real environment values appear in failures.
    for (const key of Object.keys(process.env)) {
      if (key.startsWith('VITE_') || key.startsWith('NEXT_PUBLIC_')) vi.stubEnv(key, undefined);
    }
    vi.stubEnv('VITE_FRANCHISE_PARTNER_NAME', 'Socio de prueba');
    vi.stubEnv('VITE_FRANCHISE_SALES_URL', 'https://example.test/franquicias');
    vi.stubEnv('VITE_UNUSED_BUILD_METADATA', 'SYNTHETIC_UNUSED_BUILD_MARKER');
    vi.stubEnv('NEXT_PUBLIC_UNUSED_CI_NOTE', 'SYNTHETIC_OTHER_PUBLIC_MARKER');
    vi.stubEnv('NODE_ENV', 'production');
    const result = await build({
      configFile: false, envDir: false, envPrefix: ['VITE_', 'NEXT_PUBLIC_'],
      mode: 'production', logLevel: 'silent',
      build: {
        write: false, minify: 'esbuild',
        lib: {
          entry: fileURLToPath(new URL('./franchisePartnerConfig.ts', import.meta.url)),
          formats: ['es'], fileName: 'partner-config-boundary',
        },
      },
    });
    const outputs = Array.isArray(result) ? result : [result];
    const code = outputs.flatMap((output) => 'output' in output ? output.output : [])
      .filter((output) => output.type === 'chunk').map((output) => output.code).join('\n');
    expect(code).toContain('Socio de prueba');
    expect(code).toContain('https://example.test/franquicias');
    expect(code).not.toContain('SYNTHETIC_UNUSED_BUILD_MARKER');
    expect(code).not.toContain('SYNTHETIC_OTHER_PUBLIC_MARKER');
  });
});
