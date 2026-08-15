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
});
