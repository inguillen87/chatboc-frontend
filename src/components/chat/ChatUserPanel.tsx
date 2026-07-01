import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { apiFetch, getErrorMessage } from "@/utils/api";
import { safeLocalStorage } from "@/utils/safeLocalStorage";
import { buildTenantNavigationUrl } from "@/utils/tenantPaths";
import {
  ExternalLink,
  Image as ImageIcon,
  ListChecks,
  Mail,
  Phone,
  ShoppingCart,
  Sparkles,
  Store,
  Ticket,
  User,
} from "lucide-react";
import IdentityAvatar from "@/components/identity/IdentityAvatar";

interface TicketSummary {
  id: number;
  nro_ticket: number;
  estado: string;
  asunto?: string;
}

interface Props {
  onClose: () => void;
}

interface QuickActionConfig {
  label: string;
  path?: string;
  url?: string;
}

const ChatUserPanel: React.FC<Props> = ({ onClose }) => {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [marketingOptIn, setMarketingOptIn] = useState(false);
  const [tickets, setTickets] = useState<TicketSummary[]>([]);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [statusFilter, setStatusFilter] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");

  const tenantSlug = safeLocalStorage.getItem("tenantSlug");
  const tenantInfo = useMemo(() => {
    const stored = safeLocalStorage.getItem("tenant");
    if (!stored) return null;
    try {
      return JSON.parse(stored);
    } catch (err) {
      console.warn("[ChatUserPanel] No se pudo parsear tenant", err);
      return null;
    }
  }, []);

  const trackLeadEvent = useCallback(
    async (eventName: string, payload: Record<string, unknown>) => {
      const tenantId = Number(tenantInfo?.id || safeLocalStorage.getItem('tenantId') || 0);
      if (!tenantId) return;

      try {
        await apiFetch('/analytics/event', {
          method: 'POST',
          body: {
            tenant_id: tenantId,
            event_name: eventName,
            payload,
            channel: 'web_widget',
            session_id: `sess_${Date.now()}`,
          },
          isWidgetRequest: true,
        });
      } catch (eventError) {
        console.warn('[ChatUserPanel] tracking failed', eventError);
      }
    },
    [tenantInfo?.id],
  );

  const goTo = (path: string) => {
    const url = buildTenantNavigationUrl({ basePath: path, tenantSlug, tenant: tenantInfo });
    trackLeadEvent('widget_quick_action_click', { path, has_contact_data: Boolean(email || phone) });
    window.open(url, "_blank", "noreferrer");
  };

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const data = await apiFetch<any>("/me", { isWidgetRequest: true });
        setName(data.name || "");
        setEmail(data.email || "");
        setPhone(
          data.telefono ||
            data.phone ||
            data.whatsapp ||
            data.celular ||
            data?.contacto?.telefono ||
            "",
        );
        setAvatarUrl(data.avatar_url || data.picture || "");
        setMarketingOptIn(Boolean(data.acepta_marketing));
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
        const data = await apiFetch<TicketSummary[]>(url, { sendEntityToken: true, isWidgetRequest: true });
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
      await apiFetch("/me", {
        method: "PUT",
        body: {
          name,
          email,
          telefono: phone,
          whatsapp: phone,
          celular: phone,
          avatar_url: avatarUrl.trim(),
          avatar_source: avatarUrl.trim() ? "profile_url" : undefined,
          acepta_marketing: marketingOptIn,
        },
        isWidgetRequest: true,
      });
      const stored = safeLocalStorage.getItem("user");
      if (stored) {
        try {
          const obj = JSON.parse(stored);
          obj.name = name;
          obj.email = email;
          obj.telefono = phone;
          obj.whatsapp = phone;
          obj.celular = phone;
          obj.avatar_url = avatarUrl.trim();
          obj.picture = avatarUrl.trim();
          obj.avatar_source = avatarUrl.trim() ? "profile_url" : undefined;
          obj.acepta_marketing = marketingOptIn;
          safeLocalStorage.setItem("user", JSON.stringify(obj));
        } catch {}
      }
      trackLeadEvent("widget_lead_profile_updated", {
        has_email: Boolean(email),
        has_phone: Boolean(phone),
        has_avatar: Boolean(avatarUrl.trim()),
        marketing_opt_in: marketingOptIn,
      });
      onClose();
    } catch (e) {
      setError(getErrorMessage(e, "No se pudo guardar"));
    } finally {
      setSaving(false);
    }
  };

  const backendQuickActions = useMemo(() => {
    const rawActions = tenantInfo?.interaction?.quick_actions || tenantInfo?.quick_actions || [];
    if (!Array.isArray(rawActions)) return [] as QuickActionConfig[];

    return rawActions
      .map((action: any) => {
        const label = typeof action?.label === 'string' ? action.label.trim() : '';
        const path = typeof action?.path === 'string' ? action.path.trim() : undefined;
        const url = typeof action?.url === 'string' ? action.url.trim() : undefined;
        if (!label || (!path && !url)) return null;
        return { label, path, url };
      })
      .filter((action: QuickActionConfig | null): action is QuickActionConfig => Boolean(action));
  }, [tenantInfo]);

  const quickActions = backendQuickActions.length > 0
    ? backendQuickActions.map((action) => ({ ...action, icon: Sparkles }))
    : [
        { label: "Explorar catálogo", icon: Store, path: "/catalogo" },
        { label: "Mi carrito", icon: ShoppingCart, path: "/cart" },
        { label: "Mis pedidos", icon: ListChecks, path: "/orders" },
        { label: "Mis tickets", icon: Ticket, path: "/tickets/mis" },
      ];

  return (
    <div className="p-4 flex flex-col gap-4 w-full max-w-md mx-auto animate-fade-in overflow-y-auto">
      <Card className="bg-gradient-to-r from-primary/10 via-background to-background border-primary/20">
        <CardHeader className="flex flex-row items-start justify-between gap-2">
          <div className="space-y-1">
            <CardTitle className="text-lg flex items-center gap-2">
              <User className="h-5 w-5 text-primary" />
              Hola, {name || "invitado"}
            </CardTitle>
            <CardDescription>
              Gestioná tus datos y entrá directo a las secciones clave sin salir del chat.
            </CardDescription>
          </div>
          <Sparkles className="h-6 w-6 text-primary" />
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-2">
          {quickActions.map((action) => (
            <Button
              key={action.label}
              variant="secondary"
              className="w-full justify-start gap-2"
              type="button"
              onClick={() => {
                if (action.url) {
                  trackLeadEvent('widget_quick_action_click', { url: action.url, has_contact_data: Boolean(email || phone) });
                  window.open(action.url, "_blank", "noreferrer");
                  return;
                }
                if (action.path) goTo(action.path);
              }}
            >
              <action.icon className="h-4 w-4" />
              {action.label}
              <ExternalLink className="h-3 w-3 ml-auto opacity-60" />
            </Button>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-base">Mis datos</CardTitle>
          <CardDescription>Actualizá tu perfil para que podamos reconocerte en todos los canales.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSave} className="space-y-3" autoComplete="off" spellCheck={false}>
            <div className="grid grid-cols-[auto,1fr] items-center gap-3 rounded-lg border p-3 bg-muted/40">
              <IdentityAvatar
                name={name || email || "Usuario"}
                avatarUrl={avatarUrl}
                source={avatarUrl ? "imagen consentida" : "iniciales"}
                size="lg"
              />
              <div className="min-w-0">
                <Label className="text-xs font-medium text-muted-foreground" htmlFor="profile-avatar-url">
                  Imagen de perfil
                </Label>
                <div className="mt-1 grid grid-cols-[auto,1fr] items-center gap-2">
                  <ImageIcon className="h-4 w-4 text-muted-foreground" />
                  <Input
                    id="profile-avatar-url"
                    type="text"
                    inputMode="url"
                    placeholder="https://..."
                    value={avatarUrl}
                    onChange={e => setAvatarUrl(e.target.value)}
                    disabled={saving}
                  />
                </div>
              </div>
            </div>
            <div className="grid grid-cols-[auto,1fr] items-center gap-2 rounded-lg border p-3 bg-muted/40">
              <User className="h-4 w-4 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Nombre y apellido"
                value={name}
                onChange={e => setName(e.target.value)}
                required
                disabled={saving}
              />
            </div>
            <div className="grid grid-cols-[auto,1fr] items-center gap-2 rounded-lg border p-3 bg-muted/40">
              <Mail className="h-4 w-4 text-muted-foreground" />
              <Input
                type="email"
                placeholder="Correo electrónico"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                disabled={saving}
              />
            </div>
            <div className="grid grid-cols-[auto,1fr] items-center gap-2 rounded-lg border p-3 bg-muted/40">
              <Phone className="h-4 w-4 text-muted-foreground" />
              <Input
                type="tel"
                placeholder="Teléfono (opcional)"
                value={phone}
                onChange={e => setPhone(e.target.value)}
                disabled={saving}
              />
            </div>
            <div className="flex items-center justify-between rounded-lg border p-3 bg-muted/40">
              <div>
                <p className="text-sm font-medium">Permitir comunicaciones</p>
                <p className="text-xs text-muted-foreground">Avisos de estado, recordatorios y novedades importantes.</p>
              </div>
              <Switch checked={marketingOptIn} onCheckedChange={(v) => setMarketingOptIn(Boolean(v))} />
            </div>
            {error && <div className="text-destructive text-sm px-2">{error}</div>}
            <Button type="submit" className="w-full mt-1" disabled={saving}>
              {saving ? "Guardando..." : "Guardar"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Ticket className="h-4 w-4" /> Mis tickets
          </CardTitle>
          <CardDescription>Seguimiento rápido de tus gestiones recientes.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
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
            <p className="text-sm text-muted-foreground">Aún no tenés tickets abiertos.</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {tickets.map(t => (
                <li key={t.id} className="border rounded-lg p-3 flex items-center justify-between gap-3 bg-muted/40">
                  <div className="space-y-0.5">
                    <p className="font-medium">{t.asunto || "Ticket"} #{t.nro_ticket}</p>
                    <p className="text-xs text-muted-foreground capitalize">Estado: {t.estado}</p>
                  </div>
                  <Badge variant="outline" className="capitalize">{t.estado}</Badge>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default ChatUserPanel;
