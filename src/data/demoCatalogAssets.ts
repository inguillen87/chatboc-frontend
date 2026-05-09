export type DemoCatalogAsset = {
  slug: string;
  title: string;
  sector: "gobierno" | "empresas" | "educacion";
  href: string;
};

export const DEMO_CATALOG_ASSETS: DemoCatalogAsset[] = [
  { slug: "municipio", title: "Municipio inteligente", sector: "gobierno", href: "/demo-catalogs/municipio.pdf" },
  { slug: "concejo-deliberante", title: "Concejo deliberante", sector: "gobierno", href: "/demo-catalogs/concejo-deliberante.pdf" },
  { slug: "legisladores", title: "Legisladores y bloques", sector: "gobierno", href: "/demo-catalogs/legisladores.pdf" },
  { slug: "campana-electoral", title: "Campana electoral", sector: "gobierno", href: "/demo-catalogs/campana-electoral.pdf" },
  { slug: "almacen", title: "Almacen de barrio", sector: "empresas", href: "/demo-catalogs/almacen.pdf" },
  { slug: "bodega", title: "Bodega boutique", sector: "empresas", href: "/demo-catalogs/bodega.pdf" },
  { slug: "kiosco", title: "Kiosco 24hs", sector: "empresas", href: "/demo-catalogs/kiosco.pdf" },
  { slug: "restaurante", title: "Restaurante", sector: "empresas", href: "/demo-catalogs/restaurante.pdf" },
  { slug: "ferreteria", title: "Ferreteria", sector: "empresas", href: "/demo-catalogs/ferreteria.pdf" },
  { slug: "tienda_ropa", title: "Tienda de ropa", sector: "empresas", href: "/demo-catalogs/tienda_ropa.pdf" },
  { slug: "logistica", title: "Logistica", sector: "empresas", href: "/demo-catalogs/logistica.pdf" },
  { slug: "seguros", title: "Seguros", sector: "empresas", href: "/demo-catalogs/seguros.pdf" },
  { slug: "fintech", title: "Fintech", sector: "empresas", href: "/demo-catalogs/fintech.pdf" },
  { slug: "inmobiliaria", title: "Inmobiliaria", sector: "empresas", href: "/demo-catalogs/inmobiliaria.pdf" },
  { slug: "industria", title: "Industria", sector: "empresas", href: "/demo-catalogs/industria.pdf" },
  { slug: "clinica", title: "Clinica", sector: "empresas", href: "/demo-catalogs/clinica.pdf" },
  { slug: "farmacia", title: "Farmacia", sector: "empresas", href: "/demo-catalogs/farmacia.pdf" },
  { slug: "colegio-demo", title: "Colegio privado", sector: "educacion", href: "/demo-catalogs/colegio-demo.pdf" },
  { slug: "colegio-bilingue", title: "Colegio bilingue", sector: "educacion", href: "/demo-catalogs/colegio-bilingue.pdf" },
  { slug: "escuela-publica", title: "Escuela publica", sector: "educacion", href: "/demo-catalogs/escuela-publica.pdf" },
  { slug: "supervision-escolar", title: "Supervision escolar", sector: "educacion", href: "/demo-catalogs/supervision-escolar.pdf" },
];

const normalizeSlug = (value?: string | null) =>
  String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-");

export const findDemoCatalogAsset = (slug?: string | null) => {
  const normalized = normalizeSlug(slug);
  if (!normalized) return null;
  return DEMO_CATALOG_ASSETS.find((asset) => normalizeSlug(asset.slug) === normalized) ?? null;
};
