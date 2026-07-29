import React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import ChatCRMPage from './ChatCRMPage';

const tenantState = vi.hoisted(() => ({
  currentSlug: 'junin' as string | null,
  isLoadingTenant: false,
}));

vi.mock('@/context/TenantContext', () => ({
  useTenant: () => tenantState,
}));

const renderRoute = () =>
  render(
    <MemoryRouter initialEntries={['/chatcrm']}>
      <Routes>
        <Route path="/chatcrm" element={<ChatCRMPage />} />
        <Route path="/t/:tenant/inbox" element={<div>Inbox operativo real</div>} />
        <Route path="/perfil" element={<div>Mesa de tickets</div>} />
      </Routes>
    </MemoryRouter>,
  );

describe('ChatCRMPage', () => {
  beforeEach(() => {
    tenantState.currentSlug = 'junin';
    tenantState.isLoadingTenant = false;
  });

  it('redirige el acceso autenticado al inbox real del tenant', async () => {
    renderRoute();

    expect(await screen.findByText('Inbox operativo real')).toBeInTheDocument();
    expect(screen.queryByText(/simulación de chat/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/solicitar demo/i)).not.toBeInTheDocument();
  });

  it('usa la mesa de tickets como fallback cuando no hay tenant resuelto', async () => {
    tenantState.currentSlug = null;
    renderRoute();

    expect(await screen.findByText('Mesa de tickets')).toBeInTheDocument();
  });

  it('espera la resolución de tenant antes de navegar', () => {
    tenantState.isLoadingTenant = true;
    renderRoute();

    expect(screen.getByText('Abriendo ChatCRM')).toBeInTheDocument();
    expect(screen.queryByText('Inbox operativo real')).not.toBeInTheDocument();
  });
});
