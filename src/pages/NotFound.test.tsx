import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import NotFound from './NotFound';

describe('NotFound', () => {
  it('explains the situation in Spanish without naming the platform', () => {
    render(
      <MemoryRouter initialEntries={['/no-existe']}>
        <NotFound />
      </MemoryRouter>,
    );

    expect(screen.getByRole('heading', { name: 'No encontramos esta página' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Ir al inicio' })).toHaveAttribute('href', '/');
    expect(document.body.textContent).not.toMatch(/Oops|Page not found|Chatboc/i);
  });
});
