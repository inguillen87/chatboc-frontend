import type { StoredBrandIdentity } from "@/api/brandIdentityAdmin";

/**
 * Editable form state for the brand center. Positions are percentages in the
 * form and 0..1 in the contract. Validation mirrors the backend rules so the
 * form explains problems before publishing; the backend stays the authority.
 */
export interface BrandIdentityDraft {
  palette: string[];
  stops: { color: string; x: string; y: string }[];
  textColor: string;
  family: string;
  fallback: string;
  stylesheetUrl: string;
  letterSpacing: string;
  logoOnLight: string;
  logoOnDark: string;
  logoMark: string;
  logoAlt: string;
  bubbleStyle: "default" | "globa";
  avatarStyle: "chatboc_bot" | "brand_bot";
}

export type DraftField =
  | "palette" | "stops" | "textColor" | "family" | "fallback" | "stylesheetUrl" | "letterSpacing" | "logos" | "logoAlt";

const HEX = /^#[0-9A-Fa-f]{6}$/;
const FAMILY = /^[A-Za-z0-9][A-Za-z0-9 -]{0,59}$/;
const FALLBACK = /^[A-Za-z0-9 ,"'-]{1,160}$/;
const STYLESHEET = /^https:\/\/fonts\.googleapis\.com\/css2\?[A-Za-z0-9=&:;@,.+%_-]{1,400}$/;
const ASSET = /^https:\/\/[A-Za-z0-9.-]{1,120}(?::[0-9]{2,5})?\/[A-Za-z0-9/._~%-]{1,380}$/;
const SPACING = /^-?(?:0?\.[0-9]{1,3}|0)em$/;

const percent = (value: number) => String(Math.round(value * 1000) / 10);

export const emptyBrandIdentityDraft = (): BrandIdentityDraft => ({
  palette: ["#2563EB", "#0F766E"],
  stops: [],
  textColor: "",
  family: "",
  fallback: "",
  stylesheetUrl: "",
  letterSpacing: "",
  logoOnLight: "",
  logoOnDark: "",
  logoMark: "",
  logoAlt: "",
  bubbleStyle: "default",
  avatarStyle: "chatboc_bot",
});

export function draftFromStored(value: StoredBrandIdentity | null): BrandIdentityDraft {
  if (!value) return emptyBrandIdentityDraft();
  return {
    palette: [...value.palette],
    stops: (value.gradient_stops ?? []).map((stop) => ({ color: stop.color, x: percent(stop.x), y: percent(stop.y) })),
    textColor: value.text_color ?? "",
    family: value.typography?.family ?? "",
    fallback: value.typography?.fallback ?? "",
    stylesheetUrl: value.typography?.stylesheet_url ?? "",
    letterSpacing: value.typography?.letter_spacing ?? "",
    logoOnLight: value.logo?.on_light ?? "",
    logoOnDark: value.logo?.on_dark ?? "",
    logoMark: value.logo?.mark ?? "",
    logoAlt: value.logo?.alt ?? "",
    bubbleStyle: value.bubble_style === "globa" ? "globa" : "default",
    avatarStyle: value.avatar?.style === "brand_bot" ? "brand_bot" : "chatboc_bot",
  };
}

const unit = (value: string) => {
  const number = Number(value.trim().replace(",", "."));
  return value.trim() !== "" && Number.isFinite(number) && number >= 0 && number <= 100 ? Math.round(number * 10) / 1000 : null;
};

/** Canonical payload for the backend, or the fields that need fixing. */
export function payloadFromDraft(draft: BrandIdentityDraft):
  | { ok: true; value: StoredBrandIdentity }
  | { ok: false; errors: Partial<Record<DraftField, string>> } {
  const errors: Partial<Record<DraftField, string>> = {};
  const palette = draft.palette.map((color) => color.trim().toUpperCase());
  if (palette.length < 2 || palette.length > 6 || palette.some((color) => !HEX.test(color))) {
    errors.palette = "Usá de 2 a 6 colores en formato #RRGGBB.";
  }

  const stops = draft.stops.map((stop) => ({ color: stop.color.trim().toUpperCase(), x: unit(stop.x), y: unit(stop.y) }));
  if (stops.length && (stops.length < 2 || stops.length > 6 || stops.some((stop) => !HEX.test(stop.color) || stop.x === null || stop.y === null))) {
    errors.stops = "El gradiente lleva de 2 a 6 puntos, cada uno con color #RRGGBB y posición entre 0 y 100 %.";
  }

  const textColor = draft.textColor.trim().toUpperCase();
  if (textColor && !HEX.test(textColor)) errors.textColor = "Usá el formato #RRGGBB.";

  const family = draft.family.trim(), fallback = draft.fallback.trim();
  const stylesheetUrl = draft.stylesheetUrl.trim(), letterSpacing = draft.letterSpacing.trim();
  if (family && !FAMILY.test(family)) errors.family = "Solo letras, números, espacios y guiones (hasta 60).";
  if (!family && (fallback || stylesheetUrl || letterSpacing)) errors.family = "Indicá la familia para usar estos ajustes.";
  if (fallback && !FALLBACK.test(fallback)) errors.fallback = "Lista de fuentes separadas por coma, sin otros signos.";
  if (stylesheetUrl && !STYLESHEET.test(stylesheetUrl)) errors.stylesheetUrl = "Solo hojas de https://fonts.googleapis.com/css2?…";
  if (letterSpacing && !SPACING.test(letterSpacing)) errors.letterSpacing = "En em, por ejemplo -0.02em.";

  const logos = { on_light: draft.logoOnLight.trim(), on_dark: draft.logoOnDark.trim(), mark: draft.logoMark.trim() };
  if (Object.values(logos).some((url) => url && !ASSET.test(url))) errors.logos = "Cada logo debe ser una dirección https a la imagen.";
  const alt = draft.logoAlt.trim();
  if (alt && (alt.length > 120 || /[<>]/.test(alt))) errors.logoAlt = "Hasta 120 caracteres, sin < ni >.";
  if (alt && !Object.values(logos).some(Boolean)) errors.logoAlt = "El texto alternativo acompaña a un logo.";

  if (Object.keys(errors).length) return { ok: false, errors };

  const value: StoredBrandIdentity = { palette };
  if (stops.length) value.gradient_stops = stops.map((stop) => ({ color: stop.color, x: stop.x as number, y: stop.y as number }));
  if (textColor) value.text_color = textColor;
  if (family) {
    value.typography = { family };
    if (fallback) value.typography.fallback = fallback;
    if (stylesheetUrl) value.typography.stylesheet_url = stylesheetUrl;
    if (letterSpacing) value.typography.letter_spacing = letterSpacing;
  }
  const logo = Object.fromEntries(Object.entries(logos).filter(([, url]) => url)) as StoredBrandIdentity["logo"] & object;
  if (Object.keys(logo).length) value.logo = alt ? { ...logo, alt } : logo;
  if (draft.bubbleStyle === "globa") value.bubble_style = "globa";
  if (draft.avatarStyle === "brand_bot") value.avatar = { style: "brand_bot" };
  return { ok: true, value };
}
