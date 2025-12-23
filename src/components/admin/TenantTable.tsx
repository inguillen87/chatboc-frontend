import React from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Edit, LogIn, Power, PowerOff } from 'lucide-react';
import { Tenant } from '@/types/superAdmin';
import { format } from 'date-fns';

interface TenantTableProps {
  tenants: Tenant[];
  loading: boolean;
  onEdit: (tenant: Tenant) => void;
  onImpersonate: (tenant: Tenant) => void;
  onToggleStatus: (tenant: Tenant) => void;
}

export function TenantTable({ tenants, loading, onEdit, onImpersonate, onToggleStatus }: TenantTableProps) {
  if (loading) {
    return <div className="p-8 text-center text-muted-foreground">Cargando tenants...</div>;
  }

  if (tenants.length === 0) {
    return <div className="p-8 text-center text-muted-foreground">No hay tenants registrados.</div>;
  }

  return (
    <div className="border rounded-md">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Nombre</TableHead>
            <TableHead>Slug</TableHead>
            <TableHead>Tipo</TableHead>
            <TableHead>Plan</TableHead>
            <TableHead>Admin</TableHead>
            <TableHead>Creado</TableHead>
            <TableHead>Estado</TableHead>
            <TableHead className="text-right">Acciones</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {tenants.map((tenant) => (
            <TableRow key={tenant.id}>
              <TableCell className="font-medium">{tenant.nombre}</TableCell>
              <TableCell className="font-mono text-xs">{tenant.slug}</TableCell>
              <TableCell>
                <Badge variant="outline" className="capitalize">{tenant.tipo}</Badge>
              </TableCell>
              <TableCell>
                <Badge variant="secondary" className="capitalize">{tenant.plan}</Badge>
              </TableCell>
              <TableCell className="text-sm text-muted-foreground max-w-[150px] truncate" title={tenant.owner_email}>
                {tenant.owner_email || '-'}
              </TableCell>
              <TableCell className="text-sm">
                {tenant.created_at ? format(new Date(tenant.created_at), 'dd/MM/yyyy') : '-'}
              </TableCell>
              <TableCell>
                <Badge variant={tenant.is_active ? 'success' : 'destructive'}>
                  {tenant.is_active ? 'Activo' : 'Inactivo'}
                </Badge>
              </TableCell>
              <TableCell className="text-right">
                <div className="flex justify-end gap-2">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => onEdit(tenant)}
                    title="Editar"
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => onImpersonate(tenant)}
                    title="Acceder como Admin"
                    disabled={!tenant.is_active}
                  >
                    <LogIn className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => onToggleStatus(tenant)}
                    title={tenant.is_active ? "Desactivar" : "Activar"}
                    className={tenant.is_active ? "text-destructive hover:text-destructive hover:bg-destructive/10" : "text-green-600 hover:text-green-600 hover:bg-green-50"}
                  >
                    {tenant.is_active ? <PowerOff className="h-4 w-4" /> : <Power className="h-4 w-4" />}
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
