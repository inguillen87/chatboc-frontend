import { describe, expect, it } from 'vitest';
import { normalizeDemoRubroTools } from './demoTools';
import type { DemoWorkspaceConfig } from './demoTypes';

describe('normalizeDemoRubroTools', () => {
  it('keeps backend-provided rubro tools without inventing unlabeled entries', () => {
    const workspace: DemoWorkspaceConfig = {
      rubro_tools: [
        {
          key: 'catalog',
          kind: 'catalog',
          label: 'Catalogo',
          enabled: true,
          description: 'Productos publicados por el tenant.',
          action_label: 'Ver catalogo',
          endpoint: '/api/public/tenants/ferreteria/catalog',
          fields: [{ label: 'Items', value: 24 }],
        },
        {
          key: 'missing-label',
          kind: 'faq',
          description: 'No debe renderizarse sin label backend.',
        },
      ],
    };

    const tools = normalizeDemoRubroTools(workspace);

    expect(tools).toHaveLength(1);
    expect(tools[0]).toMatchObject({
      id: 'catalog',
      kind: 'catalog',
      label: 'Catalogo',
      description: 'Productos publicados por el tenant.',
      actionLabel: 'Ver catalogo',
      endpoint: '/api/public/tenants/ferreteria/catalog',
      fields: [{ label: 'Items', value: '24' }],
    });
  });

  it('uses only backend-provided Google Maps URLs for locations', () => {
    const workspace: DemoWorkspaceConfig = {
      business_tools: [
        {
          key: 'location',
          kind: 'location',
          label: 'Sucursal',
          enabled: true,
          action_label: 'Abrir mapa',
          location: {
            lat: -34.585,
            lng: -60.943,
          },
        },
      ],
    };

    const [tool] = normalizeDemoRubroTools(workspace);

    expect(tool.actionHref).toBeUndefined();
  });

  it('keeps explicit backend maps_url without constructing a fallback', () => {
    const workspace: DemoWorkspaceConfig = {
      business_tools: [
        {
          key: 'location',
          kind: 'location',
          label: 'Sucursal',
          enabled: true,
          action_label: 'Abrir mapa',
          location: {
            lat: -34.585,
            lng: -60.943,
            maps_url: 'https://www.google.com/maps?q=sucursal-demo',
          },
        },
      ],
    };

    const [tool] = normalizeDemoRubroTools(workspace);

    expect(tool.actionHref).toBe('https://www.google.com/maps?q=sucursal-demo');
  });

  it('skips disabled tools and reads nested toolkit tools', () => {
    const workspace = {
      tools: [{ label: 'Lista de precios', kind: 'price_list', enabled: false }],
      toolkit: {
        tools: [{ label: 'Consultas frecuentes', kind: 'faq', enabled: true, status_label: 'Disponible' }],
      },
    } as DemoWorkspaceConfig;

    const tools = normalizeDemoRubroTools(workspace);

    expect(tools).toHaveLength(1);
    expect(tools[0]).toMatchObject({
      label: 'Consultas frecuentes',
      kind: 'faq',
      statusLabel: 'Disponible',
    });
  });

  it('reads backend demo.rubro_tools.v1 enabled tools and nested item links', () => {
    const workspace = {
      rubro_tools: {
        contract_version: 'demo.rubro_tools.v1',
        enabled_tools: [
          {
            id: 'location',
            kind: 'rubro_tool',
            label: 'Ubicacion',
            enabled: true,
            description: 'Direcciones con enlace operativo a Google Maps.',
            action_label: 'Abrir Google Maps',
            items: [
              {
                label: 'Sucursal centro',
                address: 'Av. San Martin 100',
                maps_url: 'https://www.google.com/maps/search/?api=1&query=Av.%20San%20Martin%20100',
              },
            ],
          },
        ],
      },
    } as DemoWorkspaceConfig;

    const tools = normalizeDemoRubroTools(workspace);

    expect(tools).toHaveLength(1);
    expect(tools[0]).toMatchObject({
      id: 'location',
      kind: 'location',
      label: 'Ubicacion',
      actionLabel: 'Abrir Google Maps',
      actionHref: 'https://www.google.com/maps/search/?api=1&query=Av.%20San%20Martin%20100',
    });
    expect(tools[0].fields).toContainEqual({ label: 'address', value: 'Av. San Martin 100' });
  });

  it('deduplicates tools mirrored in enabled_tools and tools while preserving backend order', () => {
    const primaryCatalog = {
      id: 'catalog',
      kind: 'rubro_tool',
      label: 'Catalogo',
      enabled: true,
      description: 'Recursos publicados para tramites.',
      action_label: 'Abrir catalogo',
      items: [{ url: '/api/v2/demo/catalogo.pdf' }],
      fields: [{ label: 'Recursos', value: 4 }],
    };
    const location = {
      id: 'location',
      kind: 'rubro_tool',
      label: 'Ubicacion',
      enabled: true,
      action_label: 'Consultar ubicacion',
      items: [{ maps_url: 'https://www.google.com/maps?q=junin' }],
      fields: [{ label: 'Ubicaciones', value: 1 }],
    };
    const workspace = {
      rubro_tools: {
        enabled_tools: [primaryCatalog, location],
        tools: [
          { ...primaryCatalog, description: 'Copia del contrato completo.' },
          { ...location },
        ],
      },
    } as DemoWorkspaceConfig;

    const tools = normalizeDemoRubroTools(workspace);

    expect(tools.map((tool) => tool.id)).toEqual(['catalog', 'location']);
    expect(tools[0].description).toBe('Recursos publicados para tramites.');
  });

  it('deduplicates equivalent tools across workspace sources without relying on ids', () => {
    const workspace = {
      business_tools: [
        {
          id: 'primary-location',
          kind: 'location',
          label: 'Ubicacion municipal',
          enabled: true,
          action_label: 'Abrir mapa',
          url: 'https://www.google.com/maps?q=junin',
          fields: [
            { label: 'Dirección', value: 'Av. San Martin 100' },
            { label: 'Sedes', value: 1 },
          ],
        },
      ],
      experience_blueprint: {
        operational_tools: [
          {
            id: 'mirrored-location',
            kind: 'location',
            label: '  UBICACION   MUNICIPAL ',
            enabled: true,
            action_label: 'Ver ubicacion',
            url: 'https://www.google.com/maps?q=junin',
            fields: [
              { label: 'sedes', value: 1 },
              { label: 'direccion', value: 'Av. San Martin 100' },
            ],
          },
        ],
      },
    } as DemoWorkspaceConfig;

    const tools = normalizeDemoRubroTools(workspace);

    expect(tools).toHaveLength(1);
    expect(tools[0]).toMatchObject({
      id: 'primary-location',
      label: 'Ubicacion municipal',
      actionLabel: 'Abrir mapa',
    });
  });

  it('keeps tools with the same label when their operational targets differ', () => {
    const workspace = {
      operational_tools: [
        {
          id: 'north-office',
          kind: 'location',
          label: 'Sede municipal',
          enabled: true,
          url: 'https://www.google.com/maps?q=sede-norte',
        },
        {
          id: 'south-office',
          kind: 'location',
          label: 'Sede municipal',
          enabled: true,
          url: 'https://www.google.com/maps?q=sede-sur',
        },
      ],
    } as DemoWorkspaceConfig;

    const tools = normalizeDemoRubroTools(workspace);

    expect(tools).toHaveLength(2);
    expect(tools.map((tool) => tool.id)).toEqual(['north-office', 'south-office']);
  });
});
