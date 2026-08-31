import * as React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import CrmPeopleWorkspace, { type CrmPeopleRecord } from "./CrmPeopleWorkspace";
import { CRM_CONTACT_CASES_CONTRACT_VERSION } from "./useCrmContactHistory";

const apiFetchMock = vi.hoisted(() => vi.fn());

vi.mock("@/utils/api", () => ({
  apiFetch: apiFetchMock,
  getErrorMessage: (error: unknown, fallback: string) => error instanceof Error ? error.message : fallback,
}));

const people: CrmPeopleRecord[] = [
  {
    id: "generic-phone",
    nombre: "Mauricio Alonso",
    email: "mauricio@junin.com",
    telefono: "+5492634519821",
    whatsappExplicit: false,
    whatsappNumber: null,
    etiquetas: ["empleado"],
    canal: "sms",
    marketing: false,
    motivo: "Contacto institucional",
  },
  {
    id: "contact:42",
    contactId: "42",
    nombre: "Vecina Junín",
    email: "Sin email real",
    telefono: "+17432643718",
    whatsappExplicit: true,
    whatsappNumber: "+17432643718",
    etiquetas: ["reclamo"],
    canal: "whatsapp",
    marketing: true,
    motivo: "Arbolado",
  },
];

const Harness = ({
  records = people,
  onOpenTicketDesk = vi.fn(),
  embedded = false,
  initialSelectedContactId = "generic-phone",
  peopleTotal,
  hasMore = false,
  onLoadMore = vi.fn(),
}: {
  records?: CrmPeopleRecord[];
  onOpenTicketDesk?: (exactHref: string) => void;
  embedded?: boolean;
  initialSelectedContactId?: string;
  peopleTotal?: number;
  hasMore?: boolean;
  onLoadMore?: () => void;
}) => {
  const [selectedContactId, setSelectedContactId] = React.useState(initialSelectedContactId);
  const [selectedIds, setSelectedIds] = React.useState<Set<string>>(new Set());
  const [queueView, setQueueView] = React.useState<"all" | "review" | "whatsapp" | "complete">("all");
  const [peopleSort, setPeopleSort] = React.useState<"recent" | "name" | "score-desc" | "score-asc">("recent");
  const [queryClient] = React.useState(() => new QueryClient({
    defaultOptions: { queries: { retry: false } },
  }));
  return (
    <QueryClientProvider client={queryClient}>
      <CrmPeopleWorkspace
        embedded={embedded}
        tenantSlug="junin"
        activeView="personas"
        onViewChange={vi.fn()}
        people={records}
        selectedContactId={selectedContactId}
        onSelectContact={setSelectedContactId}
        selectedIds={selectedIds}
        onToggleSelected={(id) => setSelectedIds((current) => {
          const next = new Set(current);
          const key = String(id);
          if (next.has(key)) next.delete(key);
          else next.add(key);
          return next;
        })}
        onSetSelected={(ids, selected) => setSelectedIds((current) => {
          const next = new Set(current);
          ids.forEach((id) => selected ? next.add(String(id)) : next.delete(String(id)));
          return next;
        })}
        onClearSelected={() => setSelectedIds(new Set())}
        queueView={queueView}
        onQueueViewChange={setQueueView}
        peopleSort={peopleSort}
        onPeopleSortChange={setPeopleSort}
        search=""
        onSearchChange={vi.fn()}
        marketingOnly={false}
        onMarketingOnlyChange={vi.fn()}
        peopleTotal={peopleTotal}
        hasMore={hasMore}
        onLoadMore={onLoadMore}
        onRefresh={vi.fn()}
        onBack={vi.fn()}
        onOpenTicketDesk={onOpenTicketDesk}
        isConnected
        metrics={[{ label: "Personas", value: records.length, helper: "registros" }]}
        getPersonKey={(person) => person.contactId || String(person.id)}
        hasRealEmail={(person) => person.email !== "Sin email real"}
        hasExplicitWhatsApp={(person) => Boolean(person.whatsappExplicit && person.whatsappNumber)}
        whatsappUrl={(person) => person.whatsappNumber ? `https://wa.me/${person.whatsappNumber.replace(/\D/g, "")}` : null}
        dataQualityScore={() => 65}
        formatDate={() => "Sin fecha"}
        copyToClipboard={vi.fn()}
        segmentsPanel={<div>Segmentos</div>}
        campaignsPanel={<div>Campañas</div>}
        activityPanel={<div>Actividad</div>}
      />
    </QueryClientProvider>
  );
};

