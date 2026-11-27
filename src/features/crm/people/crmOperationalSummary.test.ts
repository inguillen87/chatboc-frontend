import { describe, expect, it } from "vitest";

import { buildCrmOperationalSummary } from "./crmOperationalSummary";
import type { CrmPeopleRecord } from "./CrmPeopleWorkspace";
import type { CrmContactHistory } from "./useCrmContactHistory";

const person: CrmPeopleRecord = {
  id: "contact:42",
  contactId: "42",
  nombre: "Vecina Junín",
  email: "Sin email real",
  telefono: "+17432643718",
  etiquetas: [],
  canal: "whatsapp",
  lastSeen: "2026-08-30T17:00:00Z",
  marketing: false,
};

const verifiedHistory: CrmContactHistory = {
  contactId: "42",
  interactions: [{
    channel: "whatsapp",
    direction: "inbound",
    content: "Necesito ayuda con una luminaria.",
    timestamp: "2026-08-30T18:00:00Z",
  }],
  cases: [{
    caseKey: "junin:MunicipioTicket:419",
    sourceModel: "MunicipioTicket",
    ticketId: "419",
    tenantSlug: "junin",
    title: "Luminaria apagada",
    category: "luminarias",
    status: "nuevo",
    channel: "whatsapp",
    createdAt: "2026-08-30T16:00:00Z",
    updatedAt: "2026-08-30T18:05:00Z",
    assigneeName: "Equipo de Alumbrado",
    slaStatus: "en_riesgo",
    slaDueAt: "2026-08-30T22:00:00Z",
    href: "/perfil?tab=tickets&source_model=MunicipioTicket&ticket_id=419&tenant_slug=junin",
  }],
  casesContractStatus: "verified",
  casesRejected: 0,
  casesTotal: 1,
  casesTotalIsExact: true,
  casesTruncated: false,
};

describe("buildCrmOperationalSummary", () => {
  it("uses only exact published case and interaction facts", () => {
    const summary = buildCrmOperationalSummary({
      person,
      history: verifiedHistory,
      isLoading: false,
      error: null,
    });

    expect(summary).toEqual(expect.objectContaining({
      identityLabel: "Identidad vinculada",
      casesLabel: "1 vinculado",
      latestEventAt: "2026-08-30T18:00:00Z",
      latestEventChannel: "whatsapp",
      latestEventVerified: true,
      latestEventSourceLabel: "Actividad confirmada",
      ownerLabel: "Equipo de Alumbrado",
      slaLabel: "En Riesgo",
      slaDueAt: "2026-08-30T22:00:00Z",
      consentLabel: "Sin comprobante",
      consentDeclared: false,
    }));
  });

  it("fails closed when the cases contract is unavailable", () => {
    const summary = buildCrmOperationalSummary({
      person,
      history: { ...verifiedHistory, cases: [], casesContractStatus: "unsupported" },
      isLoading: false,
      error: null,
    });

    expect(summary.casesLabel).toBe("No disponible");
    expect(summary.ownerLabel).toBe("No disponible");
    expect(summary.slaLabel).toBe("No disponible");
    expect(summary.casesLabel).not.toContain("0");
  });

  it("does not infer an identity or consent state from phone availability", () => {
    const summary = buildCrmOperationalSummary({
      person: { ...person, contactId: null, marketing: false },
      history: null,
      isLoading: false,
      error: null,
    });

    expect(summary.identityLabel).toBe("Identidad pendiente");
    expect(summary.casesLabel).toBe("Sin identidad vinculada");
    expect(summary.consentLabel).toBe("Sin comprobante");
    expect(summary.latestEventVerified).toBe(false);
    expect(summary.latestEventSourceLabel).toBe("Registro de personas · Falta verificar");
  });

  it("treats a marketing boolean as an untraceable declaration, not evidence", () => {
    const summary = buildCrmOperationalSummary({
      person: { ...person, marketing: true },
      history: null,
      isLoading: false,
      error: null,
    });

    expect(summary.consentLabel).toBe("Declarado, falta comprobante");
    expect(summary.consentDeclared).toBe(true);
  });
});
