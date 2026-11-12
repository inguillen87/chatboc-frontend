import React from 'react';
import {createRoot} from 'react-dom/client';
import SuperadminFollowUpQueue from '@/features/crm/followup/SuperadminFollowUpQueue';
import '@/index.css';
createRoot(document.getElementById('root')!).render(<main style={{maxWidth:1200,margin:'0 auto',padding:16}}><h1 style={{fontSize:16,marginBottom:12}}>Seguimiento de contactos · escenario de prueba</h1><SuperadminFollowUpQueue/></main>);
