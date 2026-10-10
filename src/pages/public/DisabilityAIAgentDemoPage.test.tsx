import React from 'react';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import DisabilityAIAgentDemoPage from './DisabilityAIAgentDemoPage';

vi.mock('@/hooks/usePageMetadata', () => ({
  usePageMetadata: vi.fn(),
}));

vi.mock('@/components/MapLibreMap', () => ({
  default: ({
    ariaLabel,
    heatmapData,
    showHeatmap,
    showPoints,
  }: {
    ariaLabel?: string;
    heatmapData?: Array<unknown>;
    showHeatmap?: boolean;
    showPoints?: boolean;
  }) => (
    <div
      role="region"
      aria-label={ariaLabel}
      data-heatmap={showHeatmap ? 'on' : 'off'}
      data-points={showPoints ? 'on' : 'off'}
      data-point-count={String(heatmapData?.length ?? 0)}
    >
      Mapa conceptual MapLibre
    </div>
  ),
}));

vi.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => <div data-testid="responsive-chart">{children}</div>,
  AreaChart: ({ children }: { children: React.ReactNode }) => <svg>{children}</svg>,
  BarChart: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Area: () => null,
  Bar: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  CartesianGrid: () => null,
  Cell: () => null,
  Tooltip: () => null,
  XAxis: () => null,
  YAxis: () => null,
}));

beforeAll(() => {
  vi.stubGlobal(
    'IntersectionObserver',
    class IntersectionObserverMock {
      private readonly callback: IntersectionObserverCallback;

      constructor(callback: IntersectionObserverCallback) {
        this.callback = callback;
      }

      disconnect() {}
      observe(target: Element) {
        this.callback(
          [{ isIntersecting: true, target } as IntersectionObserverEntry],
          this as unknown as IntersectionObserver,
        );
      }
      takeRecords() { return []; }
      unobserve() {}
    },
  );
});

afterAll(() => {
  vi.unstubAllGlobals();
});

afterEach(() => {
  vi.clearAllTimers();
  vi.useRealTimers();
});

