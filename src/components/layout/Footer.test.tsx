import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

import Footer from './Footer';

const scrollToSectionMock = vi.hoisted(() => vi.fn());

vi.mock('@/hooks/useScrollToSection', () => ({
  useScrollToSection: () => scrollToSectionMock,
}));

describe('Footer landing navigation', () => {
  it('targets the canonical Spanish landing anchors', () => {
    render(
      <MemoryRouter>
        <Footer />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Que hace' }));
    fireEvent.click(screen.getByRole('button', { name: 'Planes' }));

    expect(scrollToSectionMock).toHaveBeenNthCalledWith(1, 'solucion');
    expect(scrollToSectionMock).toHaveBeenNthCalledWith(2, 'precios');
  });
});
