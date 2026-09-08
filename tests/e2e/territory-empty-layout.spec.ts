import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import { expectNoHorizontalOverflow } from './e2e-helpers';

// Public official geography only. Counts are an explicit controlled fixture,
// not a query of citizen records or proof of current production activity.
const boundary = JSON.parse(readFileSync(new URL('./fixtures/junin-department.geojson', import.meta.url), 'utf8'));
// The API names the source department for the public rendering contract.
boundary.features = boundary.features.map((feature: { properties: { departamen: string } }) => ({
  ...feature, properties: { ...feature.properties, name: feature.properties.departamen },
}));
const authority = {
  kind: 'official',
  source_ref: 'https://ide.mendoza.gov.ar/server/rest/services/Hosted/Departamentos_Mendoza/FeatureServer/0',
  snapshot_sha256: '3dbfc3bb3c98601d6bf1897d737c1e739f39173f1c10c440aef35e516661a731',
};

test('el mapa vacío conserva la geografía y el espacio útil en escritorio y móvil', async ({ page }, testInfo) => {
  test.setTimeout(60000);
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.addInitScript(({ boundary, authority }) => {
    (window as unknown as { territoryFixture: unknown }).territoryFixture = {
      points: [], cells: [], hotspots: [], facets: [], category_layers: [],
      tenant: { slug: 'junin', tipo: 'municipio' },
      render_contract: { can_render_heatmap: false },
      quality: { state: 'blocked', can_render_heatmap: false, visible_points: 0 },
      location_quality: { total_ticket_records: 53, ticket_records_with_coordinates: 19, ticket_records_pending_geocode: 31, ticket_records_outside_jurisdiction: 19 },
      jurisdiction_review: { candidate_count: 19, outside_jurisdiction_count: 19, invalid_coordinate_count: 0, unverified_jurisdiction_count: 0 },
      jurisdiction: { enforced: true, containment_verified: true, containment_method: 'point_in_polygon', boundary_authority: authority },
      geo_layers: { boundaries: { ...boundary, metadata: { official: true, synthetic: false, source: 'IDE Mendoza', provenance: authority } } },
    };
  }, { boundary, authority });
  await page.route('**/api/**', route => route.fulfill({ status: 200, contentType: 'application/json', body: '{}' }));
  await page.route('**/__qa/territory-empty', route => route.fulfill({
    status: 200, contentType: 'text/html', body: `<!doctype html><html lang="es"><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="root"></div>
      <script type="module">import RefreshRuntime from '/@react-refresh'; RefreshRuntime.injectIntoGlobalHook(window); window.$RefreshReg$=()=>{}; window.$RefreshSig$=()=>type=>type; window.__vite_plugin_react_preamble_installed__=true;</script>
      <script type="module" src="/tests/e2e/fixtures/territory-empty.harness.tsx"></script></body></html>`,
  }));
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/__qa/territory-empty');
    const workspace = page.getByTestId('territory-empty-workspace');
    await expect(workspace).toBeVisible();
    await expect(page.getByTestId('territory-empty-summary')).toContainText('19 ubicaciones para revisar');
    const map = page.getByTestId('territory-official-empty-map');
    await expect(map.locator('canvas')).toBeVisible();
    await expect(map.locator('.maplibregl-ctrl-attrib')).toContainText('OpenStreetMap', { timeout: 15000 });
    await page.waitForLoadState('networkidle');
    await expect(map).toContainText('Sin puntos ni calor');
    const audit = page.getByTestId('territory-empty-details');
    await expect(audit).not.toHaveAttribute('open', '');
    expect((await workspace.boundingBox())!.height).toBeLessThan(680);
    expect((await map.boundingBox())!.height).toBeLessThan(540);
    await expectNoHorizontalOverflow(page);
    await page.screenshot({ path: testInfo.outputPath(`territory-empty-${width}.png`), animations: 'disabled' });
    await audit.locator(':scope > summary').click();
    await expect(audit).toHaveAttribute('open', '');
    await audit.locator(':scope > summary').click();
    await expect(audit).not.toHaveAttribute('open', '');
  }
  expect(errors).toEqual([]);
});
