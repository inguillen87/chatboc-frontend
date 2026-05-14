export const PUBLIC_MARKETING_SLUG_REDIRECTS: Record<string, string> = {
  demo: "/demo",
  "demo-catalogs": "/demo",
  media: "/",
  public: "/",
  assets: "/",
  static: "/",
  casos: "/demo",
  "casos-de-uso": "/demo",
  sectores: "/demo",
  pymes: "/demo?sector=empresas",
  empresas: "/demo?sector=empresas",
  municipios: "/demo?sector=gobierno",
  gobiernos: "/demo?sector=gobierno",
  colegios: "/demo?sector=educacion",
  escuelas: "/demo?sector=educacion",
  precios: "/#precios",
  opinar: "/opinar",
};

export const getReservedPublicSlugRedirect = (slug?: string | null) => {
  const normalized = String(slug ?? "").trim().toLowerCase();
  if (!normalized) return null;
  return PUBLIC_MARKETING_SLUG_REDIRECTS[normalized] ?? null;
};

export const isReservedPublicSlug = (slug?: string | null) =>
  Boolean(getReservedPublicSlugRedirect(slug));
