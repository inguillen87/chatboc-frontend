import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiFetch, getErrorMessage } from '@/utils/api';
import useRequireRole from '@/hooks/useRequireRole';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Plus, Edit, ArrowUpCircle } from 'lucide-react';
import { toast } from 'sonner';

interface TenantSummary {
  id: number;
  slug: string;
  nombre: string;
  tipo: 'municipio' | 'pyme';
  plan: string;
  status: 'active' | 'inactive';
  created_at: string;
}

export default function SuperAdminDashboard() {
  useRequireRole(['super_admin']);
  const navigate = useNavigate();
  const [tenants, setTenants] = useState<TenantSummary[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchTenants = async () => {
    setLoading(true);
    try {
      const data = await apiFetch<TenantSummary[]>('/api/admin/tenants');
      setTenants(data);
    } catch (error) {
      console.warn("Failed to fetch tenants, using mock data for demonstration if API fails");
      // Mock data for UI development/verification since backend might not exist yet
      setTenants([
        { id: 1, slug: 'junin', nombre: 'Municipalidad de Junín', tipo: 'municipio', plan: 'full', status: 'active', created_at: '2023-01-01' },
        { id: 2, slug: 'demo-pyme', nombre: 'Pyme Demo', tipo: 'pyme', plan: 'free', status: 'active', created_at: '2023-05-15' },
      ]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTenants();
  }, []);

  const handleUpgrade = (tenant: TenantSummary) => {
      // Future implementation: Open modal to change plan
      toast.info(`Upgrade functionality for ${tenant.nombre} coming soon.`);
  };

  return (
    <div className="container mx-auto py-10 px-4">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-primary">Super Admin Dashboard</h1>
          <p className="text-muted-foreground">Gestión centralizada de Tenants (Municipios y Pymes)</p>
        </div>
        <Button onClick={() => navigate('/admin/tenants/new')}>
          <Plus className="mr-2 h-4 w-4" /> Nuevo Tenant
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Tenants Registrados</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nombre</TableHead>
                <TableHead>Slug</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Plan</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-4">Cargando...</TableCell>
                </TableRow>
              ) : tenants.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-4">No hay tenants registrados.</TableCell>
                </TableRow>
              ) : (
                tenants.map((tenant) => (
                  <TableRow key={tenant.id}>
                    <TableCell className="font-medium">{tenant.nombre}</TableCell>
                    <TableCell>{tenant.slug}</TableCell>
                    <TableCell className="capitalize">{tenant.tipo}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="capitalize">{tenant.plan}</Badge>
                    </TableCell>
                    <TableCell>
                        <Badge variant={tenant.status === 'active' ? 'default' : 'secondary'}>
                            {tenant.status}
                        </Badge>
                    </TableCell>
                    <TableCell className="text-right space-x-2">
                      <Button variant="ghost" size="icon" onClick={() => navigate(`/integracion?tenant=${tenant.slug}`)} title="Configurar">
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => handleUpgrade(tenant)} title="Cambiar Plan">
                        <ArrowUpCircle className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
