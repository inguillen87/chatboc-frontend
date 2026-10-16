import React, { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import {
  Dialog,
  DialogContent,
  DialogClose,
  DialogDescription,
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
import { NativeAdminLegacyMembershipCard } from '@/components/admin/platform/NativeAdminLegacyMembershipCard';
import { apiClient } from '@/api/client';
import { toast } from 'sonner';
import { Building2, GraduationCap, Loader2, MessageCircle, ShieldCheck, Store, X } from 'lucide-react';
import { organizationTypeLabel } from '@/utils/organizationTypeLabel';
import { captureChatbocSessionRevision, isChatbocSessionRevisionCurrent, subscribeChatbocSessionRevision } from '@/utils/chatbocSessionRevision';

const createSchema = z.object({
  nombre: z.string().min(2, 'El nombre es requerido'),
  slug: z.string().min(3, 'El slug debe tener al menos 3 caracteres')
    .regex(/^[a-z0-9-]+$/, 'Solo letras minúsculas, números y guiones'),
  tipo: z.enum(['municipio', 'pyme', 'colegio']),
  plan: z.enum(['free', 'pro', 'full', 'enterprise']),
  email_admin: z.union([
    z.string().trim().email('Email inválido'),
    z.literal(''),
  ]).optional(),
});

const updateSchema = z.object({
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
  onInstitutionProfile?: (tenant: Tenant) => void;
}

export function TenantModal(props: TenantModalProps) {
  const revision = useSyncExternalStore(subscribeChatbocSessionRevision, captureChatbocSessionRevision, captureChatbocSessionRevision);
  const [opening, setOpening] = useState(() => ({ open: props.isOpen, revision }));
  const retirementNotice = useRef<number | null>(null);
  const authorityRetired = props.isOpen && opening.revision !== revision;
  useEffect(() => {
    if (!authorityRetired || retirementNotice.current === revision || !isChatbocSessionRevisionCurrent(revision)) return;
    retirementNotice.current = revision;
    props.onClose();
  }, [authorityRetired, revision, props.onClose]);
  if (opening.open !== props.isOpen) setOpening({ open: props.isOpen, revision });
  if (!props.isOpen) return null;
  // A new authority cannot inherit an already open privileged form.
  if (opening.revision !== revision) return null;
  return <TenantModalSession key={JSON.stringify([props.tenantToEdit?.slug ?? null, revision])} {...props} revision={revision} />;
}

function TenantModalSession({ isOpen, onClose, onSuccess, tenantToEdit, initialTab = "general", onInstitutionProfile, revision }: TenantModalProps & { revision: number }) {
  const [loading, setLoading] = useState(false);
  const [retired, setRetired] = useState(false);
  const isEditing = !!tenantToEdit;
  const [activeTab, setActiveTab] = useState(initialTab);
  const alive = useRef(false);
  const writeLock = useRef(false);
  const closedByOwner = useRef(false);
  const content = useRef<HTMLDivElement>(null);
  const opener = useRef<HTMLElement | null>(null);
  const returnFocus = useRef<{ target: HTMLElement; content: HTMLDivElement } | null>(null);
  const callbacks = useRef({ onClose, onSuccess, onInstitutionProfile });
  callbacks.current = { onClose, onSuccess, onInstitutionProfile };
  useLayoutEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  const isCurrent = () => alive.current && isChatbocSessionRevisionCurrent(revision);
  const beginWrite = () => {
    if (!isCurrent() || writeLock.current) return false;
    writeLock.current = true; setLoading(true); return true;
  };
  const finishWrite = () => {
    if (!isCurrent()) return;
    writeLock.current = false; setLoading(false);
  };

  const form = useForm<z.infer<typeof createSchema> | z.infer<typeof updateSchema>>({
    resolver: zodResolver(isEditing ? updateSchema : createSchema),
    defaultValues: isEditing ? {
      plan: tenantToEdit.plan as any,
      is_active: tenantToEdit.is_active,
    } : {
      nombre: '',
      slug: '',
      tipo: 'pyme',
      plan: 'full',
      email_admin: '',
    },
  });

  // User Management Forms
  const userForm = useForm<z.infer<typeof adminUserSchema>>({ resolver: zodResolver(adminUserSchema), defaultValues: { name: '', email: '', password: '' } });
  const resetPassForm = useForm<z.infer<typeof resetPasswordSchema>>({ resolver: zodResolver(resetPasswordSchema), defaultValues: { password: '' } });
  const whatsappForm = useForm<z.infer<typeof whatsappSchema>>({
      resolver: zodResolver(whatsappSchema),
      defaultValues: { number: tenantToEdit?.whatsapp_sender_id || '' }
  });

  useEffect(() => { setActiveTab(initialTab); }, [initialTab]);
  const closeOwner = () => {
    if (!isCurrent()) return;
    closedByOwner.current = true;
    returnFocus.current = opener.current && content.current?.contains(document.activeElement)
      ? { target: opener.current, content: content.current } : null;
    alive.current = false;
    userForm.reset(); resetPassForm.reset();
    setRetired(true);
    callbacks.current.onClose();
  };

  const onSubmitGeneral = async (values: any) => {
    if (!beginWrite()) return;
    try {
      if (isEditing && tenantToEdit) {
        await apiClient.superAdminUpdateTenant(tenantToEdit.slug, { plan: values.plan, is_active: values.is_active });
        if (!isCurrent()) return;
        toast.success('Tenant actualizado correctamente');
      } else {
        await apiClient.superAdminCreateTenant(values);
        if (!isCurrent()) return;
        toast.success('Tenant creado correctamente');
      }
      callbacks.current.onSuccess();
      closeOwner();
    } catch (error) {
      if (!isCurrent()) return;
      console.error(error);
      toast.error(isEditing ? 'Error al actualizar' : 'Error al crear (verificar slug duplicado)');
    } finally {
      finishWrite();
    }
  };

  const onSubmitUser = async (values: any) => {
      if (!tenantToEdit) return;
      if (!beginWrite()) return;
      try {
          await apiClient.superAdminCreateAdminUser(tenantToEdit.slug, values);
          if (!isCurrent()) return;
          toast.success("Usuario administrador creado");
          userForm.reset();
      } catch (error) {
          if (!isCurrent()) return;
          toast.error("Error al crear usuario");
      } finally {
          finishWrite();
      }
  };

  const onSubmitResetPass = async (values: any) => {
      if (!tenantToEdit) return;
      if (!beginWrite()) return;
      try {
          await apiClient.superAdminResetPassword(tenantToEdit.slug, values);
          if (!isCurrent()) return;
          toast.success("Contraseña restablecida");
          resetPassForm.reset();
      } catch (error) {
          if (!isCurrent()) return;
          toast.error("Error al restablecer contraseña");
      } finally {
          finishWrite();
      }
  };

  const onSubmitWhatsapp = async (values: any) => {
      if (!tenantToEdit) return;
      if (!beginWrite()) return;
      try {
          await apiClient.superAdminUpdateWhatsapp(tenantToEdit.slug, values);
          if (!isCurrent()) return;
          toast.success("WhatsApp configurado");
          callbacks.current.onSuccess(); // Refresh to update list state if needed
      } catch (error) {
          if (!isCurrent()) return;
          toast.error("Error al configurar WhatsApp");
      } finally {
          finishWrite();
      }
  };

  if (retired) return null;
  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) closeOwner(); }}>
      <DialogContent ref={content} showCloseButton={false} className="max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] overflow-y-auto sm:max-w-[720px]" onOpenAutoFocus={() => {
        const active = document.activeElement;
        if (active instanceof HTMLElement && active !== document.body && !content.current?.contains(active)) opener.current = active;
      }} onCloseAutoFocus={(event) => {
        event.preventDefault();
        const request = returnFocus.current;
        returnFocus.current = null;
        if (!closedByOwner.current || !isChatbocSessionRevisionCurrent(revision) || !request?.target.isConnected) return;
        const active = document.activeElement;
        if (active === document.body || request.content.contains(active)) request.target.focus({ preventScroll: true });
      }}>
        <DialogHeader className="pr-14">
          <DialogTitle>{isEditing ? `Editar: ${tenantToEdit.nombre}` : 'Nuevo Tenant'}</DialogTitle>
          <DialogDescription>
            {isEditing
              ? 'Administra plan, usuarios y canal WhatsApp del tenant.'
              : 'Crea una organizacion lista para operar con widget, CRM, permisos y onboarding WhatsApp.'}
          </DialogDescription>
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
                            <section aria-label="Datos institucionales" className="space-y-2 rounded-lg border p-3">
                                <p className="font-medium">{tenantToEdit.nombre}</p>
                                <p className="text-sm text-muted-foreground">El nombre, contacto y rubro se guardan desde el perfil institucional de esta organización.</p>
                                <Button type="button" variant="outline" disabled={loading || !onInstitutionProfile || tenantToEdit.is_active !== true}
                                    onClick={() => { if (!isCurrent()) return; closeOwner(); if (isChatbocSessionRevisionCurrent(revision)) callbacks.current.onInstitutionProfile?.(tenantToEdit); }}>Editar datos institucionales</Button>
                            </section>
                            <FormField
                                control={form.control}
                                name="plan"
                                render={({ field }) => (
                                    <FormItem>
                                    <FormLabel>Plan</FormLabel>
                                    <Select onValueChange={field.onChange} value={field.value} disabled={loading}>
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
                                            <Switch checked={field.value} onCheckedChange={field.onChange} disabled={loading} />
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
                    {isOpen && activeTab === 'users' && tenantToEdit?.tipo === 'municipio' && <NativeAdminLegacyMembershipCard key={tenantToEdit.slug} tenant={tenantToEdit} />}
                    <div className="space-y-4 border p-4 rounded-md">
                        <h3 className="font-medium text-sm">Crear Nuevo Admin</h3>
                        <Form {...userForm}>
                            <form onSubmit={userForm.handleSubmit(onSubmitUser)} className="space-y-3">
                                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                                    <FormField control={userForm.control} name="name" render={({ field }) => (
                                        <FormItem><FormLabel>Nombre del administrador</FormLabel><FormControl><Input placeholder="Nombre" {...field} disabled={loading} autoComplete="off" /></FormControl><FormMessage/></FormItem>
                                    )} />
                                    <FormField control={userForm.control} name="email" render={({ field }) => (
                                        <FormItem><FormLabel>Correo del administrador</FormLabel><FormControl><Input type="email" placeholder="Email" {...field} disabled={loading} autoComplete="off" /></FormControl><FormMessage/></FormItem>
                                    )} />
                                </div>
                                <FormField control={userForm.control} name="password" render={({ field }) => (
                                    <FormItem><FormLabel>Contraseña del administrador</FormLabel><FormControl><Input type="password" placeholder="Contraseña" {...field} disabled={loading} autoComplete="new-password" /></FormControl><FormMessage/></FormItem>
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
                                        <FormItem><FormLabel>Nueva contraseña del administrador</FormLabel><FormControl><Input type="password" placeholder="Nueva contraseña" {...field} disabled={loading} autoComplete="new-password" /></FormControl><FormMessage/></FormItem>
                                    )} />
                                </div>
                                <Button size="sm" variant="secondary" type="submit" disabled={loading}>Resetear</Button>
                            </form>
                        </Form>
                    </div>
                </TabsContent>

                {/* TAB 3: INTEGRACIONES */}
                <TabsContent value="integrations" className="space-y-4 py-4">
                    <div className="rounded-xl border bg-muted/20 p-3">
                        <div className="flex items-start gap-2">
                            <MessageCircle className="mt-0.5 h-4 w-4 text-primary" />
                            <div>
                                <p className="text-sm font-medium">Sender dedicado por tenant</p>
                                <p className="text-xs text-muted-foreground">
                                    El numero queda asociado al tenant para que webhooks, menus y CRM no se mezclen entre rubros.
                                </p>
                            </div>
                        </div>
                    </div>
                    <Form {...whatsappForm}>
                        <form onSubmit={whatsappForm.handleSubmit(onSubmitWhatsapp)} className="space-y-4">
                            <FormField
                                control={whatsappForm.control}
                                name="number"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Número de WhatsApp (Sender ID)</FormLabel>
                                        <FormControl>
                                            <Input placeholder="+54911..." {...field} disabled={loading} />
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
                    <div className="grid gap-3 rounded-xl border bg-muted/20 p-3 sm:grid-cols-3">
                      <div className="flex items-start gap-2">
                        <Building2 className="mt-0.5 h-4 w-4 text-primary" />
                        <div>
                          <p className="text-sm font-medium">{organizationTypeLabel('municipio')}</p>
                          <p className="text-xs text-muted-foreground">Reclamos, turnos, mapa y encuestas.</p>
                        </div>
                      </div>
                      <div className="flex items-start gap-2">
                        <GraduationCap className="mt-0.5 h-4 w-4 text-primary" />
                        <div>
                          <p className="text-sm font-medium">{organizationTypeLabel('colegio')}</p>
                          <p className="text-xs text-muted-foreground">Familias, certificados y comunicados.</p>
                        </div>
                      </div>
                      <div className="flex items-start gap-2">
                        <Store className="mt-0.5 h-4 w-4 text-primary" />
                        <div>
                          <p className="text-sm font-medium">Pyme</p>
                          <p className="text-xs text-muted-foreground">Pedidos, catalogo y leads comerciales.</p>
                        </div>
                      </div>
                    </div>
                    <FormField
                    control={form.control}
                    name="nombre"
                    render={({ field }) => (
                        <FormItem>
                        <FormLabel>Nombre</FormLabel>
                        <FormControl><Input placeholder="Nombre del Cliente" {...field} disabled={loading} /></FormControl>
                        <FormMessage />
                        </FormItem>
                    )}
                    />
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <FormField
                        control={form.control}
                        name="slug"
                        render={({ field }) => (
                            <FormItem>
                            <FormLabel>Slug</FormLabel>
                            <FormControl><Input placeholder="cliente-slug" {...field} disabled={loading} /></FormControl>
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
                            <Select onValueChange={field.onChange} value={field.value} disabled={loading}>
                                <FormControl><SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger></FormControl>
                                <SelectContent>
                                <SelectItem value="pyme">{organizationTypeLabel('pyme')}</SelectItem>
                                <SelectItem value="municipio">{organizationTypeLabel('municipio')}</SelectItem>
                                <SelectItem value="colegio">{organizationTypeLabel('colegio')}</SelectItem>
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
                            <Select onValueChange={field.onChange} value={field.value} disabled={loading}>
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
                                <FormControl><Input type="email" placeholder="admin@cliente.com (opcional)" {...field} disabled={loading} /></FormControl>
                                <p className="text-xs text-muted-foreground">
                                  Si lo dejas vacio, Chatboc crea un admin interno del tenant y despues podes invitar usuarios reales.
                                </p>
                                <FormMessage />
                            </FormItem>
                            )}
                        />
                    </div>
                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={closeOwner}>Cancelar</Button>
                        <Button type="submit" disabled={loading}>
                            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            {!loading && <ShieldCheck className="mr-2 h-4 w-4" />}
                            Crear Tenant
                        </Button>
                    </DialogFooter>
                </form>
            </Form>
        )}
        <DialogClose asChild>
          <Button type="button" variant="ghost" size="icon" className="absolute right-2 top-2 h-11 w-11 focus-visible:ring-2 focus-visible:ring-ring" aria-label="Cerrar gestión de organización">
            <X aria-hidden="true" className="h-4 w-4" />
          </Button>
        </DialogClose>
      </DialogContent>
    </Dialog>
  );
}
