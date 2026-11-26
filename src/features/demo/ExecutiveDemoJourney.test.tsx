import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { DEMO_DATA_NOTICE } from './demoPresentationLabels';
import ExecutiveDemoJourney from './ExecutiveDemoJourney';

describe('ExecutiveDemoJourney', () => {
  it('explains the unified demo with one clear non-official notice', () => {
    render(
      <ExecutiveDemoJourney
        activeTarget="conversation"
        onSelect={vi.fn()}
        scenarioContext="demo-gobierno-junin-prioridades-barriales"
        scenarioScope="Junín, Mendoza"
      />,
    );

    expect(screen.getByText('Centro de gestión ciudadana')).toBeInTheDocument();
    expect(screen.getByText('Atención, reclamos, participación y territorio en una sola vista.')).toBeInTheDocument();
    expect(screen.getByText('Ámbito: Junín, Mendoza')).toBeInTheDocument();
    expect(screen.getByRole('note')).toHaveTextContent(DEMO_DATA_NOTICE);
    expect(screen.getAllByRole('button')).toHaveLength(5);
    expect(screen.getByRole('button', { name: 'Atención' })).toHaveAttribute('aria-current', 'page');
  });

  it('exposes every destination and triggers navigation cleanly', () => {
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
    expect(screen.getByRole('button', { name: 'Participación' })).toHaveAttribute('aria-current', 'page');

    fireEvent.click(screen.getByRole('button', { name: 'Reclamos' }));
    fireEvent.click(screen.getByRole('button', { name: 'Territorio' }));

    expect(onSelect).toHaveBeenNthCalledWith(1, 'claims');
    expect(onSelect).toHaveBeenNthCalledWith(2, 'analytics');
  });

  it('does not invent a jurisdiction when the contract does not provide one', () => {
    render(
      <ExecutiveDemoJourney activeTarget="analytics" onSelect={vi.fn()} scenarioContext=" " scenarioScope=" " />,
    );

    expect(screen.getByText('Ámbito: por configurar')).toBeInTheDocument();
    expect(screen.getByRole('note')).toHaveTextContent(DEMO_DATA_NOTICE);
  });

  it('presents a business demo with commercial wording instead of citizen management', () => {
    const onSelect = vi.fn();
    render(
      <ExecutiveDemoJourney
        activeTarget="claims"
        onSelect={onSelect}
        scenarioScope="Bodega"
        sector="empresas"
      />,
    );

    expect(screen.getByText('Centro de ventas y atención')).toBeInTheDocument();
    expect(screen.getByText('Ámbito: Bodega')).toBeInTheDocument();
    expect(screen.queryByText('Centro de gestión ciudadana')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Reclamos' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Territorio' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Pedidos y casos' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('note')).toHaveTextContent(DEMO_DATA_NOTICE);

    fireEvent.click(screen.getByRole('button', { name: 'Encuestas' }));
    expect(onSelect).toHaveBeenCalledWith('surveys');
  });

  it('presents a school demo with its own wording and keeps the five destinations', () => {
    render(
      <ExecutiveDemoJourney activeTarget="overview" onSelect={vi.fn()} scenarioScope="Colegio" sector="educacion" />,
    );

    expect(screen.getByText('Centro de atención a familias')).toBeInTheDocument();
    expect(screen.getAllByRole('button')).toHaveLength(5);
    expect(screen.getByRole('button', { name: 'Solicitudes' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Reclamos' })).not.toBeInTheDocument();
  });

  it('keeps the original government framing for an unknown or missing sector', () => {
    render(<ExecutiveDemoJourney activeTarget="overview" onSelect={vi.fn()} sector="otro" />);

    expect(screen.getByText('Centro de gestión ciudadana')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reclamos' })).toBeInTheDocument();
  });
});
