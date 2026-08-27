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

const Harness = () => {
  const [selectedContactId, setSelectedContactId] = React.useState("generic-phone");
  return (
    <CrmPeopleWorkspace
      activeView="personas"
      onViewChange={vi.fn()}
      people={people}
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
      isConnected
      metrics={[{ label: "Personas", value: 2, helper: "registros" }]}
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
    render(<Harness />);

    expect(screen.getAllByText("Mauricio Alonso").length).toBeGreaterThan(0);
    expect(screen.queryByRole("link", { name: /WhatsApp/i })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Vecina Junín/i }));

    expect(screen.getByRole("heading", { name: "Vecina Junín" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /WhatsApp/i })).toHaveAttribute("href", "https://wa.me/17432643718");
  });
});
