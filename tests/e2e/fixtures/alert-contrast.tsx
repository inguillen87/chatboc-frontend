import React from 'react';
import { createRoot } from 'react-dom/client';
import { AlertCircle } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import IdentityCoverageBanner from '@/components/analytics/IdentityCoverageBanner';
import '../../../src/index.css';

createRoot(document.getElementById('root')!).render(
  <main className="mx-auto max-w-3xl space-y-6 p-4">
    <h1 className="text-xl font-semibold">Avisos y recuperación</h1>
    <section data-case="default">
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>No pudimos cargar este espacio</AlertTitle>
        <AlertDescription><span data-contrast-text>Podés volver a intentarlo conservando tu trabajo.</span></AlertDescription>
      </Alert>
    </section>
    <section data-case="identity"><IdentityCoverageBanner tenantSlug="fixture" /></section>
    <section data-case="tinted">
      <Alert variant="destructive" className="border-destructive/40 bg-destructive/10">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Información pendiente</AlertTitle>
        <AlertDescription><span data-contrast-text>Este caso conserva el fondo semitransparente de los consumidores existentes.</span></AlertDescription>
      </Alert>
    </section>
    <section data-case="retry">
      <Alert variant="destructive" className="bg-destructive/10">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Analíticas limitadas</AlertTitle>
        <AlertDescription className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <span data-contrast-text>Los resultados todavía no están disponibles.</span>
          <Button variant="outline" className="w-full sm:w-auto border-destructive hover:bg-destructive/10">Reintentar analíticas</Button>
        </AlertDescription>
      </Alert>
    </section>
  </main>,
);
