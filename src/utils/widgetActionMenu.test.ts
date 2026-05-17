import { describe, expect, it } from "vitest";
import { mergeActionMenus, readWorkspaceActionMenu } from "./widgetActionMenu";

const actionIds = (items: unknown[]) =>
  items.map((item) => (item as Record<string, unknown>).action_id);

describe("widgetActionMenu", () => {
  it("reads government and municipio action contracts", () => {
    const workspace = {
      active_vertical: "municipio",
      government: {
        primary_actions: [
          {
            label: "Crear reclamo",
            description: "Texto backend",
            action_id: "crear_reclamo",
          },
          {
            label: "Consultar estado",
            action_id: "consultar_estado_reclamo",
          },
        ],
      },
      municipio: {
        quick_menu: [{ label: "Consultar tramite", action_id: "consultar_tramite" }],
      },
    };

    expect(actionIds(readWorkspaceActionMenu(workspace, "gobierno"))).toEqual([
      "crear_reclamo",
      "consultar_estado_reclamo",
      "consultar_tramite",
    ]);
  });

  it("reads education actions from canonical and compatibility paths", () => {
    const workspace = {
      education: {
        primary_actions: [
          { label: "Crear caso escolar", action_id: "create_school_case" },
        ],
        whatsapp_playbook: {
          quick_menu: [{ label: "Hablar con secretaria", action_id: "talk_secretary" }],
        },
      },
      education_profile: {
        primary_actions: [
          { label: "Justificar inasistencia", action_id: "justify_absence" },
        ],
      },
    };

    expect(actionIds(readWorkspaceActionMenu(workspace, "educacion"))).toEqual([
      "create_school_case",
      "justify_absence",
      "talk_secretary",
    ]);
  });

  it("reads pyme, business and commerce menus without mixing downloadable tools", () => {
    const workspace = {
      pyme: {
        primary_actions: [{ label: "Consultar producto", action_id: "consultar_producto" }],
      },
      business: {
        quick_menu: [{ label: "Crear pedido", action_id: "crear_pedido" }],
      },
      commerce: {
        actions: [{ label: "Cotizar envio", action_id: "cotizar_envio" }],
      },
    };

    expect(actionIds(readWorkspaceActionMenu(workspace, "empresas", "bodega"))).toEqual([
      "consultar_producto",
      "crear_pedido",
      "cotizar_envio",
    ]);
  });

  it("reads generic vertical actions for new rubros", () => {
    const workspace = {
      active_vertical: "general",
      verticals: {
        general: {
          actions: [
            {
              label: "Registrar consulta",
              action_id: "registrar_solicitud_operativa",
            },
          ],
        },
      },
    };

    expect(actionIds(readWorkspaceActionMenu(workspace, "general"))).toEqual([
      "registrar_solicitud_operativa",
    ]);
  });

  it("deduplicates by action id and skips disabled actions", () => {
    const merged = mergeActionMenus(
      [{ label: "Crear reclamo", action_id: "crear_reclamo" }],
      [{ label: "Alta reclamo", action_id: "crear_reclamo" }],
      [{ label: "Oculto", action_id: "oculto", enabled: false }],
      [{ cta_label: "Hablar", action_id: "derivar_humano" }],
    );

    expect(actionIds(merged)).toEqual(["crear_reclamo", "derivar_humano"]);
  });
});
