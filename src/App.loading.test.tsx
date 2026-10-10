import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { RouteLoadingFallback } from './App';

describe('RouteLoadingFallback', () => {
  it('shows an accessible, informative workspace loading state', () => {
    render(<RouteLoadingFallback />);

    expect(screen.getByRole('heading', { name: /preparando tu espacio de trabajo/i })).toBeInTheDocument();
    expect(screen.getByText(/cargando datos y herramientas de forma segura/i)).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveAttribute('aria-live', 'polite');
    expect(screen.getByRole('main')).toHaveAttribute('aria-busy', 'true');
  });
});
