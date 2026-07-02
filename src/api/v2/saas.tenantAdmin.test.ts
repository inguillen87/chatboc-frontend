import { describe, expect, it } from "vitest";
import {
  normalizeCatalogQualityV2,
  normalizeEmployeeCoverageV2,
  normalizeEmployeeRoutingV2,
  normalizeOmnichannelInboxActionV2,
  normalizeOmnichannelInboxDetailV2,
  normalizeProductionSmokeV2,
  normalizeTenantAdminExperienceV2,
} from "./saas";

describe("tenant admin v2 contracts", () => {
  it("normalizes E2E webview readiness from tenant admin experience", () => {
    const normalized = normalizeTenantAdminExperienceV2({
      contract_version: "tenant.admin_experience.v1",
      tenant: { slug: "junin" },
      profile: { display_name: "Junin" },
      modules: [{ id: "widget_whatsapp", label: "Widget/WhatsApp/Voz" }],
      operations: {},
      lead_capture: {},
      surveys_votings: {},
      marketplace: {},
      whatsapp: {},
      education: {},
      health: {},
      e2e_flow_readiness: {
        contract_version: "platform.e2e_flow_readiness.v1",
        status: "needs_attention",
        summary: { total: 2, ready: 1, webview_flows: 4 },
        flows: [
          {
            id: "pyme_catalog_order_checkout",
            label: "Pyme: catalogo, carrito, pedido y checkout",
            ready: false,
            status: "needs_attention",
            endpoint: "/api/v2/catalog/quality",
            frontend_entry: "/t/junin/market",
            meta_flow_ready: false,
            evidence: { products: 0 },
            manual_test_steps: ["Abrir marketplace"],
            acceptance_criteria: ["El pedido llega al CRM"],
            automation: { safe_by_default: true },
          },
        ],
        frontend_contract: { render_as: "e2e_flow_readiness_grid" },
      },
      frontend_contract: { render_as: "tenant_admin_operating_system" },
    });

    expect(normalized.e2e_flow_readiness?.contract_version).toBe("platform.e2e_flow_readiness.v1");
    expect(normalized.e2e_flow_readiness?.summary.webview_flows).toBe(4);
    expect(normalized.e2e_flow_readiness?.flows[0]).toMatchObject({
      id: "pyme_catalog_order_checkout",
      frontend_entry: "/t/junin/market",
      meta_flow_ready: false,
      manual_test_steps: ["Abrir marketplace"],
    });
  });

  it("normalizes catalog quality queues and import hints", () => {
    const normalized = normalizeCatalogQualityV2({
      contract_version: "catalog.quality.v1",
      summary: {
        products: 120,
        missing_images: 14,
        products_without_image: 14,
        ready_rate: 81.67,
      },
      queues: {
        missing_images: [
          {
            item_id: 10,
            nombre: "Pack escolar",
            imagen_url: "",
            precio: "12500",
            cantidad: "24",
            gallery_urls: ["https://cdn.test/a.webp"],
          },
        ],
      },
      imports: {
        latest: [{ id: "imp_1" }],
        accepted_file_types: ["csv", "xlsx", "pdf"],
        image_columns: ["imagen_url", "foto"],
      },
      frontend_contract: {
        render_as: "catalog_quality_command_center",
        queue_tabs: ["missing_images"],
      },
    });

    expect(normalized.contract_version).toBe("catalog.quality.v1");
    expect(normalized.summary.products).toBe(120);
    expect(normalized.queues.missing_images[0].item_id).toBe(10);
    expect(normalized.queues.missing_images[0].name).toBe("Pack escolar");
    expect(normalized.imports.accepted_file_types).toContain("pdf");
    expect(normalized.imports.image_columns).toContain("imagen_url");
  });

  it("normalizes employee routing matrix and recommendations", () => {
    const normalized = normalizeEmployeeRoutingV2({
      contract_version: "employee.routing.v1",
      routing_policy: {
        source: "user.accesibilidad.employee_scope",
      },
      dimensions: {
        categorias: ["educacion", "alumbrado"],
        zonas: ["centro"],
        channels: ["whatsapp", "widget"],
      },
      employees: [
        {
          id: 10,
          name: "Mesa de entrada",
          scope: {
            categorias: ["educacion"],
            zonas: ["centro"],
            channels: ["whatsapp"],
            permisos: ["tickets_assign"],
          },
          workload_open: 2,
        },
      ],
      queues: {
        unassigned: [{ id: 123, channel: "whatsapp" }],
        unassigned_count: 1,
      },
      recommendations: [
        {
          ticket: { source_model: "TenantTicket", id: 123 },
          suggested_assignee: { id: 10, name: "Mesa de entrada" },
          score: 96,
          reasons: ["category_match", "zone_match"],
        },
      ],
      frontend_contract: {
        render_as: "employee_routing_matrix",
      },
    });

    expect(normalized.contract_version).toBe("employee.routing.v1");
    expect(normalized.dimensions.channels).toEqual(["whatsapp", "widget"]);
    expect(normalized.employees[0].scope.permisos).toEqual(["tickets_assign"]);
    expect(normalized.queues.unassigned_count).toBe(1);
    expect(normalized.recommendations[0].score).toBe(96);
    expect(normalized.recommendations[0].reasons).toContain("zone_match");
  });

  it("normalizes employee coverage permissions separately from channels", () => {
    const normalized = normalizeEmployeeCoverageV2({
      contract_version: "employee.coverage.v1",
      coverage: {
        categories: [{ id: "alumbrado", label: "Alumbrado", count: 0 }],
        zones: ["centro"],
        channels: ["whatsapp"],
        permisos: ["tickets_read", "tickets_assign"],
      },
      employees: [
        {
          id: 10,
          name: "Mesa de entrada",
          scope: {
            categorias: ["alumbrado"],
            zonas: ["centro"],
            channels: ["whatsapp"],
            permisos: ["tickets_read"],
          },
          workload: 2,
        },
      ],
    });

    expect(normalized.contract_version).toBe("employee.coverage.v1");
    expect(normalized.categories[0].label).toBe("Alumbrado");
    expect(normalized.channels[0].id).toBe("whatsapp");
    expect(normalized.permisos.map((item) => item.id)).toEqual(["tickets_read", "tickets_assign"]);
    expect(normalized.permisos.map((item) => item.id)).not.toEqual(normalized.channels.map((item) => item.id));
  });

  it("normalizes inbox 360 detail fields", () => {
    const normalized = normalizeOmnichannelInboxDetailV2({
      contract_version: "inbox.omnichannel.detail.v1",
      item: {
        id: 123,
        ticket_id: 123,
        detail_endpoint: "/api/v2/inbox/omnichannel/123",
        title: "Consulta por beca",
        description: "Detalle del ticket",
        status: "nuevo",
        priority: "high",
        channel: "whatsapp",
        intent: "consulta_beca",
        assignee: { id: 10, name: "Mesa de entrada" },
        map: { can_render: true },
        location: { lat: -34.6, lng: -58.4 },
        attachments: [{ id: "att_1", name: "certificado.pdf" }],
        sla: { status: "ok", overdue: false },
        allowed_actions: [{ id: "reply", label: "Responder" }],
        source_metadata: { widget_id: "landing-widget" },
        frontend_contract: { render_as: "inbox_360_drawer" },
      },
    });

    expect(normalized.contract_version).toBe("inbox.omnichannel.detail.v1");
    expect(normalized.item.ticket_id).toBe("123");
    expect(normalized.item.detail_endpoint).toBe("/api/v2/inbox/omnichannel/123");
    expect(normalized.item.allowed_actions[0].id).toBe("reply");
    expect(normalized.item.attachments[0].name).toBe("certificado.pdf");
    expect(normalized.item.frontend_contract?.render_as).toBe("inbox_360_drawer");
  });

  it("preserves legacy claim action endpoints and payload defaults", () => {
    const normalized = normalizeOmnichannelInboxDetailV2({
      contract_version: "inbox.omnichannel.detail.v1",
      item: {
        id: "municipio:378430",
        legacy_id: 378430,
        ticket_id: 378430,
        source_model: "MunicipioTicket",
        title: "Arreglo de calle",
        status: "nuevo",
        allowed_actions: [
          {
            id: "reply",
            label: "Responder",
            method: "POST",
            endpoint: "/api/v2/inbox/omnichannel/actions",
            requires: ["body"],
            payload_defaults: {
              source_model: "MunicipioTicket",
              legacy_id: 378430,
              ticket_id: 378430,
            },
          },
          {
            id: "open_tracking",
            label: "Ver seguimiento publico",
            method: "GET",
            endpoint: "/api/public/tracking/experience?kind=claim&code=378430&pin=900144",
          },
        ],
      },
    });

    const reply = normalized.item.allowed_actions.find((action) => action.id === "reply");
    expect(normalized.item.source_model).toBe("MunicipioTicket");
    expect(normalized.item.legacy_id).toBe("378430");
    expect(reply).toMatchObject({
      endpoint: "/api/v2/inbox/omnichannel/actions",
      payload: {
        source_model: "MunicipioTicket",
        legacy_id: 378430,
      },
      payload_defaults: {
        ticket_id: 378430,
      },
    });
    expect(normalized.item.allowed_actions.find((action) => action.id === "open_tracking")?.href).toContain(
      "/api/public/tracking/experience",
    );
  });

  it("normalizes inbox action delivery so the CRM composer can distinguish real sends from timeline notes", () => {
    const normalized = normalizeOmnichannelInboxActionV2({
      contract_version: "inbox.omnichannel.action.v1",
      request_id: "reply-1",
      action: "reply",
      delivery: {
        contract_version: "inbox.action_delivery.v1",
        mode: "timeline_only",
        channel: "whatsapp",
        status: "saved_to_crm",
        reason: "external_dispatch_not_configured_for_omnichannel_action",
        external_dispatch: false,
        timeline_updated: true,
        reply_status: "saved_to_timeline",
        admin_surface: "tenant_claims_inbox",
        operator_message: "Guardado en el CRM. No se envio por WhatsApp.",
      },
      ticket: {
        id: "municipio:378430",
        ticket_id: 378430,
        source_model: "MunicipioTicket",
        title: "Arreglo de calle",
        status: "en_proceso",
      },
    });

    expect(normalized.contract_version).toBe("inbox.omnichannel.action.v1");
    expect(normalized.ticket.id).toBe("municipio:378430");
    expect(normalized.delivery).toMatchObject({
      contract_version: "inbox.action_delivery.v1",
      mode: "timeline_only",
      channel: "whatsapp",
      status: "saved_to_crm",
      external_dispatch: false,
      timeline_updated: true,
      reply_status: "saved_to_timeline",
    });
  });

  it("normalizes real WhatsApp ticket fields for evidence and maps", () => {
    const normalized = normalizeOmnichannelInboxDetailV2({
      contract_version: "inbox.omnichannel.detail.v1",
      item: {
        id: 31735,
        nro_ticket: "M-31735",
        status: "nuevo",
        categoria: "Semaforo",
        canal_ingreso: "whatsapp",
        direccion: "Av. San Martin y Rivadavia",
        latitud: "-34.6083",
        longitud: "-58.3712",
        nombre_vecino: "QA Vecino",
        telefono_vecino: "2610000000",
        foto_url_directa: "https://cdn.example.com/foto.jpg",
        archivos: [{ archivo_adjunto_id: 9, url: "https://cdn.example.com/foto.jpg" }],
      },
    });

    expect(normalized.item.nro_ticket).toBe("M-31735");
    expect(normalized.item.channel).toBe("whatsapp");
    expect(normalized.item.contact).toMatchObject({
      name: "QA Vecino",
      phone: "2610000000",
    });
    expect(normalized.item.location).toMatchObject({
      lat: -34.6083,
      lng: -58.3712,
      direccion: "Av. San Martin y Rivadavia",
    });
    expect(normalized.item.foto_url_directa).toBe("https://cdn.example.com/foto.jpg");
    expect(normalized.item.archivos_count).toBe(1);
    expect(normalized.item.attachments[0]).toMatchObject({
      archivo_adjunto_id: 9,
      url: "https://cdn.example.com/foto.jpg",
    });
  });

  it("preserves consented avatar metadata for contacts and live presence", () => {
    const normalized = normalizeOmnichannelInboxDetailV2({
      contract_version: "inbox.omnichannel.detail.v1",
      item: {
        id: "conv-1",
        title: "Consulta de vecino",
        status: "nuevo",
        contact: {
          name: "Marcelo",
          avatar_url: "https://cdn.example.com/profile/marcelo.webp",
          avatar_source: "profile_upload",
          avatar_consent: true,
        },
        presence: [
          {
            viewer_id: "viewer-1",
            viewer_name: "Marcelo",
            role: "user",
            state: "active",
            avatar_url: "https://cdn.example.com/profile/marcelo.webp",
            avatar_source: "profile_upload",
            avatar_consent: true,
          },
        ],
      },
    });

    expect(normalized.item.contact).toMatchObject({
      avatarUrl: "https://cdn.example.com/profile/marcelo.webp",
      avatar_source: "profile_upload",
      avatar_consent: true,
    });
    expect(normalized.item.presence[0]).toMatchObject({
      id: "viewer-1",
      name: "Marcelo",
      type: "user",
      status: "online",
      avatarUrl: "https://cdn.example.com/profile/marcelo.webp",
      avatarSource: "profile_upload",
      avatarConsent: true,
    });
  });

  it("normalizes production smoke report", () => {
    const normalized = normalizeProductionSmokeV2({
      contract_version: "platform.production_smoke.v1",
      status: "warning",
      summary: {
        total: 2,
        passed: 1,
        failed: 1,
        critical_failed: 0,
      },
      checks: [
        { id: "widget_platform_onboarding", ok: true, status: "pass", endpoint: "/api/public/widget-config" },
        { id: "inbox_360", ok: false, status: "warning", endpoint: "/api/v2/inbox/omnichannel" },
      ],
      e2e_flow_readiness: {
        contract_version: "platform.e2e_flow_readiness.v1",
        status: "needs_attention",
        summary: { total: 2, ready: 1 },
        flows: [
          {
            id: "gov_claim_text_to_tracking",
            label: "Municipio: reclamo por WhatsApp hasta seguimiento publico",
            ready: true,
            status: "ready",
            endpoint: "/api/public/tracking/experience?kind=claim&code={code}&pin={pin}",
            frontend_entry: "/perfil?tab=tickets",
            qa_scenario_id: "gov_claim_text_to_tracking",
            meta_flow_ready: true,
            manual_test_steps: ["Crear un reclamo por WhatsApp", "Abrir el estado publico"],
            acceptance_criteria: ["El ticket aparece en CRM", "El link publico muestra el estado"],
            automation: {
              safe_by_default: true,
              runner: "tenant_ops_qa",
            },
            evidence: { tickets_recent: 3 },
            next_action: "run_whatsapp_claim_text_to_tracking_and_open_public_status",
          },
        ],
        frontend_contract: { render_as: "e2e_flow_readiness_grid" },
      },
      frontend_contract: {
        render_as: "production_smoke_report",
      },
    });

    expect(normalized.contract_version).toBe("platform.production_smoke.v1");
    expect(normalized.status).toBe("warning");
    expect(normalized.checks).toHaveLength(2);
    expect(normalized.checks[1].endpoint).toBe("/api/v2/inbox/omnichannel");
    expect(normalized.e2e_flow_readiness?.contract_version).toBe("platform.e2e_flow_readiness.v1");
    expect(normalized.e2e_flow_readiness?.flows[0]).toMatchObject({
      id: "gov_claim_text_to_tracking",
      ready: true,
      meta_flow_ready: true,
      frontend_entry: "/perfil?tab=tickets",
      qa_scenario_id: "gov_claim_text_to_tracking",
      manual_test_steps: ["Crear un reclamo por WhatsApp", "Abrir el estado publico"],
      acceptance_criteria: ["El ticket aparece en CRM", "El link publico muestra el estado"],
      automation: {
        safe_by_default: true,
        runner: "tenant_ops_qa",
      },
    });
  });
});
