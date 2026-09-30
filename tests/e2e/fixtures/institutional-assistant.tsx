import React from 'react';
import {createRoot} from 'react-dom/client';
import {MemoryRouter} from 'react-router-dom';
import TenantImplementationCenterPage from '@/pages/TenantImplementationCenterPage';
import '@/index.css';
createRoot(document.getElementById('root')!).render(<MemoryRouter initialEntries={['/implementacion?tenant_slug=qa-knowledge']}><main className="px-4 sm:px-6"><TenantImplementationCenterPage/></main></MemoryRouter>);
