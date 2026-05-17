import React, { useEffect, useState } from "react";
import { apiFetch, getErrorMessage } from "@/utils/api";
import { safeLocalStorage } from "@/utils/safeLocalStorage";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { useNavigate } from "react-router-dom";
import useRequireRole from "@/hooks/useRequireRole";
import type { Role } from "@/utils/roles";
import { Mail, Phone, Search, Users } from "lucide-react";

type RawUsuario = Record<string, any>;

interface Usuario {
  id: number | string;
  nombre: string;
  email: string;
  telefono?: string | null;
  etiquetas: string[];
  canal?: string | null;
  origen?: string | null;
  createdAt?: string | null;
  lastSeen?: string | null;
  marketing?: boolean;
}

const phoneCandidates = [
  "telefono",
  "phone",
  "phone_number",
  "phoneNumber",
  "celular",
  "celular_numero",
  "whatsapp",
  "whatsapp_number",
  "whatsapp_numero",
  "telefono_celular",
  "tel",
  "numero",
  "numero_contacto",
];

const labelCandidates = ["etiquetas", "tags", "labels"];
const nameCandidates = ["nombre", "name", "full_name", "display_name"];
const emailCandidates = ["email", "correo", "mail"];

const normalizeString = (value: unknown): string | null => {
  if (typeof value === "string" && value.trim()) return value.trim();
  return null;
};

const pickFirstString = (keys: string[], source: RawUsuario): string | null => {
  for (const key of keys) {
    const candidate = normalizeString(source[key]);
    if (candidate) return candidate;
  }
  return null;
};

const normalizeUsuario = (raw: RawUsuario, index: number): Usuario => {
  const telefono =
    pickFirstString(phoneCandidates, raw) ||
    normalizeString(raw?.contacto?.telefono) ||
    normalizeString(raw?.contacto?.whatsapp) ||
    normalizeString(raw?.datos_contacto?.telefono) ||
    normalizeString(raw?.datos_contacto?.celular) ||
    normalizeString(raw?.profile?.telefono) ||
    normalizeString(raw?.profile?.whatsapp);

  const etiquetas = labelCandidates.reduce<string[]>((acc, key) => {
    const value = raw[key];
    if (Array.isArray(value)) {
      const normalized = value
        .map(normalizeString)
        .filter(Boolean) as string[];
      return [...acc, ...normalized];
    }
    return acc;
  }, []);

  return {
    id: raw.id ?? raw.user_id ?? index,
    nombre: pickFirstString(nameCandidates, raw) || "Sin nombre",
    email: pickFirstString(emailCandidates, raw) || "Sin email",
    telefono,
    etiquetas,
    canal: normalizeString(raw.canal || raw.channel || raw.origen || raw.source || raw.via || raw.platform),
    origen: normalizeString(raw.data_source || raw.dataSource || raw.origin),
    createdAt:
      normalizeString(raw.created_at) ||
      normalizeString(raw.fecha_creacion) ||
      normalizeString(raw.createdAt),
    lastSeen:
      normalizeString(raw.last_seen) ||
      normalizeString(raw.ultima_interaccion) ||
      normalizeString(raw.updated_at) ||
      normalizeString(raw.updatedAt),
    marketing: Boolean(raw.acepta_marketing ?? raw.marketing ?? raw.opt_in_marketing),
  };
};

