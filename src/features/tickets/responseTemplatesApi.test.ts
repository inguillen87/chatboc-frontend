import { beforeEach, describe, expect, it, vi } from 'vitest';

const apiMocks = vi.hoisted(() => ({
  apiFetch: vi.fn(),
}));

vi.mock('@/utils/api', () => ({
  apiFetch: apiMocks.apiFetch,
}));

import {
  hasUnresolvedTemplateVariables,
  listResponseTemplates,
  parseResponseTemplateTicketPreview,
  parseResponseTemplateList,
  previewResponseTemplateForTicket,
  suggestResponseTemplates,
} from './responseTemplatesApi';

const validTicketPreviewPayload = {
  contract_version: 'ai.template_ticket_preview.v1',
  tenant: { id: 4, slug: 'junin' },
  template: {
    id: 'template-9',
    name: 'Seguimiento',
    scope: 'tenant',
    readonly: false,
  },
  ticket: { id: 77, source_model: 'TenantTicket' },
  rendered_text: 'Hola Ana, tu ticket es CRM-77.',
  required_variables: ['nombre_usuario', 'nro_ticket'],
  resolved_variables: ['nombre_usuario', 'nro_ticket'],
  unresolved_variables: [],
  readiness: { ready_to_insert: true, server_rendered: true, blocker: null },
  rendering_policy: {
    content_type: 'text/plain',
    html_allowed: false,
    client_interpolation_allowed: false,
  },
  side_effects: {
    provider_calls_performed: false,
    messages_queued: 0,
    messages_sent: 0,
    records_written: 0,
  },
};

