import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiClient } from '@/api/client';
import useRequireRole from '@/hooks/useRequireRole';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Plus } from 'lucide-react';
import { toast } from 'sonner';
import { Tenant } from '@/types/superAdmin';
import { WhatsappNumberInventoryItem } from '@/types/whatsapp';
import { TenantTable } from '@/components/admin/TenantTable';
import { TenantModal } from '@/components/admin/TenantModal';
import { WhatsappInventoryPanel } from '@/components/admin/WhatsappInventoryPanel';
import { safeLocalStorage } from '@/utils/safeLocalStorage';
import { buildTenantPath } from '@/utils/tenantPaths';

export default function SuperAdminDashboard() {
  useRequireRole(['super_admin']);
  const navigate = useNavigate();
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [whatsappNumbers, setWhatsappNumbers] = useState<WhatsappNumberInventoryItem[]>([]);
  const [whatsappLoading, setWhatsappLoading] = useState(true);
  const [whatsappError, setWhatsappError] = useState<string | null>(null);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTenant, setEditingTenant] = useState<Tenant | null>(null);
  const [modalTab, setModalTab] = useState<"general" | "users" | "integrations">("general");

  const fetchTenants = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiClient.superAdminListTenants(1, 100);
      setTenants(data.tenants || []);
      setTotal(data.total || 0);
    } catch (error) {
      console.error("Failed to fetch tenants", error);
      setError("No se pudieron cargar los tenants. Por favor, intente de nuevo más tarde.");
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
  }, []);

  const handleReserveNumber = async (id: string | number) => {
    try {
      await apiClient.superAdminReserveWhatsappNumber(id);
      toast.success("Número reservado.");
      fetchWhatsappNumbers();
    } catch (error) {
      console.error(error);
      toast.error("No se pudo reservar el número.");
    }
  };

  const handleReleaseNumber = async (id: string | number) => {
    try {
      await apiClient.superAdminReleaseWhatsappNumber(id);
      toast.success("Número liberado.");
      fetchWhatsappNumbers();
    } catch (error) {
      console.error(error);
      toast.error("No se pudo liberar el número.");
    }
  };

  const handleAssignNumber = async (id: string | number, tenantSlug: string) => {
    try {
      await apiClient.superAdminAssignWhatsappNumber(id, tenantSlug);
      toast.success("Número asignado.");
      fetchWhatsappNumbers();
    } catch (error) {
      console.error(error);
      toast.error("No se pudo asignar el número.");
    }
  };

  const handleVerifyNumber = async (id: string | number, payload: { phone_number: string; sender_id: string; token: string }) => {
    try {
      await apiClient.superAdminVerifyWhatsappNumber(id, payload);
      toast.success("Número validado.");
      fetchWhatsappNumbers();
    } catch (error) {
      console.error(error);
      toast.error("No se pudo validar el número.");
    }
  };

  const handleRequestNumber = async (payload: { prefix?: string | null; city?: string | null; state?: string | null }) => {
    try {
      await apiClient.superAdminRequestWhatsappNumber(payload);
      toast.success("Solicitud enviada.");
      fetchWhatsappNumbers();
    } catch (error) {
      console.error(error);
      toast.error("No se pudo solicitar el número.");
    }
  };

  const handleRegisterExternal = async (payload: { phone_number: string; sender_id: string; token: string }) => {
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

  const handleEdit = (tenant: Tenant, tab: "general" | "users" | "integrations" = "general") => {
    setEditingTenant(tenant);
    setModalTab(tab);
    setIsModalOpen(true);
  };

  const handleImpersonate = async (tenant: Tenant) => {
    try {
      const { token, redirect_url } = await apiClient.superAdminImpersonate(tenant.slug);

      safeLocalStorage.setItem('authToken', token);

      const target = redirect_url || buildTenantPath('/', tenant.slug);

      toast.success(`Accediendo a ${tenant.nombre}...`);

      const newTab = window.open(target, '_blank', 'noopener,noreferrer');
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
        await apiClient.superAdminUpdateTenant(tenant.slug, { is_active: !tenant.is_active });
        toast.success(tenant.is_active ? "Tenant desactivado." : "Tenant reactivado.");
        fetchTenants();
    } catch (error) {
        console.error(error);
        toast.error("Error al cambiar estado del tenant.");
    }
  };

  return (
    <div className="container mx-auto py-10 px-4 max-w-7xl space-y-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-primary tracking-tight">Super Admin</h1>
          <p className="text-muted-foreground mt-1">Gestión centralizada de Tenants y Plataforma.</p>
        </div>
        <Button onClick={handleCreate} className="shadow-lg">
          <Plus className="mr-2 h-4 w-4" /> Nuevo Tenant
        </Button>
      </div>

      <Card className="border-muted/60 shadow-sm">
        <CardHeader>
          <CardTitle>Tenants ({total})</CardTitle>
          <CardDescription>Listado completo de municipios y pymes registrados en la plataforma.</CardDescription>
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
        onVerify={handleVerifyNumber}
        onRequestNumber={handleRequestNumber}
        onRegisterExternal={handleRegisterExternal}
      />
    </div>
  );
}
