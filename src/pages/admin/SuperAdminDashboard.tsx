import React, { useState, useEffect, useCallback, useMemo } from 'react';
import useRequireRole from '@/hooks/useRequireRole';
import type { Role } from '@/utils/roles';
import { apiFetch } from '@/utils/api';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { RefreshCw, Users, Settings2, Trash2 } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

// Componentes importados omitidos en gran parte para brevedad en este script de inyección
import { TenantTable } from '@/components/admin/TenantTable';
import { TenantModal } from '@/components/admin/TenantModal';
import { WhatsappInventoryPanel } from '@/components/admin/WhatsappInventoryPanel';
import { TenantPipelineKanban } from '@/components/admin/superadmin/TenantPipelineKanban';

// Tipos base para simular la estructura
interface Tenant {
  id: string;
  nombre: string;
  slug: string;
  estado: string;
  plan?: string;
  rubro?: string;
  pipeline_stage?: string;
}

interface WhatsappNumber {
  id: string;
  number: string;
  display_name: string;
  status: string;
  tenant_id: string | null;
  provider: string;
}

export default function SuperAdminDashboard() {
  useRequireRole(['super_admin'] as Role[]);

  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTenant, setEditingTenant] = useState<Tenant | null>(null);
  const [modalTab, setModalTab] = useState<'profile' | 'config' | 'limits'>('profile');

  const [purgeOpen, setPurgeOpen] = useState(false);
  const [tenantToPurge, setTenantToPurge] = useState<string | null>(null);
  const [purgeConfirmed, setPurgeConfirmed] = useState(false);
  const [purgeUsers, setPurgeUsers] = useState(false);

  const [whatsappNumbers, setWhatsappNumbers] = useState<WhatsappNumber[]>([]);
  const [whatsappLoading, setWhatsappLoading] = useState(false);
  const [whatsappError, setWhatsappError] = useState<string | null>(null);

  const [selectedProfileSlug, setSelectedProfileSlug] = useState<string>('');
  const [tenantProfile360, setTenantProfile360] = useState<any>(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);

  const fetchTenants = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiFetch<any>('/api/admin/superadmin/tenants');
      setTenants(data.tenants || []);
      setTotal(data.total || 0);
      if (data.tenants?.length > 0 && !selectedProfileSlug) {
        setSelectedProfileSlug(data.tenants[0].slug);
      }
    } catch (err: any) {
      setError(err.message || 'Error al cargar tenants');
      toast.error('No se pudo cargar la lista de tenants');
    } finally {
      setLoading(false);
    }
  }, [selectedProfileSlug]);

  const fetchWhatsappNumbers = useCallback(async () => {
    setWhatsappLoading(true);
    setWhatsappError(null);
    try {
      const data = await apiFetch<any>('/api/admin/superadmin/whatsapp/inventory');
      setWhatsappNumbers(data.numbers || []);
    } catch (err: any) {
      setWhatsappError(err.message || 'Error al cargar números');
    } finally {
      setWhatsappLoading(false);
    }
  }, []);

  const fetchProfile360 = useCallback(async (slug: string) => {
    if (!slug) return;
    setProfileLoading(true);
    setProfileError(null);
    try {
      const data = await apiFetch<any>(`/api/admin/superadmin/tenants/${slug}/profile-360`);
      setTenantProfile360(data);
    } catch (err: any) {
      setProfileError(err.message || 'Error al cargar perfil 360');
    } finally {
      setProfileLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTenants();
    fetchWhatsappNumbers();
  }, [fetchTenants, fetchWhatsappNumbers]);

  useEffect(() => {
    if (selectedProfileSlug) {
      fetchProfile360(selectedProfileSlug);
    }
  }, [selectedProfileSlug, fetchProfile360]);

  const handleEdit = (tenant: Tenant, tab: 'profile' | 'config' | 'limits' = 'profile') => {
    setEditingTenant(tenant);
    setModalTab(tab);
    setIsModalOpen(true);
  };

  const handleCreate = () => {
    setEditingTenant(null);
    setModalTab('profile');
    setIsModalOpen(true);
  };

  const handleImpersonate = async (tenantId: string) => {
    try {
      const data = await apiFetch<any>(`/api/admin/superadmin/tenants/${tenantId}/impersonate`, {
        method: 'POST',
      });
      if (data.token) {
        toast.success('Impersonation token generado. Redirigiendo...');
        window.location.href = `/?token=${data.token}&impersonate=true`;
      }
    } catch (err: any) {
      toast.error(err.message || 'Error al impersonar');
    }
  };

  const handleToggleStatus = async (tenantId: string, currentStatus: string) => {
    const newStatus = currentStatus === 'activo' ? 'inactivo' : 'activo';
    try {
      await apiFetch(`/api/admin/superadmin/tenants/${tenantId}/status`, {
        method: 'PUT',
        body: { estado: newStatus },
      });
      toast.success(`Tenant ${newStatus}`);
      fetchTenants();
    } catch (err: any) {
      toast.error(err.message || 'Error al cambiar estado');
    }
  };

  const handleKanbanStatusChange = async (tenantId: string, newStage: string) => {
     try {
      await apiFetch(`/api/admin/superadmin/tenants/${tenantId}/pipeline`, {
        method: 'PUT',
        body: { pipeline_stage: newStage },
      });
      toast.success(`Tenant movido a ${newStage}`);
      fetchTenants(); // Re-fetch to sync
    } catch (err: any) {
      toast.error(err.message || 'Error al actualizar etapa en el pipeline');
      fetchTenants(); // Revert on error
    }
  };

  const handlePurge = (tenantId: string) => {
    setTenantToPurge(tenantId);
    setPurgeConfirmed(false);
    setPurgeUsers(false);
    setPurgeOpen(true);
  };

  const handleConfirmPurge = async () => {
    if (!tenantToPurge || !purgeConfirmed) return;
    try {
      await apiFetch(`/api/admin/superadmin/tenants/${tenantToPurge}/purge`, {
        method: 'DELETE',
        body: { purgeUsers },
      });
      toast.success('Tenant purgado exitosamente');
      setPurgeOpen(false);
      setTenantToPurge(null);
      fetchTenants();
    } catch (err: any) {
      toast.error(err.message || 'Error al purgar tenant');
    }
  };

  const handleReserveNumber = async (numberId: string) => { /* mock */ };
  const handleReleaseNumber = async (numberId: string) => { /* mock */ };
  const handleAssignNumber = async (numberId: string, tenantId: string | null) => { /* mock */ };
  const handleCreateNumber = async (data: any) => { /* mock */ };
  const handleRegisterExternal = async (data: any) => { /* mock */ };

  const formatPercent = (val: any) =>
    typeof val === 'number' ? `${(val * 100).toFixed(1)}%` : '—';

  const formatHealthClass = (score: number | undefined) => {
    if (typeof score !== 'number') return 'bg-slate-100 text-slate-700';
    if (score >= 0.8) return 'bg-emerald-100 text-emerald-800 border-emerald-200';
    if (score >= 0.5) return 'bg-amber-100 text-amber-800 border-amber-200';
    return 'bg-red-100 text-red-800 border-red-200';
  };

  const profileHeader = tenantProfile360?.profile;
  const profileHealth = tenantProfile360?.health;
  const profileMetrics = tenantProfile360?.metrics;
  const profileOwner = tenantProfile360?.owner;
  const profileAlerts = tenantProfile360?.alerts || [];
  const profileOnboarding = tenantProfile360?.onboarding || {};
  const profileOnboardingEntries = Object.entries(profileOnboarding);

  return (
    <div className="container mx-auto py-8 px-4 max-w-7xl space-y-8">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">CRM Platform</h1>
          <p className="text-muted-foreground mt-1">
            Gestión global de cuentas, health scores y aprovisionamiento.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={fetchTenants}>
            <RefreshCw
              className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`}
            />
            Actualizar
          </Button>
          <Button onClick={handleCreate} size="sm">
            <Users className="mr-2 h-4 w-4" />
            Nuevo Tenant
          </Button>
        </div>
      </div>

      <Tabs defaultValue="pipeline" className="w-full">
         <TabsList className="mb-4">
            <TabsTrigger value="pipeline">Pipeline Kanban</TabsTrigger>
            <TabsTrigger value="list">Directorio</TabsTrigger>
            <TabsTrigger value="health">Profile 360</TabsTrigger>
            <TabsTrigger value="inventory">Inventario WhatsApp</TabsTrigger>
         </TabsList>

         <TabsContent value="pipeline" className="mt-0">
            <TenantPipelineKanban tenants={tenants} onStatusChange={handleKanbanStatusChange} />
         </TabsContent>

         <TabsContent value="list" className="mt-0 space-y-6">
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
         </TabsContent>

         <TabsContent value="health" className="mt-0">
            <Card className="border-muted/60 bg-background/85 shadow-sm backdrop-blur">
              <CardHeader className="gap-4 border-b border-border/50 bg-gradient-to-r from-violet-500/5 via-primary/5 to-transparent">
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
              <CardContent className="space-y-4 pt-6">
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
                      <div className="rounded-2xl border border-border/60 bg-background/70 p-4 shadow-sm">
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
                      <div className="rounded-2xl border border-border/60 bg-background/70 p-4 shadow-sm">
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
         </TabsContent>

         <TabsContent value="inventory" className="mt-0">
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
         </TabsContent>
      </Tabs>

      <TenantModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSuccess={fetchTenants}
        tenantToEdit={editingTenant}
        initialTab={modalTab}
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
