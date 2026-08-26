import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import DisabilityAIAgentDemoPage from './DisabilityAIAgentDemoPage';

vi.mock('@/hooks/usePageMetadata', () => ({
  usePageMetadata: vi.fn(),
}));

vi.mock('@/components/MapLibreMap', () => ({
  default: ({
    ariaLabel,
    showHeatmap,
  }: {
    ariaLabel?: string;
    showHeatmap?: boolean;
  }) => (
    <div role="region" aria-label={ariaLabel} data-heatmap={showHeatmap ? 'on' : 'off'}>
      Mapa conceptual MapLibre
    </div>
  ),
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

describe('DisabilityAIAgentDemoPage', () => {
  it('renders a truthful, white-label and explicitly multimodal executive proposal', async () => {
    render(<DisabilityAIAgentDemoPage />);

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
      'Una puerta de entrada accesible',
    );
    expect(screen.getAllByText('Demostración conceptual · datos representativos').length).toBeGreaterThan(0);
    expect(screen.getByText('Identidad institucional configurable')).toBeInTheDocument();
    expect(screen.getByText('WhatsApp + CRM sincronizados')).toBeInTheDocument();
    expect(screen.getByText('Tecnología licenciada · experiencia de marca blanca')).toBeInTheDocument();
    expect(screen.getByText('Responsive en iPhone y Android')).toBeInTheDocument();
    expect(screen.getByText(/Hecho por Marcelo Guillén, Ingeniero en Informática y Telecomunicaciones/i)).toBeInTheDocument();
    expect(screen.getByText('Nota de voz · 00:24')).toBeInTheDocument();
    expect(screen.getByText('Transcripción accesible preparada')).toBeInTheDocument();
    expect(screen.getByText('Guía CUD · PDF')).toBeInTheDocument();
    expect(screen.getByText('Formulario guiado')).toBeInTheDocument();
    expect(screen.getAllByText('Orientación CUD').length).toBeGreaterThan(1);
    expect(screen.getByText('Muestra · 1ª respuesta en 4 min')).toBeInTheDocument();
    expect(screen.getByText('Ushuaia · muestra')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Para mí' })).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(screen.getByRole('button', { name: 'Hablar con una persona' }));
    expect(screen.getByText(/atención humana registrada/i)).toBeInTheDocument();

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
      'tiempo de primera respuesta',
      'tiempo medio de resolución',
      'CSAT al cierre',
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

  it('keeps the three WhatsApp and CRM scenarios synchronized with keyboard tabs', () => {
    render(<DisabilityAIAgentDemoPage />);

    const tabs = screen.getAllByRole('tab');
    expect(tabs).toHaveLength(3);
    expect(tabs[0]).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByText('DEMO-DISC-0142')).toBeInTheDocument();

    fireEvent.keyDown(tabs[0], { key: 'ArrowRight' });
    expect(tabs[1]).toHaveFocus();
    expect(tabs[1]).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByText('DEMO-DISC-0187')).toBeInTheDocument();
    expect(screen.getByText(/RUPE, pensión y fe de vida/i)).toBeInTheDocument();
    expect(screen.getByText('Estado RUPE por validar')).toBeInTheDocument();
    expect(screen.getByText('Captura compartida')).toBeInTheDocument();
    expect(screen.getByText('Muestra · callback en 30 min')).toBeInTheDocument();

    fireEvent.keyDown(tabs[1], { key: 'End' });
    expect(tabs[2]).toHaveFocus();
    expect(screen.getByText('DEMO-DISC-0214')).toBeInTheDocument();
    expect(screen.getByText('Revisión humana')).toBeInTheDocument();
    expect(screen.getByText('DER-DEMO-0214')).toBeInTheDocument();
    expect(screen.getByText('Encuesta final 1–5 · pendiente de cierre')).toBeInTheDocument();
    expect(screen.getByText('Ubicación voluntaria')).toBeInTheDocument();
    expect(screen.getByText('Muestra · atención humana en 12 min')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Tomar caso' }));
    expect(screen.getByText(/caso tomado por el operador/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Preparar transferencia' }));
    expect(screen.getByText(/Transferencia preparada: Persona DEMO/i)).toBeInTheDocument();
    expect(screen.getByText(/contacto protegido/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Cerrar + CSAT' }));
    expect(screen.getByTestId('csat-close-step')).toHaveTextContent('¿Cómo fue la atención?');
    fireEvent.click(screen.getByRole('button', { name: '5 de 5' }));
    expect(screen.getByText(/Valoración de muestra registrada: 5 de 5/i)).toBeInTheDocument();
    expect(screen.getByText(/Cierre simulado auditado · CSAT 5\/5/i)).toBeInTheDocument();
    expect(screen.getByText('Bandeja Mesa Única')).toBeInTheDocument();
    expect(screen.getByText('SLA en riesgo 3')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Historial' }));
    expect(screen.getByText('Inspector de muestra: Historial.')).toBeInTheDocument();
    expect(screen.getByTestId('crm-inspector-panel')).toHaveTextContent('Historial del caso');
  });

  it('offers a non-mutating map view control and preserves the simulation warning', async () => {
    render(<DisabilityAIAgentDemoPage />);

    const geographicMap = screen.getByRole('button', { name: 'Mapa geográfico' });
    fireEvent.click(geographicMap);

    expect(geographicMap).toHaveAttribute('aria-pressed', 'true');
    expect(await screen.findByRole('region', {
      name: 'Mapa MapLibre de demanda conceptual y simulada en Tierra del Fuego',
    })).toHaveAttribute('data-heatmap', 'off');
    expect(screen.getByText(/no deben utilizarse para decisiones de política pública/i)).toBeInTheDocument();
  });
});
