import { describe, expect, it } from "vitest";
import { normalizeCatalogQualityV2, normalizeEmployeeRoutingV2 } from "./saas";

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
});
