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
}: {
  records?: CrmPeopleRecord[];
  onOpenTicketDesk?: (person: CrmPeopleRecord) => void;
}) => {
  const [selectedContactId, setSelectedContactId] = React.useState("generic-phone");
  return (
    <CrmPeopleWorkspace
      activeView="personas"
      onViewChange={vi.fn()}
      people={records}
      selectedContactId={selectedContactId}
      onSelectContact={setSelectedContactId}
      selectedIds={new Set()}
      onToggleSelected={vi.fn()}
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
  it("switches the record 360 from the compact list", () => {
    const onOpenTicketDesk = vi.fn();
    render(<Harness onOpenTicketDesk={onOpenTicketDesk} />);

    expect(screen.getAllByText("Mauricio Alonso").length).toBeGreaterThan(0);
    expect(screen.queryByRole("link", { name: /WhatsApp externo/i })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Abrir en CRM" })).toBeInTheDocument();

    fireEvent.change(screen.getByRole("combobox", { name: "Seleccionar persona" }), {
      target: { value: "42" },
    });

    expect(screen.getByRole("heading", { name: "Vecina Junín" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /WhatsApp externo/i })).toHaveAttribute("href", "https://wa.me/17432643718");
    fireEvent.click(screen.getByRole("button", { name: "Abrir en CRM" }));
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
});
