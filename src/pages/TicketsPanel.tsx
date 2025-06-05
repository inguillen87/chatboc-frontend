import React, { useEffect, useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Loader2, CheckCircle2, ChevronDown, Send } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

function fechaCorta(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  return `${d.getDate()}/${d.getMonth() + 1} ${d.getHours()}:${d
    .getMinutes()
    .toString()
    .padStart(2, "0")}`;
}

// Mapeo para colores visuales por estado
const ESTADOS = {
  nuevo: {
    label: "Nuevo",
    color: "bg-blue-100 text-blue-700 border-blue-400",
    bg: "bg-blue-50",
    badge: "bg-blue-600",
  },
  "en curso": {
    label: "En Curso",
    color: "bg-yellow-100 text-yellow-800 border-yellow-400",
    bg: "bg-yellow-50",
    badge: "bg-yellow-500",
  },
  derivado: {
    label: "Derivado",
    color: "bg-purple-100 text-purple-700 border-purple-400",
    bg: "bg-purple-50",
    badge: "bg-purple-500",
  },
  resuelto: {
    label: "Resuelto",
    color: "bg-green-100 text-green-700 border-green-400",
    bg: "bg-green-50",
    badge: "bg-green-600",
  },
  cerrado: {
    label: "Cerrado",
    color: "bg-gray-200 text-gray-500 border-gray-400",
    bg: "bg-gray-100",
    badge: "bg-gray-400",
  },
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

  // Tickets fetch
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

  // Polling comentarios si hay ticket seleccionado
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

  // Responsive: ocultar panel de tickets si está seleccionado (mobile)
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 800);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  // Si está cerrado, banner superior
  const isCerrado = estado === "cerrado";

  return (
    <div
      className="flex h-[calc(100vh-80px)] rounded-2xl overflow-hidden
      bg-gradient-to-br from-slate-100 via-white to-slate-200
      dark:from-slate-900 dark:via-slate-950 dark:to-slate-900
      border border-slate-200 dark:border-slate-800
      max-w-6xl mx-auto my-8 shadow-2xl
      "
    >
      {/* Panel Tickets */}
      {!isMobile || !selected ? (
        <div className="min-w-[320px] max-w-[400px] w-1/3 bg-slate-50 dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 flex flex-col">
          <div className="px-6 py-5 flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 shadow-sm">
            <CheckCircle2 className="text-blue-500" />
            <span className="font-bold text-lg tracking-tight">Tickets de Vecinos</span>
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
            <div>
              {tickets.map((t) => (
                <motion.div
                  key={t.id}
                  layout
                  initial={{ opacity: 0, x: -25 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ type: "spring", duration: 0.28 }}
                  className={`p-4 flex flex-col gap-1 border-b border-slate-100 dark:border-slate-800 cursor-pointer transition hover:bg-blue-100/60 hover:dark:bg-blue-950/60
                    ${selected?.id === t.id ? "bg-blue-50 dark:bg-blue-900/70 border-l-4 border-blue-500" : ""}
                  `}
                  onClick={() => handleSelectTicket(t)}
                >
                  <div className="flex justify-between items-center">
                    <span className="font-semibold text-blue-900 dark:text-blue-200">#{t.nro_ticket}</span>
                    <span className={`px-3 py-1 rounded-full text-xs font-bold text-white shadow ${ESTADOS[t.estado]?.badge}`}>
                      {ESTADOS[t.estado]?.label || t.estado}
                    </span>
                  </div>
                  <span className="text-sm text-slate-800 dark:text-slate-200 truncate">
                    {t.pregunta?.slice(0, 68) || "Sin asunto"}
                  </span>
                  <span className="text-xs text-slate-400">{fechaCorta(t.fecha)}</span>
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      ) : null}

      {/* Panel Detalle */}
      {selected && (
        <div className="flex-1 flex flex-col h-full">
          {/* Banner ticket cerrado */}
          <AnimatePresence>
            {isCerrado && (
              <motion.div
                initial={{ opacity: 0, y: -30 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -30 }}
                className="bg-gradient-to-r from-gray-800 to-gray-700 text-white text-center py-3 px-4 font-bold tracking-wide text-base shadow-md"
              >
                Este ticket está <span className="uppercase">cerrado</span> y no acepta nuevas respuestas.
              </motion.div>
            )}
          </AnimatePresence>
          <div className="flex items-center gap-4 p-5 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950">
            <Avatar>
              <AvatarFallback>
                {selected.nombre_empresa?.slice(0, 2).toUpperCase() || "VC"}
              </AvatarFallback>
              <AvatarImage src={selected.logo_url || "/avatar-muni.png"} alt="" />
            </Avatar>
            <div className="flex flex-col flex-1">
              <div className="font-bold text-xl leading-tight text-slate-900 dark:text-slate-100">{selected.nombre_empresa || "Vecino"}</div>
              <div className="text-xs text-gray-500">{selected.email || "-"}</div>
              <div className="text-xs text-gray-500">{selected.telefono || "-"}</div>
            </div>
            <div className="relative">
              <Button
                variant="outline"
                className={`flex items-center gap-1 rounded-full border border-gray-300 dark:border-slate-700 shadow text-base font-bold transition ${ESTADOS[estado]?.color}`}
                onClick={() => setDropdownVisible(!dropdownVisible)}
              >
                <span className="w-3 h-3 rounded-full mr-2 shadow" style={{ background: `var(--tw-${ESTADOS[estado]?.badge || "bg-blue-600"})` }}></span>
                {ESTADOS[estado]?.label || estado}
                <ChevronDown size={16} className="ml-1" />
              </Button>
              {dropdownVisible && (
                <div className="absolute mt-2 bg-white dark:bg-slate-800 shadow-xl rounded-xl z-20 min-w-[140px] border border-gray-200 dark:border-gray-700 animate-fadeIn">
                  {Object.keys(ESTADOS).map((k) => (
                    <div
                      key={k}
                      className={`flex items-center gap-2 px-4 py-2 cursor-pointer hover:bg-blue-100 hover:dark:bg-blue-950 text-sm
                        ${estado === k ? "font-bold text-blue-700 dark:text-blue-300" : ""}
                      `}
                      onClick={() => cambiarEstado(k)}
                    >
                      <span className={`inline-block w-2 h-2 rounded-full ${ESTADOS[k]?.badge}`}></span>
                      {ESTADOS[k]?.label}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
          {/* Mensajes/comentarios */}
          <div className="flex-1 bg-gradient-to-br from-slate-50 via-white to-slate-100 dark:from-slate-900 dark:via-slate-950 dark:to-slate-900 p-6 flex flex-col gap-2 overflow-y-auto">
            {loadingDetalle ? (
              <div className="flex flex-col items-center justify-center h-40">
                <Loader2 className="animate-spin text-gray-400" size={32} />
              </div>
            ) : comentarios.length === 0 ? (
              <div className="text-gray-400 text-center py-8">No hay comentarios.</div>
            ) : (
              <AnimatePresence initial={false}>
                {comentarios.map((c, idx) => (
                  <motion.div
                    key={c.id || idx}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 20 }}
                    transition={{ type: "spring", duration: 0.22 }}
                    className={`flex ${c.es_admin ? "justify-end" : "justify-start"} mb-2`}
                  >
                    <div
                      className={`max-w-lg px-5 py-3 rounded-2xl shadow-md transition-all
                        ${c.es_admin
                          ? "bg-gradient-to-tr from-blue-700 to-blue-400 text-white rounded-br-none"
                          : "bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-bl-none"
                        }
                      `}
                      title={new Date(c.fecha).toLocaleString()}
                    >
                      <div className="text-base leading-tight">{c.comentario}</div>
                      <div className="text-[11px] text-right text-gray-300 mt-1">
                        {fechaCorta(c.fecha)}
                      </div>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            )}
            <div ref={chatBottomRef} />
          </div>
          {/* Input responder */}
          {!isCerrado && (
            <div className="border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 p-4 flex gap-2">
              <Input
                className="flex-1 rounded-xl focus:ring-2 focus:ring-blue-400 dark:focus:ring-blue-700"
                placeholder="Responder como administración..."
                value={mensaje}
                onChange={(e) => setMensaje(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && responderTicket()}
                disabled={sending}
              />
              <Button
                className="rounded-xl px-4 py-2 shadow-md bg-blue-600 hover:bg-blue-700 text-white transition-all"
                onClick={responderTicket}
                disabled={sending || !mensaje.trim()}
              >
                {sending ? <Loader2 className="animate-spin" size={18} /> : <Send size={18} />}
              </Button>
            </div>
          )}
          {error && (
            <div className="text-red-500 text-center py-2 whitespace-pre-wrap">{error}</div>
          )}
        </div>
      )}
    </div>
  );
}
