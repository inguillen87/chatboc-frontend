import React from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { OperationsDashboardPanel } from '@/features/analytics/OperationsDashboardPanel';
import * as fixtures from './operations-workspace-data';
import '@/index.css';
const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
const values = { dashboard: fixtures.dashboardFixture(), heatmap: fixtures.heatmapFixture(), actions: fixtures.actionCenterFixture(), brief: null, queue: fixtures.aiOpsQueueFixture(), providers: fixtures.aiProviderStatusFixture(), freshness: fixtures.freshnessFixture(), mapConfig: fixtures.mapConfigFixture() };
// Browser harness reads synthetic responses from the page without altering production modules.
Object.assign(window, { qaOperationsFixtures: values });
createRoot(document.getElementById('root')!).render(<MemoryRouter><QueryClientProvider client={client}>
  <main style={{ maxWidth: 1320, margin: '0 auto', padding: 16 }}><h1 className="mb-4 text-xl font-bold">Centro de decisiones · Prueba sintética</h1><OperationsDashboardPanel /></main>
</QueryClientProvider></MemoryRouter>);
