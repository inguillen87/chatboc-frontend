import { describe, expect, it } from "vitest";
import {
  normalizeCatalogQualityV2,
  normalizeEmployeeCoverageV2,
  normalizeEmployeeRoutingV2,
  normalizeOmnichannelInboxDetailV2,
  normalizeProductionSmokeV2,
} from "./saas";

describe("tenant admin v2 contracts", () => {
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
      frontend_contract: {
        render_as: "production_smoke_report",
      },
    });

    expect(normalized.contract_version).toBe("platform.production_smoke.v1");
    expect(normalized.status).toBe("warning");
    expect(normalized.checks).toHaveLength(2);
    expect(normalized.checks[1].endpoint).toBe("/api/v2/inbox/omnichannel");
  });
});
