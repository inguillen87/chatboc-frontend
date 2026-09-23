import React, { useEffect, useState, useRef } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { motion, useReducedMotion } from "framer-motion";
import { apiClient } from "@/api/client";
import { apiFetch } from "@/utils/api";
import { getSuperadminCommandCenterV2, getSuperadminExecutiveSummaryV2 } from "@/api/v2/saas";
import useRequireRole from "@/hooks/useRequireRole";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Plus, LayoutDashboard, Building2, MessageSquare, Radio, Activity, ShieldCheck, ArrowUpRight, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import type { Tenant } from "@/types/superAdmin";
import type { WhatsappExternalNumberPayload, WhatsappNumberCreatePayload, WhatsappNumberInventoryItem } from "@/types/whatsapp";
import { TenantModal } from "@/components/admin/TenantModal";
import { WhatsappInventoryPanel } from "@/components/admin/WhatsappInventoryPanel";
import { safeLocalStorage } from "@/utils/safeLocalStorage";
import { buildTenantPath } from "@/utils/tenantPaths";
import { useSocket } from "@/context/SocketContext";
import SuperadminLeadsPipeline from "@/components/admin/SuperadminLeadsPipeline";
import ProductionSmokeReport from "@/components/admin/ProductionSmokeReport";
import { enterpriseService } from "@/services/enterpriseService";
import { OrganizationDirectory } from "@/components/admin/platform/OrganizationDirectory";
import { PlatformOverview } from "@/components/admin/platform/PlatformOverview";
import { buildPlatformOverview } from "@/components/admin/platform/data";
import "@/components/admin/platform/platform.css";

