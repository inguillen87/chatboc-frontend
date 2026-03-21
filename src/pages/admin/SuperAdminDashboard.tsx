import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiClient } from "@/api/client";
import useRequireRole from "@/hooks/useRequireRole";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { Tenant } from "@/types/superAdmin";
import { WhatsappNumberInventoryItem } from "@/types/whatsapp";
import { TenantTable } from "@/components/admin/TenantTable";
import { TenantModal } from "@/components/admin/TenantModal";
import { WhatsappInventoryPanel } from "@/components/admin/WhatsappInventoryPanel";
import { safeLocalStorage } from "@/utils/safeLocalStorage";
import { buildTenantPath } from "@/utils/tenantPaths";
import SuperadminLeadsPipeline from "@/components/admin/SuperadminLeadsPipeline";
import { enterpriseService } from "@/services/enterpriseService";
import { Badge } from "@/components/ui/badge";

export default function SuperAdminDashboard() {
  useRequireRole(["super_admin"]);
  const navigate = useNavigate();
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [whatsappNumbers, setWhatsappNumbers] = useState<
    WhatsappNumberInventoryItem[]
  >([]);
  const [whatsappLoading, setWhatsappLoading] = useState(true);
  const [whatsappError, setWhatsappError] = useState<string | null>(null);
  const [tenantHealth, setTenantHealth] = useState<any[]>([]);
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [selectedProfileSlug, setSelectedProfileSlug] = useState("");
  const [tenantProfile360, setTenantProfile360] = useState<any | null>(null);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTenant, setEditingTenant] = useState<Tenant | null>(null);
  const [modalTab, setModalTab] = useState<
    "general" | "users" | "integrations"
  >("general");
  const [purgeTenant, setPurgeTenant] = useState<Tenant | null>(null);
  const [purgeOpen, setPurgeOpen] = useState(false);
  const [purgeConfirmed, setPurgeConfirmed] = useState(false);
  const [purgeUsers, setPurgeUsers] = useState(true);

  const fetchTenants = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiClient.superAdminListTenants(1, 100);
      setTenants(data.tenants || []);
      setTotal(data.total || 0);
    } catch (error) {
      console.error("Failed to fetch tenants", error);
      setError(
        "No se pudieron cargar los tenants. Por favor, intente de nuevo más tarde.",
      );
      toast.error("Error al cargar los tenants.");
      setTenants([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  };

  const fetchWhatsappNumbers = async () => {
    setWhatsappLoading(true);
    setWhatsappError(null);
    try {
      const data = await apiClient.superAdminListWhatsappNumbers();
      setWhatsappNumbers(data.numbers || []);
    } catch (error) {
      console.error("Failed to fetch WhatsApp numbers", error);
      setWhatsappError("No se pudieron cargar los números de WhatsApp.");
      toast.error("Error al cargar números de WhatsApp.");
      setWhatsappNumbers([]);
    } finally {
      setWhatsappLoading(false);
    }
  };

  useEffect(() => {
    fetchTenants();
    fetchWhatsappNumbers();
    enterpriseService
      .getTenantHealth({ since_days: 30 })
      .then((response) => setTenantHealth(response?.items || []))
      .catch((healthError) => {
        console.error(healthError);
        setTenantHealth([]);
      });
  }, []);

  useEffect(() => {
    const fallbackSlug = selectedProfileSlug || tenants[0]?.slug || "";
    if (!fallbackSlug) return;
    setSelectedProfileSlug((prev) => prev || fallbackSlug);
  }, [selectedProfileSlug, tenants]);

  useEffect(() => {
    if (!selectedProfileSlug) return;
    setProfileLoading(true);
    setProfileError(null);
    enterpriseService
      .getTenantProfile360(selectedProfileSlug, { since_days: 30 })
      .then((response) => setTenantProfile360(response || null))
      .catch((profileFetchError) => {
        console.error(profileFetchError);
        setTenantProfile360(null);
        setProfileError("No se pudo cargar el perfil 360 del tenant.");
      })
      .finally(() => setProfileLoading(false));
  }, [selectedProfileSlug]);

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

  const handleCreateNumber = async (payload: {
    phone_number: string;
    sender_id: string;
    status?: string;
    tenant_slug?: string | null;
  }) => {
    try {
      await apiClient.superAdminCreateWhatsappNumber(payload);
      toast.success("Número creado.");
      fetchWhatsappNumbers();
    } catch (error) {
      console.error(error);
      toast.error("No se pudo crear el número.");
    }
  };

  const handleRegisterExternal = async (payload: {
    number: string;
    sender_id: string;
    status?: string;
    tenant_slug?: string | null;
  }) => {
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

  const sortedTenantHealth = tenantHealth
    .slice()
    .sort((a, b) => (b?.health_score || 0) - (a?.health_score || 0));

  const profileHeader = tenantProfile360?.tenant || {};
  const profileOwner = tenantProfile360?.owner || {};
  const profileHealth = tenantProfile360?.health || {};
  const profileMetrics = tenantProfile360?.metrics || {};
  const profileOnboardingEntries = Object.entries(
    tenantProfile360?.onboarding || {},
  );
  const profileAlerts = Array.isArray(profileHealth?.alerts)
    ? profileHealth.alerts
    : Array.isArray(tenantProfile360?.meta?.alerts)
      ? tenantProfile360.meta.alerts
      : [];
  const formatPercent = (value: unknown) =>
    typeof value === "number" ? `${Math.round(value * 100)}%` : "—";
  const formatHealthClass = (score?: number) =>
    typeof score === "number"
      ? score >= 0.8
        ? "bg-emerald-100 text-emerald-700 border-emerald-200"
        : score >= 0.6
          ? "bg-amber-100 text-amber-700 border-amber-200"
          : "bg-red-100 text-red-700 border-red-200"
      : "bg-slate-100 text-slate-700 border-slate-200";

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

  return (
    <div className="container mx-auto py-10 px-4 max-w-7xl space-y-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-primary tracking-tight">
            Super Admin
          </h1>
          <p className="text-muted-foreground mt-1">
            Gestión centralizada de Tenants y Plataforma.
          </p>
        </div>
        <Button onClick={handleCreate} className="shadow-lg">
          <Plus className="mr-2 h-4 w-4" /> Nuevo Tenant
        </Button>
      </div>

      <SuperadminLeadsPipeline />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(380px,1.2fr)]">
        <Card className="border-muted/60 shadow-sm">
          <CardHeader>
            <CardTitle>Tenant health ranking</CardTitle>
            <CardDescription>
              Ranking rápido por health score, SLA y activación para customer
              success y comercial.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {sortedTenantHealth.slice(0, 8).map((row, index) => (
              <button
                key={`${row?.tenant_slug || "tenant"}-${index}`}
                type="button"
                onClick={() => setSelectedProfileSlug(row?.tenant_slug || "")}
                className="flex w-full items-center justify-between rounded-xl border px-3 py-3 text-left transition hover:bg-muted/40"
              >
                <div className="space-y-1">
                  <div className="font-medium">{row?.tenant_slug || "—"}</div>
                  <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                    <span>
                      Win rate{" "}
                      {typeof row?.win_rate === "number"
                        ? `${(row.win_rate * 100).toFixed(0)}%`
                        : "—"}
                    </span>
                    <span>SLA {row?.sla_breached ?? 0}</span>
                    <span>Encuestas {row?.survey_responses ?? 0}</span>
                  </div>
                </div>
                <Badge
                  variant="outline"
                  className={formatHealthClass(row?.health_score)}
                >
                  {typeof row?.health_score === "number"
                    ? `${(row.health_score * 100).toFixed(0)}%`
                    : "—"}
                </Badge>
              </button>
            ))}
            {!sortedTenantHealth.length ? (
              <div className="text-sm text-muted-foreground">
                No hay datos de tenant health disponibles.
              </div>
            ) : null}
          </CardContent>
        </Card>

        <Card className="border-muted/60 shadow-sm">
          <CardHeader className="gap-4">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <CardTitle>Tenant profile 360</CardTitle>
                <CardDescription>
                  Vista ejecutiva de health, owner, onboarding y métricas clave
                  por tenant.
                </CardDescription>
              </div>
              <select
                className="h-10 min-w-[220px] rounded-md border bg-background px-3 text-sm"
                value={selectedProfileSlug}
                onChange={(event) => setSelectedProfileSlug(event.target.value)}
              >
                {tenants.map((tenant) => (
                  <option key={tenant.slug} value={tenant.slug}>
                    {tenant.nombre} ({tenant.slug})
                  </option>
                ))}
              </select>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {profileError ? (
              <div className="text-sm text-red-500">{profileError}</div>
            ) : null}
            {profileLoading ? (
              <div className="text-sm text-muted-foreground">
                Cargando perfil 360...
              </div>
            ) : null}
            {!profileLoading && !profileError && tenantProfile360 ? (
              <>
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-lg font-semibold">
                    {profileHeader?.nombre ||
                      profileHeader?.name ||
                      selectedProfileSlug}
                  </h3>
                  <Badge variant="outline">
                    {profileHeader?.plan || "Plan —"}
                  </Badge>
                  <Badge
                    variant="outline"
                    className={formatHealthClass(profileHealth?.health_score)}
                  >
                    Health{" "}
                    {typeof profileHealth?.health_score === "number"
                      ? `${(profileHealth.health_score * 100).toFixed(0)}%`
                      : "—"}
                  </Badge>
                </div>

                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  <div className="rounded-xl border p-3">
                    <div className="text-xs text-muted-foreground">Owner</div>
                    <div className="mt-1 font-medium">
                      {profileOwner?.name ||
                        profileOwner?.nombre ||
                        profileOwner?.email ||
                        "—"}
                    </div>
                  </div>
                  <div className="rounded-xl border p-3">
                    <div className="text-xs text-muted-foreground">
                      Win rate
                    </div>
                    <div className="mt-1 font-medium">
                      {formatPercent(
                        profileHealth?.win_rate ?? profileMetrics?.win_rate,
                      )}
                    </div>
                  </div>
                  <div className="rounded-xl border p-3">
                    <div className="text-xs text-muted-foreground">
                      Response rate
                    </div>
                    <div className="mt-1 font-medium">
                      {formatPercent(
                        profileHealth?.response_rate ??
                          profileMetrics?.response_rate,
                      )}
                    </div>
                  </div>
                  <div className="rounded-xl border p-3">
                    <div className="text-xs text-muted-foreground">
                      SLA breached
                    </div>
                    <div className="mt-1 font-medium">
                      {profileHealth?.sla_breached ??
                        profileMetrics?.sla_breached ??
                        0}
                    </div>
                  </div>
                </div>

                <div className="grid gap-4 lg:grid-cols-2">
                  <div className="rounded-xl border p-4">
                    <div className="mb-2 text-sm font-medium">Alertas</div>
                    <div className="flex flex-wrap gap-2">
                      {profileAlerts.length ? (
                        profileAlerts.map((alert: any, index: number) => (
                          <Badge
                            key={`alert-${index}`}
                            variant="outline"
                            className="bg-amber-100 text-amber-700 border-amber-200"
                          >
                            {typeof alert === "string"
                              ? alert
                              : alert?.label ||
                                alert?.code ||
                                `alerta_${index + 1}`}
                          </Badge>
                        ))
                      ) : (
                        <span className="text-sm text-muted-foreground">
                          Sin alertas activas.
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="rounded-xl border p-4">
                    <div className="mb-2 text-sm font-medium">Onboarding</div>
                    <div className="grid gap-2 sm:grid-cols-2">
                      {profileOnboardingEntries.length ? (
                        profileOnboardingEntries.map(([key, value]) => (
                          <div
                            key={key}
                            className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm"
                          >
                            <span className="capitalize">
                              {key.replaceAll("_", " ")}
                            </span>
                            <Badge
                              variant="outline"
                              className={
                                value
                                  ? "bg-emerald-100 text-emerald-700 border-emerald-200"
                                  : "bg-slate-100 text-slate-700 border-slate-200"
                              }
                            >
                              {value ? "OK" : "Pendiente"}
                            </Badge>
                          </div>
                        ))
                      ) : (
                        <span className="text-sm text-muted-foreground">
                          Sin checklist de onboarding disponible.
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </>
            ) : null}
          </CardContent>
        </Card>
      </div>

      <Card className="border-muted/60 shadow-sm">
        <CardHeader>
          <CardTitle>Tenants ({total})</CardTitle>
          <CardDescription>
            Listado completo de municipios y pymes registrados en la plataforma.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {error ? (
            <div className="text-center text-red-500 py-8">{error}</div>
          ) : (
            <TenantTable
              tenants={tenants}
              loading={loading}
              onEdit={handleEdit}
              onImpersonate={handleImpersonate}
              onToggleStatus={handleToggleStatus}
              onPurge={handlePurge}
            />
          )}
        </CardContent>
      </Card>

      <TenantModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSuccess={fetchTenants}
        tenantToEdit={editingTenant}
        initialTab={modalTab}
      />

      <WhatsappInventoryPanel
        numbers={whatsappNumbers}
        tenants={tenants}
        loading={whatsappLoading}
        error={whatsappError}
        onRefresh={fetchWhatsappNumbers}
        onReserve={handleReserveNumber}
        onRelease={handleReleaseNumber}
        onAssign={handleAssignNumber}
        onCreateNumber={handleCreateNumber}
        onRegisterExternal={handleRegisterExternal}
      />

      <AlertDialog open={purgeOpen} onOpenChange={setPurgeOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar tenant definitivamente</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción elimina el tenant y sus datos asociados. Confirmá para
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
              Confirmo que quiero eliminar este tenant.
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
    </div>
  );
}
