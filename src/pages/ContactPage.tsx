import { ArrowLeft, ArrowUpRight, Mail, MessageCircle, RefreshCw } from "lucide-react";
import { useEffect } from "react";
import { Link } from "react-router-dom";
import { useLandingExperience } from "@/hooks/useLandingExperience";
import { cleanLandingCopy } from "@/utils/landingCopy";

const record = (value: unknown): Record<string, unknown> | null =>
  value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;

const text = (value: unknown) =>
  typeof value === "string" ? cleanLandingCopy(value.trim()) : "";

// Contact methods are supplied by the public brand contract. Never execute a
// returned script, protocol-relative URL or malformed email header.
export const publicContactHref = (value: unknown): string | null => {
  if (typeof value !== "string" || /[\u0000-\u0020\u007f]/.test(value) || /%0[ad]/i.test(value)) return null;
  if (value.startsWith("mailto:")) {
    const destination = value.slice(7);
    const separator = destination.indexOf("?");
    const address = separator === -1 ? destination : destination.slice(0, separator);
    const query = separator === -1 ? "" : destination.slice(separator + 1);
    if (!/^[a-z0-9.!#$%&'*+/=^_`{|}~-]+@[a-z0-9.-]+\.[a-z]{2,}$/i.test(address) || value.includes("#")) return null;
    const params = new URLSearchParams(query);
    return [...params.keys()].every((key) => key === "subject") ? value : null;
  }
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password ? url.href : null;
  } catch {
    return null;
  }
};

export default function ContactPage() {
  const { experience, loading, reload } = useLandingExperience();
  const contact = record(experience?.contact);
  const methods = (Array.isArray(contact?.methods) ? contact.methods : []).flatMap((value) => {
    const method = record(value);
    const href = publicContactHref(method?.href);
    const label = text(method?.label);
    return href && label ? [{ href, label, description: text(method?.description), id: text(method?.id) }] : [];
  });
  const available = Boolean(text(contact?.title) && methods.length);
  const title = text(contact?.title) || "Contacto";
  useEffect(() => {
    const previous = document.title;
    document.title = title;
    return () => { if (document.title === title) document.title = previous; };
  }, [title]);

  return (
    <section className="mx-auto w-full max-w-5xl px-4 py-12 sm:px-6 sm:py-20" aria-labelledby="contact-title">
      <div className="rounded-3xl border border-border bg-card px-5 py-8 shadow-sm sm:p-12">
        {text(contact?.eyebrow) && <p className="mb-4 text-xs font-semibold uppercase tracking-widest text-primary">{text(contact?.eyebrow)}</p>}
        <h1 id="contact-title" className="max-w-3xl text-3xl font-semibold tracking-tight sm:text-5xl">
          {title}
        </h1>
        {available && <p className="mt-5 max-w-2xl text-base leading-7 text-muted-foreground sm:text-lg">{text(contact?.description)}</p>}
        <div className="mt-8" aria-busy={loading}>
          {loading && <p role="status" className="text-sm text-muted-foreground">Cargando información de contacto…</p>}
          {!loading && !available && <p role="alert" className="rounded-xl border border-border bg-muted/40 p-4 text-sm leading-6">No pudimos cargar la información de contacto. Podés volver a intentarlo.</p>}
          {available && (
            <div className="grid gap-4 sm:grid-cols-2">
              {methods.map((method) => {
                const Icon = method.href.startsWith("mailto:") ? Mail : MessageCircle;
                return (
                  <a key={`${method.id}-${method.href}`} href={method.href}
                    className="group flex min-h-32 min-w-0 flex-col rounded-2xl border border-border bg-background p-5 transition-colors hover:border-primary/60 hover:bg-primary/5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary motion-reduce:transition-none">
                    <span className="mb-5 flex items-center justify-between text-primary"><Icon aria-hidden="true" className="h-6 w-6" /><ArrowUpRight aria-hidden="true" className="h-5 w-5" /></span>
                    <span className="break-words text-lg font-semibold">{method.label}</span>
                    {method.description && <span className="mt-2 text-sm leading-6 text-muted-foreground">{method.description}</span>}
                  </a>
                );
              })}
            </div>
          )}
        </div>
        <div className="mt-8 flex flex-wrap items-center justify-between gap-4 border-t border-border pt-6">
          <Link to="/" className="inline-flex min-h-11 items-center gap-2 rounded-md px-2 text-sm font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">
            <ArrowLeft aria-hidden="true" className="h-4 w-4" />{text(contact?.back_label) || "Volver al inicio"}
          </Link>
          <button type="button" aria-disabled={loading} aria-busy={loading}
            onClick={() => { if (!loading) reload(); }}
            className="inline-flex min-h-11 items-center gap-2 rounded-md border border-border px-4 text-sm font-medium hover:bg-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary aria-disabled:cursor-wait aria-disabled:opacity-70">
            <RefreshCw aria-hidden="true" className="h-4 w-4" />{text(contact?.refresh_label) || "Actualizar información"}
          </button>
        </div>
      </div>
    </section>
  );
}
