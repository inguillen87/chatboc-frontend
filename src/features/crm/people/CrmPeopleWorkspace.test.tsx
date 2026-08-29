import * as React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import CrmPeopleWorkspace, { type CrmPeopleRecord } from "./CrmPeopleWorkspace";

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
}: {
  records?: CrmPeopleRecord[];
  onOpenTicketDesk?: (person: CrmPeopleRecord) => void;
  embedded?: boolean;
}) => {
  const [selectedContactId, setSelectedContactId] = React.useState("generic-phone");
  const [selectedIds, setSelectedIds] = React.useState<Set<string>>(new Set());
  const [queueView, setQueueView] = React.useState<"all" | "review" | "whatsapp" | "complete">("all");
  const [peopleSort, setPeopleSort] = React.useState<"recent" | "name" | "score-desc" | "score-asc">("recent");
  return (
    <CrmPeopleWorkspace
      embedded={embedded}
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
      onRefresh={vi.fn()}
      onBack={vi.fn()}
      onOpenTicketDesk={onOpenTicketDesk}
      isConnected
      metrics={[{ label: "Personas", value: records.length, helper: "registros" }]}
      getPersonKey={(person) => person.contactId || String(person.id)}
      hasRealEmail={(person) => person.email !== "Sin email real"}
      hasExplicitWhatsApp={(person) => Boolean(person.whatsappExplicit && person.whatsappNumber)}
      whatsappUrl={(person) => person.whatsappNumber ? `https://wa.me/${person.whatsappNumber.replace(/\D/g, "")}` : null}
      profileScore={() => 65}
      nextAction={() => "Revisar contacto"}
      formatDate={() => "Sin fecha"}
      copyToClipboard={vi.fn()}
      segmentsPanel={<div>Segmentos</div>}
      campaignsPanel={<div>Campañas</div>}
      activityPanel={<div>Actividad</div>}
    />
  );
};

describe("CrmPeopleWorkspace", () => {
  it("keeps the document main landmark owned by the application layout", () => {
    const { container } = render(<Harness />);

    expect(screen.getByTestId("crm-person-detail")).toBeInTheDocument();
    expect(container.querySelectorAll("main")).toHaveLength(0);
  });

  it("contains the embedded CRM in the available profile height", () => {
    render(<Harness embedded />);

    expect(screen.getByTestId("crm-people-workspace")).toHaveAttribute("data-layout", "embedded");
    expect(screen.getByTestId("crm-people-workspace")).toHaveClass("h-full", "min-h-0", "overflow-hidden");
    expect(screen.getByTestId("crm-people-grid")).toHaveClass("min-h-0", "flex-1");
    expect(screen.getByTestId("crm-people-grid")).not.toHaveClass("min-h-[560px]");
  });

  it("keeps the embedded mobile record controls compact and reachable", () => {
    render(<Harness embedded />);

    expect(screen.getByTestId("crm-area-navigation")).toHaveClass("grid", "grid-cols-4", "overflow-hidden");
    expect(screen.getByTestId("crm-person-tabs")).toHaveClass("overflow-hidden");
    expect(screen.getByTestId("crm-person-scroll")).toHaveClass("min-h-0", "flex-1");
    expect(screen.getByRole("button", { name: "Abrir conversación" })).toBeInTheDocument();
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

  it("switches the record 360 from the compact list", () => {
    const onOpenTicketDesk = vi.fn();
    render(<Harness onOpenTicketDesk={onOpenTicketDesk} />);

    expect(screen.getAllByText("Mauricio Alonso").length).toBeGreaterThan(0);
    expect(screen.queryByRole("link", { name: /WhatsApp externo/i })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Abrir conversación" })).toBeInTheDocument();

    fireEvent.change(screen.getByRole("combobox", { name: "Seleccionar persona" }), {
      target: { value: "42" },
    });

    expect(screen.getByRole("heading", { name: "Vecina Junín" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Más acciones" })).toHaveAttribute("aria-haspopup", "menu");
    fireEvent.click(screen.getByRole("button", { name: "Abrir conversación" }));
    expect(onOpenTicketDesk).toHaveBeenCalledWith(expect.objectContaining({ contactId: "42" }));
    expect(screen.getByRole("progressbar", { name: "Completitud del perfil CRM" })).toHaveAttribute("aria-valuenow", "65");
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
});
