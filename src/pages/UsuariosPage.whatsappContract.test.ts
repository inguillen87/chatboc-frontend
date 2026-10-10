import { describe, expect, it } from "vitest";

import {
  eventBelongsToTenant,
  getExplicitWhatsAppUrl,
  hasExplicitWhatsApp,
  normalizeUsuario,
} from "./UsuariosPage";

describe("UsuariosPage WhatsApp channel contract", () => {
  it("does not turn a generic profile phone into a WhatsApp channel", () => {
    const contact = normalizeUsuario(
      {
        id: "employee-mauricio",
        nombre: "Mauricio Alonso",
        telefono: "+5492634519821",
        canal: "sms",
      },
      0,
    );

    expect(contact.telefono).toBe("+5492634519821");
    expect(contact.whatsappNumber).toBeNull();
    expect(hasExplicitWhatsApp(contact)).toBe(false);
    expect(getExplicitWhatsAppUrl(contact)).toBeNull();
  });

  it("allows WhatsApp only when the source publishes an explicit WhatsApp channel", () => {
    const contact = normalizeUsuario(
      {
        id: "contact:42",
        nombre: "Vecina Junín",
        telefono: "+17432643718",
        canal: "whatsapp",
      },
      0,
    );

    expect(contact.whatsappNumber).toBe("+17432643718");
    expect(hasExplicitWhatsApp(contact)).toBe(true);
    expect(getExplicitWhatsAppUrl(contact)).toBe("https://wa.me/17432643718");
  });

  it("keeps a dedicated WhatsApp number distinct from the general phone", () => {
    const contact = normalizeUsuario(
      {
        id: "contact:99",
        nombre: "Contacto municipal",
        telefono: "+5492613168608",
        whatsapp_number: "+17432643718",
      },
      0,
    );

    expect(contact.telefono).toBe("+5492613168608");
    expect(contact.whatsappNumber).toBe("+17432643718");
    expect(getExplicitWhatsAppUrl(contact)).toBe("https://wa.me/17432643718");
  });

  it("accepts the camelCase WhatsApp field without reclassifying the general phone", () => {
    const contact = normalizeUsuario(
      {
        id: "contact:camel",
        telefono: "+5492634519821",
        whatsappNumber: "+17432643718",
      },
      0,
    );

    expect(contact.telefono).toBe("+5492634519821");
    expect(contact.whatsappNumber).toBe("+17432643718");
    expect(getExplicitWhatsAppUrl(contact)).toBe("https://wa.me/17432643718");
  });

  it("fails closed for realtime contact events without the active tenant identity", () => {
    expect(eventBelongsToTenant({ tenant_slug: "junin" }, "junin")).toBe(true);
    expect(eventBelongsToTenant({ tenant_slug: "otro-municipio" }, "junin")).toBe(false);
    expect(eventBelongsToTenant({ contact: { id: "42" } }, "junin")).toBe(false);
    expect(eventBelongsToTenant({ contact: { tenantSlug: "JUNIN" } }, "junin")).toBe(true);
  });
});
