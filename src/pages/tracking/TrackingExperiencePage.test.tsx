import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

const fetchTrackingExperienceMock = vi.fn();
const sendTrackingSupportMessageMock = vi.fn();

vi.mock("@/api/trackingExperience", () => ({
  fetchTrackingExperience: (...args: unknown[]) => fetchTrackingExperienceMock(...args),
  sendTrackingSupportMessage: (...args: unknown[]) => sendTrackingSupportMessageMock(...args),
}));

vi.mock("@/components/ui/TrackingMap", () => ({
  default: () => <div data-testid="tracking-map">Mapa de seguimiento</div>,
}));

import TrackingExperiencePage from "./TrackingExperiencePage";

const makeClaimPayload = (mode: "live" | "offline" = "offline") => {
  const live = mode === "live";
  return {
    contract_version: "tracking.experience.v1",
    request_id: "req-track-123",
    kind: "claim",
    tenant: {
      slug: "junin",
      nombre: "Municipalidad de Junin",
    },
    resource: {
      code: "M-123456",
      subject: "Arreglo de calle",
      category: "Arreglo de calle",
      channel: "WhatsApp",
    },
    status: {
      current_stage: "recibido",
      label: "Recibido",
      detail: "Tu reclamo fue recibido y esta pendiente de asignacion.",
    },
    location: {
      address: "Don Bosco 55, Junin, Mendoza, AR",
    },
    milestones: [
      { key: "recibido", label: "Recibido" },
      { key: "validando", label: "Validando" },
      { key: "asignado", label: "Asignado" },
      { key: "resuelto", label: "Resuelto" },
    ],
    timeline: [
      {
        id: "created",
        label: "Ticket creado",
        detail: "Reclamo recibido por WhatsApp.",
        timestamp: "6 de junio, 00:03",
      },
    ],
    map: {
      can_render: false,
      fallback_when_no_coordinates: "timeline_only",
    },
    support: {
      enabled: true,
      mode,
      availability: {
        label: live ? "Atencion en vivo disponible" : "Mesa de ayuda offline",
        description: live
          ? "Un agente puede tomar este reclamo ahora."
          : "Deja un mensaje asociado a este ticket y el equipo lo responde desde el CRM.",
      },
      live_chat: {
        enabled: true,
        available: live,
        mode,
        contract_version: "live_chat.schedule.v1",
        description: "Lunes a viernes de 09:00 a 13:00",
      },
      ticket: {
        id: 42,
        requires_pin: true,
      },
      endpoints: {
        send_message: "/api/public/tracking/claims/42/messages",
      },
      service_window: {
        accepts_messages: true,
        offline_queue_enabled: !live,
        schedule_label: "Lunes a viernes de 09:00 a 13:00",
        next_action: live ? "socket_live_message" : "queue_ticket_comment",
      },
      webview_policy: {
        stay_inside_tracking: true,
        external_redirect_required: false,
      },
      admin_response_surface: {
        label: "Bandeja de reclamos",
      },
      cta: {
        primary: {
          label: live ? "Chatear con un agente" : "Dejar mensaje para el equipo",
          action: live ? "socket_live_message" : "queue_ticket_comment",
        },
      },
      conversation: {
        messages: [],
      },
      polling: {
        interval_ms: 15000,
      },
    },
  };
};

const renderTrackingPage = () =>
  render(
    <MemoryRouter initialEntries={["/tracking/claim?code=M-123456&pin=654321&tenant_slug=junin"]}>
      <Routes>
        <Route path="/tracking/claim" element={<TrackingExperiencePage kind="claim" />} />
      </Routes>
    </MemoryRouter>,
  );

describe("TrackingExperiencePage support contract", () => {
  beforeEach(() => {
    fetchTrackingExperienceMock.mockReset();
    sendTrackingSupportMessageMock.mockReset();
  });

  it("keeps offline helpdesk messages inside the public claim tracking contract", async () => {
    const payload = makeClaimPayload("offline");
    fetchTrackingExperienceMock.mockResolvedValueOnce(payload);
    sendTrackingSupportMessageMock.mockResolvedValueOnce({
      message: "Mensaje guardado en el reclamo.",
      crm_writeback: {
        unread_for_team: true,
        inbox_increment: true,
      },
      tracking: {
        ...payload,
        support: {
          ...payload.support,
          conversation: {
            messages: [
              {
                id: "msg-1",
                author: "customer",
                message: "hola, puedo hablar con alguien?",
                created_at: "6 de junio, 00:05",
              },
            ],
          },
        },
      },
    });

    const { container } = renderTrackingPage();

    expect(await screen.findByText("Mesa de ayuda offline")).toBeInTheDocument();
    expect(screen.getByText("Sin salir del seguimiento")).toBeInTheDocument();
    expect(screen.getByText("Cola offline activa")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Dejar mensaje para el equipo/i })).toBeInTheDocument();
    expect(
      Array.from(container.querySelectorAll("a")).some((link) =>
        (link.getAttribute("href") || "").includes("/chat/"),
      ),
    ).toBe(false);

    fireEvent.change(screen.getByPlaceholderText(/mensaje offline/i), {
      target: { value: "hola, puedo hablar con alguien?" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Dejar mensaje para el equipo/i }));

    await waitFor(() => {
      expect(sendTrackingSupportMessageMock).toHaveBeenCalledWith(
        expect.objectContaining({
          endpoint: "/api/public/tracking/claims/42/messages",
          pin: "654321",
          message: "hola, puedo hablar con alguien?",
          code: "M-123456",
        }),
      );
    });
    expect(await screen.findByText("hola, puedo hablar con alguien?")).toBeInTheDocument();
    expect(await screen.findByText(/pendiente en el CRM/i)).toBeInTheDocument();
  });

  it("uses the backend live CTA when the tenant service window is open", async () => {
    fetchTrackingExperienceMock.mockResolvedValueOnce(makeClaimPayload("live"));

    renderTrackingPage();

    expect(await screen.findByText("Atencion en vivo disponible")).toBeInTheDocument();
    expect(screen.getByText("Atencion inmediata")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Chatear con un agente/i })).toBeInTheDocument();
  });
});