describe('responseTemplatesApi', () => {
  beforeEach(() => {
    apiMocks.apiFetch.mockReset();
  });

  it('parses only active templates with a consistent tenant scope', () => {
    expect(
      parseResponseTemplateList({
        plantillas: [
          {
            id: 10,
            tenant_id: 4,
            tenant_slug: 'junin',
            scope: 'tenant',
            name: '  Recepción  ',
            text: '  Recibimos tu solicitud.  ',
            keywords: [' reclamo ', 'reclamo', 123],
            is_active: true,
          },
          {
            id: 11,
            tenant_id: null,
            tenant_slug: null,
            scope: 'global',
            name: 'Base',
            text: 'Texto base',
            is_active: true,
          },
          {
            id: 12,
            tenant_id: 4,
            tenant_slug: 'junin',
            scope: 'tenant',
            name: 'Inactiva',
            text: 'No debe aparecer',
            is_active: false,
          },
          {
            id: 13,
            tenant_id: 4,
            tenant_slug: 'junin',
            scope: 'global',
            name: 'Scope incoherente',
            text: 'No debe aparecer',
          },
          { id: 14, tenant_id: 4, scope: 'tenant', name: '', text: 'Sin nombre' },
        ],
      }),
    ).toEqual([
      {
        id: '10',
        tenantId: 4,
        tenantSlug: 'junin',
        scope: 'tenant',
        name: 'Recepción',
        text: 'Recibimos tu solicitud.',
        keywords: ['reclamo'],
        isActive: true,
      },
      {
        id: '11',
        tenantId: null,
        tenantSlug: null,
        scope: 'global',
        name: 'Base',
        text: 'Texto base',
        keywords: [],
        isActive: true,
      },
    ]);
  });

  it('loads the list with an explicit tenant without mutating browser tenant state', async () => {
    apiMocks.apiFetch.mockResolvedValue({
      plantillas: [
        {
          id: 1,
          tenant_id: 7,
          tenant_slug: 'ushuaia',
          scope: 'tenant',
          name: 'Seguimiento',
          text: 'Estamos revisando el caso.',
          is_active: true,
        },
        {
          id: 2,
          tenant_id: 8,
          tenant_slug: 'otro-tenant',
          scope: 'tenant',
          name: 'Respuesta ajena',
          text: 'No debe cruzar la frontera del tenant.',
          is_active: true,
        },
      ],
    });

    await expect(listResponseTemplates('ushuaia')).resolves.toHaveLength(1);
    expect(apiMocks.apiFetch).toHaveBeenCalledWith('/api/ai/templates', {
      tenantSlug: 'ushuaia',
      persistTenantSlug: false,
    });
  });

  it('sends only classification metadata to contextual suggestions', async () => {
    apiMocks.apiFetch.mockResolvedValue({
      sugerencias: [
        {
          id_plantilla: '9',
          tenant_id: 4,
          tenant_slug: 'junin',
          scope: 'tenant',
          name: 'Alumbrado asignado',
          text: 'El caso fue asignado al equipo operativo.',
          score: 0.91,
        },
      ],
    });

    await expect(
      suggestResponseTemplates({
        tenantSlug: 'junin',
        metadata: {
          category: '  Alumbrado\n',
          status: 'en_proceso',
          channel: 'whatsapp',
        },
        topN: 99,
      }),
    ).resolves.toEqual([
      expect.objectContaining({
        id: '9',
        tenantId: 4,
        scope: 'tenant',
        score: 0.91,
      }),
    ]);

    expect(apiMocks.apiFetch).toHaveBeenCalledWith('/api/ai/suggest-templates', {
      method: 'POST',
      tenantSlug: 'junin',
      persistTenantSlug: false,
      body: {
        asunto: 'Categoría: Alumbrado',
        contexto_ticket: 'Estado: en_proceso | Canal: whatsapp',
        top_n: 5,
      },
    });
    expect(JSON.stringify(apiMocks.apiFetch.mock.calls[0][1])).not.toMatch(
      /description|descripcion|telefono|email|direccion|nombre/i,
    );
  });

  it('does not call the suggestion endpoint without usable metadata', async () => {
    await expect(
      suggestResponseTemplates({
        tenantSlug: 'junin',
        metadata: { category: '  ', status: null, channel: undefined },
      }),
    ).resolves.toEqual([]);
    expect(apiMocks.apiFetch).not.toHaveBeenCalled();
  });

  it('detects unresolved placeholders without attempting client-side interpolation', () => {
    expect(hasUnresolvedTemplateVariables('Hola {{nombre_cliente}}')).toBe(true);
    expect(hasUnresolvedTemplateVariables('Código ${ticket_id}')).toBe(true);
    expect(hasUnresolvedTemplateVariables('Caso {numero_reclamo}')).toBe(true);
    expect(hasUnresolvedTemplateVariables('Gracias por comunicarte.')).toBe(false);
  });

  it('requests and accepts only the tenant-bound server-rendered ticket preview', async () => {
    apiMocks.apiFetch.mockResolvedValue(validTicketPreviewPayload);

    await expect(
      previewResponseTemplateForTicket({
        tenantSlug: 'JUNIN',
        templateId: 'template-9',
        ticketId: '77',
        sourceModel: 'TenantTicket',
      }),
    ).resolves.toEqual({
      renderedText: 'Hola Ana, tu ticket es CRM-77.',
      templateId: 'template-9',
      ticketId: 77,
      sourceModel: 'TenantTicket',
    });

    expect(apiMocks.apiFetch).toHaveBeenCalledWith('/api/ai/templates/ticket-preview', {
      method: 'POST',
      tenantSlug: 'junin',
      persistTenantSlug: false,
      body: {
        template_id: 'template-9',
        ticket_id: 77,
        source_model: 'TenantTicket',
      },
    });
  });

  it.each([
    {
      label: 'contract version',
      payload: { ...validTicketPreviewPayload, contract_version: 'ai.template_ticket_preview.v0' },
    },
    {
      label: 'tenant binding',
      payload: { ...validTicketPreviewPayload, tenant: { id: 8, slug: 'otro-tenant' } },
    },
    {
      label: 'ticket binding',
      payload: { ...validTicketPreviewPayload, ticket: { id: 78, source_model: 'TenantTicket' } },
    },
    {
      label: 'server readiness',
      payload: {
        ...validTicketPreviewPayload,
        rendered_text: null,
        unresolved_variables: ['nombre_usuario'],
        readiness: {
          ready_to_insert: false,
          server_rendered: false,
          blocker: 'unresolved_variables',
        },
      },
    },
    {
      label: 'unresolved rendered text',
      payload: { ...validTicketPreviewPayload, rendered_text: 'Hola {nombre_usuario}' },
    },
    {
      label: 'resolved variable accounting',
      payload: { ...validTicketPreviewPayload, resolved_variables: ['nro_ticket'] },
    },
    {
      label: 'side effects',
      payload: {
        ...validTicketPreviewPayload,
        side_effects: { ...validTicketPreviewPayload.side_effects, messages_sent: 1 },
      },
    },
  ])('fails closed when preview $label is inconsistent', ({ payload }) => {
    expect(() =>
      parseResponseTemplateTicketPreview({
        payload,
        tenantSlug: 'junin',
        templateId: 'template-9',
        ticketId: 77,
        sourceModel: 'TenantTicket',
      }),
    ).toThrow(/contrato seguro esperado/i);
  });

  it('rejects invalid preview identifiers before making a request', async () => {
    await expect(
      previewResponseTemplateForTicket({
        tenantSlug: '../otro',
        templateId: 'template-9',
        ticketId: 77,
        sourceModel: 'TenantTicket',
      }),
    ).rejects.toThrow(/contrato seguro esperado/i);
    expect(apiMocks.apiFetch).not.toHaveBeenCalled();
  });
});
