import React from "react";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

const fetchTrackingExperienceMock = vi.fn();
const sendTrackingSupportMessageMock = vi.fn();
const socketHarness = vi.hoisted(() => {
  const handlers = new Map<string, (payload?: unknown) => void>();
  const socket = {
    connected: false,
    on: vi.fn((event: string, handler: (payload?: unknown) => void) => {
      handlers.set(event, handler);
      return socket;
    }),
    off: vi.fn((event: string) => {
      handlers.delete(event);
      return socket;
    }),
    emit: vi.fn(),
    disconnect: vi.fn(),
  };
  return {
    handlers,
    socket,
    io: vi.fn(() => socket),
  };
});

vi.mock("socket.io-client", () => ({
  io: socketHarness.io,
}));

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
      operator_queue: {
        contract_version: "claim.helpdesk_queue.v1",
        state: "up_to_date",
        has_pending_customer_message: false,
        pending_customer_messages: 0,
        latest_customer_message: null,
        pending_since: null,
        sla_target_minutes: live ? 30 : 240,
        next_team_action: "monitor_ticket",
        next_team_action_label: "Sin respuesta pendiente",
        customer_visible_label: "El equipo esta al dia con este reclamo",
        unread_on_customer_message: true,
        requires_admin_response: false,
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
      socket: {
        enabled: live,
        event: "new_chat_message",
        room: "ticket_municipio_42",
        access_token: live ? "signed-room-token" : null,
        access_mode: "signed_ticket_room",
        fallback_transport: "http_polling",
      },
      ui: {
        channel_binding_label: "Canal interno del ticket",
        response_expectation_label: live
          ? "Respuesta esperada en hasta 30 min"
          : "El equipo lo ve en el CRM. SLA objetivo 240 min",
        polling_label: "Actualizacion cada 15s",
        no_external_redirect_label: "Sin redireccion externa",
        operational_state_label: "Canal seguro asociado al reclamo",
      },
    },
  };
};

const makeOrderPayload = () => ({
  contract_version: "tracking.experience.v1",
  kind: "order",
  tenant: {
    slug: "junin",
    nombre: "Municipalidad de Junin",
  },
  resource: {
    code: "pc-77",
    subject: "Pedido asistido",
    category: "Marketplace",
    channel: "web",
  },
  status: {
    current_stage: "recibido",
    label: "Pedido recibido",
    detail: "Tu solicitud fue recibida por el equipo.",
  },
  milestones: [
    { key: "recibido", label: "Recibido" },
    { key: "validando", label: "Validando" },
    { key: "resuelto", label: "Resuelto" },
  ],
  timeline: [],
  map: {
    can_render: false,
    fallback_when_no_coordinates: "timeline_only",
  },
  support: {
    enabled: false,
  },
});

const renderTrackingPage = () =>
  render(
    <MemoryRouter initialEntries={["/tracking/claim?code=M-123456&pin=654321&tenant_slug=junin"]}>
      <Routes>
        <Route path="/tracking/claim" element={<TrackingExperiencePage kind="claim" />} />
      </Routes>
    </MemoryRouter>,
  );

const LocationProbe = () => {
  const location = useLocation();
  return <output data-testid="tracking-location">{`${location.search}${location.hash}`}</output>;
};

