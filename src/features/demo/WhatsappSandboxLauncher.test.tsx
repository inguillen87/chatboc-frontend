import React from 'react';
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { getDemoWhatsappSandboxMock, createDemoWhatsappSandboxMock } = vi.hoisted(() => ({
  getDemoWhatsappSandboxMock: vi.fn(),
  createDemoWhatsappSandboxMock: vi.fn(),
}));

vi.mock('./demoApi', () => ({
  getDemoWhatsappSandbox: getDemoWhatsappSandboxMock,
  createDemoWhatsappSandbox: createDemoWhatsappSandboxMock,
}));

import WhatsappSandboxLauncher from './WhatsappSandboxLauncher';

describe('WhatsappSandboxLauncher', () => {
  beforeEach(() => {
    getDemoWhatsappSandboxMock.mockReset();
    createDemoWhatsappSandboxMock.mockReset();
  });

  it('renders a no-login direct WhatsApp launcher without a join phrase step', async () => {
    getDemoWhatsappSandboxMock.mockResolvedValue({
      contract_version: 'demo.whatsapp_sandbox_launcher.v1',
      requires_auth: false,
      session: {
        demo_session_id: 'demo-token',
        chat_session_id: 'sid_sandbox_direct',
        max_messages: 10,
      },
      whatsapp_sandbox: {
        contract_version: 'demo.whatsapp_sandbox.v1',
        rubro_options: [],
        sandbox: {
          display_number: '+54 9 261 000-0000',
          activation_message: 'Hola, quiero probar el pedido por WhatsApp',
          requires_join_phrase: false,
          wa_deeplink: 'https://wa.me/5492610000000',
        },
        trial_policy: {
          max_messages: 10,
          free_inputs: ['text', 'image', 'audio', 'location', 'file'],
        },
        scenario_scripts: [{ label: 'Pedido', message: 'Pedir 2 cajas' }],
        catalog: {},
        surveys_votings: { enabled: false },
      },
    });

    render(<WhatsappSandboxLauncher initialSector="empresas" initialRubro="bodega" />);

    expect(await screen.findByText('Abrir WhatsApp directo')).toBeTruthy();
    expect(screen.getByText('Mensaje inicial')).toBeTruthy();
    expect(screen.getByText('Hola, quiero probar el pedido por WhatsApp')).toBeTruthy();
    expect(screen.queryByText('Frase')).toBeNull();
    expect(screen.getByText('10')).toBeTruthy();
    expect(screen.getByText('Pedido')).toBeTruthy();
    expect(screen.queryByText('Catalogo')).toBeNull();
  });

  it('shows catalog and surveys only when the backend publishes those capabilities', async () => {
    getDemoWhatsappSandboxMock.mockResolvedValue({
      contract_version: 'demo.whatsapp_sandbox_launcher.v1',
      requires_auth: false,
      session: {
        demo_session_id: 'demo-token',
        chat_session_id: 'sid_sandbox_catalog',
        max_messages: 10,
      },
      whatsapp_sandbox: {
        contract_version: 'demo.whatsapp_sandbox.v1',
        rubro_options: [],
        sandbox: {
          display_number: '+1 (415) 523-8886',
          join_phrase: 'join demo',
          requires_join_phrase: true,
        },
        trial_policy: { max_messages: 10, free_inputs: ['text'] },
        scenario_scripts: [],
        catalog: {
          resources: [{ label: 'Catalogo vigente', url: 'https://example.com/catalogo.xlsx' }],
          pdf_excel_upload_demo: { enabled: true, label: 'Catalogo operativo' },
        },
        surveys_votings: {
          enabled: true,
          label: 'Encuestas activas',
          url: 'https://example.com/encuestas',
        },
      },
    });

    render(<WhatsappSandboxLauncher initialSector="gobierno" initialRubro="municipio" />);

    expect(await screen.findByText('Catalogo operativo')).toBeTruthy();
    expect(screen.getByText('Catalogo vigente')).toBeTruthy();
    expect(screen.getByText('Encuestas activas')).toBeTruthy();
    expect(screen.getByText('Frase')).toBeTruthy();
  });
});
