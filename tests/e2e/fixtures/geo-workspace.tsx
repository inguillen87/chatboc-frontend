import React from 'react';
import {createRoot} from 'react-dom/client';
import HeatmapDashboard from '@/components/analytics/HeatmapDashboard';
import '@/index.css';
createRoot(document.getElementById('root')!).render(<main style={{maxWidth:1440,margin:'0 auto',padding:16}}>
  <h1 style={{fontSize:16,marginBottom:12}}>Prueba de analítica geográfica · datos sintéticos</h1>
  <HeatmapDashboard tenantId={7} dateRange={{from:'2026-09-01',to:'2026-09-24'}}/>
</main>);