describe("TrackingExperiencePage support contract", () => {
  beforeEach(() => {
    fetchTrackingExperienceMock.mockReset();
    sendTrackingSupportMessageMock.mockReset();
    socketHarness.handlers.clear();
    socketHarness.io.mockClear();
    socketHarness.socket.on.mockClear();
    socketHarness.socket.off.mockClear();
    socketHarness.socket.emit.mockClear();
    socketHarness.socket.disconnect.mockClear();
    socketHarness.socket.connected = false;
    HTMLElement.prototype.scrollIntoView = vi.fn();
  });

  it("uses a claim PIN from the URL fragment once and removes it before API polling", async () => {
    fetchTrackingExperienceMock.mockResolvedValueOnce(makeClaimPayload("offline"));
    const replaceStateSpy = vi.spyOn(window.history, "replaceState");

    render(
      <MemoryRouter
        initialEntries={["/tracking/claim?code=M-123456&tenant_slug=junin#pin=654321"]}
      >
        <Routes>
          <Route
            path="/tracking/claim"
            element={
              <>
                <TrackingExperiencePage kind="claim" />
                <LocationProbe />
              </>
            }
          />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(fetchTrackingExperienceMock).toHaveBeenCalledWith(
        expect.objectContaining({ pin: "654321" }),
      );
    });
    await waitFor(() => {
      expect(
        replaceStateSpy.mock.calls.some(
          (call) => call[2] === "/tracking/claim?code=M-123456&tenant_slug=junin",
        ),
      ).toBe(true);
    });
  });

  it("forwards signed order tracking tokens from the public URL", async () => {
    fetchTrackingExperienceMock.mockResolvedValueOnce(makeOrderPayload());

    render(
      <MemoryRouter initialEntries={["/tracking/order?code=pc-77&tenant_slug=junin&token=signed-token-123"]}>
        <Routes>
          <Route path="/tracking/order" element={<TrackingExperiencePage kind="order" />} />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(fetchTrackingExperienceMock).toHaveBeenCalledWith(
        expect.objectContaining({
          kind: "order",
          code: "pc-77",
          tenantSlug: "junin",
          token: "signed-token-123",
        }),
      );
    });
    expect((await screen.findAllByText("Pedido recibido")).length).toBeGreaterThan(0);
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
          operator_queue: {
            ...payload.support.operator_queue,
            state: "offline_waiting_admin_response",
            has_pending_customer_message: true,
            pending_customer_messages: 1,
            pending_since: "6 de junio, 00:05",
            next_team_action: "reply_from_admin_inbox",
            next_team_action_label: "Responder desde la bandeja de reclamos",
            customer_visible_label: "Tu mensaje quedo pendiente para el equipo",
            requires_admin_response: true,
          },
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
    expect(screen.getByTestId("tracking-delivery-rail")).toBeInTheDocument();
    expect(screen.getByText("Estado tipo delivery")).toBeInTheDocument();
    expect(screen.getByText(/Siguiente:/i)).toHaveTextContent("Validando");
    expect(screen.getByText("Sin salir del seguimiento")).toBeInTheDocument();
    expect(screen.getByText("Cola offline activa")).toBeInTheDocument();
    expect(screen.getByTestId("tracking-helpdesk-operational-state")).toHaveTextContent("Sin redireccion externa");
    expect(screen.getByTestId("tracking-helpdesk-operational-state")).toHaveTextContent("Canal interno del ticket");
    expect(screen.getByTestId("tracking-helpdesk-operational-state")).toHaveTextContent("SLA objetivo 240 min");
    expect(screen.getByTestId("tracking-helpdesk-operational-state")).toHaveTextContent("Actualizacion cada 15s");
    expect(screen.getByTestId("tracking-helpdesk-queue")).toHaveTextContent("El equipo esta al dia con este reclamo");
    expect(screen.getByTestId("tracking-helpdesk-queue")).toHaveTextContent("Pendientes: 0");
    expect(screen.getByRole("button", { name: /Dejar mensaje para el equipo/i })).toBeInTheDocument();
    expect(
      Array.from(container.querySelectorAll("a")).some((link) =>
        (link.getAttribute("href") || "").includes("/chat/"),
      ),
    ).toBe(false);

    fireEvent.click(screen.getByRole("button", { name: /Escribir mensaje/i }));
    await waitFor(() => {
      expect(screen.getByPlaceholderText(/mensaje offline/i)).toHaveFocus();
    });

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
    expect(screen.getByTestId("tracking-helpdesk-queue")).toHaveTextContent("Tu mensaje quedo pendiente para el equipo");
    expect(screen.getByTestId("tracking-helpdesk-queue")).toHaveTextContent("Pendientes: 1");
    expect(screen.getByTestId("tracking-helpdesk-queue")).toHaveTextContent("Responder desde la bandeja de reclamos");
  });

  it("uses the backend live CTA when the tenant service window is open", async () => {
    const payload = makeClaimPayload("live");
    let loadCount = 0;
    fetchTrackingExperienceMock.mockImplementation(async () => {
      loadCount += 1;
      return {
        ...payload,
        support: {
          ...payload.support,
          socket: {
            ...payload.support.socket,
            access_token: `signed-room-token-${loadCount}`,
          },
        },
      };
    });

    renderTrackingPage();

    expect(await screen.findByText("Atencion en vivo disponible")).toBeInTheDocument();
    expect(screen.getByText("Atencion inmediata")).toBeInTheDocument();
    expect(screen.getByTestId("tracking-helpdesk-operational-state")).toHaveTextContent("Respuesta esperada en hasta 30 min");
    expect(screen.getByRole("button", { name: /Chatear con un agente/i })).toBeInTheDocument();
    await waitFor(() => expect(socketHarness.io).toHaveBeenCalledTimes(1));

    act(() => socketHarness.handlers.get("connect")?.());
    expect(socketHarness.socket.emit).toHaveBeenCalledWith("join", {
      room: "ticket_municipio_42",
      access_token: "signed-room-token-1",
    });

    act(() => socketHarness.handlers.get("join_ack")?.({ room: "ticket_municipio_42" }));
    expect(await screen.findByText("Canal en vivo conectado")).toBeInTheDocument();

    act(() => socketHarness.handlers.get("new_chat_message")?.({ ticket_id: 42 }));
    await waitFor(() => expect(fetchTrackingExperienceMock).toHaveBeenCalledTimes(2));
    expect(socketHarness.io).toHaveBeenCalledTimes(1);
    expect(socketHarness.socket.disconnect).not.toHaveBeenCalled();

    act(() => socketHarness.handlers.get("ticket.assignment.changed")?.({ ticket_id: 42 }));
    await waitFor(() => expect(fetchTrackingExperienceMock).toHaveBeenCalledTimes(3));
    expect(socketHarness.io).toHaveBeenCalledTimes(1);
  });

  it("reconciles again when a newer realtime event arrives during an active refresh", async () => {
    const payload = makeClaimPayload("live");
    let resolvePendingRefresh: ((value: ReturnType<typeof makeClaimPayload>) => void) | null = null;
    fetchTrackingExperienceMock
      .mockResolvedValueOnce(payload)
      .mockImplementationOnce(
        () => new Promise((resolve) => {
          resolvePendingRefresh = resolve;
        }),
      )
      .mockResolvedValue(payload);

    renderTrackingPage();
    await waitFor(() => expect(socketHarness.io).toHaveBeenCalledTimes(1));

    act(() => socketHarness.handlers.get("ticket.status.changed")?.({ ticket_id: 42 }));
    await waitFor(() => expect(fetchTrackingExperienceMock).toHaveBeenCalledTimes(2));
    act(() => socketHarness.handlers.get("ticket.assignment.changed")?.({ ticket_id: 42 }));
    expect(fetchTrackingExperienceMock).toHaveBeenCalledTimes(2);

    act(() => resolvePendingRefresh?.(payload));
    await waitFor(() => expect(fetchTrackingExperienceMock).toHaveBeenCalledTimes(3));
  });

  it("restores the signed-room refresh budget after a successful rejoin", async () => {
    const payload = makeClaimPayload("live");
    fetchTrackingExperienceMock.mockResolvedValue(payload);

    renderTrackingPage();
    await waitFor(() => expect(socketHarness.io).toHaveBeenCalledTimes(1));

    act(() => socketHarness.handlers.get("join_error")?.({ error: "expired_access_token" }));
    await waitFor(() => expect(fetchTrackingExperienceMock).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(socketHarness.io).toHaveBeenCalledTimes(2));

    act(() => socketHarness.handlers.get("join_ack")?.({ room: "ticket_municipio_42" }));
    act(() => socketHarness.handlers.get("join_error")?.({ error: "expired_access_token" }));
    await waitFor(() => expect(fetchTrackingExperienceMock).toHaveBeenCalledTimes(3));
    await waitFor(() => expect(socketHarness.io).toHaveBeenCalledTimes(3));
  });

  it("keeps a legacy claim support fallback when the tracking payload has no support contract yet", async () => {
    const payload = makeClaimPayload("offline");
    const { support: _support, ...legacyPayload } = payload;
    fetchTrackingExperienceMock.mockResolvedValueOnce(legacyPayload);
    sendTrackingSupportMessageMock.mockResolvedValueOnce({
      message: "Mensaje guardado en el reclamo.",
    });

    renderTrackingPage();

    expect(await screen.findByText("Mesa de ayuda del reclamo")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Escribir mensaje/i }));
    await waitFor(() => {
      expect(screen.getByPlaceholderText(/mensaje offline/i)).toHaveFocus();
    });
    fireEvent.change(screen.getByPlaceholderText(/mensaje offline/i), {
      target: { value: "sumo informacion" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Dejar mensaje para el equipo/i }));

    await waitFor(() => {
      expect(sendTrackingSupportMessageMock).toHaveBeenCalledWith(
        expect.objectContaining({
          endpoint: "/tracking/api/send-claim-message",
          pin: "654321",
          message: "sumo informacion",
          code: "M-123456",
        }),
      );
    });
  });
});
