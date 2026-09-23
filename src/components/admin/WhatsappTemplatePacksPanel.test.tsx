import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { apiFetch } from "@/utils/api";
import WhatsappTemplatePacksPanel from "./WhatsappTemplatePacksPanel";

vi.mock("@/utils/api", async () => {
  const actual = await vi.importActual<typeof import("@/utils/api")>("@/utils/api");
  return { ...actual, apiFetch: vi.fn() };
});

const apiFetchMock = vi.mocked(apiFetch);

const deferred = <T,>() => {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
};

const catalog = {
  contract_version: "whatsapp.template_pack.catalog.v1",
  tenant: { id: 1, slug: "junin" },
  catalog_version: "2026.07.30",
  provider_calls_performed: false,
  capabilities: {
    read: true,
    materialize_local_draft: true,
    required_for_mutation: "whatsapp.templates.manage",
  },
  endpoints: {
    materialize_template: "/api/admin/whatsapp/template-packs/{vertical}/drafts",
  },
  frontend_contract: {
    copy: {
      title: "Packs profesionales de WhatsApp",
      description: "Borradores versionados con estado real.",
      provider_notice: "Sin llamadas a proveedor.",
      materialize: "Crear borradores locales",
      materialized: "Borradores locales creados",
    },
    lifecycle_labels: {
      local_draft: "Borrador local",
      approved: "Aprobada",
      unverified: "Sin verificacion",
    },
    blocker_labels: {
      provider_content_not_created: "Todavia no existe contenido verificado en el proveedor.",
    },
  },
  packs: [
    {
      vertical: "municipio",
      pack_id: "municipio_operaciones_es_ar",
      pack_version: "1.0.0",
      label: "Municipio",
      summary: { total: 1, approved: 0, blocked: 1 },
      templates: [
        {
          intent: "confirmation",
          intent_label: "Confirmacion",
          name: "chatboc_municipio_confirmacion_v1",
          materialized: false,
          lifecycle: { state: "local_draft", production_send_allowed: false },
          preview: {
            body: "Registramos tu reclamo REC-10482.",
            cta: { text: "Ver seguimiento", url: "https://www.chatboc.ar/reclamos/REC-10482" },
          },
          blockers: ["provider_content_not_created"],
        },
      ],
    },
  ],
};

describe("WhatsappTemplatePacksPanel", () => {
  beforeEach(() => {
    apiFetchMock.mockReset();
  });

  it("renders backend previews, blockers and the honest lifecycle", async () => {
    apiFetchMock.mockResolvedValueOnce(catalog);

    render(<WhatsappTemplatePacksPanel tenantSlug="junin" canManage />);

    expect(await screen.findByText("Packs profesionales de WhatsApp")).toBeInTheDocument();
    expect(screen.getByText("Registramos tu reclamo REC-10482.")).toBeInTheDocument();
    expect(screen.getAllByText("Borrador local")[0]).toBeInTheDocument();
    expect(
      screen.getByText("Todavia no existe contenido verificado en el proveedor."),
    ).toBeInTheDocument();
    expect(screen.queryByText("Aprobada")).not.toBeInTheDocument();
  });

  it("materializes only local drafts with one stable idempotency key", async () => {
    const materializedResponse = {
      ok: true, provider_calls_performed: false, tenant: catalog.tenant,
      pack: {
        ...catalog.packs[0],
        templates: catalog.packs[0].templates.map((template) => ({
          ...template,
          materialized: true,
        })),
      },
      idempotent_replay: false,
    };
    apiFetchMock
      .mockResolvedValueOnce(catalog)
      .mockResolvedValueOnce(materializedResponse);

    render(<WhatsappTemplatePacksPanel tenantSlug="junin" canManage />);
    fireEvent.click(await screen.findByRole("button", { name: "Crear borradores locales" }));

    await waitFor(() => expect(apiFetchMock).toHaveBeenCalledTimes(2));
    expect(apiFetchMock.mock.calls[1][0]).toBe(
      "/api/admin/whatsapp/template-packs/municipio/drafts",
    );
    expect(apiFetchMock.mock.calls[1][1]).toEqual(
      expect.objectContaining({
        method: "POST",
        tenantSlug: "junin",
        body: { pack_version: "1.0.0" },
        headers: {
          "Idempotency-Key": expect.stringMatching(/^template-pack:municipio:/),
        },
      }),
    );
    expect(await screen.findByRole("button", { name: "Borradores locales creados" })).toBeInTheDocument();

    const completedButton = screen.getByRole("button", { name: "Borradores locales creados" });
    expect(completedButton).toBeDisabled();
    fireEvent.click(completedButton);
    expect(apiFetchMock).toHaveBeenCalledTimes(2);
  });

  it("uses the backend template capability as the mutation authority", async () => {
    apiFetchMock.mockResolvedValueOnce({
      ...catalog,
      capabilities: { ...catalog.capabilities, materialize_local_draft: false },
    });

    render(<WhatsappTemplatePacksPanel tenantSlug="junin" canManage />);

    expect(await screen.findByRole("heading", { name: "Municipio" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Crear borradores locales" })).not.toBeInTheDocument();
  });

  it("does not render an approval when blockers are accidentally empty", async () => {
    apiFetchMock.mockResolvedValueOnce({
      ...catalog,
      packs: [
        {
          ...catalog.packs[0],
          templates: [
            {
              ...catalog.packs[0].templates[0],
              lifecycle: { state: "approved", production_send_allowed: false },
              blockers: [],
            },
          ],
        },
      ],
    });

    render(<WhatsappTemplatePacksPanel tenantSlug="junin" canManage={false} />);

    expect(await screen.findAllByText("Sin verificacion")).not.toHaveLength(0);
    expect(screen.queryByText("Aprobada")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Crear borradores locales" })).toBeInTheDocument();
  });

  it("ignores a late catalog response from the previously selected tenant", async () => {
    const juninResponse = deferred<typeof catalog>();
    const mendozaCatalog = {
      ...catalog,
      tenant: { id: 2, slug: "mendoza" },
      frontend_contract: {
        ...catalog.frontend_contract,
        copy: { ...catalog.frontend_contract.copy, title: "Packs Mendoza" },
      },
    };
    apiFetchMock.mockImplementation((_path, options) =>
      options?.tenantSlug === "junin" ? juninResponse.promise : Promise.resolve(mendozaCatalog),
    );

    const { rerender } = render(<WhatsappTemplatePacksPanel tenantSlug="junin" canManage />);
    await waitFor(() => expect(apiFetchMock).toHaveBeenCalledTimes(1));
    rerender(<WhatsappTemplatePacksPanel tenantSlug="mendoza" canManage />);

    expect(await screen.findByText("Packs Mendoza")).toBeInTheDocument();
    await act(async () => {
      juninResponse.resolve(catalog);
      await juninResponse.promise;
    });

    expect(screen.getByText("Packs Mendoza")).toBeInTheDocument();
    expect(screen.queryByText("Packs profesionales de WhatsApp")).not.toBeInTheDocument();
  });
});
