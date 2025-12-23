import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tenant, CreateTenantDTO, UpdateTenantDTO } from '@/types/superAdmin';
import { apiClient } from '@/api/client';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';

const createSchema = z.object({
  nombre: z.string().min(2, 'El nombre es requerido'),
  slug: z.string().min(3, 'El slug debe tener al menos 3 caracteres')
    .regex(/^[a-z0-9-]+$/, 'Solo letras minúsculas, números y guiones'),
  tipo: z.enum(['municipio', 'pyme']),
  plan: z.enum(['free', 'pro', 'full', 'enterprise']),
  email_admin: z.string().email('Email inválido'),
  whatsapp_sender_id: z.string().optional(),
});

const updateSchema = z.object({
  nombre: z.string().min(2, 'El nombre es requerido'),
  plan: z.enum(['free', 'pro', 'full', 'enterprise']),
  whatsapp_sender_id: z.string().optional(),
});

interface TenantModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  tenantToEdit?: Tenant | null;
}

export function TenantModal({ isOpen, onClose, onSuccess, tenantToEdit }: TenantModalProps) {
  const [loading, setLoading] = useState(false);
  const isEditing = !!tenantToEdit;

  const form = useForm<z.infer<typeof createSchema> | z.infer<typeof updateSchema>>({
    resolver: zodResolver(isEditing ? updateSchema : createSchema),
    defaultValues: isEditing ? {
      nombre: tenantToEdit.nombre,
      plan: tenantToEdit.plan as any,
      whatsapp_sender_id: tenantToEdit.whatsapp_sender_id || '',
    } : {
      nombre: '',
      slug: '',
      tipo: 'pyme',
      plan: 'pro',
      email_admin: '',
      whatsapp_sender_id: '',
    },
  });

  // Reset form when opening for create/edit
  React.useEffect(() => {
    if (isOpen) {
        if (tenantToEdit) {
            form.reset({
                nombre: tenantToEdit.nombre,
                plan: tenantToEdit.plan as any,
                whatsapp_sender_id: tenantToEdit.whatsapp_sender_id || '',
            });
        } else {
            form.reset({
                nombre: '',
                slug: '',
                tipo: 'pyme',
                plan: 'pro',
                email_admin: '',
                whatsapp_sender_id: '',
            });
        }
    }
  }, [isOpen, tenantToEdit, form]);

  const onSubmit = async (values: any) => {
    setLoading(true);
    try {
      if (isEditing && tenantToEdit) {
        await apiClient.superAdminUpdateTenant(tenantToEdit.slug, values);
        toast.success('Tenant actualizado correctamente');
      } else {
        await apiClient.superAdminCreateTenant(values);
        toast.success('Tenant creado correctamente');
      }
      onSuccess();
      onClose();
    } catch (error) {
      console.error(error);
      toast.error(isEditing ? 'Error al actualizar' : 'Error al crear (verificar slug duplicado)');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Editar Tenant' : 'Nuevo Tenant'}</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">

            <FormField
              control={form.control}
              name="nombre"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nombre</FormLabel>
                  <FormControl>
                    <Input placeholder="Nombre del Cliente" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {!isEditing && (
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="slug"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Slug</FormLabel>
                      <FormControl>
                        <Input placeholder="cliente-slug" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="tipo"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Tipo</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Seleccionar tipo" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="pyme">Pyme</SelectItem>
                          <SelectItem value="municipio">Municipio</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
                <FormField
                control={form.control}
                name="plan"
                render={({ field }) => (
                    <FormItem>
                    <FormLabel>Plan</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                        <SelectTrigger>
                            <SelectValue placeholder="Seleccionar plan" />
                        </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                        <SelectItem value="free">Gratis</SelectItem>
                        <SelectItem value="pro">Pro</SelectItem>
                        <SelectItem value="full">Full</SelectItem>
                        <SelectItem value="enterprise">Enterprise</SelectItem>
                        </SelectContent>
                    </Select>
                    <FormMessage />
                    </FormItem>
                )}
                />
                 <FormField
                    control={form.control}
                    name="whatsapp_sender_id"
                    render={({ field }) => (
                        <FormItem>
                        <FormLabel>WhatsApp Sender (Opcional)</FormLabel>
                        <FormControl>
                            <Input placeholder="whatsapp:+123456789" {...field} />
                        </FormControl>
                        <FormMessage />
                        </FormItem>
                    )}
                />
            </div>

            {!isEditing && (
              <FormField
                control={form.control}
                name="email_admin"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email del Administrador</FormLabel>
                    <FormControl>
                      <Input type="email" placeholder="admin@cliente.com" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
              <Button type="submit" disabled={loading}>
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {isEditing ? 'Guardar Cambios' : 'Crear Tenant'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
