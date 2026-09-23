// Local browser-test entry only; not imported by either production application.
import React from 'react';
import { createRoot } from 'react-dom/client';
import { PremiumTerritoryHeatmap } from '../../../src/features/analytics/PremiumTerritoryMap';
import type { OperationsHeatmapV1 } from '../../../src/features/analytics/analyticsTypes';
import '../../../src/index.css';

const heatmap = (window as unknown as { territoryFixture: OperationsHeatmapV1 }).territoryFixture;
createRoot(document.getElementById('root')!).render(
  <main style={{ maxWidth: 1200, margin: '0 auto', padding: 16 }}>
    <h1 className="mb-4 text-xl font-semibold">Control territorial · prueba de interfaz</h1>
    <PremiumTerritoryHeatmap points={[]} heatmap={heatmap} demoProfile="gobierno" tenantSlug="junin" />
  </main>,
);