const sections = [
  { id: 'overview', label: 'Resumen', icon: LayoutDashboard },
  { id: 'organizations', label: 'Organizaciones', icon: Building2 },
  { id: 'crm', label: 'CRM', icon: MessageSquare },
  { id: 'channels', label: 'Canales', icon: Radio },
  { id: 'diagnostics', label: 'Diagnóstico', icon: Activity },
] as const;
type Section = typeof sections[number]['id'];
const dateLabel = (value?: string | null) => {
  const date = value ? new Date(value) : null;
  return date && Number.isFinite(date.getTime()) ? date.toLocaleString('es-AR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : 'Fecha no disponible';
};
const leadSummary = (lead: any) => {
  const value = lead.summary || lead.motivo;
  return typeof value === 'string' && value.trim() && !/^__.*__$/.test(value.trim()) && !value.includes('__INIT__') ? value : 'Conversación iniciada; sin motivo registrado.';
};

export default function SuperAdminDashboard() {
  useRequireRole(["super_admin"]);
  const [searchParams, setSearchParams] = useSearchParams();
  const section: Section = sections.some((item) => item.id === searchParams.get('section')) ? searchParams.get('section') as Section : 'overview';
  const reducedMotion = useReducedMotion();
  const { socket, isConnected } = useSocket();
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [total, setTotal] = useState<number | null>(null);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [directoryUpdatedAt, setDirectoryUpdatedAt] = useState<string | null>(null);
  const listRevision = useRef(0);
  const [whatsappNumbers, setWhatsappNumbers] = useState<WhatsappNumberInventoryItem[]>([]);
  const [whatsappLoading, setWhatsappLoading] = useState(true);
  const [whatsappError, setWhatsappError] = useState<string | null>(null);
  const [executiveSummary, setExecutiveSummary] = useState<any | null>(null);
  const [commandCenter, setCommandCenter] = useState<any | null>(null);
  const [executiveLoading, setExecutiveLoading] = useState(true);
  const [executiveError, setExecutiveError] = useState(false);
  const [commandError, setCommandError] = useState(false);
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [tenantProfile360, setTenantProfile360] = useState<any | null>(null);
  const selectedProfileSlug = section === 'organizations' ? searchParams.get('organization') || '' : '';
  const [crmLeads, setCrmLeads] = useState<any[]>([]);
  const [crmLeadsSummary, setCrmLeadsSummary] = useState<Record<string, number>>({});
  const [crmLeadsLoading, setCrmLeadsLoading] = useState(true);
  const [crmError, setCrmError] = useState<string | null>(null);
  const crmRevision = useRef(0);
  const [crmRealtimeAt, setCrmRealtimeAt] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTenant, setEditingTenant] = useState<Tenant | null>(null);
  const [modalTab, setModalTab] = useState<'general' | 'users' | 'integrations'>('general');
  const [purgeTenant, setPurgeTenant] = useState<Tenant | null>(null);
  const [purgeOpen, setPurgeOpen] = useState(false);
  const [purgeConfirmed, setPurgeConfirmed] = useState(false);
  const [purgeUsers, setPurgeUsers] = useState(true);

  const sectionUrl = (id: Section, slug?: string) => {
    const next = new URLSearchParams(searchParams);
    next.set('section', id);
    if (slug) next.set('organization', slug); else next.delete('organization');
    return next;
  };
  const openSection = (id: Section) => setSearchParams(sectionUrl(id));
  const openProfile = (slug: string) => setSearchParams(sectionUrl('organizations', slug));

  const fetchTenants = async (nextPage = 1) => {
    const revision = ++listRevision.current;
    setLoading(true);
    setError(null);
    try {
      const data = await apiClient.superAdminListTenants(nextPage, 100);
      if (revision !== listRevision.current) return;
      if (!Array.isArray(data?.tenants)) throw new Error('Invalid directory');
      setTenants((previous) => nextPage === 1 ? data.tenants : [...new Map([...previous, ...data.tenants].map((item) => [item.id, item])).values()]);
      setTotal(Number.isSafeInteger(data.total) && data.total >= 0 ? data.total : null);
      setPage(nextPage);
      setDirectoryUpdatedAt(new Date().toISOString());
    } catch {
      if (revision !== listRevision.current) return;
      setError('No se pudo cargar el directorio. Volvé a intentarlo.');
      if (nextPage === 1) { setTenants([]); setTotal(null); }
    } finally {
      if (revision === listRevision.current) setLoading(false);
    }
  };
  const fetchWhatsappNumbers = async () => {
    setWhatsappLoading(true); setWhatsappError(null);
    try {
      const data = await apiClient.superAdminListWhatsappNumbers();
      if (!Array.isArray(data?.numbers)) throw new Error('Invalid inventory');
      setWhatsappNumbers(data.numbers);
    } catch { setWhatsappError('No se pudo cargar el inventario de WhatsApp.'); setWhatsappNumbers([]); }
    finally { setWhatsappLoading(false); }
  };
  const fetchExecutive = async () => {
    setExecutiveLoading(true); setExecutiveError(false); setCommandError(false);
    const [executive, command] = await Promise.allSettled([getSuperadminExecutiveSummaryV2(), getSuperadminCommandCenterV2()]);
    setExecutiveSummary(executive.status === 'fulfilled' ? executive.value : null);
    setExecutiveError(executive.status === 'rejected');
    setCommandCenter(command.status === 'fulfilled' ? command.value : null);
    setCommandError(command.status === 'rejected');
    setExecutiveLoading(false);
  };
  const fetchCrmLeads = React.useCallback(async () => {
    const revision = ++crmRevision.current;
    setCrmLeadsLoading(true); setCrmError(null);
    try {
      const response = await apiFetch<{ items?: any[]; summary?: Record<string, number> }>('/api/admin/crm/leads?limit=8', { omitTenant: true });
      if (revision !== crmRevision.current) return;
      if (!Array.isArray(response?.items)) throw new Error('Invalid CRM selection');
      setCrmLeads(response.items); setCrmLeadsSummary(response.summary || {});
    } catch { if (revision === crmRevision.current) { setCrmLeads([]); setCrmLeadsSummary({}); setCrmError('No se pudieron cargar los contactos recientes.'); } }
    finally { if (revision === crmRevision.current) setCrmLeadsLoading(false); }
  }, []);
  useEffect(() => { void fetchTenants(); void fetchWhatsappNumbers(); void fetchExecutive(); void fetchCrmLeads(); }, [fetchCrmLeads]);
  useEffect(() => {
    if (!socket) return;
    const refresh = () => { setCrmRealtimeAt(new Date().toISOString()); void fetchCrmLeads(); };
    const events = ['crm.contact.updated', 'crm_contact_updated', 'crm.notification.updated', 'crm_notification_updated', 'notification.updated', 'notification.sent', 'notification.failed'];
    events.forEach((event) => socket.on(event, refresh));
    return () => { events.forEach((event) => socket.off(event, refresh)); };
  }, [socket, fetchCrmLeads]);
  useEffect(() => {
    let cancelled = false;
    setTenantProfile360(null); setProfileError(null);
    if (!selectedProfileSlug) { setProfileLoading(false); return; }
    setProfileLoading(true);
    enterpriseService.getTenantProfile360(selectedProfileSlug, { since_days: 30 }).then((response) => {
      if (cancelled) return;
      if (!response?.tenant || response.tenant.slug !== selectedProfileSlug) throw new Error('Profile identity mismatch');
      setTenantProfile360(response);
    }).catch(() => { if (!cancelled) setProfileError('No se pudo verificar la ficha de esta organización.'); })
      .finally(() => { if (!cancelled) setProfileLoading(false); });
    return () => { cancelled = true; };
  }, [selectedProfileSlug]);
  useEffect(() => {
    if (!selectedProfileSlug) return;
    const heading = document.getElementById('platform-profile-title');
    heading?.focus({ preventScroll: true });
    heading?.scrollIntoView?.({ block: 'start', behavior: reducedMotion ? 'auto' : 'smooth' });
  }, [selectedProfileSlug, tenantProfile360, reducedMotion]);

  const handleReserveNumber = async (payload: {
    number_id: string | number;
    tenant_slug?: string | null;
  }) => {
    try {
      await apiClient.superAdminReserveWhatsappNumber(payload);
      toast.success("Número reservado.");
      fetchWhatsappNumbers();
    } catch (error) {
      console.error(error);
      toast.error("No se pudo reservar el número.");
    }
  };

  const handleReleaseNumber = async (payload: {
    number_id: string | number;
  }) => {
    try {
      await apiClient.superAdminReleaseWhatsappNumber(payload);
      toast.success("Número liberado.");
      fetchWhatsappNumbers();
    } catch (error) {
      console.error(error);
      toast.error("No se pudo liberar el número.");
    }
  };

  const handleAssignNumber = async (payload: {
    number_id: string | number;
    tenant_slug: string;
  }) => {
    try {
      await apiClient.superAdminAssignWhatsappNumber(payload);
      toast.success("Número asignado.");
      fetchWhatsappNumbers();
    } catch (error) {
      console.error(error);
      toast.error("No se pudo asignar el número.");
    }
  };

  const handleCreateNumber = async (payload: WhatsappNumberCreatePayload) => {
    try {
      await apiClient.superAdminCreateWhatsappNumber(payload);
      toast.success("Número creado.");
      fetchWhatsappNumbers();
    } catch (error) {
      console.error(error);
      toast.error("No se pudo crear el número.");
    }
  };

  const handleRegisterExternal = async (payload: WhatsappExternalNumberPayload) => {
    try {
      await apiClient.superAdminRegisterExternalWhatsappNumber(payload);
      toast.success("Número externo registrado.");
      fetchWhatsappNumbers();
    } catch (error) {
      console.error(error);
      toast.error("No se pudo registrar el número externo.");
    }
  };

  const handleCreate = () => {
    setEditingTenant(null);
    setModalTab("general");
    setIsModalOpen(true);
  };

  const handleEdit = (
    tenant: Tenant,
    tab: "general" | "users" | "integrations" = "general",
  ) => {
    setEditingTenant(tenant);
    setModalTab(tab);
    setIsModalOpen(true);
  };

  const handleImpersonate = async (tenant: Tenant) => {
    try {
      const { token, redirect_url } = await apiClient.superAdminImpersonate(
        tenant.slug,
      );

      safeLocalStorage.setItem("authToken", token);

      const target = redirect_url || buildTenantPath("/", tenant.slug);

      toast.success(`Accediendo a ${tenant.nombre}...`);

      const newTab = window.open(target, "_blank", "noopener,noreferrer");
      if (!newTab) {
        window.location.href = target;
      }
    } catch (error) {
      console.error(error);
      toast.error("Falló el acceso como admin.");
    }
  };

  const handleToggleStatus = async (tenant: Tenant) => {
    try {
      await apiClient.superAdminUpdateTenant(tenant.slug, {
        is_active: !tenant.is_active,
      });
      toast.success(
        tenant.is_active ? "Tenant desactivado." : "Tenant reactivado.",
      );
      fetchTenants();
    } catch (error) {
      console.error(error);
      toast.error("Error al cambiar estado del tenant.");
    }
  };

  const handlePurge = (tenant: Tenant) => {
    setPurgeTenant(tenant);
    setPurgeConfirmed(false);
    setPurgeUsers(true);
    setPurgeOpen(true);
  };

  const handleConfirmPurge = async () => {
    if (!purgeTenant || !purgeConfirmed) return;
    try {
      await apiClient.superAdminPurgeTenant(purgeTenant.slug, {
        confirm: true,
        purge_users: purgeUsers,
      });
      toast.success("Tenant eliminado definitivamente.");
      setPurgeOpen(false);
      setPurgeTenant(null);
      fetchTenants();
    } catch (error) {
      console.error(error);
      toast.error("No se pudo eliminar el tenant.");
    }
  };

  const overview = buildPlatformOverview({ tenants, total, tenantsError: Boolean(error), commandCenter, commandError, executiveSummary, executiveError, crmItems: crmLeads, crmSummary: crmLeadsSummary, crmError: Boolean(crmError) });
  const selectedTenant = tenants.find((tenant) => tenant.slug === selectedProfileSlug);
  const profile = tenantProfile360?.tenant?.slug === selectedProfileSlug ? tenantProfile360.tenant : null;
  const owner = tenantProfile360?.owner;
  const updatedAt = tenantProfile360?.meta?.last_updated_at;
  return <div className="platform-workspace" data-testid="platform-workspace">
    <header className="platform-header"><div><div className="platform-eyebrow"><ShieldCheck size={15} aria-hidden="true" />Administración de plataforma</div><h1>Tu operación, en un solo lugar</h1><p>Organizaciones, relaciones comerciales y canales. Una vista compartida para decidir el próximo paso.</p></div><Button onClick={handleCreate}><Plus className="mr-2 h-4 w-4" />Nueva organización</Button></header>
    <nav className="platform-navigation" aria-label="Secciones de plataforma">{sections.map(({ id, label, icon: Icon }) => <Link key={id} to={{ search: `?${sectionUrl(id)}` }} aria-current={section === id ? 'page' : undefined}><Icon size={17} aria-hidden="true" />{label}</Link>)}</nav>
    <motion.div key={section} initial={reducedMotion ? false : { opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: reducedMotion ? 0 : .18 }} className="platform-section" data-testid={`platform-section-${section}`}>
      {section === 'overview' && <PlatformOverview data={overview} directoryLoading={loading} crmLoading={crmLeadsLoading} healthLoading={executiveLoading} onOrganizations={() => openSection('organizations')} onCrm={() => openSection('crm')} onProfile={openProfile} onRefresh={() => { void Promise.all([fetchTenants(), fetchExecutive(), fetchCrmLeads()]); }} />}
      {section === 'organizations' && <>
        {selectedProfileSlug && <section className="platform-panel order-first" aria-labelledby="platform-profile-title" data-testid="platform-organization-profile"><div className="platform-panel-heading"><div><h2 id="platform-profile-title" tabIndex={-1}>{profile?.nombre || selectedTenant?.nombre || selectedProfileSlug}</h2><p>Ficha de la organización · actividad de los últimos 30 días</p></div><Button variant="ghost" onClick={() => openSection('organizations')}>Cerrar ficha</Button></div>
          {profileLoading ? <div className="platform-empty" role="status">Cargando ficha…</div> : profileError ? <div className="platform-empty" role="alert">{profileError}</div> : profile && <div className="platform-panel-body"><dl className="platform-profile-facts"><div><dt>Responsable</dt><dd>{owner?.name || owner?.nombre || owner?.email || 'No disponible'}</dd></div><div><dt>Correo de contacto</dt><dd>{owner?.email || 'No disponible'}</dd></div><div><dt>Plan</dt><dd>{profile.plan || 'No disponible'}</dd></div><div><dt>Estado</dt><dd>{profile.is_active === true ? 'Activa' : profile.is_active === false ? 'Inactiva' : 'No disponible'}</dd></div><div><dt>Última actualización informada</dt><dd>{dateLabel(updatedAt)}</dd></div></dl>{selectedTenant && <div className="mt-6 flex flex-wrap gap-2"><Button variant="outline" onClick={() => handleEdit(selectedTenant)}>Editar organización</Button><Button variant="outline" onClick={() => handleEdit(selectedTenant, 'users')}>Administrar acceso</Button><Button variant="outline" onClick={() => handleEdit(selectedTenant, 'integrations')}>Configurar canales</Button></div>}</div>}
        </section>}
        <OrganizationDirectory tenants={tenants} total={total} loading={loading} error={error} onRefresh={() => void fetchTenants()} onLoadMore={() => void fetchTenants(page + 1)} onProfile={openProfile} onEdit={handleEdit} onImpersonate={handleImpersonate} onToggleStatus={handleToggleStatus} onPurge={handlePurge} />
        {directoryUpdatedAt && !error && <p className="text-xs text-muted-foreground">Directorio consultado: {dateLabel(directoryUpdatedAt)}.</p>}

      </>}
      {section === 'crm' && <>
        <section className="platform-panel"><div className="platform-panel-heading"><div><h2>Contactos recientes</h2><p>Selección de hasta 8 contactos recibidos, ordenados por prioridad comercial. No es el total del CRM.</p></div><Button variant="outline" disabled={crmLeadsLoading} onClick={() => void fetchCrmLeads()}>Actualizar contactos</Button></div>
          <p className="platform-note">{isConnected ? 'Conexión de eventos activa.' : 'Actualización en vivo desconectada. Podés actualizar manualmente.'}{crmRealtimeAt ? ` Última señal recibida: ${dateLabel(crmRealtimeAt)}.` : ''}</p>
          {crmLeadsLoading ? <div className="platform-empty">Cargando contactos…</div> : crmError ? <div className="platform-empty" role="alert">{crmError}</div> : !crmLeads.length ? <div className="platform-empty">No hay contactos en esta selección.</div> : <div className="platform-panel-body platform-contact-grid">{crmLeads.map((lead, index) => <article className="platform-contact" key={lead.contact_id || index}><div className="flex items-start justify-between gap-3"><h3>{lead.name || lead.phone || lead.telefono || lead.email || 'Contacto sin nombre'}</h3><span className="platform-plan">{{ hot: 'Prioridad alta', warm: 'En seguimiento', cold: 'Contacto inicial' }[lead.lead_temperature] || 'Sin clasificación'}</span></div><p className="mt-1">{lead.phone || lead.telefono || lead.email || 'Sin canal informado'}</p><p className="mt-3">{leadSummary(lead)}</p><p className="mt-3">{lead.tenant?.nombre || lead.tenant?.slug || 'Organización no informada'} · {dateLabel(lead.last_seen)}</p>{lead.tenant?.slug && <Button variant="ghost" size="sm" className="mt-3" onClick={() => openProfile(lead.tenant.slug)}>Ver organización<ArrowUpRight className="ml-2 h-4 w-4" /></Button>}</article>)}</div>}
        </section>
        <section className="platform-panel" aria-label="Seguimiento comercial"><details className="platform-technical-details"><summary>Abrir seguimiento de oportunidades y herramientas comerciales</summary><div><SuperadminLeadsPipeline /></div></details></section>
      </>}
      {section === 'channels' && <><div className="platform-warning"><Radio className="shrink-0 mt-0.5" size={19} /><div><h2>Canales y asignaciones</h2><p className="mt-1 text-sm text-muted-foreground">Consultá el inventario de números y su organización asignada. La disponibilidad depende del estado informado por el servicio.</p></div></div><WhatsappInventoryPanel numbers={whatsappNumbers} tenants={tenants} loading={whatsappLoading} error={whatsappError} onRefresh={fetchWhatsappNumbers} onReserve={handleReserveNumber} onRelease={handleReleaseNumber} onAssign={handleAssignNumber} onCreateNumber={handleCreateNumber} onRegisterExternal={handleRegisterExternal} /></>}
      {section === 'diagnostics' && <><section className="platform-panel"><div className="platform-panel-heading"><div><h2>Disponibilidad de la información</h2><p>Estado de las consultas realizadas en este panel. No representa la disponibilidad global de la plataforma.</p></div><Button variant="outline" disabled={loading || executiveLoading || whatsappLoading || crmLeadsLoading} onClick={() => { void fetchTenants(); void fetchExecutive(); void fetchWhatsappNumbers(); void fetchCrmLeads(); }}><RefreshCw className="mr-2 h-4 w-4" />Reconsultar</Button></div><div className="platform-panel-body">{[
        { label: 'Directorio de organizaciones', loading, failed: Boolean(error) },
        { label: 'Evaluaciones operativas', loading: executiveLoading, failed: executiveError },
        { label: 'Resumen de seguimiento', loading: executiveLoading, failed: commandError },
        { label: 'Contactos recientes', loading: crmLeadsLoading, failed: Boolean(crmError) },
        { label: 'Inventario de WhatsApp', loading: whatsappLoading, failed: Boolean(whatsappError) },
      ].map((item) => <div className="platform-service-row" key={item.label}><span>{item.label}</span><span className="platform-plan">{item.loading ? 'Consultando…' : item.failed ? 'No disponible' : 'Consulta recibida'}</span></div>)}</div></section><section className="platform-panel"><details className="platform-technical-details"><summary>Ver comprobaciones técnicas de producción</summary><div><ProductionSmokeReport /></div></details></section></>}
    </motion.div>
    <TenantModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} onSuccess={fetchTenants} tenantToEdit={editingTenant} initialTab={modalTab} />
      <AlertDialog open={purgeOpen} onOpenChange={setPurgeOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar organización definitivamente</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción elimina la organización y sus datos asociados. Confirmá para
              continuar.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-3">
            <label className="flex items-center gap-2 text-sm text-muted-foreground">
              <Checkbox
                checked={purgeConfirmed}
                onCheckedChange={(checked) =>
                  setPurgeConfirmed(Boolean(checked))
                }
              />
              Confirmo que quiero eliminar esta organización.
            </label>
            <label className="flex items-center gap-2 text-sm text-muted-foreground">
              <Checkbox
                checked={purgeUsers}
                onCheckedChange={(checked) => setPurgeUsers(Boolean(checked))}
              />
              Eliminar usuarios asociados.
            </label>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmPurge}
              disabled={!purgeConfirmed}
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
  </div>;
}
