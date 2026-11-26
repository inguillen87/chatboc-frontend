import React, { useEffect, useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { createDemoSession, getDemoCatalog } from "@/features/demo/demoApi";
import type { DemoCatalogResponse, DemoSector, DemoSectorGroup } from "@/features/demo/demoTypes";
import type { Rubro } from "@/types/rubro";

const LANDING_DEMO_ORDER: DemoSector[] = ["educacion", "gobierno", "empresas"];

const normalize = (value?: string | null) =>
  (value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

const rootMatchesSector = (root: Rubro, sector: DemoSector) => {
  const declaredSector = normalize(
    [(root as any).sector, (root as any).pillar, (root as any).vertical].filter(Boolean).join(" "),
  );
  const key = normalize(
    [root.clave, root.nombre, (root as any).key, (root as any).slug, (root as any).label, (root as any).title]
      .filter(Boolean)
      .join(" "),
  );
  const name = normalize([root.nombre, (root as any).label, (root as any).title].filter(Boolean).join(" "));
  if (declaredSector && declaredSector.includes(normalize(sector))) return true;
  if (sector === "educacion") return key.includes("educacion") || name.includes("coleg");
  if (sector === "gobierno") {
    return (
      declaredSector.includes("gobierno") ||
      key.includes("municip") ||
      name.includes("gobierno") ||
      name.includes("public")
    );
  }
  if (sector === "empresas") {
    return (
      declaredSector.includes("empresa") ||
      declaredSector.includes("pyme") ||
      key.includes("comercial") ||
      name.includes("empresa") ||
      name.includes("comerc")
    );
  }
  return key.includes(normalize(sector)) || name.includes(normalize(sector));
};

const flattenDemoCards = (root: Rubro): Rubro[] => {
  const result: Rubro[] = [];
  const visit = (node: Rubro) => {
    if (node.demo || (node as any).tenant_slug || (node as any).slug || (node as any).key) result.push(node);
    (node.subrubros || []).forEach(visit);
  };
  visit(root);
  return result;
};

const readRubroLabel = (item: Rubro) =>
  String(
    item.demo?.nombre || item.nombre || (item as any).label || (item as any).title || (item as any).key || (item as any).slug || "",
  ).trim();

const readRubroDescription = (item: Rubro, group?: DemoSectorGroup) =>
  String(
    item.demo?.descripcion || (item as any).descripcion || (item as any).description || group?.description || readRubroLabel(item),
  ).trim();

const readRubroSlug = (item: Rubro) =>
  String(
    item.demo?.slug || item.clave || (item as any).rubro_slug || (item as any).key || (item as any).slug || item.nombre || (item as any).label || "",
  ).trim();

const readRubroTenantSlug = (item: Rubro, group?: DemoSectorGroup) =>
  String(
    (item as any).tenant_slug || (item as any).demo_tenant_slug || item.demo?.slug || (item as any).slug || group?.tenant_slug || "",
  ).trim() || null;

const DemoRow = ({ item, sector, group }: { item: Rubro; sector: DemoSector; group?: DemoSectorGroup }) => {
  const navigate = useNavigate();
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const rubroLabel = readRubroLabel(item);
  const rubroDescription = readRubroDescription(item, group);
  if (!rubroLabel) return null;

  const startDemo = async () => {
    setStarting(true);
    setError(null);
    try {
      const session = await createDemoSession({
        sector,
        pillar: sector,
        rubro: readRubroSlug(item),
        rubro_slug: readRubroSlug(item),
        category_slug: readRubroSlug(item),
        tenant_slug: readRubroTenantSlug(item, group),
      });
      const sessionId = session.chat_session_id || session.session_id;
      if (!sessionId) throw new Error("missing_chat_session_id");
      navigate(`/demo?session=${encodeURIComponent(sessionId)}`, {
        state: {
          demoSession: session,
          sector,
          rubroLabel,
          rubroSlug: readRubroSlug(item),
        },
      });
    } catch {
      setError("No pudimos abrir la demo real. Probá de nuevo en unos minutos.");
    } finally {
      setStarting(false);
    }
  };

  return (
    <li className="flex flex-col gap-4 border-b border-border py-6 sm:flex-row sm:items-center sm:justify-between sm:gap-8">
      <div className="min-w-0">
        <h4 className="text-lg font-semibold leading-snug text-foreground">{rubroLabel}</h4>
        <p className="mt-1 max-w-[54ch] text-sm leading-6 text-slate-600 dark:text-muted-foreground">
          {rubroDescription}
        </p>
        {error ? (
          <p className="mt-2 rounded-[8px] bg-destructive/10 px-3 py-1.5 text-xs text-destructive">{error}</p>
        ) : null}
      </div>

      <div className="shrink-0">
        <Button
          size="sm"
          className="chatboc-cta-primary h-10 w-full rounded-[8px] px-4 text-sm font-semibold shadow-none sm:w-auto"
          onClick={startDemo}
          disabled={starting}
        >
          {starting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />
              Iniciando…
            </>
          ) : (
            group?.cta_label?.trim() || "Probar demo"
          )}
        </Button>
      </div>
    </li>
  );
};

const PillarDemoRow = ({ sector, group }: { sector: DemoSector; group: DemoSectorGroup }) => {
  const navigate = useNavigate();
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const startDemo = async () => {
    setStarting(true);
    setError(null);
    try {
      const defaultRubro =
        typeof group.default_rubro === "string"
          ? group.default_rubro
          : typeof group.default_rubro_slug === "string"
            ? group.default_rubro_slug
            : String(group.key);
      const session = await createDemoSession({
        sector,
        pillar: sector,
        rubro: defaultRubro,
        rubro_slug: defaultRubro,
        category_slug: defaultRubro,
        tenant_slug: group.tenant_slug ?? group.demo_tenant_slug ?? group.default_tenant_slug ?? null,
      });
      const sessionId = session.chat_session_id || session.session_id;
      if (!sessionId) throw new Error("missing_chat_session_id");
      navigate(`/demo?session=${encodeURIComponent(sessionId)}`, {
        state: {
          demoSession: session,
          sector,
          rubroLabel: group.label || String(group.key),
          rubroSlug: defaultRubro,
        },
      });
    } catch {
      setError("No pudimos abrir la demo real. Probá de nuevo en unos minutos.");
    } finally {
      setStarting(false);
    }
  };

  return (
    <li className="flex flex-col gap-4 border-b border-border py-6 sm:flex-row sm:items-center sm:justify-between sm:gap-8">
      <div className="min-w-0">
        <h4 className="text-lg font-semibold leading-snug text-foreground">{group.label || String(group.key)}</h4>
        {group.description ? (
          <p className="mt-1 max-w-[54ch] text-sm leading-6 text-slate-600 dark:text-muted-foreground">
            {group.description}
          </p>
        ) : null}
        {error ? (
          <p className="mt-2 rounded-[8px] bg-destructive/10 px-3 py-1.5 text-xs text-destructive">{error}</p>
        ) : null}
      </div>

      <div className="shrink-0">
        <Button
          size="sm"
          className="chatboc-cta-primary h-10 w-full rounded-[8px] px-4 text-sm font-semibold shadow-none sm:w-auto"
          onClick={startDemo}
          disabled={starting}
        >
          {starting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />
              Iniciando…
            </>
          ) : (
            group.cta_label?.trim() || "Probar demo"
          )}
        </Button>
      </div>
    </li>
  );
};

