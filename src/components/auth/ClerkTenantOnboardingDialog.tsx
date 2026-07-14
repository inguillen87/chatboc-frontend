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
  ClerkOnboardingVerticalPreset,
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

type OnboardingForm = typeof defaultForm;

const normalizeIdentityValue = (value?: string | null) => value?.trim().toLowerCase() || '';

const getClerkIdentityKey = (profile?: ClerkUserProfilePayload) => {
  const emails = (profile?.email_addresses || [])
    .map((email) => [normalizeIdentityValue(email.id), normalizeIdentityValue(email.email_address)])
    .sort(([leftId, leftEmail], [rightId, rightEmail]) => `${leftId}:${leftEmail}`.localeCompare(`${rightId}:${rightEmail}`));
  const externalAccounts = (profile?.external_accounts || [])
    .map((account) => [normalizeIdentityValue(account.id), normalizeIdentityValue(account.provider), normalizeIdentityValue(account.strategy)])
    .sort(([leftId, leftProvider], [rightId, rightProvider]) => `${leftId}:${leftProvider}`.localeCompare(`${rightId}:${rightProvider}`));

  return JSON.stringify([normalizeIdentityValue(profile?.id), normalizeIdentityValue(profile?.primary_email_address_id), emails, externalAccounts]);
};

