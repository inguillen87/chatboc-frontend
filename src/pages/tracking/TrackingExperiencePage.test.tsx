import React from "react";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
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
      created_at: "6 de junio, 00:03",
      updated_at: "6 de junio, 00:04",
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

  it("masks the numeric claim PIN, exposes a toggle, and focuses the field when it is missing", async () => {
    render(
      <MemoryRouter initialEntries={["/tracking/claim?code=M-123456&tenant_slug=junin"]}>
        <Routes>
          <Route path="/tracking/claim" element={<TrackingExperiencePage kind="claim" />} />
        </Routes>
      </MemoryRouter>,
    );

    const pinInput = screen.getByLabelText("PIN del reclamo");
    expect(pinInput).toHaveAttribute("type", "password");
    expect(pinInput).toHaveAttribute("inputmode", "numeric");
    expect(pinInput).toHaveAttribute("aria-describedby", "tracking-pin-help");

    fireEvent.click(screen.getByRole("button", { name: "Mostrar PIN" }));
    expect(pinInput).toHaveAttribute("type", "text");
    expect(screen.getByRole("button", { name: "Ocultar PIN" })).toHaveAttribute("aria-pressed", "true");

    fireEvent.click(screen.getByRole("button", { name: "Actualizar estado" }));

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Ingresa el PIN");
    await waitFor(() => expect(pinInput).toHaveFocus());
    expect(pinInput).toHaveAttribute("aria-invalid", "true");
    expect(pinInput).toHaveAttribute("aria-describedby", "tracking-pin-help tracking-page-error");

    fireEvent.change(pinInput, { target: { value: "654321" } });
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(pinInput).toHaveAttribute("aria-invalid", "false");
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

  it("keeps a query PIN in memory while removing it from browser history", async () => {
    fetchTrackingExperienceMock.mockResolvedValueOnce(makeClaimPayload("offline"));
    const replaceStateSpy = vi.spyOn(window.history, "replaceState");

    renderTrackingPage();

    await waitFor(() => {
      expect(fetchTrackingExperienceMock).toHaveBeenCalledWith(
        expect.objectContaining({ pin: "654321", tenantSlug: "junin" }),
      );
    });
    expect(screen.getByLabelText("PIN del reclamo")).toHaveValue("654321");
    expect(
      replaceStateSpy.mock.calls.some(
        (call) => call[2] === "/tracking/claim?code=M-123456&tenant_slug=junin",
      ),
    ).toBe(true);
    expect(await screen.findByTestId("tracking-helpdesk")).toBeInTheDocument();
  });

  it("survives an application-provider remount after the query credential is scrubbed", async () => {
    fetchTrackingExperienceMock.mockResolvedValue(makeClaimPayload("offline"));
    const firstRender = render(
      <MemoryRouter initialEntries={["/tracking/claim?code=M-REMOUNT-1&pin=112233&tenant_slug=junin"]}>
        <Routes>
          <Route path="/tracking/claim" element={<TrackingExperiencePage kind="claim" />} />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(fetchTrackingExperienceMock).toHaveBeenCalledWith(
        expect.objectContaining({ code: "M-REMOUNT-1", pin: "112233" }),
      );
    });
    firstRender.unmount();
    fetchTrackingExperienceMock.mockClear();

    render(
      <MemoryRouter initialEntries={["/tracking/claim?code=M-REMOUNT-1&tenant_slug=junin"]}>
        <Routes>
          <Route path="/tracking/claim" element={<TrackingExperiencePage kind="claim" />} />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(fetchTrackingExperienceMock).toHaveBeenCalledWith(
        expect.objectContaining({ code: "M-REMOUNT-1", pin: "112233" }),
      );
    });
    expect(screen.getByLabelText("PIN del reclamo")).toHaveValue("112233");
  });

  it("humanizes real API status keys and ISO timestamps", async () => {
    const payload = makeClaimPayload("offline");
    fetchTrackingExperienceMock.mockResolvedValueOnce({
      ...payload,
      status: {
        current_stage: "en_proceso",
        raw_status: "en_proceso",
        milestones: ["recibido", "en_proceso", "resuelto"],
      },
      resource: {
        ...payload.resource,
        updated_at: "2026-06-06T03:11:29.310634+00:00",
      },
      timeline: [
        {
          id: "created",
          label: "estado_actual",
          message: "Caso actualizado.",
          created_at: "2026-06-06T03:11:29.310634+00:00",
        },
      ],
    });

    renderTrackingPage();

    const summary = await screen.findByTestId("tracking-summary-header");
    expect(summary).toHaveTextContent("En proceso");
    expect(summary).not.toHaveTextContent("En_proceso");
    expect(summary).not.toHaveTextContent("2026-06-06T03:11:29.310634+00:00");
    expect((await screen.findAllByText("Estado actual")).length).toBeGreaterThan(0);
    expect(document.body).not.toHaveTextContent("2026-06-06T03:11:29.310634+00:00");
  });

  it("renders claim evidence through signed delivery URLs with source context", async () => {
    const payload = makeClaimPayload("offline");
    fetchTrackingExperienceMock.mockResolvedValueOnce({
      ...payload,
      attachments: [
        {
          id: 91,
          name: "bache.jpg",
          url: "tenant/junin/private/bache.jpg",
          download_url: "https://signed.example/bache.jpg?token=safe",
          thumbUrl: "https://signed.example/bache-thumb.webp?token=safe",
          mimeType: "image/jpeg",
          size: 2048,
          source: "whatsapp_flow",
          storage_access: "signed",
          status: "ready",
        },
      ],
    });

    renderTrackingPage();

    const evidence = await screen.findByTestId("tracking-evidence");
    expect(evidence).toHaveTextContent("Evidencia del reclamo");
    expect(evidence).toHaveTextContent("bache.jpg");
    expect(evidence).toHaveTextContent("Enviado por WhatsApp");
    expect(evidence).toHaveTextContent("2 KB");
    expect(evidence).toHaveTextContent("Acceso seguro");
    expect(within(evidence).getByRole("link", { name: "Abrir bache.jpg" })).toHaveAttribute(
      "href",
      "https://signed.example/bache.jpg?token=safe",
    );
    expect(evidence.querySelector("img")).toHaveAttribute(
      "src",
      "https://signed.example/bache-thumb.webp?token=safe",
    );
    expect(evidence).not.toHaveTextContent("tenant/junin/private/bache.jpg");
  });

  it("announces tracking load failures and focuses the alert", async () => {
    fetchTrackingExperienceMock.mockRejectedValueOnce(new Error("El reclamo no pudo consultarse."));

    renderTrackingPage();

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("El reclamo no pudo consultarse.");
    expect(alert).toHaveAttribute("aria-live", "assertive");
    await waitFor(() => expect(alert).toHaveFocus());
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

  it("keeps the map available when the tracking contract provides coordinates", async () => {
    const payload = makeClaimPayload("offline");
    fetchTrackingExperienceMock.mockResolvedValueOnce({
      ...payload,
      map: {
        can_render: true,
        origin: { lat: -34.588, lng: -60.949, name: "Base operativa" },
        destination: { lat: -34.593, lng: -60.944, name: "Reclamo" },
      },
    });

    renderTrackingPage();

    expect(await screen.findByTestId("tracking-map")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Ver mapa" })).toBeEnabled();
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
    expect(screen.getByText("Referencia interna #42")).toBeInTheDocument();
    expect(screen.queryByText("Ticket #42")).not.toBeInTheDocument();
    const summaryHeader = screen.getByTestId("tracking-summary-header");
    expect(within(summaryHeader).getByText("Estado actual")).toBeInTheDocument();
    expect(within(summaryHeader).getByText("Proxima etapa")).toBeInTheDocument();
    expect(within(summaryHeader).getByText("Ultima actualizacion")).toBeInTheDocument();
    expect(within(summaryHeader).getByText("Validando")).toBeInTheDocument();
    expect(within(summaryHeader).getByText("6 de junio, 00:04")).toBeInTheDocument();
    expect(screen.getByRole("progressbar", { name: "Avance del seguimiento" })).toHaveAttribute(
      "aria-valuenow",
      "0",
    );

    const priorityContent = screen.getByTestId("tracking-priority-content");
    const timelineHeading = within(priorityContent).getByRole("heading", { name: "Timeline" });
    const helpdesk = within(priorityContent).getByTestId("tracking-helpdesk");
    const mapHeading = screen.getByRole("heading", { name: "Mapa y recorrido" });
    expect(timelineHeading).toBeInTheDocument();
    expect(helpdesk).toBeInTheDocument();
    expect(priorityContent.compareDocumentPosition(mapHeading) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();

    const details = screen.getByTestId("tracking-details-disclosure") as HTMLDetailsElement;
    expect(details.open).toBe(false);
    fireEvent.click(within(details).getByText("Detalles y diagnostico"));
    expect(details.open).toBe(true);
    expect(within(details).getByText("Dentro del seguimiento")).toBeInTheDocument();
    expect(within(details).getByText("Habilitados")).toBeInTheDocument();
    expect(within(details).getByText("Bandeja de reclamos")).toBeInTheDocument();
    expect(within(details).getByText("req-track-123")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Hitos" })).toBeInTheDocument();
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
    const composer = screen.getByLabelText("Mensaje para la mesa de ayuda");
    expect(composer).toHaveAttribute("aria-describedby", "tracking-support-message-help");
    await waitFor(() => {
      expect(composer).toHaveFocus();
    });

    fireEvent.change(composer, {
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

  it("announces support send errors and moves focus to the actionable alert", async () => {
    fetchTrackingExperienceMock.mockResolvedValueOnce(makeClaimPayload("offline"));
    sendTrackingSupportMessageMock.mockRejectedValueOnce(new Error("La mesa de ayuda no esta disponible."));

    renderTrackingPage();

    const composer = await screen.findByLabelText("Mensaje para la mesa de ayuda");
    fireEvent.change(composer, { target: { value: "Necesito sumar informacion" } });
    fireEvent.click(screen.getByRole("button", { name: /Dejar mensaje para el equipo/i }));

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("La mesa de ayuda no esta disponible.");
    expect(alert).toHaveAttribute("aria-live", "assertive");
    await waitFor(() => expect(alert).toHaveFocus());
    expect(composer).toHaveAttribute(
      "aria-describedby",
      "tracking-support-message-help tracking-support-message-notice",
    );
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
    expect(within(screen.getByTestId("tracking-helpdesk")).getByText("En vivo")).toBeInTheDocument();
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
    const composer = screen.getByLabelText("Mensaje para la mesa de ayuda");
    await waitFor(() => {
      expect(composer).toHaveFocus();
    });
    fireEvent.change(composer, {
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
