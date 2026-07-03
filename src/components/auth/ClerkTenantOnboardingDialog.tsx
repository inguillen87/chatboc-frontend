import React from 'react';
import { Building2, Loader2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { ClerkOnboardingPayload, ClerkUserProfilePayload } from '@/api/clerkAuth';

interface ClerkTenantOnboardingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userProfile?: ClerkUserProfilePayload;
  defaultTenantName?: string;
  required?: boolean;
  loading?: boolean;
  error?: string | null;
  onSubmit: (payload: ClerkOnboardingPayload) => Promise<void> | void;
}

const defaultForm = {
  tenant_name: '',
  vertical: 'pyme',
  rubro: '',
  telefono: '',
  website: '',
  ciudad: '',
  primary_goal: 'whatsapp_ai',
};

const ClerkTenantOnboardingDialog: React.FC<ClerkTenantOnboardingDialogProps> = ({
  open,
  onOpenChange,
  userProfile,
  defaultTenantName,
  required = false,
  loading,
  error,
  onSubmit,
}) => {
  const [form, setForm] = React.useState(defaultForm);

  React.useEffect(() => {
    if (!open) return;
    setForm((current) => ({
      ...current,
      tenant_name: current.tenant_name || defaultTenantName || '',
    }));
  }, [defaultTenantName, open]);

  const update = (field: keyof typeof defaultForm, value: string) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    await onSubmit({
      ...form,
      user: userProfile,
      preferred_channels: ['whatsapp', 'webchat'],
    });
  };

  const handleOpenChange = (nextOpen: boolean) => {
    if (required && !nextOpen) return;
    onOpenChange(nextOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        className="max-w-2xl border-slate-200 bg-white text-slate-950 shadow-2xl dark:border-slate-800 dark:bg-slate-950 dark:text-slate-50"
        showCloseButton={!required}
        onEscapeKeyDown={required ? (event) => event.preventDefault() : undefined}
        onPointerDownOutside={required ? (event) => event.preventDefault() : undefined}
      >
        <DialogHeader>
          <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-xl bg-blue-600 text-white">
            <Building2 className="h-6 w-6" />
          </div>
          <DialogTitle>Crear tu espacio Chatboc</DialogTitle>
          <DialogDescription>
            Configuramos el tenant, CRM, plantillas iniciales y canales con estos datos.
          </DialogDescription>
        </DialogHeader>

        <form className="grid gap-5" onSubmit={submit}>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="tenant_name">Nombre de organizacion</Label>
              <Input
                id="tenant_name"
                value={form.tenant_name}
                onChange={(event) => update('tenant_name', event.target.value)}
                placeholder="Ej. Municipalidad de Junin"
                required
                disabled={loading}
              />
            </div>

            <div className="space-y-2">
              <Label>Vertical</Label>
              <Select value={form.vertical} onValueChange={(value) => update('vertical', value)} disabled={loading}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona vertical" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="municipio">Municipio / gobierno</SelectItem>
                  <SelectItem value="colegio">Colegio / educacion</SelectItem>
                  <SelectItem value="pyme">Empresa / comercio</SelectItem>
                  <SelectItem value="salud">Salud</SelectItem>
                  <SelectItem value="inmobiliaria">Inmobiliaria</SelectItem>
                  <SelectItem value="profesionales">Servicios profesionales</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="rubro">Rubro</Label>
              <Input
                id="rubro"
                value={form.rubro}
                onChange={(event) => update('rubro', event.target.value)}
                placeholder="Reclamos, ventas, cuotas..."
                required
                disabled={loading}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="telefono">WhatsApp / telefono</Label>
              <Input
                id="telefono"
                value={form.telefono}
                onChange={(event) => update('telefono', event.target.value)}
                placeholder="+54..."
                disabled={loading}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="ciudad">Ciudad</Label>
              <Input
                id="ciudad"
                value={form.ciudad}
                onChange={(event) => update('ciudad', event.target.value)}
                placeholder="Junin, Mendoza"
                disabled={loading}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="website">Sitio web</Label>
              <Input
                id="website"
                value={form.website}
                onChange={(event) => update('website', event.target.value)}
                placeholder="https://..."
                disabled={loading}
              />
            </div>

            <div className="space-y-2">
              <Label>Objetivo principal</Label>
              <Select
                value={form.primary_goal}
                onValueChange={(value) => update('primary_goal', value)}
                disabled={loading}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona objetivo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="whatsapp_ai">Atender WhatsApp con IA</SelectItem>
                  <SelectItem value="crm_reclamos">Gestionar reclamos/tickets</SelectItem>
                  <SelectItem value="ventas">Vender y tomar pedidos</SelectItem>
                  <SelectItem value="encuestas">Encuestas y analitica</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {error && (
            <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </p>
          )}

          <DialogFooter>
            <Button type="submit" disabled={loading || !form.tenant_name || !form.rubro}>
              {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Crear tenant
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default ClerkTenantOnboardingDialog;
