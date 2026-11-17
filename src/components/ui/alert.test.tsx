import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Alert, AlertTitle } from './alert';

describe('AlertTitle heading level', () => {
  it('keeps h5 by default and follows the level of its section when given', () => {
    render(<><Alert><AlertTitle>Por defecto</AlertTitle></Alert><Alert><AlertTitle level={2}>Aviso de sección</AlertTitle></Alert></>);
    expect(screen.getByRole('heading', { level: 5, name: 'Por defecto' })).toHaveClass('font-medium');
    expect(screen.getByRole('heading', { level: 2, name: 'Aviso de sección' })).toHaveClass('font-medium');
  });
});
