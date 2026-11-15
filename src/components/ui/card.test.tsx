import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { CardTitle } from './card';

describe('CardTitle heading level', () => {
  it('keeps h3 by default and renders the requested level for cards under a page h1', () => {
    render(<><CardTitle>Por defecto</CardTitle><CardTitle level={2}>Sección</CardTitle><CardTitle level={4}>Detalle</CardTitle></>);
    expect(screen.getByRole('heading', { level: 3, name: 'Por defecto' })).toHaveClass('text-2xl');
    expect(screen.getByRole('heading', { level: 2, name: 'Sección' })).toHaveClass('text-2xl');
    expect(screen.getByRole('heading', { level: 4, name: 'Detalle' })).toBeInTheDocument();
  });
});