export default function UsuariosPage() {
  useRequireRole(['admin', 'empleado', 'super_admin'] as Role[]);
  const navigate = useNavigate();
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [marketingOnly, setMarketingOnly] = useState(false);
  const [sortConfig, setSortConfig] = useState<{ key: keyof Usuario; direction: 'asc' | 'desc' } | null>(null);
  const [page, setPage] = useState(1);
  const pageSize = 25;

  const sortedUsuarios = React.useMemo(() => {
    let sortableItems = [...usuarios];
    if (sortConfig !== null) {
      sortableItems.sort((a, b) => {
        const aVal = a[sortConfig.key];
        const bVal = b[sortConfig.key];
        const aStr = (aVal ?? "").toString().toLowerCase();
        const bStr = (bVal ?? "").toString().toLowerCase();
        if (aStr < bStr) {
          return sortConfig.direction === 'asc' ? -1 : 1;
        }
        if (aStr > bStr) {
          return sortConfig.direction === 'asc' ? 1 : -1;
        }
        return 0;
      });
    }
    return sortableItems;
  }, [usuarios, sortConfig]);

  const paginatedUsuarios = React.useMemo(() => {
    const start = (page - 1) * pageSize;
    return sortedUsuarios.slice(start, start + pageSize);
  }, [sortedUsuarios, page]);

  const totalPages = Math.max(1, Math.ceil(sortedUsuarios.length / pageSize));

  const requestSort = (key: keyof Usuario) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  useEffect(() => {
    const token = safeLocalStorage.getItem("authToken");
    if (!token) {
      navigate("/login");
      return;
    }
    const fetchData = async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        if (search.trim()) params.set('search', search.trim());
        if (marketingOnly) params.set('marketing', 'true');
        const url = `/api/crm/clientes${params.toString() ? `?${params.toString()}` : ''}`;
        const data = await apiFetch<RawUsuario[]>(url);
        if (Array.isArray(data)) {
          setUsuarios(data.map((item, index) => normalizeUsuario(item, index)));
        }
      } catch (e) {
        setError(getErrorMessage(e, 'No se pudieron cargar los usuarios'));
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [navigate, search, marketingOnly]);

  useEffect(() => {
    setPage(1);
  }, [sortedUsuarios.length]);

  const formatDate = (value?: string | null) => {
    if (!value) return "-";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return new Intl.DateTimeFormat('es-AR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  };

  const marketingCount = React.useMemo(
    () => usuarios.filter((u) => u.marketing).length,
    [usuarios],
  );

  const phoneCount = React.useMemo(
    () => usuarios.filter((u) => Boolean(u.telefono)).length,
    [usuarios],
  );

  const channelStats = React.useMemo(() => {
    const counts: Record<string, number> = {};
    usuarios.forEach((u) => {
      const channel = u.canal || 'Sin canal';
      counts[channel] = (counts[channel] || 0) + 1;
    });
    return Object.entries(counts)
      .map(([label, total]) => ({ label, total }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 4);
  }, [usuarios]);

  const emailCount = React.useMemo(
    () => usuarios.filter((u) => u.email && u.email !== 'Sin email').length,
    [usuarios],
  );

  const contactCoverage = usuarios.length ? Math.round((phoneCount / usuarios.length) * 100) : 0;

  if (loading) return <div className="p-8">Cargando...</div>;
  if (error) return <div className="p-8 text-destructive">{error}</div>;

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-4 p-4 md:p-6">
      <header className="rounded-[28px] border border-border/70 bg-gradient-to-br from-background via-primary/5 to-sky-500/10 p-5 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="text-3xl font-black tracking-tight">Usuarios y contactos</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
              Base operativa para atencion, segmentacion y seguimiento. Los datos se muestran tal como los publica el backend.
            </p>
          </div>
          <Button variant="outline" onClick={() => navigate("/perfil")}>Volver</Button>
        </div>
      </header>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
              <Users className="h-4 w-4" />
              Total
            </CardTitle>
          </CardHeader>
          <CardContent className="text-3xl font-bold">{usuarios.length}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-muted-foreground">Con teléfono</CardTitle>
          </CardHeader>
          <CardContent className="text-3xl font-bold">{phoneCount}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-muted-foreground">Opt-in marketing</CardTitle>
          </CardHeader>
          <CardContent className="text-3xl font-bold">{marketingCount}</CardContent>
        </Card>
      </div>
      <div className="grid gap-3 md:grid-cols-3">
        <div className="rounded-2xl border border-border/70 bg-card p-3 text-sm">
          <div className="flex items-center gap-2 font-semibold">
            <Phone className="h-4 w-4 text-primary" />
            Cobertura de telefono
          </div>
          <p className="mt-1 text-2xl font-bold">{contactCoverage}%</p>
          <p className="text-xs text-muted-foreground">Contactos con telefono publicado.</p>
        </div>
        <div className="rounded-2xl border border-border/70 bg-card p-3 text-sm">
          <div className="flex items-center gap-2 font-semibold">
            <Mail className="h-4 w-4 text-primary" />
            Emails utilizables
          </div>
          <p className="mt-1 text-2xl font-bold">{emailCount.toLocaleString('es-AR')}</p>
          <p className="text-xs text-muted-foreground">Contactos con email publicado.</p>
        </div>
        <div className="rounded-2xl border border-border/70 bg-card p-3 text-sm">
          <div className="font-semibold">Marketing</div>
          <p className="mt-1 text-2xl font-bold">{marketingCount.toLocaleString('es-AR')}</p>
          <p className="text-xs text-muted-foreground">Opt-in disponible para campanas.</p>
        </div>
      </div>
      {channelStats.length > 0 && (
        <div className="flex flex-wrap gap-2 text-sm text-muted-foreground">
          {channelStats.map((c) => (
            <Badge key={c.label} variant="secondary" className="gap-2">
              <span className="font-semibold text-foreground">{c.total}</span>
              <span>{c.label}</span>
            </Badge>
          ))}
        </div>
      )}
      <div className="flex flex-col gap-3 rounded-2xl border border-border/70 bg-card p-3 shadow-sm md:flex-row md:items-center md:justify-between">
        <div className="relative w-full md:max-w-md">
          <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar nombre o email"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-10 pl-9"
          />
        </div>
        <label className="flex items-center gap-2 text-sm">
          <Checkbox checked={marketingOnly} onCheckedChange={(v) => setMarketingOnly(Boolean(v))} />
          Solo con marketing
        </label>
      </div>
      {usuarios.length === 0 ? (
        <p>No hay usuarios registrados.</p>
      ) : (
        <Card className="overflow-hidden">
          <CardContent>
            <div className="overflow-x-auto">
            <table className="w-full min-w-[980px] text-sm">
              <thead>
                <tr className="text-left font-semibold">
                  <th className="p-2 cursor-pointer" onClick={() => requestSort('nombre')}>
                    Nombre {sortConfig?.key === 'nombre' ? (sortConfig.direction === 'asc' ? '▲' : '▼') : ''}
                  </th>
                  <th className="p-2 cursor-pointer" onClick={() => requestSort('email')}>
                    Email {sortConfig?.key === 'email' ? (sortConfig.direction === 'asc' ? '▲' : '▼') : ''}
                  </th>
                  <th className="p-2 cursor-pointer" onClick={() => requestSort('telefono')}>
                    Teléfono {sortConfig?.key === 'telefono' ? (sortConfig.direction === 'asc' ? '▲' : '▼') : ''}
                  </th>
                  <th className="p-2">Canal</th>
                  <th className="p-2">Origen</th>
                  <th className="p-2">Etiquetas</th>
                  <th className="p-2">Creado</th>
                  <th className="p-2">Último contacto</th>
                  <th className="p-2 text-center">Marketing</th>
                </tr>
              </thead>
              <tbody>
                {paginatedUsuarios.map(u => (
                  <tr key={u.id} className="border-t">
                    <td className="p-2">{u.nombre}</td>
                    <td className="p-2">{u.email}</td>
                    <td className="p-2">{u.telefono || '-'}</td>
                    <td className="p-2">{u.canal || '-'}</td>
                    <td className="p-2">{u.origen || '-'}</td>
                    <td className="p-2">
                      {u.etiquetas && u.etiquetas.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {u.etiquetas.map((tag, idx) => (
                            <Badge key={`${u.id}-${tag}-${idx}`} variant="outline">{tag}</Badge>
                          ))}
                        </div>
                      ) : (
                        '-'
                      )}
                    </td>
                    <td className="p-2 whitespace-nowrap">{formatDate(u.createdAt)}</td>
                    <td className="p-2 whitespace-nowrap">{formatDate(u.lastSeen)}</td>
                    <td className="p-2 text-center">
                      {u.marketing ? <Badge variant="secondary">Sí</Badge> : <Badge variant="outline">No</Badge>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
            <div className="mt-4 flex flex-col gap-2 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
              <span>
                Mostrando {(page - 1) * pageSize + 1}–
                {Math.min(page * pageSize, sortedUsuarios.length)} de {sortedUsuarios.length}
              </span>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page === 1}
                  onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                >
                  Anterior
                </Button>
                <span className="text-xs font-semibold">Página {page} / {totalPages}</span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= totalPages}
                  onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
                >
                  Siguiente
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
