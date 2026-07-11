import React from 'react';
import { Building2, CheckCircle2, Loader2, ShieldCheck, Sparkles } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
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
import type {
  ClerkOnboardingModule,
  ClerkOnboardingPayload,
  ClerkOnboardingOption,
  ClerkSessionResponse,
  ClerkUserProfilePayload,
} from '@/api/clerkAuth';

interface ClerkTenantOnboardingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userProfile?: ClerkUserProfilePayload;
  defaultTenantName?: string;
  onboarding?: ClerkSessionResponse['onboarding'];
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

const fallbackVerticalOptions: ClerkOnboardingOption[] = [
  { value: 'municipio', label: 'Municipio / gobierno' },
  { value: 'colegio', label: 'Colegio / educacion' },
  { value: 'pyme', label: 'Empresa / comercio' },
  { value: 'salud', label: 'Salud' },
  { value: 'inmobiliaria', label: 'Inmobiliaria' },
  { value: 'profesionales', label: 'Servicios profesionales' },
  { value: 'otro', label: 'Otro' },
];

const fallbackGoalOptions: ClerkOnboardingOption[] = [
  { value: 'whatsapp_ai', label: 'Atender WhatsApp con IA' },
  { value: 'crm_reclamos', label: 'Gestionar reclamos/tickets' },
  { value: 'ventas', label: 'Vender y tomar pedidos' },
  { value: 'encuestas', label: 'Encuestas y analitica' },
  { value: 'marketplace', label: 'Publicar catalogo / marketplace' },
  { value: 'omnicanal', label: 'Centralizar conversaciones' },
];

const fallbackSummaryCards: ClerkOnboardingModule[] = [
  { id: 'identity', label: 'Identidad validada', description: 'Login social y perfil consentido.' },
  { id: 'workspace', label: 'Tenant y CRM', description: 'Espacio operativo listo para el equipo.' },
  { id: 'channels', label: 'Canales', description: 'Widget y plantillas base; WhatsApp productivo requiere plan Full.' },
  { id: 'analytics', label: 'Metricas', description: 'Base para mapas, encuestas y tickets.' },
];

const fallbackStarterModules: ClerkOnboardingModule[] = [
  { id: 'crm_operativo', label: 'CRM operativo', description: 'Reclamos, pedidos, chats y responsables.' },
  { id: 'whatsapp_widget', label: 'WhatsApp y widget', description: 'IA, humano y seguimiento por ticket.' },
  { id: 'marketplace_catalogo', label: 'Catalogo / marketplace', description: 'Productos, promos y pedidos asistidos.' },
  { id: 'analytics_heatmaps', label: 'Analitica y mapas', description: 'Zonas calientes, encuestas y actividad.' },
];

