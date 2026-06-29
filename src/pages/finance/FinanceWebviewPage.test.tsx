import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const fetchFinanceWebviewMock = vi.fn();
const sendFinanceActionMock = vi.fn();

vi.mock('@/api/finance', () => ({
  fetchFinanceWebview: (...args: unknown[]) => fetchFinanceWebviewMock(...args),
  sendFinanceAction: (...args: unknown[]) => sendFinanceActionMock(...args),
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
    requires_idempotency_key: true,
    audit_trail_required: true,
    highlights: [
      'Nunca pedimos claves, PIN ni datos completos de tarjeta por chat.',
      'Los documentos se revisan desde una vista protegida.',
      'La confirmacion final llega desde el proveedor autorizado.',
    ],
    never_request_in_chat: ['clave bancaria', 'token de seguridad', 'CVV'],
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
  experience: {
    webview_flow_id: 'finance_credit_collection_signature',
    templates: ['finance_credit_offer', 'finance_collection_due', 'finance_secure_payment'],
    crm_queue: {
      id: 'collections',
      label: 'Cobranzas y planes de pago',
      sla_minutes: 120,
    },
    user_tasks: [
      'Revisar monto, concepto y vencimiento',
      'Elegir pagar, pedir plan o firmar documento',
      'Recibir comprobante y seguimiento trazable',
    ],
  },
  events: {
    success: ['payment_webhook', 'signature_completed', 'crm_operation_updated'],
    analytics: ['collection_opened', 'payment_started', 'signature_completed'],
  },
  action_catalog: [
    {
      id: 'continue_secure_flow',
      label: 'Continuar gestion segura',
      enabled: true,
      event: 'finance_secure_flow_continued',
      next_step: 'secure_webview',
    },
    {
      id: 'request_agent_help',
      label: 'Pedir ayuda de un asesor',
      enabled: true,
      event: 'finance_agent_help_requested',
      next_step: 'crm_queue',
    },
    {
      id: 'request_payment_plan',
      label: 'Solicitar plan de pago',
      enabled: true,
      event: 'finance_payment_plan_requested',
      next_step: 'collections_queue',
    },
    {
      id: 'add_public_comment',
      label: 'Agregar comentario',
      enabled: true,
      event: 'finance_comment_added',
      next_step: 'crm_timeline',
    },
  ],
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
    sendFinanceActionMock.mockReset();
  });

  it('renders the public finance webview contract without asking for sensitive data in chat', async () => {
    fetchFinanceWebviewMock.mockResolvedValueOnce(financePayload);

    renderPage();

    expect(await screen.findByText('Banco Demo')).toBeInTheDocument();
    expect(screen.getByText('Operacion segura')).toBeInTheDocument();
    expect(screen.getAllByText('Listo para revisar').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Datos sensibles fuera del chat').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/No se aceptan tarjetas, documentos completos ni claves dentro del chat/i)).toBeInTheDocument();
    expect(screen.getByText('Proteccion de datos')).toBeInTheDocument();
    expect(screen.getByText('Cobranzas y planes de pago')).toBeInTheDocument();
    expect(screen.getByText('Pasos claros antes de confirmar')).toBeInTheDocument();
    expect(screen.getByText('Revisar monto, concepto y vencimiento')).toBeInTheDocument();
    expect(screen.getByText('Pago confirmado')).toBeInTheDocument();
    expect(screen.getByText('Solicitar plan de pago')).toBeInTheDocument();
    expect(screen.getByLabelText('Comentario seguro')).toBeInTheDocument();
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

  it('posts a finance action and shows the CRM ticket reference', async () => {
    fetchFinanceWebviewMock.mockResolvedValueOnce(financePayload);
    sendFinanceActionMock.mockResolvedValueOnce({
      contract_version: 'finance.action.v1',
      status: 'accepted',
      action: {
        id: 'request_payment_plan',
        label: 'Solicitar plan de pago',
        event: 'finance_payment_plan_requested',
        next_step: 'collections_queue',
      },
      ticket: {
        id: 8842,
        status: 'nuevo',
        category: 'Cobranzas y planes de pago',
        crm_queue: { id: 'collections', label: 'Cobranzas y planes de pago', sla_minutes: 120 },
      },
      frontend_contract: { toast: 'Gestion registrada' },
    });

    renderPage();

    await screen.findByText('Banco Demo');
    fireEvent.change(screen.getByLabelText('Comentario seguro'), {
      target: { value: 'Necesito pagar en 3 cuotas.' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Solicitar plan de pago/i }));

    await waitFor(() => {
      expect(sendFinanceActionMock).toHaveBeenCalledWith(
        expect.objectContaining({
          tenantSlug: 'banco-demo',
          flow: 'operacion',
          operationCode: 'OP-123',
          actionId: 'request_payment_plan',
          comment: 'Necesito pagar en 3 cuotas.',
          amount: '1500.75',
          currency: 'ARS',
        }),
      );
    });
    expect(await screen.findByText('Gestion registrada')).toBeInTheDocument();
    expect(screen.getByText('Ticket CRM #8842')).toBeInTheDocument();
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
