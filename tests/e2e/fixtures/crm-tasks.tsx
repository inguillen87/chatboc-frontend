import React from 'react';
import {createRoot} from 'react-dom/client';
import {ContactTasksEntry} from '@/features/crm/tasks/ContactTasks';
import '@/index.css';
const params=new URLSearchParams(location.search);
const identity={tenantSlug:params.get('tenant')||'tasks-qa',contactId:params.get('contact')||'contact-qa'};
createRoot(document.getElementById('root')!).render(<main style={{maxWidth:1200,margin:'0 auto',padding:16}}><h1>Tareas del contacto · prueba aislada</h1><ContactTasksEntry identity={identity}/></main>);
