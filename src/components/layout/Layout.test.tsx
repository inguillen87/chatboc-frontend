import React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

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
          <Route path="/t/:tenant/reclamos" element={<div>tenant tickets outlet</div>} />
          <Route path="/e/:slug" element={<div>survey outlet</div>} />
          <Route path="/otra" element={<div>other outlet</div>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );

describe('Layout ticket workspace shell', () => {
  beforeEach(() => {
    vi.stubGlobal('scrollTo', vi.fn());
    document.documentElement.style.overflow = '';
    document.documentElement.style.overscrollBehavior = '';
    document.body.style.overflow = '';
    document.body.style.overscrollBehavior = '';
    document.body.style.paddingBottom = '';
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('removes public footer chrome from the embedded ticket CRM workspace', () => {
    const view = renderLayout('/perfil?tab=tickets');

    expect(screen.getByText('profile outlet')).toBeInTheDocument();
    expect(screen.getByTestId('navbar')).toBeInTheDocument();
    expect(screen.queryByTestId('site-footer')).not.toBeInTheDocument();
    expect(screen.queryByTestId('scroll-to-top')).not.toBeInTheDocument();

    const main = screen.getByRole('main');
    expect(main).toHaveClass('flex-1');
    expect(main).toHaveClass('min-h-0');
    expect(main).toHaveClass('overflow-hidden');
    expect(main).not.toHaveClass('max-w-7xl');
    expect(main.parentElement).toHaveAttribute('data-workspace-shell', 'tickets');
    expect(main.parentElement).toHaveClass('h-dvh');
    expect(document.querySelector('style[data-ticket-workspace-chrome]')).toHaveTextContent(
      '.chatboc-container[data-mode="standalone"]',
    );
    expect(document.documentElement.style.overflow).toBe('hidden');
    expect(document.body.style.overflow).toBe('hidden');
    expect(document.body.style.paddingBottom).toBe('0px');

    view.unmount();

    expect(document.documentElement.style.overflow).toBe('');
    expect(document.body.style.overflow).toBe('');
    expect(document.body.style.paddingBottom).toBe('');
  });

  it('uses the same full-height shell for canonical tenant reclamos', () => {
    renderLayout('/t/municipio-demo/reclamos?ticket_id=42&channel=whatsapp');

    expect(screen.getByText('tenant tickets outlet')).toBeInTheDocument();
    expect(screen.getByTestId('navbar')).toBeInTheDocument();
    expect(screen.queryByTestId('site-footer')).not.toBeInTheDocument();
    expect(screen.queryByTestId('scroll-to-top')).not.toBeInTheDocument();

    const main = screen.getByRole('main');
    expect(main).toHaveClass('flex-1');
    expect(main).toHaveClass('min-h-0');
    expect(main).toHaveClass('overflow-hidden');
    expect(main.parentElement).toHaveAttribute('data-workspace-shell', 'tickets');
    expect(document.documentElement.style.overflow).toBe('hidden');
    expect(document.body.style.overflow).toBe('hidden');
  });

  it('contains the profile people CRM in the same viewport workspace contract', () => {
    renderLayout('/perfil?tab=usuarios');

    expect(screen.getByText('profile outlet')).toBeInTheDocument();
    expect(screen.getByTestId('navbar')).toBeInTheDocument();
    expect(screen.queryByTestId('site-footer')).not.toBeInTheDocument();
    expect(screen.queryByTestId('scroll-to-top')).not.toBeInTheDocument();

    const main = screen.getByRole('main');
    expect(main).toHaveClass('flex-1', 'min-h-0', 'overflow-hidden');
    expect(main).not.toHaveClass('max-w-7xl');
    expect(main.parentElement).toHaveAttribute('data-workspace-shell', 'crm');
    expect(main.parentElement).toHaveClass('h-dvh');
    expect(document.documentElement.style.overflow).toBe('hidden');
    expect(document.body.style.overflow).toBe('hidden');
  });

  it('removes public footer chrome from the embedded analytics CRM workspace', () => {
    renderLayout('/perfil?tab=analytics');

    expect(screen.getByText('profile outlet')).toBeInTheDocument();
    expect(screen.getByTestId('navbar')).toBeInTheDocument();
    expect(screen.queryByTestId('site-footer')).not.toBeInTheDocument();
    expect(screen.queryByTestId('scroll-to-top')).not.toBeInTheDocument();

    const main = screen.getByRole('main');
    expect(main).toHaveClass('pt-14');
    expect(main).not.toHaveClass('max-w-7xl');
  });

  it('keeps the profile dashboard inside the application shell without marketing footer chrome', () => {
    renderLayout('/perfil');

    expect(screen.getByText('profile outlet')).toBeInTheDocument();
    expect(screen.queryByTestId('site-footer')).not.toBeInTheDocument();
    expect(screen.queryByTestId('scroll-to-top')).not.toBeInTheDocument();

    const main = screen.getByRole('main');
    expect(main).toHaveClass('pt-20');
    expect(main).toHaveClass('max-w-7xl');
    expect(document.querySelector('style[data-ticket-workspace-chrome]')).not.toBeInTheDocument();
  });

  it('gives public survey dashboards a wider data-rich canvas without removing responsive gutters', () => {
    renderLayout('/e/prioridades-barriales?tenant_slug=junin');

    expect(screen.getByText('survey outlet')).toBeInTheDocument();
    const main = screen.getByRole('main');
    expect(main).toHaveClass('max-w-[96rem]', 'px-4', 'md:px-8', 'xl:px-12');
    expect(main).not.toHaveClass('max-w-7xl');
    expect(main).not.toHaveClass('lg:px-16');
  });
});
