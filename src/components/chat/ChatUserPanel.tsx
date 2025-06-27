import React, { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { apiFetch } from "@/utils/api";
import { safeLocalStorage } from "@/utils/safeLocalStorage";

interface TicketSummary {
  id: number;
  nro_ticket: number;
  estado: string;
  asunto?: string;
}

interface Props {
  onClose: () => void;
}

const ChatUserPanel: React.FC<Props> = ({ onClose }) => {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [tickets, setTickets] = useState<TicketSummary[]>([]);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [statusFilter, setStatusFilter] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const data = await apiFetch<any>("/me");
        setName(data.name || "");
        setEmail(data.email || "");
        setPhone(data.telefono || "");
      } catch (e) {
        /* ignore */
      }
    };
    const fetchTickets = async () => {
      try {
        let url = "/tickets/mis";
        const params: string[] = [];
        if (statusFilter) params.push(`estado=${encodeURIComponent(statusFilter)}`);
        if (categoryFilter) params.push(`categoria=${encodeURIComponent(categoryFilter)}`);
        if (params.length) url += `?${params.join("&")}`;
        const data = await apiFetch<TicketSummary[]>(url, { sendEntityToken: true });
        if (Array.isArray(data)) setTickets(data);
      } catch (e) {
        /* ignore */
      }
    };
    fetchProfile();
    fetchTickets();
  }, [statusFilter, categoryFilter]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      await apiFetch("/me", { method: "PUT", body: { name, email, telefono: phone } });
      const stored = safeLocalStorage.getItem("user");
      if (stored) {
        try {
          const obj = JSON.parse(stored);
          obj.name = name;
          obj.email = email;
          safeLocalStorage.setItem("user", JSON.stringify(obj));
        } catch {}
      }
      onClose();
    } catch (e) {
      setError("No se pudo guardar");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-4 flex flex-col gap-4 w-full max-w-md mx-auto animate-fade-in overflow-y-auto">
      <h2 className="text-xl font-bold text-center text-primary">Mi cuenta</h2>
      <form onSubmit={handleSave} className="space-y-3" autoComplete="off" spellCheck={false}>
        <Input
          type="text"
          placeholder="Nombre y apellido"
          value={name}
          onChange={e => setName(e.target.value)}
          required
          disabled={saving}
        />
        <Input
          type="email"
          placeholder="Correo electrónico"
          value={email}
          onChange={e => setEmail(e.target.value)}
          required
          disabled={saving}
        />
        <Input
          type="tel"
          placeholder="Teléfono (opcional)"
          value={phone}
          onChange={e => setPhone(e.target.value)}
          disabled={saving}
        />
        {error && <div className="text-destructive text-sm px-2">{error}</div>}
        <Button type="submit" className="w-full mt-1" disabled={saving}>
          {saving ? "Guardando..." : "Guardar"}
        </Button>
      </form>
      <h3 className="text-lg font-semibold mt-4">Mis Tickets</h3>
      <div className="flex gap-2 mt-2">
        <Input
          placeholder="Estado"
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
        />
        <Input
          placeholder="Categoría"
          value={categoryFilter}
          onChange={e => setCategoryFilter(e.target.value)}
        />
      </div>
      {tickets.length === 0 ? (
        <p className="text-sm text-muted-foreground">Aún no tienes tickets.</p>
      ) : (
        <ul className="space-y-2 text-sm">
          {tickets.map(t => (
            <li key={t.id} className="border rounded p-2 flex justify-between">
              <span>{t.asunto || "Ticket"} #{t.nro_ticket}</span>
              <span className="font-medium capitalize">{t.estado}</span>
            </li>
          ))}
        </ul>
      )}
      <Button
        variant="secondary"
        className="w-full mt-6"
        onClick={() => {
          safeLocalStorage.removeItem('authToken');
          safeLocalStorage.removeItem('user');
          onClose();
        }}
      >
        Cerrar sesión
      </Button>
    </div>
  );
};

export default ChatUserPanel;
