import React, { useEffect, useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Loader2, CheckCircle2, ChevronDown } from "lucide-react";

function fechaCorta(iso: string) {
  if (!iso) return "";
  const d = new Date(iso);
  return `${d.getDate()}/${d.getMonth() + 1} ${d.getHours()}:${d
    .getMinutes()
    .toString()
    .padStart(2, "0")}`;
}

const ESTADOS = {
  nuevo: { label: "Nuevo", color: "bg-blue-100 text-blue-700" },
  "en curso": { label: "En Curso", color: "bg-yellow-100 text-yellow-700" },
  derivado: { label: "Derivado", color: "bg-purple-100 text-purple-700" },
  resuelto: { label: "Resuelto", color: "bg-green-100 text-green-700" },
  cerrado: { label: "Cerrado", color: "bg-gray-200 text-gray-500" },
};

const API_BASE_URL = import.meta.env.VITE_API_URL || "";

export default function TicketsPanel() {
  // Tomar userId real desde localStorage
  const storedUser = localStorage.getItem("user");
  const userId = storedUser ? JSON.parse(storedUser).id : null;

  const [tickets, setTickets] = useState<any[]>([]);
  const [selected, setSelected] = useState<any | null>(null);
  const [comentarios, setComentarios] = useState<any[]>([]);
  const [mensaje, setMensaje] = useState("");
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [estado, setEstado] = useState("");
  const [dropdownVisible, setDropdownVisible] = useState(false);
  const chatBottomRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!userId) {
      window.location.href = "/login";
      return;
    }
    setLoading(true);
    fetch(`${API_BASE_URL}/tickets/municipio?user_id=${userId}`, {
      credentials: "include",
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.ok) setTickets(data.tickets || []);
        else setTickets([]);
      })
      .finally(() => setLoading(false));
  }, [userId]);

  function handleSelectTicket(t: any) {
    setSelected(t);
    setEstado(t.estado);
    setLoading(true);
    fetch(`${API_BASE_URL}/tickets/municipio/${t.id}/comentarios?user_id=${userId}`, {
      credentials: "include",
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.ok) setComentarios(data.comentarios || []);
        else setComentarios([]);
      })
      .finally(() => {
        setLoading(false);
        setTimeout(() => chatBottomRef.current?.scrollIntoView({ behavior: "smooth" }), 200);
      });
  }

  function cambiarEstado(nuevo: string) {
    setDropdownVisible(false);
    setEstado(nuevo);
    fetch(`${API_BASE_URL}/tickets/municipio/${selected.id}/estado`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ estado: nuevo, user_id: userId }),
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.ok) {
          setTickets((tickets) =>
            tickets.map((t) => (t.id === selected.id ? { ...t, estado: nuevo } : t))
          );
          setSelected((s) => (s ? { ...s, estado: nuevo } : s));
        }
      });
  }

  function responderTicket() {
    if (!mensaje.trim()) return;
    setSending(true);
    fetch(`${API_BASE_URL}/tickets/municipio/${selected.id}/comentarios`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ comentario: mensaje, user_id: userId }),
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.ok) {
          setMensaje("");
          return fetch(`${API_BASE_URL}/tickets/municipio/${selected.id}/comentarios?user_id=${userId}`, {
            credentials: "include",
          });
        }
        throw new Error(data.error || "Error enviando comentario");
      })
      .then((res) => res?.json())
      .then((data) => {
        if (data && data.ok) setComentarios(data.comentarios || []);
        setSending(false);
        setTimeout(() => chatBottomRef.current?.scrollIntoView({ behavior: "smooth" }), 200);
      })
      .catch(() => setSending(false));
  }

  return (
    <div className="flex h-[calc(100vh-80px)] shadow-2xl rounded-2xl overflow-hidden bg-white border max-w-6xl mx-auto my-8">
      <div className="w-1/3 bg-gray-50 border-r flex flex-col">
        <div className="px-6 py-5 flex items-center gap-2 border-b bg-white">
          <CheckCircle2 className="text-blue-500" />
          <span className="font-bold text-lg">Tickets de Vecinos</span>
        </div>
        <div className="flex-1 overflow-y-auto">
          {loading && (
            <div className="flex flex-col items-center justify-center h-40">
              <Loader2 className="animate-spin text-gray-400" size={32} />
            </div>
          )}
          {tickets.length === 0 && !loading && (
            <div className="flex flex-col items-center justify-center h-40 text-gray-400">
              No hay tickets cargados aún.
            </div>
          )}
          {tickets.map((t) => (
            <div
              key={t.id}
              className={`p-4 flex flex-col gap-1 border-b cursor-pointer transition hover:bg-blue-100 ${
                selected?.id === t.id ? "bg-blue-50" : ""
              }`}
              onClick={() => handleSelectTicket(t)}
            >
              <div className="flex justify-between items-center">
                <span className="font-semibold text-blue-800">#{t.nro_ticket}</span>
                <Badge
                  className={ESTADOS[t.estado]?.color + " rounded px-2 py-1 text-xs"}
                >
                  {ESTADOS[t.estado]?.label || t.estado}
                </Badge>
              </div>
              <span className="text-sm text-gray-700">{t.pregunta?.slice(0, 70) || "Sin asunto"}</span>
              <span className="text-xs text-gray-400">{fechaCorta(t.fecha)}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="flex-1 flex flex-col h-full">
        {selected ? (
          <>
            <div className="flex items-center gap-4 p-5 border-b bg-white">
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
                  className="flex items-center gap-1 rounded-full border-gray-300 shadow"
                  onClick={() => setDropdownVisible(!dropdownVisible)}
                >
                  {ESTADOS[estado]?.label || estado}
                  <ChevronDown size={16} className="ml-1" />
                </Button>
                {dropdownVisible && (
                  <div className="absolute mt-2 bg-white shadow-xl rounded-xl z-20 min-w-[140px]">
                    {Object.keys(ESTADOS).map((k) => (
                      <div
                        key={k}
                        className={`px-4 py-2 cursor-pointer hover:bg-blue-100 text-sm ${
                          estado === k ? "font-bold text-blue-600" : ""
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
            <div className="flex-1 bg-gray-50 p-6 flex flex-col gap-2 overflow-y-auto">
              {comentarios.map((c, idx) => (
                <div
                  key={c.id || idx}
                  className={`flex ${c.es_admin ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-lg px-5 py-3 rounded-2xl shadow ${
                      c.es_admin
                        ? "bg-gradient-to-r from-blue-600 to-blue-400 text-white rounded-br-none"
                        : "bg-white border rounded-bl-none"
                    }`}
                  >
                    <div className="text-sm">{c.comentario || c.mensaje}</div>
                    <div className="text-[11px] text-right text-gray-300 mt-1">
                      {fechaCorta(c.fecha)}
                    </div>
                  </div>
                </div>
              ))}
              <div ref={chatBottomRef} />
            </div>
            <div className="border-t bg-white p-4 flex gap-2">
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
