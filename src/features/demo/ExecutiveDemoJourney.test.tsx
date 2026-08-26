import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import ExecutiveDemoJourney from './ExecutiveDemoJourney';

describe('ExecutiveDemoJourney', () => {
  it('explains the unified demo without presenting scenario data as official', () => {
    render(
      <ExecutiveDemoJourney
        activeTarget="conversation"
        onSelect={vi.fn()}
        scenarioContext="demo-gobierno-junin-prioridades-barriales"
        scenarioScope="Junín, Mendoza"
      />,
    );

    expect(screen.getByText('Un solo espacio de trabajo, del contacto a la decisión')).toBeInTheDocument();
    expect(screen.getByText('Ámbito: Junín, Mendoza')).toBeInTheDocument();
    expect(screen.getByText('Escenario demostrativo · no oficial')).toBeInTheDocument();
    expect(screen.getAllByRole('button')).toHaveLength(4);
    expect(screen.getByRole('button', { name: /Atención omnicanal/i })).toHaveAttribute('aria-current', 'step');
    expect(screen.getByText('3 escenarios de Junín · un mismo workspace')).toBeInTheDocument();
    expect(document.querySelector('[data-demo-scenario="prioridades-barriales"]')).toHaveTextContent('En pantalla');
    expect(document.querySelector('[data-demo-scenario="obras-servicios-90-dias"]')).toHaveTextContent(
      'Demo no oficial',
    );
    expect(document.querySelector('[data-demo-scenario="tramites-atencion-digital"]')).toHaveTextContent(
      'Trámites y atención digital',
    );
  });

  it('keeps the Junín scenario catalog in the same workspace and exposes every destination', () => {
    const onSelect = vi.fn();
    render(
      <ExecutiveDemoJourney
        activeTarget="surveys"
        onSelect={onSelect}
        scenarioContext="obras y servicios a 90 días"
        scenarioScope="Junín, Mendoza"
      />,
    );

    expect(screen.getByText('Ámbito: Junín, Mendoza')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Encuestas y votaciones/i })).toHaveAttribute('aria-current', 'step');
    expect(document.querySelector('[data-demo-scenario="obras-servicios-90-dias"]')).toHaveTextContent('En pantalla');

    fireEvent.click(screen.getByRole('button', { name: /CRM de reclamos/i }));
    fireEvent.click(screen.getByRole('button', { name: /Analítica territorial/i }));

    expect(onSelect).toHaveBeenNthCalledWith(1, 'claims');
    expect(onSelect).toHaveBeenNthCalledWith(2, 'analytics');
  });

  it('does not invent a jurisdiction when the contract does not provide one', () => {
    render(
      <ExecutiveDemoJourney activeTarget="analytics" onSelect={vi.fn()} scenarioContext=" " scenarioScope=" " />,
    );

    expect(screen.getByText('Ámbito: configurado por esta demo')).toBeInTheDocument();
    expect(document.querySelector('[data-demo-scenario]')).not.toHaveTextContent('En pantalla');
  });
});
