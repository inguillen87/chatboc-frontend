import React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import Layout from './Layout';

vi.mock('./Navbar', () => ({
  default: () => <nav data-testid="navbar">navbar</nav>,
}));

vi.mock('./Footer', () => ({
  default: () => <footer data-testid="site-footer">footer</footer>,
}));

vi.mock('../ui/ScrollToTopButton', () => ({
  default: () => <button data-testid="scroll-to-top">top</button>,
}));

vi.mock('./DemoModeBanner', () => ({
  default: () => <div data-testid="demo-banner">demo</div>,
}));

const renderLayout = (initialEntry: string) =>
  render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/perfil" element={<div>profile outlet</div>} />
          <Route path="/otra" element={<div>other outlet</div>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );

describe('Layout ticket workspace shell', () => {
  beforeEach(() => {
    vi.stubGlobal('scrollTo', vi.fn());
  });

  it('removes public footer chrome from the embedded ticket CRM workspace', () => {
    renderLayout('/perfil?tab=tickets');

    expect(screen.getByText('profile outlet')).toBeInTheDocument();
    expect(screen.getByTestId('navbar')).toBeInTheDocument();
    expect(screen.queryByTestId('site-footer')).not.toBeInTheDocument();
    expect(screen.queryByTestId('scroll-to-top')).not.toBeInTheDocument();

    const main = screen.getByRole('main');
    expect(main).toHaveClass('pt-14');
    expect(main).not.toHaveClass('max-w-7xl');
  });

  it('keeps the normal marketing shell outside the ticket workspace', () => {
    renderLayout('/perfil');

    expect(screen.getByText('profile outlet')).toBeInTheDocument();
    expect(screen.getByTestId('site-footer')).toBeInTheDocument();
    expect(screen.getByTestId('scroll-to-top')).toBeInTheDocument();

    const main = screen.getByRole('main');
    expect(main).toHaveClass('pt-20');
    expect(main).toHaveClass('max-w-7xl');
  });
});