const DemoShowcaseSection = () => {
  const [catalog, setCatalog] = useState<DemoCatalogResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    getDemoCatalog()
      .then((response) => {
        if (!active) return;
        setCatalog(response);
        setLoadError(null);
      })
      .catch(() => {
        if (!active) return;
        setCatalog(null);
        setLoadError("No pudimos cargar las demos en este momento. Recargá la página o probá de nuevo en unos minutos.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const roots = Array.isArray(catalog?.rubros) ? catalog.rubros : [];
  const groups = useMemo(() => {
    const catalogGroups = Array.isArray(catalog?.sector_groups) ? catalog.sector_groups : [];
    const byKey = new Map(catalogGroups.map((group) => [String(group.key), group]));
    return LANDING_DEMO_ORDER.map((sector) => byKey.get(String(sector))).filter((group): group is DemoSectorGroup =>
      Boolean(group),
    );
  }, [catalog?.sector_groups]);
  const defaultValue = groups[0]?.key ? String(groups[0].key) : undefined;

  return (
    <section
      id="demos"
      aria-labelledby="demos-title"
      className="border-t border-border bg-background py-20 text-foreground md:py-28"
    >
      <div className="container mx-auto px-4">
        <div className="mx-auto max-w-6xl">
          <div className="max-w-3xl">
            <div className="chatboc-section-kicker mb-4">Demos</div>
            <h2 id="demos-title" className="chatboc-section-heading text-balance">
              Probá una conversación real por sector
            </h2>
            <p className="chatboc-section-copy mt-4 max-w-2xl">
              Elegí un rubro y abrí un recorrido publicado: el chat pide datos, recibe adjuntos y muestra cómo queda la
              operación para el equipo.
            </p>
          </div>

          {loading ? (
            <div
              role="status"
              className="mt-10 rounded-[12px] border border-border bg-card px-5 py-4 text-sm text-slate-600 dark:text-muted-foreground"
            >
              Cargando las demos disponibles…
            </div>
          ) : null}

          {!loading && (loadError || groups.length === 0) ? (
            <div className="mt-10 rounded-[12px] border border-border bg-card px-6 py-8 text-sm text-slate-600 dark:text-muted-foreground">
              {loadError || "Todavía no hay demos publicadas para mostrar."}
            </div>
          ) : null}

          {!loading && !loadError && groups.length > 0 ? (
            <Tabs defaultValue={defaultValue} className="mt-10 w-full">
              <div className="overflow-x-auto border-b border-border">
                <TabsList className="inline-flex h-auto w-auto justify-start gap-2 rounded-none bg-transparent p-0">
                  {groups.map((group) => (
                    <TabsTrigger
                      key={String(group.key)}
                      value={String(group.key)}
                      className="relative -mb-px rounded-none border-b-2 border-transparent bg-transparent px-4 py-3 text-sm font-semibold text-slate-600 shadow-none transition-colors motion-reduce:transition-none hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-foreground data-[state=active]:shadow-none dark:text-muted-foreground"
                    >
                      {group.label || String(group.key)}
                    </TabsTrigger>
                  ))}
                </TabsList>
              </div>

              {groups.map((group) => {
                const sector = String(group.key) as DemoSector;
                const matchingRoots = roots.filter((root) => rootMatchesSector(root, sector));
                const cards = matchingRoots.flatMap(flattenDemoCards);
                return (
                  <TabsContent key={String(group.key)} value={String(group.key)} className="mt-8 focus-visible:ring-0">
                    <div className="grid gap-8 lg:grid-cols-[0.75fr_1.25fr] lg:gap-16">
                      <div>
                        <h3 className="chatboc-display text-2xl font-semibold text-foreground">
                          {group.label || String(group.key)}
                        </h3>
                        {group.description ? (
                          <p className="mt-3 text-base leading-7 text-slate-600 dark:text-muted-foreground">
                            {group.description}
                          </p>
                        ) : null}
                        {cards.length ? (
                          <p className="mt-4 text-sm text-slate-600 dark:text-muted-foreground">
                            {cards.length} {cards.length === 1 ? "demo lista" : "demos listas"} para probar en este
                            sector.
                          </p>
                        ) : null}
                      </div>

                      <ul className="border-t border-border">
                        {cards.length ? (
                          cards.map((item, index) => (
                            <DemoRow
                              key={String(item.id ?? item.key ?? item.slug ?? item.rubro_slug ?? `${sector}-${index}`)}
                              item={item as Rubro}
                              sector={sector}
                              group={group}
                            />
                          ))
                        ) : (
                          <PillarDemoRow sector={sector} group={group} />
                        )}
                      </ul>
                    </div>
                  </TabsContent>
                );
              })}
            </Tabs>
          ) : null}
        </div>
      </div>
    </section>
  );
};

export default DemoShowcaseSection;
