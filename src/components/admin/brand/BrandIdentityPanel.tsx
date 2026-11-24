import React, { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  brandIdentityReasonMessage, BrandIdentityAdminError, getBrandIdentityAdmin, putBrandIdentityAdmin,
  type BrandIdentityAdminState,
} from "@/api/brandIdentityAdmin";
import { readPublicBrandIdentity } from "@/utils/publicBrandIdentity";
import BrandIdentityPreview from "./BrandIdentityPreview";
import {
  draftFromStored, payloadFromDraft, type BrandIdentityDraft, type DraftField,
} from "./brandIdentityDraft";

const MAX_COLORS = 6;
const CORNERS = [[10, 10], [90, 10], [10, 90], [90, 90], [50, 50], [50, 0]];

const reasonOf = (error: unknown) =>
  brandIdentityReasonMessage(error instanceof BrandIdentityAdminError ? error.reason : "brand_identity_request_failed");

const safeColor = (value: string) => (/^#[0-9A-Fa-f]{6}$/.test(value.trim()) ? value.trim() : "#000000");

function ColorField({ label, value, onChange, onRemove, removeLabel }: {
  label: string; value: string; onChange: (value: string) => void; onRemove?: () => void; removeLabel?: string;
}) {
  const id = useId();
  return (
    <div className="flex items-center gap-2">
      <input
        type="color"
        aria-label={`${label}: selector`}
        value={safeColor(value).toLowerCase()}
        onChange={(event) => onChange(event.target.value.toUpperCase())}
        className="h-9 w-10 shrink-0 cursor-pointer rounded-md border bg-transparent p-0.5"
      />
      <Label htmlFor={id} className="sr-only">{label}</Label>
      <Input id={id} value={value} onChange={(event) => onChange(event.target.value)} className="h-9 w-28 font-mono uppercase" spellCheck={false} />
      {onRemove ? (
        <Button type="button" variant="ghost" size="icon" className="h-9 w-9" onClick={onRemove} aria-label={removeLabel}>
          <Trash2 className="h-4 w-4" aria-hidden="true" />
        </Button>
      ) : null}
    </div>
  );
}

function TextField({ label, value, onChange, hint, error, placeholder }: {
  label: string; value: string; onChange: (value: string) => void; hint?: string; error?: string; placeholder?: string;
}) {
  const id = useId(), described = `${id}-help`;
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        aria-invalid={error ? true : undefined}
        aria-describedby={error || hint ? described : undefined}
        spellCheck={false}
      />
      {error || hint ? (
        <p id={described} className={error ? "text-xs text-destructive" : "text-xs text-muted-foreground"}>{error || hint}</p>
      ) : null}
    </div>
  );
}

/**
 * Brand center for one organization (superadmin): palette, gradient points,
 * typography, logos, bubble shape and mascot, with a live preview. Publishing
 * replaces the whole record; the backend validates it again and decides
 * whether it is visible (active Full plan).
 */
