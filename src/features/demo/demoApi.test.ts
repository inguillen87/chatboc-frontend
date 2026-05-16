import { beforeEach, describe, expect, it, vi } from 'vitest';

const { demoGetMock, demoPostMock, findDemoCatalogAssetMock } = vi.hoisted(() => ({
  demoGetMock: vi.fn(),
  demoPostMock: vi.fn(),
  findDemoCatalogAssetMock: vi.fn(() => null),
}));

vi.mock('@/api/v2/client', () => ({
  demoApi: {
    get: demoGetMock,
    post: demoPostMock,
  },
}));

vi.mock('@/data/demoCatalogAssets', () => ({
  findDemoCatalogAsset: findDemoCatalogAssetMock,
}));

import { safeLocalStorage } from '@/utils/safeLocalStorage';
import { createDemoSession, createDemoWhatsappSandbox, getDemoAdminPreview, getDemoWhatsappSandbox } from './demoApi';
import {
  DEMO_CHAT_SESSION_STORAGE_KEY,
  DEMO_SESSION_STORAGE_KEY,
  DEMO_TENANT_STORAGE_KEY,
} from './demoStorage';

describe('demo session API', () => {
  beforeEach(() => {
    demoGetMock.mockReset();
    demoPostMock.mockReset();
    findDemoCatalogAssetMock.mockReset();
    findDemoCatalogAssetMock.mockReturnValue(null);
    safeLocalStorage.clear();
  });

  it('persists demo tenant/session under demo-only keys without overwriting real tenant context', async () => {
    safeLocalStorage.setItem('tenantSlug', 'colegio-pago');
    demoPostMock.mockResolvedValue({
      contract_version: 'demo.session.v2',
      demo_session_id: 'demo-token-123',
      chat_session_id: 'sid_demo_municipio_123',
      tenant_slug: 'municipio',
      tenant: { slug: 'municipio', tipo: 'municipio' },
      workspace: {
        chat_bootstrap: {
          endpoint: '/api/ask/municipio',
          payload: {
            vertical: 'gobierno',
            tenant_slug: 'municipio',
          },
        },
      },
    });

    const response = await createDemoSession({ sector: 'gobierno', tenant_slug: 'municipio' });

    expect(response.tenant_slug).toBe('municipio');
    expect(safeLocalStorage.getItem(DEMO_SESSION_STORAGE_KEY)).toBe('demo-token-123');
    expect(safeLocalStorage.getItem(DEMO_CHAT_SESSION_STORAGE_KEY)).toBe('sid_demo_municipio_123');
    expect(safeLocalStorage.getItem(DEMO_TENANT_STORAGE_KEY)).toBe('municipio');
    expect(safeLocalStorage.getItem('tenantSlug')).toBe('colegio-pago');
    expect(safeLocalStorage.getItem('chat_session_id')).toBeNull();
    expect(safeLocalStorage.getItem('chatboc_chat_session_id')).toBeNull();
  });

  it('accepts backend-canonicalized demo tenants when sector and rubro match the selector', async () => {
    findDemoCatalogAssetMock.mockImplementation((key: unknown) =>
      String(key) === 'catalogo_demo_colegios' ? { sector: 'educacion' } : null,
    );
    demoPostMock.mockResolvedValue({
      contract_version: 'demo.session.v2',
      demo_session_id: 'demo-token-edu',
      chat_session_id: 'sid_demo_educacion_123',
      tenant_slug: 'qa-colegio-sandbox',
      tenant: { slug: 'qa-colegio-sandbox', tipo: 'pyme' },
      workspace: {
        catalog_resources: [{ id: 'catalogo_demo_colegios' }],
        chat_bootstrap: {
          endpoint: '/api/ask/pyme',
          payload: {
            vertical: 'educacion',
            rubro: 'colegios',
            tenant_slug: 'qa-colegio-sandbox',
          },
        },
      },
    });

    const response = await createDemoSession({
      sector: 'educacion',
      tenant_slug: 'colegio-demo',
      rubro: 'colegios',
    });

    expect(response.tenant_slug).toBe('qa-colegio-sandbox');
    expect(safeLocalStorage.getItem(DEMO_SESSION_STORAGE_KEY)).toBe('demo-token-edu');
    expect(safeLocalStorage.getItem(DEMO_CHAT_SESSION_STORAGE_KEY)).toBe('sid_demo_educacion_123');
    expect(safeLocalStorage.getItem(DEMO_TENANT_STORAGE_KEY)).toBe('qa-colegio-sandbox');
  });

  it('accepts compact widget selector sessions without reusing a previous tenant', async () => {
    safeLocalStorage.setItem('tenantSlug', 'junin-1');
    demoPostMock.mockResolvedValue({
      contract_version: 'demo.session.v2',
      ok: true,
      ready: true,
      status: 'ready',
      response_profile: 'widget_compact',
      demo_session_id: 'demo-widget-token',
      chat_session_id: 'sid_widget_gob_1',
      session: {
        demo_session_id: 'demo-widget-token',
        chat_session_id: 'sid_widget_gob_1',
        tenant_slug: 'municipio',
        sector: 'gobierno',
        rubro: 'municipio',
      },
      workspace: {
        chat_bootstrap: {
          same_origin_endpoint: '/api/ask/municipio',
          headers: {},
          payload: { vertical: 'gobierno' },
        },
      },
      widget_onboarding: {
        status: 'ready',
        open_chat: true,
        close_selector: true,
        send_init_once: true,
      },
    });

    const response = await createDemoSession(
      {
        surface: 'widget',
        source: 'landing_widget_selector',
        sector: 'gobierno',
        label: 'Gobiernos',
        anon_id: 'anon-1',
      },
      { strictSelection: false },
    );

    expect(demoPostMock).toHaveBeenCalledWith(
      '/api/v2/demo/session',
      {
        surface: 'widget',
        source: 'landing_widget_selector',
        sector: 'gobierno',
        label: 'Gobiernos',
        anon_id: 'anon-1',
      },
      { baseUrlOverride: '/api' },
    );
    expect(response.chat_session_id).toBe('sid_widget_gob_1');
    expect(response.session?.tenant_slug).toBe('municipio');
    expect(response.workspace?.chat_bootstrap?.headers?.['X-Chat-Session-Id']).toBe('sid_widget_gob_1');
    expect(response.workspace?.chat_bootstrap?.headers?.['X-Demo-Session-Id']).toBe('demo-widget-token');
    expect(response.workspace?.chat_bootstrap?.payload?.tenant_slug).toBe('municipio');
    expect(safeLocalStorage.getItem(DEMO_SESSION_STORAGE_KEY)).toBe('demo-widget-token');
    expect(safeLocalStorage.getItem(DEMO_CHAT_SESSION_STORAGE_KEY)).toBe('sid_widget_gob_1');
    expect(safeLocalStorage.getItem(DEMO_TENANT_STORAGE_KEY)).toBe('municipio');
    expect(safeLocalStorage.getItem('tenantSlug')).toBe('junin-1');
  });

  it('treats empresas without rubro as a valid rubro selection step', async () => {
    demoPostMock.mockResolvedValue({
      contract_version: 'demo.session.v2',
      ok: true,
      ready: true,
      status: 'ready',
      next_step: 'select_rubro',
      requires_rubro_selection: true,
      workspace: {
        rubro_selector: {
          contract_version: 'demo.rubro_selector.v1',
          render_as: 'rubro_selector',
          sector: 'empresas',
          categories: [
            { slug: 'bodega', label: 'Bodega' },
            { slug: 'ferreteria', label: 'Ferreteria' },
          ],
        },
      },
      widget_onboarding: {
        status: 'select_rubro',
        open_chat: false,
        close_selector: false,
        send_init_once: false,
      },
      frontend_contract: {
        render_as: 'demo_rubro_selector',
        next_step: 'select_rubro',
        rubro_selector_path: 'workspace.rubro_selector',
      },
    });

    const response = await createDemoSession(
      {
        surface: 'widget',
        source: 'landing_widget_selector',
        sector: 'empresas',
        label: 'Empresas',
      },
      { strictSelection: false },
    );

    expect(response.requires_rubro_selection).toBe(true);
    expect(response.workspace?.rubro_selector?.categories).toHaveLength(2);
    expect(response.workspace?.chat_bootstrap).toBeNull();
    expect(safeLocalStorage.getItem(DEMO_SESSION_STORAGE_KEY)).toBeNull();
    expect(safeLocalStorage.getItem(DEMO_CHAT_SESSION_STORAGE_KEY)).toBeNull();
    expect(safeLocalStorage.getItem(DEMO_TENANT_STORAGE_KEY)).toBeNull();
  });

  it('preserves rubro context and backend default menu for explicit empresa rubro sessions', async () => {
    demoPostMock.mockResolvedValue({
      contract_version: 'demo.session.v2',
      ok: true,
      ready: true,
      status: 'ready',
      demo_session_id: 'demo-bodega-token',
      chat_session_id: 'sid_widget_bodega_1',
      session: {
        demo_session_id: 'demo-bodega-token',
        chat_session_id: 'sid_widget_bodega_1',
        tenant_slug: 'bodega',
        sector: 'empresas',
        rubro: 'bodega',
      },
      workspace: {
        rubro_context: { slug: 'bodega', label: 'Bodega' },
        default_menu: {
          contract_version: 'demo.default_menu.v1',
          render_as: 'quick_menu',
          items: [{ id: 'catalogo_vinos', label: 'Catalogo de vinos', intent: 'ver_catalogo' }],
        },
        chat_bootstrap: {
          same_origin_endpoint: '/api/ask/pyme',
          payload: {
            vertical: 'empresas',
            rubro: 'bodega',
            tenant_slug: 'bodega',
            demo_metadata: {
              rubro: 'bodega',
            },
          },
          default_menu: {
            items: [{ id: 'pedido', label: 'Hacer pedido', intent: 'crear_pedido' }],
          },
        },
      },
    });

    const response = await createDemoSession(
      {
        surface: 'widget',
        source: 'landing_widget_rubro_selector',
        sector: 'empresas',
        rubro: 'bodega',
        label: 'Bodega',
      },
      { strictSelection: false },
    );

    expect(demoPostMock).toHaveBeenCalledWith(
      '/api/v2/demo/session',
      {
        surface: 'widget',
        source: 'landing_widget_rubro_selector',
        sector: 'empresas',
        rubro: 'bodega',
        label: 'Bodega',
      },
      { baseUrlOverride: '/api' },
    );
    expect(response.workspace?.rubro_context?.slug).toBe('bodega');
    expect((response.workspace?.default_menu as any)?.items?.[0]?.intent).toBe('ver_catalogo');
    expect((response.workspace?.chat_bootstrap?.default_menu as any)?.items?.[0]?.intent).toBe('crear_pedido');
    expect(response.workspace?.chat_bootstrap?.payload?.rubro).toBe('bodega');
    expect(response.workspace?.chat_bootstrap?.headers?.['X-Chat-Session-Id']).toBe('sid_widget_bodega_1');
    expect(response.workspace?.chat_bootstrap?.headers?.['X-Demo-Session-Id']).toBe('demo-bodega-token');
  });

  it('rejects demo sessions that do not provide a usable chat bootstrap', async () => {
    demoPostMock.mockResolvedValue({
      contract_version: 'demo.session.v2',
      ok: true,
      session: {
        chat_session_id: 'sid_without_bootstrap',
      },
      workspace: {},
    });

    await expect(
      createDemoSession(
        {
          surface: 'widget',
          source: 'landing_widget_selector',
          sector: 'gobierno',
          label: 'Gobiernos',
        },
        { strictSelection: false },
      ),
    ).rejects.toThrow('sesion de chat utilizable');
  });
});

describe('demo WhatsApp sandbox API', () => {
  beforeEach(() => {
    demoGetMock.mockReset();
    demoPostMock.mockReset();
    safeLocalStorage.clear();
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
