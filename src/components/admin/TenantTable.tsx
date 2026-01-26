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
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Edit, LogIn, MoreVertical, Power, PowerOff, UserPlus, KeyRound, MessageSquare, Trash2 } from 'lucide-react';
import { Tenant } from '@/types/superAdmin';

interface TenantTableProps {
  tenants: Tenant[];
  loading: boolean;
  onEdit: (tenant: Tenant, tab?: "general" | "users" | "integrations") => void;
  onImpersonate: (tenant: Tenant) => void;
  onToggleStatus: (tenant: Tenant) => void;
  onPurge: (tenant: Tenant) => void;
}

export function TenantTable({ tenants, loading, onEdit, onImpersonate, onToggleStatus, onPurge }: TenantTableProps) {
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
            <TableHead>ID</TableHead>
            <TableHead>Slug</TableHead>
            <TableHead>Nombre</TableHead>
            <TableHead>Tipo</TableHead>
            <TableHead>Plan</TableHead>
            <TableHead>Estado</TableHead>
            <TableHead>Email Admin</TableHead>
            <TableHead className="text-right">Acciones</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {tenants.map((tenant) => (
            <TableRow key={tenant.id}>
              <TableCell className="font-mono text-xs">{tenant.id}</TableCell>
              <TableCell className="font-mono text-xs">{tenant.slug}</TableCell>
              <TableCell className="font-medium">{tenant.nombre}</TableCell>
              <TableCell>
                <Badge variant="outline" className="capitalize">{tenant.tipo}</Badge>
              </TableCell>
              <TableCell>
                <Badge variant="secondary" className="capitalize">{tenant.plan}</Badge>
              </TableCell>
              <TableCell>
                <Badge
                  variant={tenant.is_active ? 'secondary' : 'destructive'}
                  className={tenant.is_active ? 'bg-emerald-100 text-emerald-700 border-emerald-200' : undefined}
                >
                  {tenant.is_active ? 'Activo' : 'Inactivo'}
                </Badge>
              </TableCell>
              <TableCell className="text-sm text-muted-foreground max-w-[180px] truncate" title={tenant.owner_email}>
                {tenant.owner_email ? (
                  <a href={`mailto:${tenant.owner_email}`} className="hover:underline text-primary">
                    {tenant.owner_email}
                  </a>
                ) : (
                  '-'
                )}
              </TableCell>
              <TableCell className="text-right">
                <div className="flex justify-end gap-2">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => onImpersonate(tenant)}
                    title="Acceder como Admin"
                    disabled={!tenant.is_active}
                  >
                    <LogIn className="h-4 w-4" />
                  </Button>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" title="Más acciones">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-56">
                      <DropdownMenuItem onSelect={() => onEdit(tenant, "general")}>
                        <Edit className="mr-2 h-4 w-4" />
                        Editar / Plan
                      </DropdownMenuItem>
                      <DropdownMenuItem onSelect={() => onEdit(tenant, "users")} disabled={Boolean(tenant.owner_email)}>
                        <UserPlus className="mr-2 h-4 w-4" />
                        Crear admin
                      </DropdownMenuItem>
                      <DropdownMenuItem onSelect={() => onEdit(tenant, "users")}>
                        <KeyRound className="mr-2 h-4 w-4" />
                        Resetear contraseña
                      </DropdownMenuItem>
                      <DropdownMenuItem onSelect={() => onEdit(tenant, "integrations")}>
                        <MessageSquare className="mr-2 h-4 w-4" />
                        Configurar WhatsApp
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onSelect={() => onToggleStatus(tenant)}>
                        {tenant.is_active ? <PowerOff className="mr-2 h-4 w-4" /> : <Power className="mr-2 h-4 w-4" />}
                        {tenant.is_active ? "Desactivar" : "Activar"}
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onSelect={() => onPurge(tenant)}
                        className="text-destructive focus:text-destructive"
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        Eliminar definitivamente
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