const getInitialForm = (
  defaultTenantName: string | undefined,
  existingTenant: ClerkSessionResponse['tenant'] | undefined,
  presets: Record<string, ClerkOnboardingVerticalPreset>,
): OnboardingForm => {
  const vertical = existingTenant?.tipo || existingTenant?.vertical || defaultForm.vertical;
  const preset = presets[vertical];

  return {
    ...defaultForm,
    tenant_name: existingTenant?.nombre || defaultTenantName || '',
    vertical,
    rubro: existingTenant?.subvertical || preset?.rubro || '',
    primary_goal: preset?.primary_goal || defaultForm.primary_goal,
  };
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
  const tenantNameInputRef = React.useRef<HTMLInputElement>(null);
  const termsCheckboxRef = React.useRef<HTMLButtonElement>(null);
  const errorRef = React.useRef<HTMLParagraphElement>(null);
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
  const initialForm = React.useMemo(
    () => getInitialForm(defaultTenantName, existingTenant, presets),
    [defaultTenantName, existingTenant?.nombre, existingTenant?.subvertical, existingTenant?.tipo, existingTenant?.vertical, presets],
  );
  const clerkIdentityKey = getClerkIdentityKey(userProfile);
  const formScopeKey = `${clerkIdentityKey}:${existingTenant?.id ?? ''}`;
  const previousFormScopeRef = React.useRef(formScopeKey);
  const selectedPreset = presets[form.vertical];
  const recommendedIds = new Set(selectedPreset?.recommended_modules || []);
  const recommendedModules = recommendedIds.size ? starterModules.filter((module) => recommendedIds.has(module.id)) : starterModules.slice(0, 3);
  const preferredChannels = selectedPreset?.preferred_channels?.length ? selectedPreset.preferred_channels : ['whatsapp', 'webchat'];

  const focusInitialControl = React.useCallback(() => {
    const initialControl = termsOnly ? termsCheckboxRef.current : tenantNameInputRef.current;
    initialControl?.focus();
  }, [termsOnly]);

  React.useEffect(() => {
    if (!open) return;
    const formScopeChanged = previousFormScopeRef.current !== formScopeKey;
    previousFormScopeRef.current = formScopeKey;

    if (formScopeChanged) {
      setForm(initialForm);
      setTermsAccepted(false);
      focusInitialControl();
      return;
    }

    setForm((current) => ({
      ...current,
      tenant_name: current.tenant_name || initialForm.tenant_name,
      vertical: current.vertical === defaultForm.vertical ? initialForm.vertical : current.vertical,
      rubro: current.rubro || initialForm.rubro,
      primary_goal: current.primary_goal === defaultForm.primary_goal ? initialForm.primary_goal : current.primary_goal,
    }));
  }, [focusInitialControl, formScopeKey, initialForm, open]);

  React.useEffect(() => {
    if (open) setTermsAccepted(false);
  }, [open]);

  React.useEffect(() => {
    if (open && error) errorRef.current?.focus();
  }, [error, open]);

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
        className="flex max-h-[calc(100dvh-1rem)] w-[calc(100%-1rem)] max-w-4xl flex-col gap-0 overflow-hidden border-slate-200 bg-white p-0 text-slate-950 shadow-2xl dark:border-slate-800 dark:bg-slate-950 dark:text-slate-50 sm:max-h-[calc(100dvh-2rem)] sm:w-[calc(100%-2rem)]"
        showCloseButton={!required}
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          focusInitialControl();
        }}
        onEscapeKeyDown={required ? (event) => event.preventDefault() : undefined}
        onPointerDownOutside={required ? (event) => event.preventDefault() : undefined}
      >
        <DialogHeader className="shrink-0 border-b border-slate-200 px-4 py-4 pr-12 text-left dark:border-slate-800 sm:px-6 sm:pr-14">
          <div className="flex min-w-0 items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-600 text-white shadow-lg shadow-blue-600/25">
              <Building2 className="h-5 w-5" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <DialogTitle className="break-words leading-6">{onboarding?.title || 'Crear tu espacio Chatboc'}</DialogTitle>
              <DialogDescription className="mt-1 break-words leading-5">
                {onboarding?.description || 'Configuramos el tenant, CRM, plantillas iniciales y canales con estos datos.'}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <form
          className="flex min-h-0 flex-1 flex-col"
          aria-busy={loading || undefined}
          aria-describedby={error ? 'clerk-onboarding-error' : undefined}
          onSubmit={submit}
        >
          <div
            className="min-h-0 flex-1 touch-pan-y overflow-x-hidden overflow-y-auto overscroll-contain break-words px-4 py-4 [scrollbar-gutter:stable] sm:px-6 sm:py-5"
            data-testid="clerk-onboarding-scroll-region"
          >
            <div className="grid min-w-0 gap-5">
              {termsOnly ? (
                <div className="min-w-0 rounded-lg border border-blue-200 bg-blue-50 p-4 text-blue-950 dark:border-blue-500/25 dark:bg-blue-500/10 dark:text-blue-50">
                  <div className="flex items-start gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-600 text-white">
                      <ShieldCheck className="h-5 w-5" aria-hidden="true" />
                    </div>
                    <div className="min-w-0">
                      <p className="break-words font-semibold">{existingTenant?.nombre || 'Tu espacio Chatboc'}</p>
                      <p className="mt-1 text-sm leading-5 text-blue-900/75 dark:text-blue-100/75">
                        Revisá y aceptá la versión {terms?.version || 'vigente'} para mantener el acceso al CRM y sus canales.
                      </p>
                    </div>
                  </div>
                </div>
              ) : (
                <>
                  <div className="grid min-w-0 gap-3 sm:grid-cols-4">
                    {summaryCards.slice(0, 4).map((card) => (
                      <div key={card.id} className="min-w-0 rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-900/70">
                        <div className="mb-2 flex h-8 w-8 items-center justify-center rounded-md bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300">
                          <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                        </div>
                        <p className="break-words text-sm font-semibold">{card.label}</p>
                        {card.description ? <p className="mt-1 break-words text-xs leading-5 text-slate-500 dark:text-slate-400">{card.description}</p> : null}
                      </div>
                    ))}
                  </div>

                  <div className="grid min-w-0 gap-5 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
                    <div className="grid min-w-0 gap-4 sm:grid-cols-2">
                      <div className="space-y-2 sm:col-span-2">
                        <Label htmlFor="tenant_name">Nombre de organizacion</Label>
                        <Input
                          ref={tenantNameInputRef}
                          id="tenant_name"
                          value={form.tenant_name}
                          onChange={(event) => update('tenant_name', event.target.value)}
                          placeholder="Ej. Municipalidad de Junin"
                          required
                          disabled={loading}
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="clerk-onboarding-vertical">Vertical</Label>
                        <Select value={form.vertical} onValueChange={handleVerticalChange} disabled={loading}>
                          <SelectTrigger id="clerk-onboarding-vertical" className="min-w-0">
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
                        <Label htmlFor="clerk-onboarding-primary-goal">Objetivo principal</Label>
                        <Select value={form.primary_goal} onValueChange={(value) => update('primary_goal', value)} disabled={loading}>
                          <SelectTrigger id="clerk-onboarding-primary-goal" className="min-w-0">
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

                    <aside className="min-w-0 border-t border-slate-200 pt-5 text-slate-900 dark:border-slate-800 dark:text-slate-100 lg:border-l lg:border-t-0 lg:pl-5 lg:pt-0">
                      <div className="flex items-start gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-600 text-white">
                          <Sparkles className="h-5 w-5" aria-hidden="true" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold uppercase tracking-normal text-blue-600 dark:text-blue-300">Setup sugerido</p>
                          <h3 className="mt-1 break-words text-base font-semibold leading-6">
                            {selectedPreset?.headline || 'Atencion omnicanal, CRM y analitica inicial'}
                          </h3>
                        </div>
                      </div>

                      <ul className="mt-4 divide-y divide-slate-200 border-y border-slate-200 dark:divide-slate-800 dark:border-slate-800">
                        {recommendedModules.map((module) => (
                          <li key={module.id} className="min-w-0 py-3">
                            <p className="break-words text-sm font-semibold">{module.label}</p>
                            {module.description ? (
                              <p className="mt-1 break-words text-xs leading-5 text-slate-600 dark:text-slate-400">{module.description}</p>
                            ) : null}
                          </li>
                        ))}
                      </ul>

                      {whatsappRequirements ? (
                        <div
                          className="mt-4 min-w-0 rounded-lg border border-amber-200 bg-amber-50 p-3 text-amber-950 dark:border-amber-400/25 dark:bg-amber-500/10 dark:text-amber-50"
                          data-testid="clerk-whatsapp-requirements"
                        >
                          <p className="text-sm font-semibold">WhatsApp productivo</p>
                          <p className="mt-1 break-words text-xs leading-5">
                            {whatsappRequirements.message ||
                              'El tenant se crea ahora. WhatsApp productivo requiere plan Full y sender Meta/Twilio configurado.'}
                          </p>
                          <div className="mt-2 flex flex-wrap gap-2 text-[11px] font-semibold uppercase tracking-normal">
                            {whatsappRequirements.required_plan ? (
                              <span className="max-w-full break-all rounded-full bg-white/75 px-2 py-1 dark:bg-slate-950/40">
                                Plan {whatsappRequirements.required_plan}
                              </span>
                            ) : null}
                            {(whatsappRequirements.required_provider_setup || []).slice(0, 3).map((item) => (
                              <span key={item} className="max-w-full break-all rounded-full bg-white/75 px-2 py-1 dark:bg-slate-950/40">
                                {item.replace(/_/g, ' ')}
                              </span>
                            ))}
                          </div>
                        </div>
                      ) : null}

                      {planPolicy ? (
                        <div
                          className="mt-4 min-w-0 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-emerald-950 dark:border-emerald-400/25 dark:bg-emerald-500/10 dark:text-emerald-50"
                          data-testid="clerk-plan-policy"
                        >
                          <p className="text-sm font-semibold">Plan inicial seguro</p>
                          <p className="mt-1 break-words text-xs leading-5">
                            {planPolicy.message || 'El registro publico crea un espacio Free. Los planes productivos se activan desde administracion.'}
                          </p>
                          <div className="mt-2 flex flex-wrap gap-2 text-[11px] font-semibold uppercase tracking-normal">
                            {planPolicy.self_service_plan ? (
                              <span className="max-w-full break-all rounded-full bg-white/75 px-2 py-1 dark:bg-slate-950/40">
                                Alta {planPolicy.self_service_plan}
                              </span>
                            ) : null}
                            {planPolicy.productive_plan ? (
                              <span className="max-w-full break-all rounded-full bg-white/75 px-2 py-1 dark:bg-slate-950/40">
                                Productivo {planPolicy.productive_plan}
                              </span>
                            ) : null}
                            {planPolicy.upgrade_requires ? (
                              <span className="max-w-full break-all rounded-full bg-white/75 px-2 py-1 dark:bg-slate-950/40">
                                {planPolicy.upgrade_requires.replace(/_/g, ' ')}
                              </span>
                            ) : null}
                          </div>
                        </div>
                      ) : null}

                      {selectedPreset?.starter_questions?.length ? (
                        <div className="mt-4 min-w-0 border-t border-slate-200 pt-4 dark:border-slate-800">
                          <p className="mb-2 text-sm font-semibold">Preguntas iniciales para el agente</p>
                          <ul className="space-y-2 text-xs leading-5 text-slate-600 dark:text-slate-400">
                            {selectedPreset.starter_questions.slice(0, 3).map((question) => (
                              <li key={question} className="flex min-w-0 gap-2">
                                <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                                <span className="min-w-0 break-words">{question}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      ) : null}
                    </aside>
                  </div>
                </>
              )}

              {error ? (
                <p
                  ref={errorRef}
                  id="clerk-onboarding-error"
                  role="alert"
                  aria-live="assertive"
                  aria-atomic="true"
                  tabIndex={-1}
                  className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 outline-none focus-visible:ring-2 focus-visible:ring-red-600 focus-visible:ring-offset-2 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-200"
                >
                  {error}
                </p>
              ) : null}

              <div className="flex min-w-0 items-start gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-900/70">
                <Checkbox
                  ref={termsCheckboxRef}
                  id="clerk-onboarding-terms"
                  checked={termsAccepted}
                  onCheckedChange={(checked) => setTermsAccepted(checked === true)}
                  disabled={loading}
                  className="mt-0.5"
                />
                <Label htmlFor="clerk-onboarding-terms" className="min-w-0 break-words text-sm leading-5 text-slate-700 dark:text-slate-300">
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
            </div>
          </div>

          <DialogFooter
            className="shrink-0 border-t border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-950 sm:px-6"
            data-testid="clerk-onboarding-footer"
          >
            <Button
              type="submit"
              className="min-h-11 w-full sm:w-auto"
              aria-busy={loading || undefined}
              aria-describedby={error ? 'clerk-onboarding-error' : undefined}
              disabled={loading || !termsAccepted || (!termsOnly && (!form.tenant_name || !form.rubro))}
            >
              {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" /> : null}
              {termsOnly ? 'Aceptar y continuar' : 'Crear tenant'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default ClerkTenantOnboardingDialog;
