import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

type RewriteRule = {
  source?: string;
  destination?: string;
  has?: Array<{ type?: string; key?: string; value?: string }>;
};

describe('Vercel routing contract', () => {
  it('serves direct admin HTML navigations through the SPA before proxying admin API calls', () => {
    const configPath = resolve(process.cwd(), 'vercel.json');
    const config = JSON.parse(readFileSync(configPath, 'utf8')) as {
      rewrites?: RewriteRule[];
    };
    const rewrites = config.rewrites ?? [];

    const analyticsCsvExportIndex = rewrites.findIndex(
      (rule) =>
        rule.source === '/admin/analytics/export.csv' &&
        rule.destination === 'https://api.chatboc.ar/admin/analytics/export.csv' &&
        !rule.has,
    );

    const adminSpaIndex = rewrites.findIndex(
      (rule) =>
        rule.source === '/admin/(.*)' &&
        rule.destination === '/index.html' &&
        rule.has?.some(
          (condition) =>
            condition.type === 'header' &&
            condition.key.toLowerCase() === 'accept' &&
            condition.value === '.*text/html.*',
        ),
    );
    const adminApiIndex = rewrites.findIndex(
      (rule) =>
        rule.source === '/admin/(.*)' &&
        rule.destination === 'https://api.chatboc.ar/admin/$1' &&
        !rule.has,
    );

    expect(analyticsCsvExportIndex).toBeGreaterThanOrEqual(0);
    expect(adminSpaIndex).toBeGreaterThan(analyticsCsvExportIndex);
    expect(adminApiIndex).toBeGreaterThan(adminSpaIndex);
  });

  it('serves the institutional disability demo through its unbranded HTML entry', () => {
    const configPath = resolve(process.cwd(), 'vercel.json');
    const config = JSON.parse(readFileSync(configPath, 'utf8')) as {
      rewrites?: RewriteRule[];
    };
    const rewrites = config.rewrites ?? [];

    const institutionalEntryIndex = rewrites.findIndex(
      (rule) =>
        rule.source === '/demo/institucional/tdf-discapacidad' &&
        rule.destination === '/demo/institucional/tdf-discapacidad/index.html',
    );
    const catchAllIndex = rewrites.findIndex(
      (rule) =>
        rule.source === '/((?!assets/|api/|ask/|archivos/|public/|socket.io/).*)' &&
        rule.destination === '/index.html',
    );

    expect(institutionalEntryIndex).toBeGreaterThanOrEqual(0);
    expect(catchAllIndex).toBeGreaterThan(institutionalEntryIndex);

    const institutionalHtmlPath = resolve(
      process.cwd(),
      'demo/institucional/tdf-discapacidad/index.html',
    );
    const institutionalHtml = readFileSync(institutionalHtmlPath, 'utf8');
    expect(institutionalHtml).toContain(
      '<title>Faro TDF · El agente que guía y acompaña</title>',
    );
    expect(institutionalHtml).toContain(
      '<meta property="og:site_name" content="Faro TDF" />',
    );
    expect(institutionalHtml).toContain(
      '<meta property="og:image" content="https://faro-tdf.vercel.app/images/og-tdf-discapacidad.png" />',
    );
    expect(institutionalHtml).toContain(
      '<link\n      rel="canonical"\n      href="https://faro-tdf.vercel.app/"',
    );
    expect(institutionalHtml).toContain(
      '<link rel="icon" type="image/webp" href="/branding/faro-agent-icon-v1.webp" />',
    );
    const institutionalVisibleMetadata = institutionalHtml.replaceAll(
      'https://faro-tdf.vercel.app',
      'https://preview.example',
    );
    expect(institutionalVisibleMetadata).not.toMatch(/Chatboc|manifest\.webmanifest|chatboc-favicon/i);

    const institutionalEntry = readFileSync(
      resolve(process.cwd(), 'src/tdfDisabilityDemoEntry.tsx'),
      'utf8',
    );
    expect(institutionalEntry).toContain("import('./pages/public/DisabilityAIAgentDemoPage')");
    expect(institutionalEntry).not.toMatch(/(?:import\s+['"]\.\/main['"]|setupPWA|<App\s*\/>)/);

    const viteConfig = readFileSync(resolve(process.cwd(), 'vite.config.ts'), 'utf8');
    expect(viteConfig).toContain(
      "^\\/demo\\/institucional\\/tdf-discapacidad(?:\\/|$)",
    );
  });
});
