import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import RubroSelector from './RubroSelector';

const leaf = (id: number, nombre: string, descripcion = 'Demo lista para probar') =>
  ({ id, nombre, demo: { nombre, descripcion } }) as any;

describe('RubroSelector', () => {
  it('opens an option without sublevels in one click, with no accordion around it', () => {
    const onSelect = vi.fn();
    const gobierno = leaf(1, 'Gobiernos y municipios');
    render(<RubroSelector rubros={[gobierno, leaf(2, 'Legislador o diputado')]} onSelect={onSelect} />);

    const option = screen.getByRole('button', { name: /Gobiernos y municipios/ });
    // A direct option, not an accordion trigger that hides the same name inside.
    expect(option).toHaveAttribute('data-rubro-direct-option');
    expect(option).not.toHaveAttribute('aria-expanded');
    expect(screen.getAllByText('Gobiernos y municipios')).toHaveLength(1);

    fireEvent.click(option);
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect).toHaveBeenCalledWith(gobierno);
  });

  it('keeps the label as written instead of capitalising every word', () => {
    render(<RubroSelector rubros={[leaf(1, 'Legislador o diputado')]} onSelect={vi.fn()} />);

    const label = screen.getByText('Legislador o diputado');
    expect(label.closest('[class*="capitalize"]')).toBeNull();
  });

  it('still groups an option that has sublevels behind an accordion', () => {
    const grupo = {
      id: 10,
      nombre: 'Empresas',
      subrubros: [
        { id: 11, nombre: 'Bodega', demo: { nombre: 'Bodega', descripcion: 'Catálogo y pedidos' } },
        { id: 12, nombre: 'Ferretería', demo: { nombre: 'Ferretería', descripcion: 'Presupuestos y stock' } },
      ],
    } as any;
    render(<RubroSelector rubros={[grupo]} onSelect={vi.fn()} />);

    const trigger = screen.getByRole('button', { name: 'Empresas' });
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    expect(trigger.className).not.toMatch(/capitalize/);
  });

  it('opens a group whose dropdown would offer a single option in one click, selecting that option', () => {
    const onSelect = vi.fn();
    const only = leaf(21, 'Gobiernos y municipios', 'Reclamos, trámites y participación');
    const grupo = { id: 20, nombre: 'Gobiernos y municipios', subrubros: [only] } as any;
    render(<RubroSelector rubros={[grupo]} onSelect={onSelect} />);

    const option = screen.getByRole('button', { name: /Gobiernos y municipios/ });
    expect(option).toHaveAttribute('data-rubro-direct-option');
    expect(option).not.toHaveAttribute('aria-expanded');
    expect(screen.getByText('Reclamos, trámites y participación')).toBeInTheDocument();

    fireEvent.click(option);
    expect(onSelect).toHaveBeenCalledWith(only);
  });

  it('keeps the dropdown when a group offers more than one option', () => {
    const grupo = {
      id: 30,
      nombre: 'Empresas',
      subrubros: [leaf(31, 'Bodega'), leaf(32, 'Ferretería')],
    } as any;
    render(<RubroSelector rubros={[grupo]} onSelect={vi.fn()} />);

    expect(screen.getByRole('button', { name: 'Empresas' })).toHaveAttribute('aria-expanded', 'false');
  });

  it('opens the production shape in one click: a group whose children were pruned, with a name and nothing else', () => {
    // /demo prunes unavailable children, so each group arrives as
    // { nombre, subrubros: [] } with no demo block and no description.
    const onSelect = vi.fn();
    const gobierno = { id: 40, nombre: 'Gobiernos y municipios', subrubros: [] } as any;
    const concejo = { id: 41, nombre: 'Concejo deliberante', subrubros: [] } as any;
    render(<RubroSelector rubros={[gobierno, concejo]} onSelect={onSelect} />);

    const option = screen.getByRole('button', { name: 'Gobiernos y municipios' });
    expect(option).toHaveAttribute('data-rubro-direct-option');
    expect(option).not.toHaveAttribute('aria-expanded');
    expect(screen.queryAllByRole('button', { expanded: false })).toHaveLength(0);

    fireEvent.click(option);
    expect(onSelect).toHaveBeenCalledWith(gobierno);
  });
});
