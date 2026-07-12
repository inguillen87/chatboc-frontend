import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

import BottomNavigationBar from './BottomNavigationBar';

const routerFuture = {
  v7_startTransition: true,
  v7_relativeSplatPath: true,
} as const;

vi.mock('@/context/TenantContext', () => ({
  useTenant: () => ({
    currentSlug: 'junin',
    tenant: { slug: 'junin', tipo: 'municipio' },
  }),
}));

describe('BottomNavigationBar mobile accessibility', () => {
  it('exposes a labelled safe-area navigation landmark and keyboard-focusable actions', () => {
    const onOpenMobileMenu = vi.fn();

    render(
      <MemoryRouter future={routerFuture} initialEntries={['/t/junin/portal/dashboard']}>
        <BottomNavigationBar onOpenMobileMenu={onOpenMobileMenu} />
      </MemoryRouter>,
    );

    const navigation = screen.getByRole('navigation', {
      name: /navegacion principal del portal/i,
    });
    expect(navigation.className).toContain('h-[calc(4rem+env(safe-area-inset-bottom))]');
    expect(navigation.className).toContain('pb-[env(safe-area-inset-bottom)]');

    const homeLink = screen.getByRole('link', { name: /inicio/i });
    expect(homeLink).toHaveAttribute('href', '/t/junin/portal/dashboard');
    expect(homeLink).toHaveAttribute('aria-current', 'page');

    const moreButton = screen.getByRole('button', { name: 'Mas' });
    expect(moreButton).toHaveAttribute('type', 'button');
    expect(moreButton).toHaveAttribute('aria-haspopup', 'dialog');
    moreButton.focus();
    expect(moreButton).toHaveFocus();
    fireEvent.click(moreButton);
    expect(onOpenMobileMenu).toHaveBeenCalledTimes(1);
  });
});