describe('DisabilityAIAgentDemoPage', () => {
  it('renders a truthful, white-label and explicitly multimodal executive proposal', async () => {
    render(<DisabilityAIAgentDemoPage />);

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Faro: una puerta de entrada accesible');
    expect(screen.getAllByText('Demostración conceptual · datos representativos').length).toBeGreaterThan(0);
    expect(screen.getByText(/Tierra del Fuego · Identidad institucional configurable/)).toBeInTheDocument();
    expect(screen.getByText('WhatsApp + CRM sincronizados')).toBeInTheDocument();
    expect(screen.getByText('Tecnología licenciada · experiencia de marca blanca')).toBeInTheDocument();
    expect(screen.getByText('Responsive en iPhone y Android')).toBeInTheDocument();
    expect(screen.getByText(/Hecho por Marcelo Guillén, Ingeniero en Informática y Telecomunicaciones/i)).toBeInTheDocument();
    expect(screen.getAllByText('Faro TDF').length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Facilitador Accesible de Respuestas y Orientación/i).length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole('button', { name: 'Ver secuencia completa' }));
    expect(screen.getAllByText('Nota de voz · 00:24').length).toBeGreaterThan(0);
    expect(screen.getByText('Transcripción accesible preparada')).toBeInTheDocument();
    expect(screen.getAllByText('Guía CUD · PDF').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Formulario guiado').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Orientación CUD').length).toBeGreaterThan(1);
    expect(screen.getByText('Muestra · 1ª respuesta en 4 min')).toBeInTheDocument();
    expect(screen.getByText('Ushuaia · muestra')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Para mí' })).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(screen.getByRole('button', { name: 'Hablar con una persona' }));
    expect(screen.getByText(/Solicitud de atención humana registrada/i)).toBeInTheDocument();

    for (const input of ['Texto', 'Voz', 'Imagen', 'Documento', 'Ubicación']) {
      expect(screen.getAllByText(input).length).toBeGreaterThan(0);
    }
    for (const output of [
      'PDF',
      'Catálogo de servicios accesible',
      'Directorio accesible',
      'Formulario',
      'Contacto',
      'Turno',
      'Callback',
      'Derivación humana',
    ]) {
      expect(screen.getByText(output)).toBeInTheDocument();
    }

    expect(screen.getByText(/esta demostración no pide DNI/i)).toBeInTheDocument();
    expect(screen.getByText('ARS 3.500.000–5.000.000 mensuales')).toBeInTheDocument();
    expect(screen.getByText(/servicio gestionado punta a punta/i)).toBeInTheDocument();
    expect(screen.getByText(/operación estándar e infraestructura incluidas dentro del rango acordado/i)).toBeInTheDocument();
    expect(screen.queryByText(/proveedores subyacentes/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/fees de meta/i)).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: /descargar propuesta PDF/i })).toHaveAttribute(
      'href',
      '/propuestas/propuesta-ejecutiva-agente-ia-discapacidad-tdf.pdf',
    );
    expect(screen.queryByRole('form')).not.toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: 'Dashboard' })[0]).toHaveAttribute('href', '#dashboard');
    expect(screen.getByText('Matriz de canales y acciones')).toBeInTheDocument();
    expect(screen.getAllByText('Llamada entrante').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Llamada saliente').length).toBeGreaterThan(0);
  });

  it('presents the five service axes, preventive alerts, accountable parties and conceptual KPIs', () => {
    render(<DisabilityAIAgentDemoPage />);

    for (const axis of [
      'Documentación y certificación',
      'Salud y apoyos clínicos',
      'Prestaciones y licencias',
      'Escuela, recreación y apoyos',
      'Empleo y formación',
    ]) {
      expect(screen.getAllByText(axis).length).toBeGreaterThan(0);
    }
    for (const alert of ['CUD · 90 días', 'Turnos', 'RUPE', 'Farmacia', 'Educación']) {
      expect(screen.getByText(alert)).toBeInTheDocument();
    }
    for (const metric of [
      'interacciones por canal',
      'cierre autónomo',
      'derivación humana',
      'completitud de preevaluación',
    ]) {
      expect(screen.getAllByText(metric).length).toBeGreaterThan(0);
    }
    expect(screen.getAllByText('Mesa Única').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Agencia de Innovación Fueguina (AIF)').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Proveedor tecnológico').length).toBeGreaterThan(0);
    expect(screen.getByText('74% de alertas completadas · muestra conceptual')).toBeInTheDocument();
    expect(screen.getByText('Fase 01')).toBeInTheDocument();
    expect(screen.getByText('Fase 04')).toBeInTheDocument();
  });

  it('keeps the five WhatsApp and CRM service axes synchronized with keyboard tabs', () => {
    render(<DisabilityAIAgentDemoPage />);

    const tabs = screen.getAllByRole('tab');
    expect(tabs).toHaveLength(5);
    expect(tabs[0]).toHaveAttribute('aria-selected', 'true');
    fireEvent.click(screen.getByRole('button', { name: 'Ver secuencia completa' }));
    expect(screen.getByText('DEMO-DISC-0142')).toBeInTheDocument();

    fireEvent.keyDown(tabs[0], { key: 'ArrowRight' });
    expect(tabs[1]).toHaveFocus();
    expect(tabs[1]).toHaveAttribute('aria-selected', 'true');
    fireEvent.click(screen.getByRole('button', { name: 'Ver secuencia completa' }));
    expect(screen.getByText('DEMO-DISC-0187')).toBeInTheDocument();
    expect(screen.getByText(/RUPE, pensión y fe de vida/i)).toBeInTheDocument();
    expect(screen.getByText('Estado RUPE por validar')).toBeInTheDocument();
    expect(screen.getAllByText('Captura compartida').length).toBeGreaterThan(0);
    expect(screen.getByText('Muestra · callback en 30 min')).toBeInTheDocument();

    fireEvent.keyDown(tabs[1], { key: 'ArrowRight' });
    fireEvent.click(screen.getByRole('button', { name: 'Ver secuencia completa' }));
    expect(tabs[2]).toHaveFocus();
    expect(screen.getByText('DEMO-DISC-0214')).toBeInTheDocument();
    expect(screen.getByText('Revisión humana')).toBeInTheDocument();
    expect(screen.getByText('DER-DEMO-0214')).toBeInTheDocument();
    expect(screen.getByText('Encuesta final 1–5 · pendiente de cierre')).toBeInTheDocument();
    expect(screen.getAllByText('Ubicación voluntaria').length).toBeGreaterThan(0);
    expect(screen.getByText('Muestra · atención humana en 12 min')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Simular toma' }));
    expect(screen.getByText(/caso tomado por el operador/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Simular transferencia' }));
    expect(screen.getByText(/Transferencia preparada: Persona DEMO/i)).toBeInTheDocument();
    expect(screen.getByText(/contacto protegido/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Cerrar + CSAT' }));
    expect(screen.getByTestId('csat-close-step')).toHaveTextContent('¿Cómo fue la atención?');
    fireEvent.click(screen.getByRole('button', { name: '5 de 5' }));
    expect(screen.getByText(/Valoración de muestra registrada: 5 de 5/i)).toBeInTheDocument();
    expect(screen.getByText(/Cierre simulado auditado · CSAT 5\/5/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Historial' }));
    expect(screen.getByTestId('crm-inspector-panel')).toHaveTextContent('Historial del caso');

    fireEvent.keyDown(tabs[2], { key: 'End' });
    expect(tabs[4]).toHaveFocus();
    expect(tabs[4]).toHaveAttribute('aria-selected', 'true');
    fireEvent.click(screen.getByRole('button', { name: 'Ver secuencia completa' }));
    expect(screen.getByText('DEMO-DISC-0273')).toBeInTheDocument();
    expect(screen.getAllByText('CV de muestra').length).toBeGreaterThan(0);
  });

  it('advances deterministically, pauses and cleans its timer', async () => {
    vi.useFakeTimers();
    const { unmount } = render(<DisabilityAIAgentDemoPage />);
    const progress = screen.getByRole('progressbar', { name: /Progreso de sincronización/i });
    expect(screen.getByTestId('tdf-sequence-toggle')).toHaveClass('bg-[#075f91]');
    expect(screen.getByTestId('tdf-sync-progress-fill')).toHaveClass(
      'bg-[linear-gradient(90deg,#075f91,#28c8e8)]',
    );
    expect(progress).toHaveAttribute('aria-valuenow', '0');

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1450);
    });
    expect(progress).toHaveAttribute('aria-valuenow', '11');
    fireEvent.click(screen.getByRole('button', { name: 'Pausar demostración' }));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(14500);
    });
    expect(progress).toHaveAttribute('aria-valuenow', '11');
    fireEvent.click(screen.getByRole('button', { name: 'Siguiente paso' }));
    expect(progress).toHaveAttribute('aria-valuenow', '22');

    unmount();
    expect(vi.getTimerCount()).toBeLessThanOrEqual(1);
  });

  it('offers dyslexia-friendly preferences and a non-networked Faro widget', () => {
    render(<DisabilityAIAgentDemoPage />);
    fireEvent.click(screen.getByRole('button', { name: 'Abrir preferencias de accesibilidad' }));
    const readingMode = screen.getByRole('button', { name: 'Lectura clara / dislexia' });
    const spacingMode = screen.getByRole('button', { name: 'Espaciado amplio' });
    fireEvent.click(readingMode);
    fireEvent.click(spacingMode);
    expect(document.documentElement).toHaveClass('tdf-demo-reading-friendly');
    expect(document.documentElement).toHaveClass('tdf-demo-wide-spacing');

    fireEvent.click(screen.getByRole('button', { name: 'Abrir chat de Faro' }));
    expect(screen.getByRole('dialog', { name: 'Faro TDF' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'CUD y CMO' }));
    expect(screen.getByText(/Quiero saber qué necesito para iniciar el CUD/i)).toBeInTheDocument();
  });

  it('renders heat and all 24 representative points together, with complete territorial filters', async () => {
    render(<DisabilityAIAgentDemoPage />);

    const map = await screen.findByRole('region', {
      name: 'Mapa MapLibre de demanda conceptual y simulada en Tierra del Fuego',
    });
    expect(map).toHaveAttribute('data-heatmap', 'on');
    expect(map).toHaveAttribute('data-points', 'on');
    expect(map).toHaveAttribute('data-point-count', '24');

    const cityFilters = screen.getByRole('group', { name: 'Filtrar mapa por ciudad' });
    const neighborhoodFilter = screen.getByRole('combobox', { name: 'Filtrar mapa por barrio' });
    const categoryFilters = screen.getByRole('group', { name: 'Filtrar mapa por categoría o rubro' });
    const typeFilter = screen.getByRole('combobox', { name: 'Filtrar mapa por tipo' });

    for (const city of ['Todas', 'Ushuaia', 'Río Grande', 'Tolhuin']) {
      expect(within(cityFilters).getByRole('button', { name: city })).toBeInTheDocument();
    }
    expect(within(neighborhoodFilter).getByRole('option', { name: 'Todos' })).toBeInTheDocument();
    expect(within(categoryFilters).getByRole('button', { name: 'Salud y prestaciones' })).toBeInTheDocument();
    expect(within(typeFilter).getByRole('option', { name: 'Reclamo' })).toBeInTheDocument();

    const categoryLegend = screen.getByRole('list', { name: 'Leyenda de categorías territoriales' });
    expect(within(categoryLegend).getAllByRole('listitem')).toHaveLength(5);
    for (const category of [
      'CUD / CMO',
      'Salud y prestaciones',
      'Educación y apoyos',
      'RUPE y licencias',
      'Inclusión laboral',
    ]) {
      expect(within(categoryLegend).getByText(category)).toBeInTheDocument();
    }

    fireEvent.click(within(cityFilters).getByRole('button', { name: 'Río Grande' }));
    fireEvent.click(within(categoryFilters).getByRole('button', { name: 'Salud y prestaciones' }));
    fireEvent.change(neighborhoodFilter, { target: { value: 'Margen Sur' } });
    fireEvent.change(typeFilter, { target: { value: 'Reclamo' } });

    expect(map).toHaveAttribute('data-heatmap', 'on');
    expect(map).toHaveAttribute('data-points', 'on');
    expect(map).toHaveAttribute('data-point-count', '1');
  });

  it('opens an accessible representative point detail and keeps the points-only alternative', async () => {
    render(<DisabilityAIAgentDemoPage />);

    const pointDirectory = screen.getByTestId('tdf-map-point-directory');
    expect(pointDirectory).toHaveAccessibleName('Directorio territorial de muestra');
    const pointList = within(pointDirectory).getByRole('list', {
      name: 'Ubicaciones representativas disponibles',
    });
    const pointRows = within(pointList).getAllByTestId(/^tdf-map-point-row-/);
    expect(pointRows).toHaveLength(24);
    const rioGrandeCenter = pointRows.find((row) =>
      row.textContent?.includes('Centro') &&
      row.textContent?.includes('Río Grande') &&
      row.textContent?.includes('CUD / CMO'));
    expect(rioGrandeCenter).toBeDefined();
    fireEvent.click(rioGrandeCenter!);

    const detail = screen.getByRole('region', { name: 'Detalle de ubicación representativa' });
    expect(detail).toHaveTextContent('Centro');
    expect(detail).toHaveTextContent('Río Grande');
    expect(detail).toHaveTextContent('CUD / CMO');
    expect(detail).toHaveTextContent('Consulta');
    expect(detail).toHaveTextContent('WhatsApp');
    expect(detail).toHaveTextContent(/64/);
    expect(within(detail).getByRole('button', { name: 'Enfocar este barrio en el mapa' })).toBeInTheDocument();

    const pointsOnlyMap = screen.getByRole('button', { name: /Solo puntos/i });
    fireEvent.click(pointsOnlyMap);

    expect(pointsOnlyMap).toHaveAttribute('aria-pressed', 'true');
    expect(await screen.findByRole('region', {
      name: 'Mapa MapLibre de demanda conceptual y simulada en Tierra del Fuego',
    })).toHaveAttribute('data-heatmap', 'off');
    expect(await screen.findByRole('region', {
      name: 'Mapa MapLibre de demanda conceptual y simulada en Tierra del Fuego',
    })).toHaveAttribute('data-points', 'on');
    expect(screen.getByText(/no deben utilizarse para decisiones de política pública/i)).toBeInTheDocument();
  });
});
