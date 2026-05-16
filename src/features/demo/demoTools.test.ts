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

  it('builds a Google Maps URL only from backend location data', () => {
    const workspace: DemoWorkspaceConfig = {
      business_tools: [
        {
          key: 'location',
          kind: 'location',
          label: 'Sucursal',
          action_label: 'Abrir mapa',
          location: {
            lat: -34.585,
            lng: -60.943,
          },
        },
      ],
    };

    const [tool] = normalizeDemoRubroTools(workspace);

    expect(tool.actionHref).toBe(
      'https://www.google.com/maps/search/?api=1&query=-34.585%2C-60.943',
    );
  });

  it('skips disabled tools and reads nested toolkit tools', () => {
    const workspace = {
      tools: [{ label: 'Lista de precios', kind: 'price_list', enabled: false }],
      toolkit: {
        tools: [{ label: 'Consultas frecuentes', kind: 'faq', status_label: 'Disponible' }],
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
});
