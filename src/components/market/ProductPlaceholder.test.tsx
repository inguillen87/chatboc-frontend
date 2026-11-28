import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { CupSoda, Hammer, PawPrint, ShoppingBag, Wheat } from 'lucide-react';
import ProductPlaceholder, { categoryIcon } from './ProductPlaceholder';

describe('product placeholder', () => {
  it('draws the category, with or without accents, and a bag for anything else', () => {
    expect(categoryIcon('Almacén')).toBe(Wheat);
    expect(categoryIcon('BEBIDAS')).toBe(CupSoda);
    expect(categoryIcon('Ferreteria')).toBe(Hammer);
    expect(categoryIcon('Alimento para perro')).toBe(PawPrint);
    expect(categoryIcon('Mascotas')).toBe(PawPrint);
    expect(categoryIcon(null)).toBe(ShoppingBag);
    expect(categoryIcon('Servicios varios')).toBe(ShoppingBag);
  });

  it('names the category under the drawing, and stays quiet when compact', () => {
    const { rerender } = render(<ProductPlaceholder category="Limpieza" />);
    expect(screen.getByText('Limpieza')).toBeInTheDocument();
    rerender(<ProductPlaceholder category="Limpieza" compact />);
    expect(screen.queryByText('Limpieza')).not.toBeInTheDocument();
    expect(screen.getByTestId('product-placeholder')).toBeInTheDocument();
  });
});
