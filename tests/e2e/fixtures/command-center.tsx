import React from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import BackofficeCommandCenter from '@/components/backoffice/BackofficeCommandCenter';
import { SyntheticAnalyticsSessionProvider } from './analytics-workspace.session';
import '@/index.css';

const query = new URLSearchParams(location.search);
if (query.has('dark')) document.documentElement.classList.add('dark');
const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });

createRoot(document.getElementById('root')!).render(
  <QueryClientProvider client={client}>
    <SyntheticAnalyticsSessionProvider tenantSlug="qa-command-center" tenantId={7} verified profileVerified>
      <main className="mx-auto max-w-[1440px] p-2 sm:p-5">
        <h1 className="mb-2 text-lg font-semibold">Inicio · Prueba sintética</h1>
        <p className="mb-5 text-sm text-muted-foreground">
          Componente y estilos reales. Sesión y respuestas sintéticas; sin conexión con organizaciones reales.
        </p>
        <BackofficeCommandCenter tenantSlug="qa-command-center" tenantId={7} tenantRevision="synthetic-1" scope="municipio" />
      </main>
    </SyntheticAnalyticsSessionProvider>
  </QueryClientProvider>,
);
