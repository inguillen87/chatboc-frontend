import React, { useEffect, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Loader2, CheckCircle2, ChevronDown, ArrowLeft, Send, Ticket } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

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

const API_URL = "https://api.chatboc.ar";

function useIsMobile(breakpoint = 768) {
  const [isMobile, setIsMobile] = useState(
    typeof window !== "undefined" ? window.innerWidth < breakpoint : false
  );
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < breakpoint);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [breakpoint]);
  return isMobile;
}

function fechaCorta(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  return `${d.getDate().toString().padStart(2, "0")}/${(d.getMonth() + 1)
    .toString()
    .padStart(2, "0")} ${d.getHours().toString().padStart(2, "0")}:${d
    .getMinutes()
    .toString()
    .padStart(2, "0")}`;
}

function resumenTexto(text, max = 70) {
  if (!text) return "";
  if (text.length <= max) return text;
  const idx = text.lastIndexOf(" ", max);
  return text.slice(0, idx > 20 ? idx : max) + "…";
}

export default function TicketsPanelPro() {
  const userId = 6;
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
  const isMobile = useIsMobile();

  useEffect(() => {
    if (selected && isMobile) window.scrollTo({ top: 0, behavior: "smooth" });
  }, [selected, isMobile]);

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

  const isCerrado = estado === "cerrado";

  return (
    <div
      className="flex h-[calc(100vh-80px)] rounded-2xl overflow-hidden
      bg-gradient-to-br from-slate-100 via-white to-slate-200
      dark:from-slate-900 dark:via-slate-950 dark:to-slate-900
      border border-slate-200 dark:border-slate-800
      max-w-6xl mx-auto my-8 shadow-2xl
      relative"
    >
      {/* Panel Tickets */}
      {(!isMobile || !selected) && (
        <div className="min-w-[300px] max-w-[400px] w-full sm:w-1/3 bg-slate-50 dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 flex flex-col">
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
                  title={t.pregunta}
                >
                  <div className="flex justify-between items-center">
                    <span className="font-semibold text-blue-900 dark:text-blue-200">#{t.nro_ticket}</span>
                    <span className={`px-3 py-1 rounded-full text-xs font-bold text-white shadow ${ESTADOS[t.estado]?.badge}`}>
                      {ESTADOS[t.estado]?.label || t.estado}
                    </span>
                  </div>
                  <span className="text-sm text-slate-800 dark:text-slate-200 truncate font-medium">
                    {t.asunto ? t.asunto : resumenTexto(t.pregunta)}
                  </span>
                  <span className="text-xs text-slate-400">{fechaCorta(t.fecha)}</span>
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Panel Detalle */}
      {selected && (
        <div className="flex-1 flex flex-col h-full">
          {/* Header (mejorado pero sin romper estructura) */}
          <div className={`flex items-center gap-3 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 p-5`}>
            {isMobile && (
              <button
                className="mr-2 rounded-full p-2 hover:bg-slate-100 dark:hover:bg-slate-900 transition"
                onClick={() => setSelected(null)}
                title="Volver a tickets"
              >
                <ArrowLeft className="w-6 h-6 text-slate-600 dark:text-slate-300" />
              </button>
            )}
            <Ticket className="text-blue-600 dark:text-blue-300 w-7 h-7" />
            <div className="flex flex-col flex-1 min-w-0 ml-2">
              <div className="flex items-center gap-2 flex-wrap min-w-0">
                <span className="font-bold text-lg truncate text-slate-900 dark:text-white">
                  Ticket #{selected.nro_ticket || selected.id || "?"}
                </span>
                <span className="px-2 py-1 rounded bg-blue-600 text-white text-xs font-bold whitespace-nowrap">
                  {selected.nombre_vecino || selected.nombre_empresa || "Vecino"}
                </span>
                <span className={`px-2 py-1 rounded-full text-xs font-bold text-white shadow whitespace-nowrap ${ESTADOS[selected.estado]?.badge}`}>
                  {ESTADOS[selected.estado]?.label || selected.estado}
                </span>
              </div>
              <div className="flex gap-4 text-xs text-gray-500 mt-1 truncate">
                {selected.email && <span>{selected.email}</span>}
                {selected.telefono && <span>{selected.telefono}</span>}
              </div>
            </div>
            {!isMobile && (
              <div className="relative ml-2">
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
            )}
          </div>

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

          {/* Mensajes/comentarios */}
          <div className="flex-1 bg-gradient-to-br from-slate-50 via-white to-slate-100 dark:from-slate-900 dark:via-slate-950 dark:to-slate-900 p-4 flex flex-col gap-2 overflow-y-auto">
            <div className="mb-2 pb-2 border-b border-slate-200 dark:border-slate-800">
              <div className="font-semibold text-lg mb-1 text-slate-900 dark:text-slate-100">
                {selected.asunto || resumenTexto(selected.pregunta, 80)}
              </div>
              <div className="text-base whitespace-pre-line text-slate-700 dark:text-slate-300">{selected.pregunta}</div>
            </div>
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
                    className={`flex ${c.es_admin ? "justify-end" : "justify-start"}`}
                  >
                    <div
                      className={`
                        max-w-xs sm:max-w-lg px-5 py-3 rounded-2xl shadow
                        ${c.es_admin
                          ? "bg-gradient-to-r from-blue-600 to-blue-400 text-white rounded-br-none"
                          : "bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-bl-none"}
                        relative group
                      `}
                    >
                      <div className="text-sm">{c.comentario}</div>
                      <div className="text-[11px] text-right text-gray-300 mt-1">
                        <span className="group-hover:opacity-100 opacity-60 transition" title={c.fecha}>
                          {fechaCorta(c.fecha)}
                        </span>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            )}
            <div ref={chatBottomRef} />
          </div>

          {/* Input respuesta */}
          <div
            className={`border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 p-3 flex gap-2
            ${isCerrado ? "opacity-60 pointer-events-none select-none" : ""}
            sticky bottom-0 z-20`}
          >
            <Input
              className="flex-1 rounded-2xl shadow border-none bg-slate-100 dark:bg-slate-800 px-4 py-3 text-base"
              placeholder={isCerrado ? "Ticket cerrado. No podés responder." : "Responder como administración..."}
              value={mensaje}
              onChange={(e) => setMensaje(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && responderTicket()}
              disabled={sending || isCerrado}
              maxLength={500}
            />
            <Button
              className="rounded-2xl shadow-lg font-bold flex items-center gap-1 text-base px-6 py-2"
              onClick={responderTicket}
              disabled={sending || !mensaje.trim() || isCerrado}
              variant="default"
            >
              {sending ? <Loader2 className="animate-spin" size={20} /> : <Send size={22} />}
              <span className="hidden sm:inline">Enviar</span>
            </Button>
          </div>
          {error && (
            <div className="text-red-500 text-center py-2 whitespace-pre-wrap">{error}</div>
          )}
        </div>
      )}
    </div>
  );
}