export default function BrandIdentityPanel({ slug, organizationName }: { slug: string; organizationName: string }) {
  const [state, setState] = useState<BrandIdentityAdminState | null>(null);
  const [draft, setDraft] = useState<BrandIdentityDraft | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const [errors, setErrors] = useState<Partial<Record<DraftField, string>>>({});
  const [confirmRemove, setConfirmRemove] = useState(false);
  const request = useRef(0);

  const load = useCallback(async () => {
    const current = ++request.current;
    setLoading(true); setLoadError(null); setNotice(null); setErrors({});
    try {
      const next = await getBrandIdentityAdmin(slug);
      if (current !== request.current) return;
      setState(next); setDraft(draftFromStored(next.brandIdentity));
    } catch (error) {
      if (current === request.current) { setState(null); setDraft(null); setLoadError(reasonOf(error)); }
    } finally {
      if (current === request.current) setLoading(false);
    }
  }, [slug]);

  useEffect(() => {
    void load();
    return () => { request.current += 1; };
  }, [load]);

  const update = (patch: Partial<BrandIdentityDraft>) => {
    setDraft((previous) => (previous ? { ...previous, ...patch } : previous));
    setNotice(null);
  };

  const preview = useMemo(() => {
    if (!draft) return null;
    const result = payloadFromDraft(draft);
    return "value" in result ? readPublicBrandIdentity({ contract_version: "public.brand_identity.v1", ...result.value }) : null;
  }, [draft]);

  const dirty = useMemo(() => {
    if (!draft || !state) return false;
    return JSON.stringify(draft) !== JSON.stringify(draftFromStored(state.brandIdentity));
  }, [draft, state]);

  const write = async (value: Parameters<typeof putBrandIdentityAdmin>[1], success: string) => {
    const current = ++request.current;
    setSaving(true); setNotice(null);
    try {
      const next = await putBrandIdentityAdmin(slug, value);
      if (current !== request.current) return;
      setState(next); setDraft(draftFromStored(next.brandIdentity)); setErrors({});
      setNotice({ tone: "ok", text: next.brandIdentity && !next.published
        ? `${success} No se muestra todavía: requiere una organización activa con plan Full.`
        : success });
    } catch (error) {
      if (current === request.current) setNotice({ tone: "error", text: reasonOf(error) });
    } finally {
      if (current === request.current) setSaving(false);
    }
  };

  const publish = (event: React.FormEvent) => {
    event.preventDefault();
    if (!draft) return;
    const result = payloadFromDraft(draft);
    if ("errors" in result) {
      setErrors(result.errors);
      setNotice({ tone: "error", text: "Revisá los campos marcados antes de publicar." });
      return;
    }
    setErrors({});
    void write(result.value, "Identidad publicada.");
  };

  const status = !state ? null : state.published
    ? { label: "Publicada", className: "bg-emerald-100 text-emerald-900 dark:bg-emerald-900/40 dark:text-emerald-100" }
    : state.brandIdentity
      ? { label: "Guardada, no visible", className: "bg-amber-100 text-amber-900 dark:bg-amber-900/40 dark:text-amber-100" }
      : { label: "Sin identidad", className: "" };

  return (
    <section className="platform-panel" aria-labelledby="brand-center-title" data-testid="brand-identity-panel">
      <div className="platform-panel-heading">
        <div>
          <h2 id="brand-center-title">Identidad de marca</h2>
          <p>Paleta, tipografía, logos, forma de las burbujas y mascota del widget y del portal público.</p>
        </div>
        {status ? <span className={`platform-plan ${status.className}`} data-testid="brand-identity-status">{status.label}</span> : null}
      </div>
      <div className="platform-panel-body grid gap-6">
        {loading ? <div className="platform-empty" role="status">Cargando identidad de marca…</div> : null}
        {!loading && loadError ? (
          <div className="platform-empty" role="alert">
            <p>{loadError}</p>
            <Button type="button" variant="outline" onClick={() => void load()}>Reintentar</Button>
          </div>
        ) : null}
        {!loading && state && draft ? (
          <>
            {state.brandIdentity && !state.published ? (
              <p className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-950 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-100">
                La identidad está guardada pero no se muestra: solo se publica para una organización activa con plan Full.
              </p>
            ) : null}
            <BrandIdentityPreview identity={preview} name={organizationName} portalUrl={state.published ? `/t/${encodeURIComponent(slug)}` : undefined} />
            <form className="grid gap-6" onSubmit={publish} noValidate>
              <fieldset className="grid gap-3">
                <legend className="text-sm font-semibold">Paleta</legend>
                <p className="text-xs text-muted-foreground">De 2 a 6 colores. El último suele ser el de texto, para los ojos de la mascota.</p>
                <div className="flex flex-wrap gap-x-5 gap-y-2">
                  {draft.palette.map((color, index) => (
                    <ColorField
                      key={index}
                      label={`Color ${index + 1} de la paleta`}
                      value={color}
                      onChange={(value) => update({ palette: draft.palette.map((item, i) => (i === index ? value : item)) })}
                      onRemove={draft.palette.length > 2 ? () => update({ palette: draft.palette.filter((_, i) => i !== index) }) : undefined}
                      removeLabel={`Quitar el color ${index + 1}`}
                    />
                  ))}
                </div>
                {errors.palette ? <p className="text-xs text-destructive" role="alert">{errors.palette}</p> : null}
                <div>
                  <Button type="button" variant="outline" size="sm" disabled={draft.palette.length >= MAX_COLORS}
                    onClick={() => update({ palette: [...draft.palette, draft.palette[draft.palette.length - 1] ?? "#000000"] })}>
                    <Plus className="mr-1.5 h-4 w-4" aria-hidden="true" />Agregar color
                  </Button>
                </div>
              </fieldset>

              <fieldset className="grid gap-3">
                <legend className="text-sm font-semibold">Gradiente por puntos</legend>
                <p className="text-xs text-muted-foreground">
                  Cada punto pinta su color desde una posición (0 % arriba o a la izquierda). Se usa en la cabecera del widget y en la mascota. Sin puntos, se reparte la paleta.
                </p>
                {draft.stops.map((stop, index) => (
                  <div key={index} className="flex flex-wrap items-end gap-3" data-testid="brand-gradient-stop">
                    <ColorField
                      label={`Color del punto ${index + 1}`}
                      value={stop.color}
                      onChange={(value) => update({ stops: draft.stops.map((item, i) => (i === index ? { ...item, color: value } : item)) })}
                    />
                    {(["x", "y"] as const).map((axis) => (
                      <div key={axis} className="grid gap-1">
                        <Label htmlFor={`${slug}-stop-${index}-${axis}`} className="text-xs">
                          {axis === "x" ? "Horizontal %" : "Vertical %"}
                        </Label>
                        <Input
                          id={`${slug}-stop-${index}-${axis}`}
                          inputMode="decimal"
                          className="h-9 w-20"
                          value={stop[axis]}
                          onChange={(event) => update({ stops: draft.stops.map((item, i) => (i === index ? { ...item, [axis]: event.target.value } : item)) })}
                        />
                      </div>
                    ))}
                    <Button type="button" variant="ghost" size="icon" className="h-9 w-9" aria-label={`Quitar el punto ${index + 1}`}
                      onClick={() => update({ stops: draft.stops.filter((_, i) => i !== index) })}>
                      <Trash2 className="h-4 w-4" aria-hidden="true" />
                    </Button>
                  </div>
                ))}
                {errors.stops ? <p className="text-xs text-destructive" role="alert">{errors.stops}</p> : null}
                <div className="flex flex-wrap gap-2">
                  <Button type="button" variant="outline" size="sm" disabled={draft.stops.length >= MAX_COLORS}
                    onClick={() => update({ stops: [...draft.stops, { color: draft.palette[draft.stops.length % draft.palette.length] ?? "#000000", x: "50", y: "50" }] })}>
                    <Plus className="mr-1.5 h-4 w-4" aria-hidden="true" />Agregar punto
                  </Button>
                  <Button type="button" variant="ghost" size="sm"
                    onClick={() => update({ stops: draft.palette.slice(0, 4).map((color, index) => ({ color, x: String(CORNERS[index][0]), y: String(CORNERS[index][1]) })) })}>
                    Generar desde la paleta
                  </Button>
                </div>
                <div className="max-w-xs">
                  <TextField label="Color de texto (opcional)" value={draft.textColor} placeholder="#353535"
                    onChange={(textColor) => update({ textColor })} error={errors.textColor}
                    hint="Se excluye del gradiente cuando no hay puntos." />
                </div>
              </fieldset>

              <fieldset className="grid gap-3 sm:grid-cols-2">
                <legend className="mb-1 text-sm font-semibold sm:col-span-2">Tipografía</legend>
                <TextField label="Familia" value={draft.family} onChange={(family) => update({ family })} error={errors.family} placeholder="Nombre de la familia" />
                <TextField label="Respaldo" value={draft.fallback} onChange={(fallback) => update({ fallback })} error={errors.fallback}
                  placeholder="system-ui, sans-serif" hint="Fuentes que se usan si la familia no carga." />
                <TextField label="Hoja de Google Fonts" value={draft.stylesheetUrl} onChange={(stylesheetUrl) => update({ stylesheetUrl })}
                  error={errors.stylesheetUrl} hint="Opcional. Solo https://fonts.googleapis.com/css2?…" />
                <TextField label="Espaciado entre letras" value={draft.letterSpacing} onChange={(letterSpacing) => update({ letterSpacing })}
                  error={errors.letterSpacing} placeholder="-0.02em" />
              </fieldset>

              <fieldset className="grid gap-3 sm:grid-cols-2">
                <legend className="mb-1 text-sm font-semibold sm:col-span-2">Logos</legend>
                <TextField label="Logo sobre fondo claro" value={draft.logoOnLight} onChange={(logoOnLight) => update({ logoOnLight })} placeholder="https://…" />
                <TextField label="Logo sobre fondo oscuro" value={draft.logoOnDark} onChange={(logoOnDark) => update({ logoOnDark })} placeholder="https://…" />
                <TextField label="Isotipo (cuadrado)" value={draft.logoMark} onChange={(logoMark) => update({ logoMark })} placeholder="https://…"
                  hint="Se usa en los mosaicos del portal." />
                <TextField label="Texto alternativo" value={draft.logoAlt} onChange={(logoAlt) => update({ logoAlt })} error={errors.logoAlt} />
                {errors.logos ? <p className="text-xs text-destructive sm:col-span-2" role="alert">{errors.logos}</p> : null}
              </fieldset>

              <fieldset className="grid gap-3 sm:grid-cols-2">
                <legend className="mb-1 text-sm font-semibold sm:col-span-2">Conversación</legend>
                <div className="grid gap-1.5">
                  <Label htmlFor={`${slug}-bubble-style`}>Forma de las burbujas</Label>
                  <select id={`${slug}-bubble-style`} className="h-10 rounded-md border bg-background px-3 text-sm"
                    value={draft.bubbleStyle} onChange={(event) => update({ bubbleStyle: event.target.value === "globa" ? "globa" : "default" })}>
                    <option value="default">Redondeadas (predeterminada)</option>
                    <option value="globa">Globa con punta</option>
                  </select>
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor={`${slug}-avatar-style`}>Mascota del widget</Label>
                  <select id={`${slug}-avatar-style`} className="h-10 rounded-md border bg-background px-3 text-sm"
                    value={draft.avatarStyle} onChange={(event) => update({ avatarStyle: event.target.value === "brand_bot" ? "brand_bot" : "chatboc_bot" })}>
                    <option value="chatboc_bot">Bot de Chatboc</option>
                    <option value="brand_bot">Mascota con la paleta de la organización</option>
                  </select>
                </div>
              </fieldset>

              {notice ? (
                <p role={notice.tone === "error" ? "alert" : "status"}
                  className={notice.tone === "error" ? "text-sm text-destructive" : "text-sm text-emerald-700 dark:text-emerald-300"}>
                  {notice.text}
                </p>
              ) : null}
              <div className="flex flex-wrap gap-2">
                <Button type="submit" disabled={saving || (!dirty && Boolean(state.brandIdentity))}>
                  {saving ? "Guardando…" : state.brandIdentity ? "Publicar cambios" : "Publicar identidad"}
                </Button>
                <Button type="button" variant="outline" disabled={saving || !dirty}
                  onClick={() => { setDraft(draftFromStored(state.brandIdentity)); setErrors({}); setNotice(null); }}>
                  Descartar cambios
                </Button>
                {state.brandIdentity ? (
                  <Button type="button" variant="ghost" className="text-destructive" disabled={saving} onClick={() => setConfirmRemove(true)}>
                    Quitar identidad
                  </Button>
                ) : null}
              </div>
            </form>
          </>
        ) : null}
      </div>
      <AlertDialog open={confirmRemove} onOpenChange={setConfirmRemove}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Quitar la identidad de marca</AlertDialogTitle>
            <AlertDialogDescription>
              El widget y el portal de {organizationName} vuelven al aspecto de Chatboc. Podés publicarla de nuevo cuando quieras.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => { setConfirmRemove(false); void write(null, "Identidad quitada."); }}>Quitar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
