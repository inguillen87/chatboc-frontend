import React from 'react';
import {createRoot} from 'react-dom/client';
import {MemoryRouter} from 'react-router-dom';
import HeatmapDashboard from '@/components/analytics/HeatmapDashboard';
import {SyntheticAnalyticsSessionProvider} from './analytics-workspace.session';
import '@/index.css';
const query = new URLSearchParams(window.location.search);
createRoot(document.getElementById('root')!).render(<MemoryRouter initialEntries={['/t/geo-qa/analytics']}>
  <SyntheticAnalyticsSessionProvider tenantSlug="geo-qa" tenantId={7} verified={!query.has('qa-unverified')} profileVerified={!query.has('qa-profile-unverified')}>
  <main style={{maxWidth:1440,margin:'0 auto',padding:16}}>
  <h1 style={{fontSize:16,marginBottom:12}}>Prueba de analítica geográfica · datos sintéticos</h1>
  <HeatmapDashboard tenantId={7} dateRange={{from:'2026-09-01',to:'2026-09-24'}}/>
</main></SyntheticAnalyticsSessionProvider></MemoryRouter>);
