import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiClient } from '@/api/client';
import useRequireRole from '@/hooks/useRequireRole';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Plus } from 'lucide-react';
import { toast } from 'sonner';
import { Tenant } from '@/types/superAdmin';
import { TenantTable } from '@/components/admin/TenantTable';
import { TenantModal } from '@/components/admin/TenantModal';
import { safeLocalStorage } from '@/utils/safeLocalStorage';
import { buildTenantPath } from '@/utils/tenantPaths';

export default function SuperAdminDashboard() {
  useRequireRole(['super_admin']);
  const navigate = useNavigate();
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTenant, setEditingTenant] = useState<Tenant | null>(null);

  const fetchTenants = async () => {
    setLoading(true);
    try {
      const data = await apiClient.superAdminListTenants(1, 100); // Fetch all for now, add pagination later if needed
      setTenants(data.tenants);
      setTotal(data.total);
    } catch (error) {
      console.error("Failed to fetch tenants", error);
      toast.error("Error al cargar tenants. Verificá tu conexión.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTenants();
  }, []);

  const handleCreate = () => {
    setEditingTenant(null);
    setIsModalOpen(true);
  };

  const handleEdit = (tenant: Tenant) => {
    setEditingTenant(tenant);
    setIsModalOpen(true);
  };

  const handleImpersonate = async (tenant: Tenant) => {
    try {
      const { token, redirect_url } = await apiClient.superAdminImpersonate(tenant.slug);

      // Store token and redirect
      safeLocalStorage.setItem('authToken', token);

      // We need to reload/redirect to apply the new auth context
      // Assuming redirect_url is relative to app root (e.g. /portal/slug/admin)
      // Or if it's a full URL.
      // Usually it's better to navigate within SPA if possible, but impersonation might change user context drastically.

      // Check if redirect_url includes tenant prefix
      const target = redirect_url || buildTenantPath('/', tenant.slug);

      toast.success(`Accediendo a ${tenant.nombre}...`);

      // Allow toast to show
      setTimeout(() => {
          window.location.href = target;
      }, 1000);

    } catch (error) {
        console.error(error);
        toast.error("Falló el acceso como admin.");
    }
  };

  const handleToggleStatus = async (tenant: Tenant) => {
    try {
        if (tenant.is_active) {
            await apiClient.superAdminDeactivateTenant(tenant.slug);
            toast.success("Tenant desactivado.");
        } else {
            await apiClient.superAdminActivateTenant(tenant.slug);
            toast.success("Tenant reactivado.");
        }
        fetchTenants();
    } catch (error) {
        console.error(error);
        toast.error("Error al cambiar estado.");
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
          <TenantTable
            tenants={tenants}
            loading={loading}
            onEdit={handleEdit}
            onImpersonate={handleImpersonate}
            onToggleStatus={handleToggleStatus}
          />
        </CardContent>
      </Card>

      <TenantModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSuccess={fetchTenants}
        tenantToEdit={editingTenant}
      />
    </div>
  );
}