describe("CrmPeopleWorkspace", () => {
  beforeEach(() => {
    apiFetchMock.mockReset();
    apiFetchMock.mockResolvedValue({ interactions: [] });
  });

  it("keeps the document main landmark owned by the application layout", () => {
    const { container } = render(<Harness />);

    expect(screen.getByTestId("crm-person-detail")).toBeInTheDocument();
    expect(screen.getByText("Transporte conectado")).toBeInTheDocument();
    expect(screen.queryByText("Socket conectado")).not.toBeInTheDocument();
    expect(screen.queryByText("En vivo")).not.toBeInTheDocument();
    expect(container.querySelectorAll("main")).toHaveLength(0);
  });

  it("contains the embedded CRM in the available profile height", () => {
    render(<Harness embedded />);

    expect(screen.getByTestId("crm-people-workspace")).toHaveAttribute("data-layout", "embedded");
    expect(screen.getByTestId("crm-people-workspace")).toHaveClass("h-full", "min-h-0", "overflow-hidden");
    expect(screen.getByTestId("crm-people-grid")).toHaveClass("min-h-0", "flex-1");
    expect(screen.getByTestId("crm-people-grid")).not.toHaveClass("min-h-[560px]");
    expect(screen.queryByTestId("crm-overview-metrics")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Ver indicadores CRM" }));
    expect(screen.getByTestId("crm-overview-metrics-popover")).toHaveTextContent("Personas");
    expect(screen.getByTestId("crm-overview-metrics-popover")).toHaveTextContent("2");
  });

  it("keeps the embedded mobile record controls compact and reachable", () => {
    render(<Harness embedded />);

    expect(screen.getByTestId("crm-area-navigation")).toHaveClass("grid", "grid-cols-4", "overflow-hidden");
    expect(screen.getByTestId("crm-person-tabs")).toHaveClass("overflow-hidden");
    expect(screen.getByTestId("crm-person-scroll")).toHaveClass("min-h-0", "flex-1");
    expect(screen.getByRole("button", { name: "Sin caso exacto" })).toBeDisabled();
    expect(screen.queryByText("Deslizá la lista desde el selector de persona.")).not.toBeInTheDocument();

    fireEvent.change(screen.getByRole("combobox", { name: "Vista operativa de personas" }), {
      target: { value: "whatsapp" },
    });

    expect(screen.getByRole("heading", { name: "Vecina Junín" })).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Vista operativa de personas" })).toHaveValue("whatsapp");
  });

  it("preserves the standalone directory controls outside Perfil", () => {
    render(<Harness />);

    expect(screen.queryByRole("combobox", { name: "Vista operativa de personas" })).not.toBeInTheDocument();
    expect(screen.getByRole("group", { name: "Vistas operativas de personas" })).toBeInTheDocument();
    expect(screen.getByText("Deslizá la lista desde el selector de persona.")).toBeInTheDocument();
  });

  it("opens the only exact case without falling back to personal-data search", async () => {
    const onOpenTicketDesk = vi.fn();
    apiFetchMock.mockResolvedValue({
      cases_contract_version: CRM_CONTACT_CASES_CONTRACT_VERSION,
      cases_total: 1,
      cases_total_is_exact: true,
      cases_truncated: false,
      cases: [{
        source_model: "MunicipioTicket",
        ticket_id: "419",
        tenant_slug: "junin",
        title: "Luminaria apagada",
        detail_href: "/perfil?tab=tickets&q=%2B17432643718",
      }],
      interactions: [],
    });
    render(<Harness onOpenTicketDesk={onOpenTicketDesk} />);

    expect(screen.getAllByText("Mauricio Alonso").length).toBeGreaterThan(0);
    expect(screen.queryByRole("link", { name: /WhatsApp externo/i })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Sin caso exacto" })).toBeDisabled();

    fireEvent.change(screen.getByRole("combobox", { name: "Seleccionar persona" }), {
      target: { value: "42" },
    });

    expect(screen.getByRole("heading", { name: "Vecina Junín" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Más acciones" })).toHaveAttribute("aria-haspopup", "menu");
    fireEvent.click(await screen.findByRole("button", { name: "Abrir caso" }));
    await waitFor(() => expect(onOpenTicketDesk).toHaveBeenCalledWith(
      "/perfil?tab=tickets&source_model=MunicipioTicket&ticket_id=419&tenant_slug=junin&tenant=junin",
    ));
    expect(onOpenTicketDesk.mock.calls[0][0]).not.toContain("q=");
    expect(screen.getByRole("region", { name: "Estado operacional de la persona" })).toHaveTextContent("Calidad de datos65%");
  });

  it("routes multiple exact cases to a compact chooser and opens each exact identity", async () => {
    const onOpenTicketDesk = vi.fn();
    apiFetchMock.mockResolvedValue({
      cases_contract_version: CRM_CONTACT_CASES_CONTRACT_VERSION,
      cases_total: 2,
      cases_total_is_exact: true,
      cases_truncated: false,
      cases: [
        {
          source_model: "MunicipioTicket",
          ticket_id: "419",
          tenant_slug: "junin",
          title: "Luminaria apagada",
          category: "luminarias",
          status: "nuevo",
          channel: "whatsapp",
        },
        {
          source_model: "TenantTicket",
          ticket_id: "88",
          tenant_slug: "junin",
          title: "Bache en calzada",
          category: "baches_y_calzada",
          status: "en_proceso",
          channel: "web",
        },
      ],
      interactions: [],
    });
    render(
      <Harness
        initialSelectedContactId="42"
        onOpenTicketDesk={onOpenTicketDesk}
      />,
    );

    fireEvent.click(await screen.findByRole("button", { name: "Ver 2 casos" }));

    expect(await screen.findByRole("region", { name: "Casos exactos del contacto" })).toBeInTheDocument();
    expect(screen.getByText("Luminaria apagada")).toBeInTheDocument();
    expect(screen.getByText("Bache en calzada")).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /Casos 2/i })).toHaveAttribute("data-state", "active");
    expect(onOpenTicketDesk).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Abrir caso Bache en calzada" }));
    expect(onOpenTicketDesk).toHaveBeenCalledWith(
      "/perfil?tab=tickets&source_model=TenantTicket&ticket_id=88&tenant_slug=junin&tenant=junin",
    );
  });

  it("does not open a single visible case when the backend reports a partial result", async () => {
    const onOpenTicketDesk = vi.fn();
    apiFetchMock.mockResolvedValue({
      cases_contract_version: CRM_CONTACT_CASES_CONTRACT_VERSION,
      cases_total: 2,
      cases_total_is_exact: false,
      cases_truncated: true,
      cases: [{
        source_model: "MunicipioTicket",
        ticket_id: "419",
        tenant_slug: "junin",
        title: "Luminaria apagada",
      }, {
        source_model: "MunicipioTicket",
        ticket_id: "0",
        tenant_slug: "junin",
        title: "Referencia inválida",
      }],
      interactions: [],
    });
    render(<Harness initialSelectedContactId="42" onOpenTicketDesk={onOpenTicketDesk} />);

    fireEvent.click(await screen.findByRole("button", { name: "Ver 1+ casos" }));

    expect(await screen.findByRole("region", { name: "Casos exactos del contacto" })).toBeInTheDocument();
    expect(screen.getByText("Luminaria apagada")).toBeInTheDocument();
    expect(screen.getByText("2 informados · 1 verificables")).toBeInTheDocument();
    expect(onOpenTicketDesk).not.toHaveBeenCalled();
  });

  it("shows an honest zero-case state and never invents a fuzzy conversation", async () => {
    const onOpenTicketDesk = vi.fn();
    apiFetchMock.mockResolvedValue({
      cases_contract_version: CRM_CONTACT_CASES_CONTRACT_VERSION,
      cases_total: 0,
      cases_total_is_exact: true,
      cases_truncated: false,
      cases: [],
      interactions: [],
    });
    render(<Harness initialSelectedContactId="42" onOpenTicketDesk={onOpenTicketDesk} />);

    expect(await screen.findByText(/Sin caso exacto asociado/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Sin caso exacto" })).toBeDisabled();
    expect(onOpenTicketDesk).not.toHaveBeenCalled();
  });

  it("does not open a stale case after the selected contact changes", async () => {
    let resolveFirstCases: ((value: unknown) => void) | undefined;
    const firstCases = new Promise((resolve) => {
      resolveFirstCases = resolve;
    });
    apiFetchMock.mockImplementation((url: string) => {
      if (url.includes("/contacts/42/")) return firstCases;
      return Promise.resolve({
        cases_contract_version: CRM_CONTACT_CASES_CONTRACT_VERSION,
        cases_total: 0,
        cases_total_is_exact: true,
        cases_truncated: false,
        cases: [],
        interactions: [],
      });
    });
    const onOpenTicketDesk = vi.fn();
    const records: CrmPeopleRecord[] = [
      people[1],
      {
        id: "contact:84",
        contactId: "84",
        nombre: "Ana Pérez",
        email: "ana@example.com",
        telefono: "+5492634000084",
        etiquetas: [],
        canal: "web",
      },
    ];
    render(
      <Harness
        records={records}
        initialSelectedContactId="42"
        onOpenTicketDesk={onOpenTicketDesk}
      />,
    );

    await waitFor(() => expect(apiFetchMock).toHaveBeenCalledTimes(1));
    fireEvent.change(screen.getByRole("combobox", { name: "Seleccionar persona" }), {
      target: { value: "84" },
    });

    await act(async () => {
      resolveFirstCases?.({
        cases_contract_version: CRM_CONTACT_CASES_CONTRACT_VERSION,
        cases_total: 1,
        cases_total_is_exact: true,
        cases_truncated: false,
        cases: [{
          source_model: "MunicipioTicket",
          ticket_id: "419",
          tenant_slug: "junin",
          title: "Caso anterior",
        }],
        interactions: [],
      });
      await firstCases;
    });

    expect(screen.getByRole("heading", { name: "Ana Pérez" })).toBeInTheDocument();
    expect(onOpenTicketDesk).not.toHaveBeenCalled();
  });

  it("expands the selected record into a reversible focus mode", () => {
    render(<Harness embedded />);

    const grid = screen.getByTestId("crm-people-grid");
    expect(grid).toHaveAttribute("data-focus-mode", "split");
    expect(screen.getByRole("complementary", { name: "Lista de personas" })).toBeInTheDocument();
    expect(screen.queryByRole("complementary", { name: "Panel contextual" })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Mostrar panel contextual" }));
    expect(screen.getByRole("complementary", { name: "Panel contextual" })).toBeInTheDocument();

    const expandButton = screen.getByRole("button", { name: "Ampliar ficha de la persona" });
    expect(expandButton).toHaveAttribute("aria-pressed", "false");
    fireEvent.click(expandButton);

    expect(grid).toHaveAttribute("data-focus-mode", "detail");
    expect(screen.queryByRole("complementary", { name: "Lista de personas" })).not.toBeInTheDocument();
    expect(screen.queryByRole("complementary", { name: "Panel contextual" })).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Mauricio Alonso" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Volver a vista dividida" })).toHaveAttribute("aria-pressed", "true");

    const consumedEscape = new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true });
    consumedEscape.preventDefault();
    document.dispatchEvent(consumedEscape);
    expect(grid).toHaveAttribute("data-focus-mode", "detail");

    fireEvent.keyDown(document, { key: "Escape" });

    expect(grid).toHaveAttribute("data-focus-mode", "split");
    expect(screen.getByRole("complementary", { name: "Lista de personas" })).toBeInTheDocument();
    expect(screen.getByRole("complementary", { name: "Panel contextual" })).toBeInTheDocument();
  });

  it("keeps sequential queue navigation available when the directory is hidden", () => {
    render(<Harness embedded />);

    const navigator = screen.getByRole("group", { name: "Navegar personas filtradas" });
    expect(navigator).toHaveTextContent("1 de 2");
    expect(screen.getByRole("button", { name: "Persona anterior" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Persona siguiente" })).toBeEnabled();

    fireEvent.click(screen.getByRole("button", { name: "Ampliar ficha de la persona" }));
    expect(screen.queryByRole("complementary", { name: "Lista de personas" })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Persona siguiente" }));
    expect(screen.getByRole("heading", { name: "Vecina Junín" })).toBeInTheDocument();
    expect(navigator).toHaveTextContent("2 de 2");
    expect(screen.getByRole("button", { name: "Persona siguiente" })).toBeDisabled();

    fireEvent.click(screen.getByRole("button", { name: "Persona anterior" }));
    expect(screen.getByRole("heading", { name: "Mauricio Alonso" })).toBeInTheDocument();
    expect(navigator).toHaveTextContent("1 de 2");
  });

  it("keeps an authoritative Persona 360 ribbon and discloses full detail on demand", async () => {
    apiFetchMock.mockResolvedValue({
      cases_contract_version: CRM_CONTACT_CASES_CONTRACT_VERSION,
      cases_total: 1,
      cases_total_is_exact: true,
      cases_truncated: false,
      cases: [{
        source_model: "MunicipioTicket",
        ticket_id: "419",
        tenant_slug: "junin",
        title: "Luminaria apagada",
        assignee_name: "Equipo de Alumbrado",
        sla_status: "en_riesgo",
        sla_due_at: "2026-08-30T22:00:00Z",
      }],
      interactions: [{
        channel: "whatsapp",
        direction: "inbound",
        content: "La luminaria continúa apagada.",
        ts: "2026-08-30T18:00:00Z",
      }],
    });
    render(<Harness embedded initialSelectedContactId="42" />);

    const summary = screen.getByRole("region", { name: "Estado operacional de la persona" });
    await waitFor(() => expect(summary).toHaveTextContent("1 exacto"));
    expect(summary).toHaveTextContent("Equipo de Alumbrado");
    expect(summary).toHaveTextContent("En Riesgo");
    expect(summary).toHaveTextContent("Declarado sin trazabilidad");
    expect(screen.getByRole("region", { name: "Actividad y casos exactos de la persona" })).toHaveTextContent("La luminaria continúa apagada.");
    expect(screen.queryByRole("complementary", { name: "Panel contextual" })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Detalle 360" }));

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Contexto operativo" })).toBeInTheDocument();
    expect(screen.getByRole("progressbar", { name: "Calidad de datos operativa de la persona" })).toHaveAttribute("aria-valuenow", "65");
    expect(screen.getAllByText("Declarado sin trazabilidad").length).toBeGreaterThan(0);
  });

  it("virtualizes a large directory instead of mounting every desktop row", () => {
    const largeDirectory = Array.from({ length: 5_000 }, (_, index): CrmPeopleRecord => ({
      id: index === 0 ? "generic-phone" : `person-${index}`,
      nombre: index === 0 ? "Mauricio Alonso" : `Persona ${index}`,
      email: "Sin email real",
      etiquetas: [],
      canal: "web",
    }));

    render(<Harness records={largeDirectory} />);

    expect(screen.getByText("5000 resultados")).toBeInTheDocument();
    expect(screen.queryAllByRole("button", { name: /Persona \d+/i }).length).toBeLessThan(100);
    expect(screen.getByText(/Buscá para ver 4750 personas más/i)).toBeInTheDocument();
  });

  it("turns the directory into an actionable CRM queue", () => {
    render(<Harness />);

    fireEvent.click(screen.getByRole("button", { name: /WhatsApp 1/i }));
    expect(screen.getByText("1 de 2")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Vecina Junín" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("checkbox", { name: "Seleccionar personas visibles" }));
    expect(screen.getByRole("region", { name: "Acciones sobre personas seleccionadas" })).toHaveTextContent("1");
    expect(screen.getByRole("button", { name: "Preparar campaña" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Limpiar selección" }));
    expect(screen.queryByRole("region", { name: "Acciones sobre personas seleccionadas" })).not.toBeInTheDocument();
  });

  it("loads real tenant-scoped history immediately for the selected Persona 360 summary", async () => {
    apiFetchMock.mockResolvedValue({
      interactions: [
        {
          channel: "whatsapp",
          direction: "inbound",
          content: "Necesito reparar una luminaria.",
          ts: "2026-08-29T17:20:00Z",
        },
      ],
    });

    render(<Harness initialSelectedContactId="42" />);

    expect(await screen.findByText("Necesito reparar una luminaria.")).toBeInTheDocument();
    expect(apiFetchMock).toHaveBeenCalledTimes(1);
    expect(apiFetchMock).toHaveBeenCalledWith(
      "/api/admin/tenants/junin/contacts/42/history",
      { tenantSlug: "junin" },
    );
  });

  it("never shows a previous contact history after the selected person changes", async () => {
    let resolveFirstHistory: ((value: unknown) => void) | undefined;
    const firstHistory = new Promise((resolve) => {
      resolveFirstHistory = resolve;
    });
    apiFetchMock.mockImplementation((url: string) => {
      if (url.includes("/contacts/42/")) return firstHistory;
      return Promise.resolve({
        interactions: [{
          channel: "web",
          direction: "outbound",
          content: "Historial vigente de Ana.",
          ts: "2026-08-29T18:00:00Z",
        }],
      });
    });

    const records: CrmPeopleRecord[] = [
      people[1],
      {
        id: "contact:84",
        contactId: "84",
        nombre: "Ana Pérez",
        email: "ana@example.com",
        telefono: "+5492634000084",
        etiquetas: [],
        canal: "web",
      },
    ];
    render(<Harness records={records} initialSelectedContactId="42" />);
    fireEvent.mouseDown(screen.getByRole("tab", { name: "Interacciones" }), {
      button: 0,
      ctrlKey: false,
    });
    await waitFor(() => expect(apiFetchMock).toHaveBeenCalledTimes(1));

    fireEvent.change(screen.getByRole("combobox", { name: "Seleccionar persona" }), {
      target: { value: "84" },
    });
    expect(await screen.findByText("Historial vigente de Ana.")).toBeInTheDocument();

    await act(async () => {
      resolveFirstHistory?.({
        interactions: [{
          channel: "whatsapp",
          direction: "inbound",
          content: "Historial viejo de Vecina Junín.",
          ts: "2026-08-29T16:00:00Z",
        }],
      });
      await firstHistory;
    });

    expect(screen.queryByText("Historial viejo de Vecina Junín.")).not.toBeInTheDocument();
    expect(screen.getByText("Historial vigente de Ana.")).toBeInTheDocument();
  });

  it("shows an honest non-fetching state for legacy records without contact identity", () => {
    render(<Harness initialSelectedContactId="generic-phone" />);
    fireEvent.mouseDown(screen.getByRole("tab", { name: "Interacciones" }), {
      button: 0,
      ctrlKey: false,
    });

    expect(screen.getByText("Historial detallado no disponible")).toBeInTheDocument();
    expect(screen.getByText(/No se inventan eventos/i)).toBeInTheDocument();
    expect(apiFetchMock).not.toHaveBeenCalled();
  });

  it("keeps masked directory people visible but non-actionable and loads the next cursor page explicitly", async () => {
    const onLoadMore = vi.fn();
    const protectedPerson: CrmPeopleRecord = {
      id: "person_opaque_42",
      contactId: null,
      nombre: "M*** A***",
      email: "m***@example.com",
      telefono: "***8608",
      etiquetas: [],
      canal: "whatsapp",
      marketing: true,
      piiMasked: true,
      possibleDuplicate: true,
      resumen: "Datos protegidos.",
    };

    render(
      <Harness
        records={[protectedPerson]}
        initialSelectedContactId="person_opaque_42"
        peopleTotal={84}
        hasMore
        onLoadMore={onLoadMore}
      />,
    );

    expect(screen.getByText("1 de 84")).toBeInTheDocument();
    expect(screen.getByText("Vistas sobre 1 cargadas")).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: /Orden backend por actividad reciente sobre 1 personas cargadas/i })).toBeDisabled();
    expect(screen.getAllByText("Datos protegidos").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Revisar identidad").length).toBeGreaterThan(0);
    expect(screen.getByText("Calidad no evaluable")).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: "Seleccionar personas visibles" })).toBeDisabled();
    expect(screen.queryByRole("progressbar", { name: "Calidad de datos operativa de la persona" })).not.toBeInTheDocument();
    expect(apiFetchMock).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Cargar más" }));
    expect(onLoadMore).toHaveBeenCalledTimes(1);

    const actionsTrigger = screen.getByRole("button", { name: "Más acciones" });
    act(() => {
      actionsTrigger.focus();
      fireEvent.keyDown(actionsTrigger, { key: "ArrowDown" });
    });
    const actionsMenu = await screen.findByRole("menu");
    expect(within(actionsMenu).getByRole("menuitem", { name: "Sin caso exacto" })).toHaveAttribute("data-disabled");
    expect(within(actionsMenu).queryByRole("menuitem", { name: "Copiar teléfono" })).not.toBeInTheDocument();
    expect(within(actionsMenu).queryByRole("menuitem", { name: "Copiar email" })).not.toBeInTheDocument();
    expect(within(actionsMenu).queryByRole("menuitem", { name: "WhatsApp externo" })).not.toBeInTheDocument();
  });

  it("offers a retry without replacing the error with invented activity", async () => {
    apiFetchMock
      .mockRejectedValueOnce(new Error("Servicio temporalmente no disponible"))
      .mockResolvedValueOnce({ interactions: [] });

    render(<Harness initialSelectedContactId="42" />);
    fireEvent.mouseDown(screen.getByRole("tab", { name: "Interacciones" }), {
      button: 0,
      ctrlKey: false,
    });

    expect(await screen.findByRole("alert")).toHaveTextContent("Servicio temporalmente no disponible");
    fireEvent.click(screen.getByRole("button", { name: "Reintentar" }));

    expect(await screen.findByText("Sin eventos publicados")).toBeInTheDocument();
    expect(apiFetchMock).toHaveBeenCalledTimes(2);
  });
});
