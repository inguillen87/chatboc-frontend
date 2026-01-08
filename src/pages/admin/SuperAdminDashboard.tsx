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

// Mock Data for Demo/Development since backend might not have data yet
const MOCK_TENANTS: Tenant[] = [
    { id: 1, slug: 'junin', nombre: 'Municipalidad de Junín', tipo: 'municipio', plan: 'full', status: 'active', is_active: true, created_at: '2023-01-01', owner_email: 'admin@junin.gov.ar' },
    { id: 2, slug: 'demo-pyme', nombre: 'Pyme Demo', tipo: 'pyme', plan: 'free', status: 'active', is_active: true, created_at: '2023-05-15', owner_email: 'dueño@pyme.com' },
];

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
      // Try to fetch from API
      const data = await apiClient.superAdminListTenants(1, 100);
      if (data.tenants && data.tenants.length > 0) {
          setTenants(data.tenants);
          setTotal(data.total);
      } else {
          // Fallback to mock if empty response (dev mode)
          setTenants(MOCK_TENANTS);
          setTotal(MOCK_TENANTS.length);
      }
    } catch (error) {
      console.warn("Failed to fetch tenants, using mock data", error);
      // Fallback to mock on error (dev mode)
      setTenants(MOCK_TENANTS);
      setTotal(MOCK_TENANTS.length);
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

      safeLocalStorage.setItem('authToken', token);

      const target = redirect_url || buildTenantPath('/', tenant.slug);

      toast.success(`Accediendo a ${tenant.nombre}...`);

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
        toast.error("Error al cambiar estado (Simulado en dev).");
        // Optimistic update for demo
        setTenants(prev => prev.map(t => t.id === tenant.id ? { ...t, is_active: !t.is_active } : t));
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
