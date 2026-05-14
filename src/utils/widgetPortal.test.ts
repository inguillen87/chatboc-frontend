import { describe, expect, it } from 'vitest';

import {
  buildPortalContentFromWidgetHistory,
  normalizeWidgetClaims,
  normalizeWidgetOrders,
} from './widgetPortal';

describe('widgetPortal public contract normalizers', () => {
  it('renders municipal claim data only from backend-provided fields', () => {
    const claims = normalizeWidgetClaims({
      claims: {
        items: [
          {
            id: 12,
            nro_ticket: 'MUN-12',
            categoria: 'Alumbrado',
            direccion: 'Av. San Martin 123',
            latitud: -34.61,
            longitud: -58.44,
            canal_ingreso: 'whatsapp',
            foto_url_directa: 'https://cdn.example/foto.jpg',
            detail_endpoint: '/api/v2/inbox/omnichannel/12',
            events: [{ id: 'ev1', label: 'Recibido', at: '2026-05-14T00:00:00Z' }],
          },
        ],
      },
    });

    expect(claims).toHaveLength(1);
    expect(claims[0]).toMatchObject({
      nroTicket: 'MUN-12',
      category: 'Alumbrado',
      address: 'Av. San Martin 123',
      lat: -34.61,
      lng: -58.44,
      channel: 'whatsapp',
      detailEndpoint: '/api/v2/inbox/omnichannel/12',
    });
    expect(claims[0].attachments[0]).toMatchObject({
      url: 'https://cdn.example/foto.jpg',
      kind: 'image',
    });
    expect(claims[0].timeline[0].label).toBe('Recibido');
  });

  it('does not invent location, attachments or timeline when a claim does not provide them', () => {
    const claims = normalizeWidgetClaims({
      claims: {
        items: [{ id: 'claim-1', categoria: 'Consulta', estado: 'pendiente' }],
      },
    });

    expect(claims).toHaveLength(1);
    expect(claims[0].lat).toBeUndefined();
    expect(claims[0].lng).toBeUndefined();
    expect(claims[0].attachments).toEqual([]);
    expect(claims[0].timeline).toEqual([]);
  });

  it('normalizes pyme orders from detalles without parsing message text', () => {
    const orders = normalizeWidgetOrders({
      orders: {
        items: [
          {
            nro_pedido: 'PED-44',
            nombre_cliente: 'QA Bodega',
            telefono_cliente: '+549261000000',
            monto_total: 35000,
            detalles: [
              { sku: 'MALBEC', cantidad: 2, precio: 12000 },
              { sku: 'CABERNET', cantidad: 1, precio: 11000 },
            ],
          },
        ],
      },
    });

    expect(orders).toHaveLength(1);
    expect(orders[0]).toMatchObject({
      nroPedido: 'PED-44',
      customerName: 'QA Bodega',
      customerPhone: '+549261000000',
      amountTotal: 35000,
      trackingUrl: '/tracking/order/PED-44',
    });
    expect(orders[0].items).toEqual([
      { id: 'MALBEC', name: 'MALBEC', quantity: 2, price: 12000 },
      { id: 'CABERNET', name: 'CABERNET', quantity: 1, price: 11000 },
    ]);
  });

  it('does not publish participation metrics when backend only sends a points balance', () => {
    const content = buildPortalContentFromWidgetHistory(
      { summary: { points: 1200 } },
      null,
    );

    expect(content.loyaltySummary?.points).toBe(1200);
    expect(content.loyaltySummary?.hasParticipationMetrics).toBe(false);
  });

  it('marks participation metrics as renderable only when backend sends those values', () => {
    const content = buildPortalContentFromWidgetHistory(
      { summary: { points: 1200, surveys_completed: 3, claims_filed: 2 } },
      null,
    );

    expect(content.loyaltySummary?.hasParticipationMetrics).toBe(true);
    expect(content.loyaltySummary?.surveysCompleted).toBe(3);
    expect(content.loyaltySummary?.claimsFiled).toBe(2);
  });
});
