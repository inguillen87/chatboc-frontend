import React, { useEffect, useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Loader2, CheckCircle2, ChevronDown } from "lucide-react";

function fechaCorta(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  return `${d.getDate()}/${d.getMonth() + 1} ${d.getHours()}:${d
    .getMinutes()
    .toString()
    .padStart(2, "0")}`;
}

const ESTADOS = {
  nuevo: { label: "Nuevo", color: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-200" },
  "en curso": { label: "En Curso", color: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-200" },
  derivado: { label: "Derivado", color: "bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-200" },
  resuelto: { label: "Resuelto", color: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-200" },
  cerrado: { label: "Cerrado", color: "bg-gray-200 text-gray-500 dark:bg-gray-700 dark:text-gray-300" },
};

const API_URL = "https://api.chatboc.ar"; // Cambiá si usás otro dominio

export default function TicketsPanelPro() {
  const userId = 6; // Cambiá por auth real cuando toque
  const [tickets, setTickets] = useState([]);
  const [selected, setSelected] = useState(null);
  const [comentarios, setComentarios] = useState([]);
  const [mensaje, setMensaje] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadingDetalle, setLoadingDetalle] = useState(false);
  const [sending, setSending] = useState(false);
  const [estado, setEstado] = useState("");
  const [dropdownVisible, setDropdownVisible] = useState(false);
  const chatBottomRef = useRef(null);
  const [error, setError] = useState(null);

  // Fetch tickets
  useEffect(() => {
    setLoading(true);
    setError(null);
    fetch(`${API_URL}/tickets/municipio?user_id=${userId}`, { credentials: "include" })
      .then(async (res) => {
        if (!res.ok) {
          const text = await res.text();
          throw new Error(`Error tickets: [${res.status}] ${text.slice(0, 100)}`);
        }
        const data = await res.json();
        if (!data.ok) throw new Error(data.error || "Sin tickets");
        setTickets(data.tickets || []);
      })
      .catch((err) => setError(String(err.message || err)))
      .finally(() => setLoading(false));
  }, [userId]);

  // Select ticket y cargar comentarios
  const handleSelectTicket = (t) => {
    setSelected(t);
    setEstado(t.estado);
    setComentarios([]);
    setLoadingDetalle(true);
    setError(null);

    fetch(`${API_URL}/tickets/municipio/${t.id}/comentarios?user_id=${userId}`, { credentials: "include" })
      .then(async (res) => {
        if (!res.ok) {
          const text = await res.text();
          throw new Error(`Error comentarios: [${res.status}] ${text.slice(0, 100)}`);
        }
        const data = await res.json();
        if (!data.ok) throw new Error(data.error || "Sin comentarios");
        setComentarios(data.comentarios || []);
      })
      .catch((err) => setError(String(err.message || err)))
      .finally(() => {
        setLoadingDetalle(false);
        setTimeout(() => chatBottomRef.current?.scrollIntoView({ behavior: "smooth" }), 150);
      });
  };

  // Polling solo si hay ticket seleccionado
  useEffect(() => {
    if (!selected) return;
    const interval = setInterval(() => {
      fetch(`${API_URL}/tickets/municipio/${selected.id}/comentarios?user_id=${userId}`, { credentials: "include" })
        .then(async (res) => {
          if (!res.ok) return;
          const data = await res.json();
          if (data.ok) setComentarios(data.comentarios || []);
        });
    }, 4000);
    return () => clearInterval(interval);
  }, [selected, userId]);

  // Cambiar estado del ticket
  const cambiarEstado = (nuevo) => {
    if (!selected) return;
    setDropdownVisible(false);
    setEstado(nuevo);
    setError(null);
    fetch(`${API_URL}/tickets/municipio/${selected.id}/estado`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ estado: nuevo, user_id: userId }),
    })
      .then(async (res) => {
        if (!res.ok) {
          const text = await res.text();
          throw new Error(`Error al cambiar estado: [${res.status}] ${text.slice(0, 100)}`);
        }
        const data = await res.json();
        if (!data.ok) throw new Error(data.error || "Error al cambiar estado");
        setTickets((tickets) =>
          tickets.map((t) => (t.id === selected.id ? { ...t, estado: nuevo } : t))
        );
        setSelected((s) => (s ? { ...s, estado: nuevo } : s));
      })
      .catch((err) => setError(String(err.message || err)));
  };

  // Responder un ticket
  const responderTicket = () => {
    if (!mensaje.trim() || !selected) return;
    setSending(true);
    setError(null);

    fetch(`${API_URL}/tickets/municipio/${selected.id}/comentarios`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ comentario: mensaje, user_id: userId }),
    })
      .then(async (res) => {
        if (!res.ok) {
          const text = await res.text();
          throw new Error(`Error al enviar comentario: [${res.status}] ${text.slice(0, 100)}`);
        }
        const data = await res.json();
        if (!data.ok) throw new Error(data.error || "Error enviando comentario");
        setMensaje("");
        // Recargar comentarios después de enviar
        return fetch(`${API_URL}/tickets/municipio/${selected.id}/comentarios?user_id=${userId}`, { credentials: "include" });
      })
      .then(async (res) => {
        if (res && !res.ok) {
          const text = await res.text();
          throw new Error(`Error recargando comentarios: [${res.status}] ${text.slice(0, 100)}`);
        }
        const data = res ? await res.json() : { ok: false, comentarios: [] };
        if (data.ok) setComentarios(data.comentarios || []);
        setSending(false);
        setTimeout(() => chatBottomRef.current?.scrollIntoView({ behavior: "smooth" }), 200);
      })
      .catch((err) => {
        setSending(false);
        setError(String(err.message || err));
      });
  };

  return (
    <div className="flex h-[calc(100vh-80px)] shadow-2xl rounded-2xl overflow-hidden 
      bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 
      max-w-6xl mx-auto my-8 text-gray-900 dark:text-gray-100">
      {/* Panel de tickets */}
      <div className="w-1/3 bg-gray-50 dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 flex flex-col">
        <div className="px-6 py-5 flex items-center gap-2 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
          <CheckCircle2 className="text-blue-500" />
          <span className="font-bold text-lg">Tickets de Vecinos</span>
        </div>
        <div className="flex-1 overflow-y-auto">
          {loading && (
            <div className="flex flex-col items-center justify-center h-40">
              <Loader2 className="animate-spin text-gray-400" size={32} />
            </div>
          )}
          {error && (
            <div className="text-red-500 text-center py-4 whitespace-pre-wrap">{error}</div>
          )}
          {!loading && !error && tickets.length === 0 && (
            <div className="flex flex-col items-center justify-center h-40 text-gray-400">
              No hay tickets cargados.
            </div>
          )}
          {tickets.map((t) => (
            <div
              key={t.id}
              className={`p-4 flex flex-col gap-1 border-b border-gray-100 dark:border-gray-700 cursor-pointer transition hover:bg-blue-100 hover:dark:bg-blue-950 ${
                selected?.id === t.id ? "bg-blue-50 dark:bg-blue-900" : ""
              }`}
              onClick={() => handleSelectTicket(t)}
            >
              <div className="flex justify-between items-center">
                <span className="font-semibold text-blue-800 dark:text-blue-200">#{t.nro_ticket}</span>
                <Badge className={ESTADOS[t.estado]?.color + " rounded px-2 py-1 text-xs"}>
                  {ESTADOS[t.estado]?.label || t.estado}
                </Badge>
              </div>
              <span className="text-sm text-gray-700 dark:text-gray-300">
                {t.pregunta?.slice(0, 70) || "Sin asunto"}
              </span>
              <span className="text-xs text-gray-400">{fechaCorta(t.fecha)}</span>
            </div>
          ))}
        </div>
      </div>
      {/* Panel de detalle */}
      <div className="flex-1 flex flex-col h-full">
        {selected ? (
          <>
            <div className="flex items-center gap-4 p-5 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
              <Avatar>
                <AvatarFallback>
                  {selected.nombre_empresa?.slice(0, 2).toUpperCase() || "VC"}
                </AvatarFallback>
                <AvatarImage src={selected.logo_url || "/avatar-muni.png"} alt="" />
              </Avatar>
              <div className="flex flex-col flex-1">
                <div className="font-bold text-xl">{selected.nombre_empresa || "Vecino"}</div>
                <div className="text-xs text-gray-500">{selected.email || "-"}</div>
                <div className="text-xs text-gray-500">{selected.telefono || "-"}</div>
              </div>
              <div className="relative">
                <Button
                  variant="outline"
                  className="flex items-center gap-1 rounded-full border-gray-300 dark:border-gray-700 shadow"
                  onClick={() => setDropdownVisible(!dropdownVisible)}
                >
                  {ESTADOS[estado]?.label || estado}
                  <ChevronDown size={16} className="ml-1" />
                </Button>
                {dropdownVisible && (
                  <div className="absolute mt-2 bg-white dark:bg-gray-800 shadow-xl rounded-xl z-20 min-w-[140px] border border-gray-200 dark:border-gray-700">
                    {Object.keys(ESTADOS).map((k) => (
                      <div
                        key={k}
                        className={`px-4 py-2 cursor-pointer hover:bg-blue-100 hover:dark:bg-blue-950 text-sm ${
                          estado === k ? "font-bold text-blue-600 dark:text-blue-200" : ""
                        }`}
                        onClick={() => cambiarEstado(k)}
                      >
                        {ESTADOS[k]?.label}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <div className="flex-1 bg-gray-50 dark:bg-gray-900 p-6 flex flex-col gap-2 overflow-y-auto">
              {loadingDetalle ? (
                <div className="flex flex-col items-center justify-center h-40">
                  <Loader2 className="animate-spin text-gray-400" size={32} />
                </div>
              ) : comentarios.length === 0 ? (
                <div className="text-gray-400 text-center py-8">No hay comentarios.</div>
              ) : (
                comentarios.map((c, idx) => (
                  <div
                    key={c.id || idx}
                    className={`flex ${c.es_admin ? "justify-end" : "justify-start"}`}
                  >
                    <div
                      className={`max-w-lg px-5 py-3 rounded-2xl shadow ${
                        c.es_admin
                          ? "bg-gradient-to-r from-blue-600 to-blue-400 text-white rounded-br-none"
                          : "bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-bl-none"
                      }`}
                    >
                      <div className="text-sm">{c.comentario}</div>
                      <div className="text-[11px] text-right text-gray-300 mt-1">
                        {fechaCorta(c.fecha)}
                      </div>
                    </div>
                  </div>
                ))
              )}
              <div ref={chatBottomRef} />
            </div>
            <div className="border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-4 flex gap-2">
              <Input
                className="flex-1 rounded-xl"
                placeholder="Responder como administración..."
                value={mensaje}
                onChange={(e) => setMensaje(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && responderTicket()}
                disabled={sending}
              />
              <Button
                className="rounded-xl"
                onClick={responderTicket}
                disabled={sending || !mensaje.trim()}
              >
                {sending ? <Loader2 className="animate-spin" size={18} /> : "Enviar"}
              </Button>
            </div>
            {error && (
              <div className="text-red-500 text-center py-2 whitespace-pre-wrap">{error}</div>
            )}
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-gray-400 text-xl">
            Seleccioná un ticket de la lista para ver el detalle y responder
          </div>
        )}
      </div>
    </div>
  );
}
