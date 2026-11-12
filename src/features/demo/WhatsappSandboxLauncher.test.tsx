import React from 'react';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
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
import { clearDemoWhatsappProfileSelection } from './demoStorage';

describe('WhatsappSandboxLauncher', () => {
  beforeEach(() => {
    getDemoWhatsappSandboxMock.mockReset();
    createDemoWhatsappSandboxMock.mockReset();
    clearDemoWhatsappProfileSelection();
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

  it('exposes the selected profile, primary WhatsApp link, and optional QR access', async () => {
    getDemoWhatsappSandboxMock.mockResolvedValue({
      contract_version: 'demo.whatsapp_sandbox_launcher.v1',
      requires_auth: false,
      session: {
        demo_session_id: 'demo-token',
        chat_session_id: 'sid_sandbox_mobile',
        max_messages: 10,
      },
      whatsapp_sandbox: {
        contract_version: 'demo.whatsapp_sandbox.v1',
        rubro_options: [
          { id: 'bodega', label: 'Bodega', rubro: 'bodega', description: 'Pedidos y catálogo' },
          { id: 'municipio', label: 'Municipio', rubro: 'municipio', description: 'Atención ciudadana' },
        ],
        sandbox: {
          display_number: '+54 9 261 000-0000',
          activation_message: 'Hola, quiero probar la demo',
          requires_join_phrase: false,
          wa_deeplink: 'https://wa.me/5492610000000',
          qr_url: 'https://example.com/demo-qr.png',
        },
        trial_policy: { max_messages: 10, free_inputs: ['text'] },
        scenario_scripts: [],
        catalog: {},
        surveys_votings: { enabled: false },
      },
    });

    render(<WhatsappSandboxLauncher initialSector="empresas" initialRubro="bodega" />);

    const profiles = await screen.findByRole('group', { name: 'Elegí un perfil' });
    expect(within(profiles).getByRole('button', { name: /Bodega/ }).getAttribute('aria-pressed')).toBe('true');
    expect(within(profiles).getByRole('button', { name: /Municipio/ }).getAttribute('aria-pressed')).toBe('false');

    const primaryLink = screen.getByRole('link', { name: 'Abrir WhatsApp directo' });
    expect(primaryLink.getAttribute('href')).toBe('https://wa.me/5492610000000');
    expect(primaryLink.getAttribute('target')).toBe('_blank');
    expect(primaryLink.getAttribute('rel')).toContain('noopener');
    expect(primaryLink.className).toContain('bg-[hsl(var(--primary-dark))]');
    expect(screen.getByText('Se abrirá WhatsApp con esta demo lista para probar.').className).toContain(
      'text-foreground/75',
    );
    expect(screen.getByText('Mostrar código QR')).toBeTruthy();
    expect(screen.getAllByAltText('Código QR para abrir la demo de WhatsApp')).toHaveLength(2);
  });

  it('prioritizes the requested rubro and updates selection after a successful change', async () => {
    const response = {
      contract_version: 'demo.whatsapp_sandbox_launcher.v1',
      requires_auth: false,
      session: {
        demo_session_id: 'demo-token',
        chat_session_id: 'sid_sandbox_selection',
        max_messages: 10,
      },
      whatsapp_sandbox: {
        contract_version: 'demo.whatsapp_sandbox.v1',
        rubro_options: [
          { id: 'comercio', label: 'Comercio', sector: 'empresas', rubro: 'comercio' },
          { id: 'bodega', label: 'Bodega', sector: 'empresas', rubro: 'bodega' },
        ],
        sandbox: {
          display_number: '+54 9 261 000-0000',
          activation_message: 'Hola, quiero probar la demo',
          requires_join_phrase: false,
          wa_deeplink: 'https://wa.me/5492610000000',
        },
        trial_policy: { max_messages: 10, free_inputs: ['text'] },
        scenario_scripts: [],
        catalog: {},
        surveys_votings: { enabled: false },
      },
    };
    getDemoWhatsappSandboxMock.mockResolvedValue(response);
    createDemoWhatsappSandboxMock.mockResolvedValue(response);

    render(<WhatsappSandboxLauncher initialSector="empresas" initialRubro="bodega" />);

    const profiles = await screen.findByRole('group', { name: 'Elegí un perfil' });
    const comercio = within(profiles).getByRole('button', { name: 'Comercio' });
    const bodega = within(profiles).getByRole('button', { name: 'Bodega' });
    expect(comercio.getAttribute('aria-pressed')).toBe('false');
    expect(bodega.getAttribute('aria-pressed')).toBe('true');

    fireEvent.click(comercio);
    await waitFor(() => expect(createDemoWhatsappSandboxMock).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(comercio.getAttribute('aria-pressed')).toBe('true'));
    expect(bodega.getAttribute('aria-pressed')).toBe('false');
  });

  it('preserves a successful user selection across a later GET refresh', async () => {
    const response = {
      contract_version: 'demo.whatsapp_sandbox_launcher.v1',
      requires_auth: false,
      session: {
        demo_session_id: 'demo-token',
        chat_session_id: 'sid_sandbox_race',
        max_messages: 10,
      },
      whatsapp_sandbox: {
        contract_version: 'demo.whatsapp_sandbox.v1',
        rubro_options: [
          { id: 'comercio', label: 'Comercio', sector: 'empresas', rubro: 'comercio' },
          { id: 'bodega', label: 'Bodega', sector: 'empresas', rubro: 'bodega' },
        ],
        sandbox: {
          requires_join_phrase: false,
          wa_deeplink: 'https://wa.me/5492610000000',
        },
        trial_policy: { max_messages: 10, free_inputs: ['text'] },
        scenario_scripts: [],
        catalog: {},
        surveys_votings: { enabled: false },
      },
    };
    let resolvePost!: (value: typeof response) => void;
    let resolveRefresh!: (value: typeof response) => void;
    const pendingPost = new Promise<typeof response>((resolve) => {
      resolvePost = resolve;
    });
    const pendingRefresh = new Promise<typeof response>((resolve) => {
      resolveRefresh = resolve;
    });
    getDemoWhatsappSandboxMock.mockResolvedValueOnce(response).mockImplementationOnce(() => pendingRefresh);
    createDemoWhatsappSandboxMock.mockImplementationOnce(() => pendingPost);

    const { rerender } = render(
      <WhatsappSandboxLauncher initialSector="empresas" initialRubro="bodega" initialTenantSlug="tenant-a" />,
    );
    const firstProfiles = await screen.findByRole('group', { name: 'Elegí un perfil' });
    fireEvent.click(within(firstProfiles).getByRole('button', { name: 'Comercio' }));
    await waitFor(() => expect(createDemoWhatsappSandboxMock).toHaveBeenCalledTimes(1));

    rerender(
      <WhatsappSandboxLauncher initialSector="empresas" initialRubro="bodega" initialTenantSlug="tenant-b" />,
    );
    await waitFor(() => expect(getDemoWhatsappSandboxMock).toHaveBeenCalledTimes(2));
    await act(async () => {
      resolvePost(response);
      await pendingPost;
      resolveRefresh(response);
      await pendingRefresh;
    });

    const refreshedProfiles = await screen.findByRole('group', { name: 'Elegí un perfil' });
    expect(within(refreshedProfiles).getByRole('button', { name: 'Comercio' }).getAttribute('aria-pressed')).toBe(
      'true',
    );
    expect(within(refreshedProfiles).getByRole('button', { name: 'Bodega' }).getAttribute('aria-pressed')).toBe(
      'false',
    );
  });

  it('synchronizes a successful selection across concurrently mounted launchers', async () => {
    const response = {
      contract_version: 'demo.whatsapp_sandbox_launcher.v1',
      requires_auth: false,
      session: { demo_session_id: 'demo-token', chat_session_id: 'sid_shared', max_messages: 10 },
      whatsapp_sandbox: {
        contract_version: 'demo.whatsapp_sandbox.v1',
        rubro_options: [
          { id: 'comercio', label: 'Comercio', sector: 'empresas', rubro: 'comercio' },
          { id: 'bodega', label: 'Bodega', sector: 'empresas', rubro: 'bodega' },
        ],
        sandbox: { requires_join_phrase: false, wa_deeplink: 'https://wa.me/5492610000000' },
        trial_policy: { max_messages: 10, free_inputs: ['text'] },
        scenario_scripts: [],
        catalog: {},
        surveys_votings: { enabled: false },
      },
    };
    getDemoWhatsappSandboxMock.mockResolvedValue(response);
    createDemoWhatsappSandboxMock.mockResolvedValue(response);

    render(
      <>
        <WhatsappSandboxLauncher initialSector="empresas" initialRubro="comercio" />
        <WhatsappSandboxLauncher initialSector="empresas" initialRubro="comercio" />
      </>,
    );

    const profileGroups = await screen.findAllByRole('group', { name: 'Elegí un perfil' });
    fireEvent.click(within(profileGroups[0]).getByRole('button', { name: 'Bodega' }));

    await waitFor(() => expect(createDemoWhatsappSandboxMock).toHaveBeenCalledTimes(1));
    await waitFor(() => {
      for (const group of profileGroups) {
        expect(within(group).getByRole('button', { name: 'Bodega' }).getAttribute('aria-pressed')).toBe('true');
      }
    });
  });
});