const ClerkTenantOnboardingDialog: React.FC<ClerkTenantOnboardingDialogProps> = ({
  open,
  onOpenChange,
  userProfile,
  defaultTenantName,
  onboarding,
  required = false,
  loading,
  error,
  onSubmit,
}) => {
  const [form, setForm] = React.useState(defaultForm);
  const [termsAccepted, setTermsAccepted] = React.useState(false);
  const modal = onboarding?.modal;
  const verticalOptions = modal?.vertical_options?.length ? modal.vertical_options : fallbackVerticalOptions;
  const goalOptions = modal?.goal_options?.length ? modal.goal_options : fallbackGoalOptions;
  const summaryCards = modal?.summary_cards?.length ? modal.summary_cards : fallbackSummaryCards;
  const starterModules = modal?.starter_modules?.length ? modal.starter_modules : fallbackStarterModules;
  const whatsappRequirements = modal?.whatsapp_business_requirements;
  const planPolicy = modal?.plan_policy;
  const terms = modal?.terms;
  const termsOnly = modal?.mode === 'terms_only';
  const existingTenant = modal?.existing_tenant;
  const presets = React.useMemo(() => modal?.vertical_presets || {}, [modal?.vertical_presets]);
  const selectedPreset = presets[form.vertical];
  const recommendedIds = new Set(selectedPreset?.recommended_modules || []);
  const recommendedModules = recommendedIds.size
    ? starterModules.filter((module) => recommendedIds.has(module.id))
    : starterModules.slice(0, 3);
  const preferredChannels = selectedPreset?.preferred_channels?.length
    ? selectedPreset.preferred_channels
    : ['whatsapp', 'webchat'];

  React.useEffect(() => {
    if (!open) return;
    setForm((current) => ({
      ...current,
      tenant_name: current.tenant_name || existingTenant?.nombre || defaultTenantName || '',
      vertical: current.vertical || existingTenant?.tipo || defaultForm.vertical,
      rubro: current.rubro || existingTenant?.subvertical || presets[current.vertical]?.rubro || '',
      primary_goal:
        current.primary_goal === defaultForm.primary_goal
          ? presets[current.vertical]?.primary_goal || current.primary_goal
          : current.primary_goal,
    }));
  }, [defaultTenantName, existingTenant?.nombre, existingTenant?.subvertical, existingTenant?.tipo, open, presets]);

  React.useEffect(() => {
    if (open) setTermsAccepted(false);
  }, [open]);

  const update = (field: keyof typeof defaultForm, value: string) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const handleVerticalChange = (value: string) => {
    setForm((current) => {
      const currentPreset = presets[current.vertical];
      const nextPreset = presets[value];
      const shouldReplaceRubro = !current.rubro || current.rubro === currentPreset?.rubro;
      const shouldReplaceGoal = !current.primary_goal || current.primary_goal === currentPreset?.primary_goal;
      return {
        ...current,
        vertical: value,
        rubro: shouldReplaceRubro ? nextPreset?.rubro || current.rubro : current.rubro,
        primary_goal: shouldReplaceGoal ? nextPreset?.primary_goal || current.primary_goal : current.primary_goal,
      };
    });
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    await onSubmit({
      ...form,
      terms_accepted: termsAccepted,
      terms_version: terms?.version || '2026-07-11',
      user: userProfile,
      preferred_channels: preferredChannels,
    });
  };

  const handleOpenChange = (nextOpen: boolean) => {
    if (required && !nextOpen) return;
    onOpenChange(nextOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        className="max-w-4xl border-slate-200 bg-white text-slate-950 shadow-2xl dark:border-slate-800 dark:bg-slate-950 dark:text-slate-50"
        showCloseButton={!required}
        onEscapeKeyDown={required ? (event) => event.preventDefault() : undefined}
        onPointerDownOutside={required ? (event) => event.preventDefault() : undefined}
      >
        <DialogHeader>
          <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-xl bg-blue-600 text-white shadow-lg shadow-blue-600/25">
            <Building2 className="h-6 w-6" aria-hidden="true" />
          </div>
          <DialogTitle>{onboarding?.title || 'Crear tu espacio Chatboc'}</DialogTitle>
          <DialogDescription>
            {onboarding?.description || 'Configuramos el tenant, CRM, plantillas iniciales y canales con estos datos.'}
          </DialogDescription>
        </DialogHeader>

        <form className="grid gap-5" onSubmit={submit}>
          {termsOnly ? (
            <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-blue-950 dark:border-blue-500/25 dark:bg-blue-500/10 dark:text-blue-50">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-600 text-white">
                  <ShieldCheck className="h-5 w-5" aria-hidden="true" />
                </div>
                <div>
                  <p className="font-semibold">{existingTenant?.nombre || 'Tu espacio Chatboc'}</p>
                  <p className="mt-1 text-sm leading-5 text-blue-900/75 dark:text-blue-100/75">
                    Revisá y aceptá la versión {terms?.version || 'vigente'} para mantener el acceso al CRM y sus canales.
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <>
          <div className="grid gap-3 sm:grid-cols-4">
            {summaryCards.slice(0, 4).map((card) => (
              <div
                key={card.id}
                className="rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-900/70"
              >
                <div className="mb-2 flex h-8 w-8 items-center justify-center rounded-lg bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300">
                  <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                </div>
                <p className="text-sm font-semibold">{card.label}</p>
                {card.description ? (
                  <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">{card.description}</p>
                ) : null}
              </div>
            ))}
          </div>

          <div className="grid gap-5 lg:grid-cols-[1.15fr_0.85fr]">
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
                <Select value={form.vertical} onValueChange={handleVerticalChange} disabled={loading}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecciona vertical" />
                  </SelectTrigger>
                  <SelectContent>
                    {verticalOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
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
                    {goalOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <aside className="rounded-2xl border border-blue-200 bg-blue-50 p-4 text-blue-950 dark:border-blue-500/25 dark:bg-blue-500/10 dark:text-blue-50">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white">
                  <Sparkles className="h-5 w-5" aria-hidden="true" />
                </div>
                <div>
                  <p className="text-sm font-semibold uppercase tracking-[0.18em] text-blue-600 dark:text-blue-300">
                    Setup sugerido
                  </p>
                  <h3 className="mt-1 text-lg font-semibold">
                    {selectedPreset?.headline || 'Atencion omnicanal, CRM y analitica inicial'}
                  </h3>
                </div>
              </div>

              <div className="mt-4 space-y-3">
                {recommendedModules.map((module) => (
                  <div key={module.id} className="rounded-xl bg-white/80 p-3 shadow-sm dark:bg-slate-950/50">
                    <p className="text-sm font-semibold">{module.label}</p>
                    {module.description ? (
                      <p className="mt-1 text-xs leading-5 text-blue-900/70 dark:text-blue-100/70">
                        {module.description}
                      </p>
                    ) : null}
                  </div>
                ))}
              </div>

              {whatsappRequirements ? (
                <div
                  className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-amber-950 dark:border-amber-400/25 dark:bg-amber-500/10 dark:text-amber-50"
                  data-testid="clerk-whatsapp-requirements"
                >
                  <p className="text-sm font-semibold">WhatsApp productivo</p>
                  <p className="mt-1 text-xs leading-5">
                    {whatsappRequirements.message ||
                      'El tenant se crea ahora. WhatsApp productivo requiere plan Full y sender Meta/Twilio configurado.'}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2 text-[11px] font-semibold uppercase tracking-normal">
                    {whatsappRequirements.required_plan ? (
                      <span className="rounded-full bg-white/75 px-2 py-1 dark:bg-slate-950/40">
                        Plan {whatsappRequirements.required_plan}
                      </span>
                    ) : null}
                    {(whatsappRequirements.required_provider_setup || []).slice(0, 3).map((item) => (
                      <span key={item} className="rounded-full bg-white/75 px-2 py-1 dark:bg-slate-950/40">
                        {item.replace(/_/g, ' ')}
                      </span>
                    ))}
                  </div>
                </div>
              ) : null}

              {planPolicy ? (
                <div
                  className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-emerald-950 dark:border-emerald-400/25 dark:bg-emerald-500/10 dark:text-emerald-50"
                  data-testid="clerk-plan-policy"
                >
                  <p className="text-sm font-semibold">Plan inicial seguro</p>
                  <p className="mt-1 text-xs leading-5">
                    {planPolicy.message ||
                      'El registro publico crea un espacio Free. Los planes productivos se activan desde administracion.'}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2 text-[11px] font-semibold uppercase tracking-normal">
                    {planPolicy.self_service_plan ? (
                      <span className="rounded-full bg-white/75 px-2 py-1 dark:bg-slate-950/40">
                        Alta {planPolicy.self_service_plan}
                      </span>
                    ) : null}
                    {planPolicy.productive_plan ? (
                      <span className="rounded-full bg-white/75 px-2 py-1 dark:bg-slate-950/40">
                        Productivo {planPolicy.productive_plan}
                      </span>
                    ) : null}
                    {planPolicy.upgrade_requires ? (
                      <span className="rounded-full bg-white/75 px-2 py-1 dark:bg-slate-950/40">
                        {planPolicy.upgrade_requires.replace(/_/g, ' ')}
                      </span>
                    ) : null}
                  </div>
                </div>
              ) : null}

              {selectedPreset?.starter_questions?.length ? (
                <div className="mt-4 rounded-xl border border-blue-200 bg-white/70 p-3 dark:border-blue-400/20 dark:bg-slate-950/40">
                  <p className="mb-2 text-sm font-semibold">Preguntas iniciales para el agente</p>
                  <ul className="space-y-2 text-xs leading-5 text-blue-900/75 dark:text-blue-100/75">
                    {selectedPreset.starter_questions.slice(0, 3).map((question) => (
                      <li key={question} className="flex gap-2">
                        <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                        <span>{question}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </aside>
          </div>
            </>
          )}

          {error && (
            <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </p>
          )}

          <div className="flex items-start gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-900/70">
            <Checkbox
              id="clerk-onboarding-terms"
              checked={termsAccepted}
              onCheckedChange={(checked) => setTermsAccepted(checked === true)}
              disabled={loading}
              className="mt-0.5"
            />
            <Label htmlFor="clerk-onboarding-terms" className="text-sm leading-5 text-slate-700 dark:text-slate-300">
              {terms?.label || 'Acepto los Terminos y la Politica de Privacidad'}.{' '}
              <a
                href={terms?.terms_url || '/terminos'}
                target="_blank"
                rel="noreferrer"
                className="font-semibold text-blue-600 underline underline-offset-4 dark:text-blue-300"
              >
                Ver terminos
              </a>{' '}
              y{' '}
              <a
                href={terms?.privacy_url || '/privacidad'}
                target="_blank"
                rel="noreferrer"
                className="font-semibold text-blue-600 underline underline-offset-4 dark:text-blue-300"
              >
                privacidad
              </a>
            </Label>
          </div>

          <DialogFooter>
            <Button
              type="submit"
              disabled={loading || !termsAccepted || (!termsOnly && (!form.tenant_name || !form.rubro))}
            >
              {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {termsOnly ? 'Aceptar y continuar' : 'Crear tenant'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default ClerkTenantOnboardingDialog;
