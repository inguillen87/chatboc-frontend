import React, { useEffect } from "react";
import { ExternalLink } from "lucide-react";
import {
  brandFontStack, brandGradientColors, ensureBrandStylesheet, type PublicBrandIdentity,
} from "@/utils/publicBrandIdentity";

/**
 * How the identity reads on the public surfaces: palette band, bubbles,
 * palette, logos and typography. It renders exactly what the public reader
 * would accept, so an invalid draft shows no preview. The animated mascot
 * and the widget header live in the widget bundle (offline shell): they are
 * seen on the public portal, not duplicated here.
 */
export default function BrandIdentityPreview({ identity, name, portalUrl }: { identity: PublicBrandIdentity | null; name: string; portalUrl?: string }) {
  useEffect(() => { ensureBrandStylesheet(identity?.typography?.stylesheetUrl); }, [identity?.typography?.stylesheetUrl]);

  if (!identity) {
    return (
      <div className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground" role="status" data-testid="brand-preview-empty">
        La vista previa aparece cuando los campos son válidos.
      </div>
    );
  }

  const colors = brandGradientColors(identity);
  // A dark veil keeps the white name readable over any palette.
  const header = `linear-gradient(rgba(2, 6, 23, 0.38), rgba(2, 6, 23, 0.38)), linear-gradient(115deg, ${(colors.length >= 2 ? colors : identity.palette).join(", ")})`;
  const fontFamily = brandFontStack(identity.typography);
  const typeStyle: React.CSSProperties = { fontFamily, letterSpacing: identity.typography?.letterSpacing };
  const logos = [
    { key: "light", url: identity.logo?.onLight ?? identity.logo?.mark, tile: "bg-white", label: "Sobre fondo claro" },
    { key: "dark", url: identity.logo?.onDark ?? identity.logo?.mark, tile: "bg-slate-900", label: "Sobre fondo oscuro" },
  ].filter((logo) => logo.url);

  return (
    <div className="grid gap-4 lg:grid-cols-2" data-testid="brand-preview">
      <figure className="overflow-hidden rounded-xl border shadow-sm" style={typeStyle}>
        <div className="flex items-center gap-3 px-4 py-3 text-white" style={{ background: header }} data-testid="brand-preview-header">
          <div className="min-w-0">
            <p className="truncate font-semibold">{name}</p>
            <p className="text-xs opacity-90">
              {identity.avatarStyle === "brand_bot" ? "Con la mascota de la organización" : "Con el bot de Chatboc"}
              {identity.bubbleStyle === "globa" ? " · burbujas globa" : ""}
            </p>
          </div>
        </div>
        <div className="flex flex-col gap-4 bg-card p-4 pb-6 text-sm" data-bubble-style={identity.bubbleStyle === "globa" ? "globa" : undefined}>
          <div className="chat-bubble-bot self-start">Así se ve una respuesta del asistente.</div>
          <div className="chat-bubble-user self-end">Y así una consulta.</div>
        </div>
        <figcaption className="flex flex-wrap items-center justify-between gap-2 border-t px-4 py-2 text-xs text-muted-foreground">
          <span>El color de las burbujas del visitante sale de «Apariencia del chat».</span>
          {portalUrl ? (
            <a href={portalUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-medium text-foreground underline underline-offset-2">
              Ver el portal publicado<ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
            </a>
          ) : null}
        </figcaption>
      </figure>

      <div className="grid content-start gap-4">
        <div>
          <p className="mb-2 text-xs font-medium text-muted-foreground">Paleta</p>
          <ul className="flex flex-wrap gap-3" aria-label="Colores de la paleta">
            {identity.palette.map((color, index) => (
              <li key={`${color}-${index}`} className="grid justify-items-center gap-1">
                <span className="h-10 w-10 rounded-lg border shadow-inner" style={{ background: color }} aria-hidden="true" />
                <span className="font-mono text-[11px]">{color}</span>
              </li>
            ))}
          </ul>
        </div>
        {logos.length ? (
          <div>
            <p className="mb-2 text-xs font-medium text-muted-foreground">Logos</p>
            <div className="flex flex-wrap gap-3">
              {logos.map((logo) => (
                <div key={logo.key} className={`grid h-16 min-w-[7rem] place-items-center rounded-lg border px-3 ${logo.tile}`}>
                  <img src={logo.url} alt={`${identity.logo?.alt ?? name} (${logo.label.toLowerCase()})`} className="max-h-12 max-w-[9rem] object-contain" loading="lazy" />
                </div>
              ))}
            </div>
          </div>
        ) : null}
        {identity.typography ? (
          <div style={typeStyle}>
            <p className="mb-1 text-xs font-medium text-muted-foreground" style={{ fontFamily: "inherit" }}>Tipografía · {identity.typography.family}</p>
            <p className="text-2xl font-bold leading-tight">Información y orientación</p>
            <p className="text-sm">Aa Bb Cc 0123 — ñ á é í ó ú</p>
          </div>
        ) : null}
      </div>
    </div>
  );
}
