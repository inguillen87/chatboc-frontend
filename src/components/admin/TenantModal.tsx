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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { Tenant } from '@/types/superAdmin';
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
});

const updateSchema = z.object({
  nombre: z.string().min(2, 'El nombre es requerido'),
  plan: z.enum(['free', 'pro', 'full', 'enterprise']),
  is_active: z.boolean(),
});

const adminUserSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  name: z.string().min(2)
});

const resetPasswordSchema = z.object({
  password: z.string().min(6)
});

const whatsappSchema = z.object({
  number: z.string().min(10)
});

interface TenantModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  tenantToEdit?: Tenant | null;
  initialTab?: "general" | "users" | "integrations";
}

export function TenantModal({ isOpen, onClose, onSuccess, tenantToEdit, initialTab = "general" }: TenantModalProps) {
  const [loading, setLoading] = useState(false);
  const isEditing = !!tenantToEdit;
  const [activeTab, setActiveTab] = useState("general");

  const form = useForm<z.infer<typeof createSchema> | z.infer<typeof updateSchema>>({
    resolver: zodResolver(isEditing ? updateSchema : createSchema),
    defaultValues: isEditing ? {
      nombre: tenantToEdit.nombre,
      plan: tenantToEdit.plan as any,
      is_active: tenantToEdit.is_active,
    } : {
      nombre: '',
      slug: '',
      tipo: 'pyme',
      plan: 'pro',
      email_admin: '',
    },
  });

  // User Management Forms
  const userForm = useForm<z.infer<typeof adminUserSchema>>({ resolver: zodResolver(adminUserSchema) });
  const resetPassForm = useForm<z.infer<typeof resetPasswordSchema>>({ resolver: zodResolver(resetPasswordSchema) });
  const whatsappForm = useForm<z.infer<typeof whatsappSchema>>({
      resolver: zodResolver(whatsappSchema),
      defaultValues: { number: tenantToEdit?.whatsapp_sender_id || '' }
  });

  // Reset forms when opening
  React.useEffect(() => {
    if (isOpen) {
        if (tenantToEdit) {
            form.reset({
                nombre: tenantToEdit.nombre,
                plan: tenantToEdit.plan as any,
                is_active: tenantToEdit.is_active,
            });
            whatsappForm.reset({ number: tenantToEdit.whatsapp_sender_id || '' });
        } else {
            form.reset({
                nombre: '',
                slug: '',
                tipo: 'pyme',
                plan: 'pro',
                email_admin: '',
            });
        }
        setActiveTab(initialTab);
    }
  }, [isOpen, tenantToEdit, form, whatsappForm, initialTab]);

  const onSubmitGeneral = async (values: any) => {
    setLoading(true);
    try {
      if (isEditing && tenantToEdit) {
        const updatePayload = {
          plan: values.plan,
          is_active: values.is_active
        };
        await apiClient.superAdminUpdateTenant(tenantToEdit.slug, updatePayload);
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

  const onSubmitUser = async (values: any) => {
      if (!tenantToEdit) return;
      setLoading(true);
      try {
          await apiClient.superAdminCreateAdminUser(tenantToEdit.slug, values);
          toast.success("Usuario administrador creado");
          userForm.reset();
      } catch (error) {
          toast.error("Error al crear usuario");
      } finally {
          setLoading(false);
      }
  };

  const onSubmitResetPass = async (values: any) => {
      if (!tenantToEdit) return;
      setLoading(true);
      try {
          await apiClient.superAdminResetPassword(tenantToEdit.slug, values);
          toast.success("Contraseña restablecida");
          resetPassForm.reset();
      } catch (error) {
          toast.error("Error al restablecer contraseña");
      } finally {
          setLoading(false);
      }
  };

  const onSubmitWhatsapp = async (values: any) => {
      if (!tenantToEdit) return;
      setLoading(true);
      try {
          await apiClient.superAdminUpdateWhatsapp(tenantToEdit.slug, values);
          toast.success("WhatsApp configurado");
          onSuccess(); // Refresh to update list state if needed
      } catch (error) {
          toast.error("Error al configurar WhatsApp");
      } finally {
          setLoading(false);
      }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>{isEditing ? `Editar: ${tenantToEdit.nombre}` : 'Nuevo Tenant'}</DialogTitle>
        </DialogHeader>

        {isEditing ? (
            <Tabs value={activeTab} onValueChange={setActiveTab}>
                <TabsList className="grid w-full grid-cols-3">
                    <TabsTrigger value="general">General</TabsTrigger>
                    <TabsTrigger value="users">Usuarios</TabsTrigger>
                    <TabsTrigger value="integrations">Integraciones</TabsTrigger>
                </TabsList>

                {/* TAB 1: GENERAL */}
                <TabsContent value="general" className="space-y-4 py-4">
                    <Form {...form}>
                        <form onSubmit={form.handleSubmit(onSubmitGeneral)} className="space-y-4">
                            <FormField
                                control={form.control}
                                name="nombre"
                                render={({ field }) => (
                                    <FormItem>
                                    <FormLabel>Nombre</FormLabel>
                                    <FormControl><Input {...field} /></FormControl>
                                    <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name="plan"
                                render={({ field }) => (
                                    <FormItem>
                                    <FormLabel>Plan</FormLabel>
                                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                                        <FormControl><SelectTrigger><SelectValue placeholder="Seleccionar plan" /></SelectTrigger></FormControl>
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
                                name="is_active"
                                render={({ field }) => (
                                    <FormItem className="flex items-center justify-between rounded-lg border p-3">
                                        <div>
                                            <FormLabel className="text-sm">Estado</FormLabel>
                                            <p className="text-xs text-muted-foreground">Define si el tenant está activo.</p>
                                        </div>
                                        <FormControl>
                                            <Switch checked={field.value} onCheckedChange={field.onChange} />
                                        </FormControl>
                                    </FormItem>
                                )}
                            />
                            <div className="flex justify-end pt-2">
                                <Button type="submit" disabled={loading}>
                                    {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                    Guardar Cambios
                                </Button>
                            </div>
                        </form>
                    </Form>
                </TabsContent>

                {/* TAB 2: USUARIOS */}
                <TabsContent value="users" className="space-y-6 py-4">
                    <div className="space-y-4 border p-4 rounded-md">
                        <h3 className="font-medium text-sm">Crear Nuevo Admin</h3>
                        <Form {...userForm}>
                            <form onSubmit={userForm.handleSubmit(onSubmitUser)} className="space-y-3">
                                <div className="grid grid-cols-2 gap-2">
                                    <FormField control={userForm.control} name="name" render={({ field }) => (
                                        <FormItem><FormControl><Input placeholder="Nombre" {...field} /></FormControl><FormMessage/></FormItem>
                                    )} />
                                    <FormField control={userForm.control} name="email" render={({ field }) => (
                                        <FormItem><FormControl><Input placeholder="Email" {...field} /></FormControl><FormMessage/></FormItem>
                                    )} />
                                </div>
                                <FormField control={userForm.control} name="password" render={({ field }) => (
                                    <FormItem><FormControl><Input type="password" placeholder="Contraseña" {...field} /></FormControl><FormMessage/></FormItem>
                                )} />
                                <Button size="sm" type="submit" disabled={loading}>Crear Usuario</Button>
                            </form>
                        </Form>
                    </div>

                    <div className="space-y-4 border p-4 rounded-md bg-muted/20">
                        <h3 className="font-medium text-sm">Restablecer Contraseña (Admin Principal)</h3>
                        <Form {...resetPassForm}>
                            <form onSubmit={resetPassForm.handleSubmit(onSubmitResetPass)} className="flex gap-2 items-end">
                                <div className="flex-1">
                                    <FormField control={resetPassForm.control} name="password" render={({ field }) => (
                                        <FormItem><FormControl><Input type="password" placeholder="Nueva contraseña" {...field} /></FormControl><FormMessage/></FormItem>
                                    )} />
                                </div>
                                <Button size="sm" variant="secondary" type="submit" disabled={loading}>Resetear</Button>
                            </form>
                        </Form>
                    </div>
                </TabsContent>

                {/* TAB 3: INTEGRACIONES */}
                <TabsContent value="integrations" className="space-y-4 py-4">
                    <Form {...whatsappForm}>
                        <form onSubmit={whatsappForm.handleSubmit(onSubmitWhatsapp)} className="space-y-4">
                            <FormField
                                control={whatsappForm.control}
                                name="number"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Número de WhatsApp (Sender ID)</FormLabel>
                                        <FormControl>
                                            <Input placeholder="+54911..." {...field} />
                                        </FormControl>
                                        <p className="text-xs text-muted-foreground">Debe incluir código de país (ej: +549...)</p>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <div className="flex justify-end">
                                <Button type="submit" disabled={loading}>Guardar Integración</Button>
                            </div>
                        </form>
                    </Form>
                </TabsContent>
            </Tabs>
        ) : (
            // CREATE MODE (Single Form)
            <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmitGeneral)} className="space-y-4">
                    <FormField
                    control={form.control}
                    name="nombre"
                    render={({ field }) => (
                        <FormItem>
                        <FormLabel>Nombre</FormLabel>
                        <FormControl><Input placeholder="Nombre del Cliente" {...field} /></FormControl>
                        <FormMessage />
                        </FormItem>
                    )}
                    />
                    <div className="grid grid-cols-2 gap-4">
                        <FormField
                        control={form.control}
                        name="slug"
                        render={({ field }) => (
                            <FormItem>
                            <FormLabel>Slug</FormLabel>
                            <FormControl><Input placeholder="cliente-slug" {...field} /></FormControl>
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
                                <FormControl><SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger></FormControl>
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
                    <div className="grid grid-cols-2 gap-4">
                        <FormField
                        control={form.control}
                        name="plan"
                        render={({ field }) => (
                            <FormItem>
                            <FormLabel>Plan</FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                                <FormControl><SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger></FormControl>
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
                            name="email_admin"
                            render={({ field }) => (
                            <FormItem>
                                <FormLabel>Email Admin</FormLabel>
                                <FormControl><Input type="email" placeholder="admin@cliente.com" {...field} /></FormControl>
                                <FormMessage />
                            </FormItem>
                            )}
                        />
                    </div>
                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
                        <Button type="submit" disabled={loading}>
                            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Crear Tenant
                        </Button>
                    </DialogFooter>
                </form>
            </Form>
        )}
      </DialogContent>
    </Dialog>
  );
}
