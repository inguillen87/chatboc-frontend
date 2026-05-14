import { beforeEach, describe, expect, it, vi } from 'vitest';

const { demoGetMock, demoPostMock } = vi.hoisted(() => ({
  demoGetMock: vi.fn(),
  demoPostMock: vi.fn(),
}));

vi.mock('@/api/v2/client', () => ({
  demoApi: {
    get: demoGetMock,
    post: demoPostMock,
  },
}));

vi.mock('@/data/demoCatalogAssets', () => ({
  findDemoCatalogAsset: vi.fn(() => null),
}));

import { createDemoWhatsappSandbox, getDemoAdminPreview, getDemoWhatsappSandbox } from './demoApi';

describe('demo WhatsApp sandbox API', () => {
  beforeEach(() => {
    demoGetMock.mockReset();
    demoPostMock.mockReset();
  });

  it('loads the no-login WhatsApp sandbox launcher from the backend contract', async () => {
    demoGetMock.mockResolvedValue({
      contract_version: 'demo.whatsapp_sandbox_launcher.v1',
      requires_auth: false,
      session: {
        demo_session_id: 'demo.jwt.token',
        chat_session_id: 'sid_get_123',
        max_messages: 10,
      },
      whatsapp_sandbox: {
        contract_version: 'demo.whatsapp_sandbox.v1',
        rubro_options: [{ label: 'Bodega', sector: 'empresas', rubro: 'bodega' }],
        sandbox: {
          display_number: '+1 (415) 523-8886',
          join_phrase: 'join demo-bodega',
          wa_deeplink: 'https://wa.me/14155238886',
          qr_url: 'https://example.com/qr.png',
        },
        trial_policy: {
          max_messages: 10,
          free_inputs: ['text', 'image', 'audio', 'location', 'file'],
        },
        scenario_scripts: [{ label: 'Pedido de vino', message: 'Quiero pedir 2 malbec' }],
        catalog: {},
        surveys_votings: {},
      },
    });

    const response = await getDemoWhatsappSandbox({
      sector: 'empresas',
      rubro: 'bodega',
      source: 'public_demo_profile',
    });

    expect(demoGetMock).toHaveBeenCalledWith(
      '/api/v2/demo/whatsapp-sandbox?sector=empresas&rubro=bodega&source=public_demo_profile',
      { baseUrlOverride: '/api' },
    );
    expect(response.requires_auth).toBe(false);
    expect(response.session?.chat_session_id).toBe('sid_get_123');
    expect(response.whatsapp_sandbox?.rubro_options).toHaveLength(1);
    expect(response.whatsapp_sandbox?.scenario_scripts).toHaveLength(1);
    expect(response.whatsapp_sandbox?.trial_policy?.max_messages).toBe(10);
  });

  it('posts sandbox selection without reusing a JWT as chat_session_id', async () => {
    const demoJwt = 'header.payload.signature';
    demoPostMock.mockResolvedValue({
      contract_version: 'demo.whatsapp_sandbox_launcher.v1',
      session: {
        demo_session_id: demoJwt,
        chat_session_id: demoJwt,
        session_id: 'sid_post_123',
        max_messages: '10',
      },
      whatsapp_sandbox: {
        contract_version: 'demo.whatsapp_sandbox.v1',
        sandbox: {},
      },
    });

    const payload = {
      sector: 'gobierno',
      rubro: 'municipio',
      tenant_slug: 'municipio',
      source: 'public_demo_profile',
    };
    const response = await createDemoWhatsappSandbox(payload);

    expect(demoPostMock).toHaveBeenCalledWith('/api/v2/demo/whatsapp-sandbox', payload, {
      baseUrlOverride: '/api',
    });
    expect(response.session?.demo_session_id).toBe(demoJwt);
    expect(response.session?.chat_session_id).toBe('sid_post_123');
    expect(response.whatsapp_sandbox?.rubro_options).toEqual([]);
    expect(response.whatsapp_sandbox?.scenario_scripts).toEqual([]);
  });
});

describe('demo admin preview API', () => {
  beforeEach(() => {
    demoGetMock.mockReset();
    demoPostMock.mockReset();
  });

  it('passes the same chat_session_id used by the runtime conversation', async () => {
    demoGetMock.mockResolvedValue({
      contract_version: 'demo.admin_preview.v1',
      cards: [],
      map: { enabled: false, points: [] },
    });

    await getDemoAdminPreview({
      sector: 'gobierno',
      tenant_slug: 'municipio',
      chat_session_id: 'sid_demo_gobierno_123',
    });

    expect(demoGetMock).toHaveBeenCalledWith(
      '/api/v2/demo/admin-preview?sector=gobierno&tenant_slug=municipio&chat_session_id=sid_demo_gobierno_123',
      { baseUrlOverride: '/api' },
    );
  });
});
