import React, { useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  Briefcase,
  Building2,
  Factory,
  GraduationCap,
  Heart,
  Loader2,
  ShoppingBag,
  Store,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { createDemoSession, getDemoCatalog } from "@/features/demo/demoApi";
import type { DemoCatalogResponse, DemoSector, DemoSectorGroup } from "@/features/demo/demoTypes";
import type { Rubro } from "@/types/rubro";

const categoryIcons: Record<string, React.ReactNode> = {
  municipios_root: <Building2 className="h-5 w-5" />,
  comerciales_root: <Store className="h-5 w-5" />,
  educacion_root: <GraduationCap className="h-5 w-5" />,
  gobierno: <Building2 className="h-5 w-5" />,
  empresas: <Store className="h-5 w-5" />,
  educacion: <GraduationCap className="h-5 w-5" />,
  "Colegios e instituciones educativas": <GraduationCap className="h-5 w-5" />,
  "Alimentacion y Bebidas": <ShoppingBag className="h-4 w-4" />,
  "Salud y Bienestar": <Heart className="h-4 w-4" />,
  "Servicios Profesionales": <Briefcase className="h-4 w-4" />,
  "Produccion e Industria": <Factory className="h-4 w-4" />,
  "Retail y Comercios": <Store className="h-4 w-4" />,
};

const LANDING_DEMO_ORDER: DemoSector[] = ["educacion", "gobierno", "empresas"];

const getIconForCategory = (cat: Pick<Rubro, "clave" | "nombre"> | DemoSectorGroup | null | undefined) => {
  const key = String((cat as any)?.key ?? (cat as any)?.clave ?? "");
  if (key && categoryIcons[key]) return categoryIcons[key];
  const name = String((cat as any)?.label ?? (cat as any)?.nombre ?? "");
  const found = Object.keys(categoryIcons).find((candidate) => name.includes(candidate));
  return found ? categoryIcons[found] : <Store className="h-4 w-4" />;
};

const normalize = (value?: string | null) =>
  (value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

const rootMatchesSector = (root: Rubro, sector: DemoSector) => {
  const key = normalize(root.clave || root.nombre);
  const name = normalize(root.nombre);
  if (sector === "educacion") return key.includes("educacion") || name.includes("coleg");
  if (sector === "gobierno") return key.includes("municip") || name.includes("gobierno") || name.includes("public");
  if (sector === "empresas") return key.includes("comercial") || name.includes("empresa") || name.includes("comerc");
  return key.includes(normalize(sector)) || name.includes(normalize(sector));
};

const flattenDemoCards = (root: Rubro): Rubro[] => {
  const result: Rubro[] = [];
  const visit = (node: Rubro) => {
    if (node.demo) result.push(node);
    (node.subrubros || []).forEach(visit);
  };
  visit(root);
  return result;
};

const readRubroSlug = (item: Rubro) => item.demo?.slug || item.clave || item.nombre;

const DemoCard = ({ item, sector, group }: { item: Rubro; sector: DemoSector; group?: DemoSectorGroup }) => {
  const navigate = useNavigate();
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (!item.demo) return null;

  const startDemo = async () => {
    setStarting(true);
    setError(null);
    try {
      const session = await createDemoSession({
        sector,
        pillar: sector,
        rubro_slug: readRubroSlug(item),
        category_slug: readRubroSlug(item),
        tenant_slug: item.demo?.slug ?? group?.tenant_slug ?? null,
      });
      const sessionId = session.demo_session_id || session.session_id;
      if (!sessionId) throw new Error("missing_demo_session_id");
      navigate(`/demo?session=${encodeURIComponent(sessionId)}`, {
        state: {
          demoSession: session,
          sector,
          rubroLabel: item.demo?.nombre || item.nombre,
          rubroSlug: readRubroSlug(item),
        },
      });
    } catch (err) {
      setError("No pudimos abrir la demo real. Proba de nuevo en unos minutos.");
    } finally {
      setStarting(false);
    }
  };

  return (
    <Card className="group chatboc-hover-lift flex h-full flex-col overflow-hidden rounded-[8px] border-border/70 bg-card/95 shadow-sm transition-all hover:border-primary/40 hover:shadow-xl">
      <CardHeader className="pb-3">
        <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-[8px] bg-primary/10 text-primary">
          {getIconForCategory(item)}
        </div>
        <div className="flex items-start justify-between gap-3">
          <CardTitle className="text-base font-semibold leading-snug transition-colors group-hover:text-primary">
            {item.demo.nombre || item.nombre}
          </CardTitle>
          <Badge variant="secondary" className="h-5 rounded-[8px] px-2 text-[10px]">
            Demo
          </Badge>
        </div>
        <CardDescription className="line-clamp-2 text-sm">
          {item.demo.descripcion || group?.description || item.nombre}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex-1">
        {error ? <p className="rounded-[8px] bg-destructive/10 px-3 py-2 text-xs text-destructive">{error}</p> : null}
      </CardContent>
      <CardFooter className="pt-0">
        <Button
          size="sm"
          className="h-10 w-full justify-between rounded-[8px] text-xs font-semibold"
          onClick={startDemo}
          disabled={starting}
        >
          {starting ? "Iniciando" : group?.cta_label?.trim() || "Probar demo"}
          {starting ? (
            <Loader2 className="ml-2 h-3.5 w-3.5 animate-spin" />
          ) : (
            <ArrowRight className="ml-2 h-3.5 w-3.5 transition-transform group-hover:translate-x-1" />
          )}
        </Button>
      </CardFooter>
    </Card>
  );
};

const PillarDemoCard = ({ sector, group }: { sector: DemoSector; group: DemoSectorGroup }) => {
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
        category_slug: defaultRubro,
        tenant_slug: group.tenant_slug ?? group.demo_tenant_slug ?? group.default_tenant_slug ?? null,
      });
      const sessionId = session.demo_session_id || session.session_id;
      if (!sessionId) throw new Error("missing_demo_session_id");
      navigate(`/demo?session=${encodeURIComponent(sessionId)}`, {
        state: {
          demoSession: session,
          sector,
          rubroLabel: group.label || String(group.key),
          rubroSlug: defaultRubro,
        },
      });
    } catch (err) {
      setError("No pudimos abrir la demo real. Proba de nuevo en unos minutos.");
    } finally {
      setStarting(false);
    }
  };

  return (
    <Card className="group chatboc-hover-lift flex h-full flex-col rounded-[8px] border-border/70 bg-card/95 shadow-sm transition-all hover:border-primary/40 hover:shadow-xl">
      <CardHeader>
        <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-[8px] bg-primary/10 text-primary">
          {getIconForCategory(group)}
        </div>
        <CardTitle className="text-base font-semibold">{group.label || String(group.key)}</CardTitle>
        {group.description ? <CardDescription>{group.description}</CardDescription> : null}
      </CardHeader>
      <CardContent className="flex-1">
        {error ? <p className="rounded-[8px] bg-destructive/10 px-3 py-2 text-xs text-destructive">{error}</p> : null}
      </CardContent>
      <CardFooter>
        <Button size="sm" className="h-10 w-full justify-between rounded-[8px] text-xs font-semibold" onClick={startDemo} disabled={starting}>
          {starting ? "Iniciando" : group.cta_label?.trim() || "Probar demo"}
          {starting ? (
            <Loader2 className="ml-2 h-3.5 w-3.5 animate-spin" />
          ) : (
            <ArrowRight className="ml-2 h-3.5 w-3.5 transition-transform group-hover:translate-x-1" />
          )}
        </Button>
      </CardFooter>
    </Card>
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
        setLoadError("No pudimos cargar las demos reales en este momento.");
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
    return LANDING_DEMO_ORDER.map(
      (sector) => byKey.get(String(sector)),
    ).filter((group): group is DemoSectorGroup => Boolean(group));
  }, [catalog?.sector_groups]);
  const defaultValue = groups[0]?.key ? String(groups[0].key) : undefined;

  return (
    <section id="demos" className="relative overflow-hidden bg-background py-16 text-foreground md:py-24">
      <div className="absolute inset-x-0 top-0 h-48 bg-gradient-to-b from-primary/10 to-transparent" />
      <div className="container relative mx-auto px-4">
        <div className="mx-auto mb-10 max-w-4xl text-center">
          <div className="chatboc-section-kicker mb-4">Demos</div>
          <h2 className="chatboc-section-heading">Elegi un pilar y abri una operacion real de demo</h2>
          <p className="chatboc-section-copy mt-4">
            Proba colegios, gobiernos o empresas con recorridos concretos: reclamos, pedidos, encuestas, adjuntos,
            ubicaciones, derivacion humana y seguimiento.
          </p>
        </div>

        {loading ? (
          <Alert className="mx-auto mb-6 max-w-5xl border-amber-300/60 bg-amber-50 text-amber-950 dark:bg-amber-950/20 dark:text-amber-100">
            <AlertTitle>Cargando demos reales</AlertTitle>
            <AlertDescription>
              Estamos consultando las experiencias publicadas para iniciar una demo real.
            </AlertDescription>
          </Alert>
        ) : null}

        {!loading && (loadError || groups.length === 0) ? (
          <div className="mx-auto max-w-2xl rounded-[8px] border border-dashed border-border px-6 py-12 text-center text-muted-foreground">
            {loadError || "Todavia no hay demos publicadas para mostrar."}
          </div>
        ) : null}

        {!loading && !loadError && groups.length > 0 ? (
          <Tabs defaultValue={defaultValue} className="mx-auto w-full max-w-6xl">
            <div className="mb-8 overflow-x-auto pb-2">
              <TabsList className="mx-auto grid h-auto w-full max-w-3xl grid-cols-3 gap-1 rounded-[8px] border border-border/70 bg-card/80 p-1 shadow-sm backdrop-blur">
                {groups.map((group) => (
                  <TabsTrigger
                    key={String(group.key)}
                    value={String(group.key)}
                    className="rounded-[8px] px-3 py-3 text-sm font-semibold transition-all data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
                  >
                    <span className="flex items-center justify-center gap-2">
                      {getIconForCategory(group)}
                      {group.label || String(group.key)}
                    </span>
                  </TabsTrigger>
                ))}
              </TabsList>
            </div>

            {groups.map((group) => {
              const sector = String(group.key) as DemoSector;
              const matchingRoots = roots.filter((root) => rootMatchesSector(root, sector));
              const cards = matchingRoots.flatMap(flattenDemoCards);
              return (
                <TabsContent key={String(group.key)} value={String(group.key)} className="focus-visible:ring-0">
                  <div className="chatboc-command-shell grid gap-6 p-5 md:grid-cols-[0.8fr_1.2fr] md:p-6">
                    <div className="rounded-[8px] border border-border/70 bg-background/70 p-5 shadow-sm">
                      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-[8px] bg-primary/10 text-primary">
                        {getIconForCategory(group)}
                      </div>
                      <h3 className="text-2xl font-bold">{group.label || String(group.key)}</h3>
                      {group.description ? <p className="mt-3 text-sm text-muted-foreground">{group.description}</p> : null}
                      {cards.length ? (
                        <p className="mt-5 rounded-[8px] border border-border/70 bg-card/70 p-3 text-sm text-muted-foreground">
                          {cards.length} demos reales publicadas para este pilar.
                        </p>
                      ) : null}
                    </div>

                    {cards.length ? (
                      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        {cards.map((item) => (
                          <DemoCard key={item.id} item={item as Rubro} sector={sector} group={group} />
                        ))}
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <PillarDemoCard sector={sector} group={group} />
                      </div>
                    )}
                  </div>
                </TabsContent>
              );
            })}
          </Tabs>
        ) : null}
      </div>
    </section>
  );
};

export default DemoShowcaseSection;
