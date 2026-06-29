import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const fetchFinanceWebviewMock = vi.fn();

vi.mock('@/api/finance', () => ({
  fetchFinanceWebview: (...args: unknown[]) => fetchFinanceWebviewMock(...args),
}));

import FinanceWebviewPage from './FinanceWebviewPage';
import { ApiError } from '@/utils/api';

const financePayload = {
  contract_version: 'finance.webview.v1',
  request_id: 'req-finance-1',
  tenant: {
    slug: 'banco-demo',
    nombre: 'Banco Demo',
    tipo: 'pyme',
    vertical: 'finanzas',
  },
  operation: {
    flow: 'operacion',
    code: 'OP-123',
    title: 'Operacion segura',
    description: 'Revisa una cobranza, pago, firma o credito asociado.',
    status: 'ready_for_customer_review',
    amount: '1500.75',
    currency: 'ARS',
  },
  security_policy: {
    card_data_in_chat_allowed: false,
    identity_data_in_chat_allowed: false,
    requires_session_token: true,
    session_state: 'present',
    server_to_server_confirmation_required: true,
  },
  steps: [
    { id: 'identity', label: 'Identidad y consentimiento', state: 'ready', detail: 'Validacion segura.' },
    { id: 'review', label: 'Revision de la operacion', state: 'ready', detail: 'El usuario confirma.' },
    { id: 'confirmation', label: 'Confirmacion trazable', state: 'pending', detail: 'Evento registrado.' },
  ],
  actions: {
    primary: {
      id: 'continue_secure_flow',
      label: 'Continuar gestion segura',
      enabled: true,
      disabled_reason: null,
    },
    support: {
      id: 'request_agent_help',
      label: 'Pedir ayuda de un asesor',
      enabled: true,
    },
  },
};

function renderPage(path = '/finanzas/banco-demo/operacion/OP-123?session=session-123456&amount=1500.75') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/finanzas/:tenantSlug/:flow/:operationCode" element={<FinanceWebviewPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('FinanceWebviewPage', () => {
  beforeEach(() => {
    fetchFinanceWebviewMock.mockReset();
  });

  it('renders the public finance webview contract without asking for sensitive data in chat', async () => {
    fetchFinanceWebviewMock.mockResolvedValueOnce(financePayload);

    renderPage();

    expect(await screen.findByText('Banco Demo')).toBeInTheDocument();
    expect(screen.getByText('Operacion segura')).toBeInTheDocument();
    expect(screen.getAllByText('Listo para revisar').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Datos sensibles fuera del chat')).toBeInTheDocument();
    expect(screen.getByText(/No se aceptan tarjetas, documentos completos ni claves dentro del chat/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Continuar gestion segura/i })).toBeEnabled();

    await waitFor(() => {
      expect(fetchFinanceWebviewMock).toHaveBeenCalledWith(
        expect.objectContaining({
          tenantSlug: 'banco-demo',
          flow: 'operacion',
          operationCode: 'OP-123',
        }),
      );
    });
  });

  it('shows the session blocker when the backend marks the link incomplete', async () => {
    fetchFinanceWebviewMock.mockResolvedValueOnce({
      ...financePayload,
      operation: {
        ...financePayload.operation,
        status: 'session_required',
      },
      security_policy: {
        ...financePayload.security_policy,
        session_state: 'missing_or_short',
      },
      actions: {
        ...financePayload.actions,
        primary: {
          ...financePayload.actions.primary,
          enabled: false,
          disabled_reason: 'Falta token de sesion del link de WhatsApp.',
        },
      },
    });

    renderPage('/finanzas/banco-demo/alta/ONB-9');

    expect((await screen.findAllByText('Link incompleto')).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByRole('button', { name: /Continuar gestion segura/i })).toBeDisabled();
    expect(screen.getByText('Falta token de sesion del link de WhatsApp.')).toBeInTheDocument();
  });

  it('shows a safe customer-facing message when the finance contract is not deployed', async () => {
    fetchFinanceWebviewMock.mockRejectedValueOnce(
      new ApiError('The requested URL was not found on the server.', 404, null, 'req-missing-finance'),
    );

    renderPage();

    expect(await screen.findByText('No se pudo abrir la operacion')).toBeInTheDocument();
    expect(screen.getByText(/todavia no esta habilitado para esta cuenta/i)).toBeInTheDocument();
    expect(screen.getByText(/No ingreses datos sensibles/i)).toBeInTheDocument();
    expect(screen.getByText(/req-missing-finance/i)).toBeInTheDocument();
  });
});
