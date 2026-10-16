import React, { useEffect, useMemo, useRef, useState } from "react";
import "./enterpriseLanding.css";
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
import type { LandingExperience } from "@/api/landingExperience";

type DemoShowcaseCopy = Partial<Record<
  "eyebrow" | "title" | "description" | "loading_title" | "loading_description" |
  "error_message" | "empty_message" | "retry_label" | "start_error_message" |
  "starting_label" | "card_label" | "open_label", string
>>;

const readShowcaseCopy = (experience?: LandingExperience | null): DemoShowcaseCopy => {
  const source = experience?.demo_showcase;
  if (!source || typeof source !== "object" || Array.isArray(source)) return {};
  return Object.fromEntries(Object.entries(source).flatMap(([key, value]) =>
    typeof value === "string" && value.trim() ? [[key, value.trim()]] : [],
  ));
};

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
  const name = String((cat as any)?.label ?? (cat as any)?.nombre ?? (cat as any)?.title ?? "");
  const found = Object.keys(categoryIcons).find((candidate) => name.includes(candidate));
  return found ? categoryIcons[found] : <Store className="h-4 w-4" />;
};

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
  if (sector === "gobierno") return declaredSector.includes("gobierno") || key.includes("municip") || name.includes("gobierno") || name.includes("public");
  if (sector === "empresas") return declaredSector.includes("empresa") || declaredSector.includes("pyme") || key.includes("comercial") || name.includes("empresa") || name.includes("comerc");
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
  String(item.demo?.nombre || item.nombre || (item as any).label || (item as any).title || (item as any).key || (item as any).slug || '').trim();

const readRubroDescription = (item: Rubro, group?: DemoSectorGroup) =>
  String(item.demo?.descripcion || (item as any).descripcion || (item as any).description || group?.description || readRubroLabel(item)).trim();

const readRubroSlug = (item: Rubro) =>
  String(item.demo?.slug || item.clave || (item as any).rubro_slug || (item as any).key || (item as any).slug || item.nombre || (item as any).label || '').trim();

const readRubroTenantSlug = (item: Rubro, group?: DemoSectorGroup) =>
  String((item as any).tenant_slug || (item as any).demo_tenant_slug || item.demo?.slug || (item as any).slug || group?.tenant_slug || '').trim() || null;

const DemoCard = ({ item, sector, group, copy }: { item: Rubro; sector: DemoSector; group?: DemoSectorGroup; copy: DemoShowcaseCopy }) => {
  const navigate = useNavigate();
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const rubroLabel = readRubroLabel(item);
  const rubroDescription = readRubroDescription(item, group);
  const openLabel = group?.cta_label?.trim() || copy.open_label;
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
    } catch (err) {
      setError(copy.start_error_message || copy.error_message || null);
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
            {rubroLabel}
          </CardTitle>
          {copy.card_label && <Badge variant="secondary" className="rounded-lg px-2 py-1 text-[10px]">
            {copy.card_label}
          </Badge>}
        </div>
        <CardDescription className="line-clamp-2 text-sm">
          {rubroDescription}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex-1">
        {error ? <p className="rounded-[8px] bg-destructive/10 px-3 py-2 text-xs text-destructive">{error}</p> : null}
      </CardContent>
      <CardFooter className="pt-0">
        {openLabel && <Button
          size="sm"
          className="h-10 w-full justify-between rounded-[8px] text-xs font-semibold"
          onClick={startDemo}
          disabled={starting}
        >
          {starting ? copy.starting_label || openLabel : openLabel}
          {starting ? (
            <Loader2 className="ml-2 h-3.5 w-3.5 animate-spin" />
          ) : (
            <ArrowRight className="ml-2 h-3.5 w-3.5 transition-transform group-hover:translate-x-1" />
          )}
        </Button>}
      </CardFooter>
    </Card>
  );
};

const PillarDemoCard = ({ sector, group, copy }: { sector: DemoSector; group: DemoSectorGroup; copy: DemoShowcaseCopy }) => {
  const navigate = useNavigate();
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const openLabel = group.cta_label?.trim() || copy.open_label;

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
    } catch (err) {
      setError(copy.start_error_message || copy.error_message || null);
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
        {openLabel && <Button size="sm" className="h-10 w-full justify-between rounded-[8px] text-xs font-semibold" onClick={startDemo} disabled={starting}>
          {starting ? copy.starting_label || openLabel : openLabel}
          {starting ? (
            <Loader2 className="ml-2 h-3.5 w-3.5 animate-spin" />
          ) : (
            <ArrowRight className="ml-2 h-3.5 w-3.5 transition-transform group-hover:translate-x-1" />
          )}
        </Button>}
      </CardFooter>
    </Card>
  );
};

const DemoShowcaseSection = ({ experience }: { experience?: LandingExperience | null }) => {
  const copy = readShowcaseCopy(experience);
  const [catalog, setCatalog] = useState<DemoCatalogResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [requestVersion, setRequestVersion] = useState(0);
  const loadingRef = useRef(true);
  const retryRequested = useRef(false);
  const retryButtonRef = useRef<HTMLButtonElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const headingId = `demo-showcase-${React.useId().replace(/:/g, "")}`;

  useEffect(() => {
    let active = true;
    loadingRef.current = true;
    setLoading(true);
    getDemoCatalog()
      .then((response) => {
        if (!active) return;
        if (retryRequested.current && response.sector_groups?.length && document.activeElement === retryButtonRef.current) {
          headingRef.current?.focus({ preventScroll: true });
        }
        setCatalog(response);
        setLoadError(false);
      })
      .catch(() => {
        if (!active) return;
        setCatalog(null);
        setLoadError(true);
      })
      .finally(() => {
        if (!active) return;
        loadingRef.current = false;
        retryRequested.current = false;
        setLoading(false);
      });

    return () => { active = false; };
  }, [requestVersion]);

  const retryCatalog = () => {
    if (loadingRef.current) return;
    loadingRef.current = true;
    retryRequested.current = true;
    setRequestVersion((version) => version + 1);
  };

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
    <section id="demos" className="enterprise-demo-showcase py-16 text-foreground md:py-24" aria-labelledby={headingId} aria-busy={loading}>
      <div className="container mx-auto px-4">
        <div className="enterprise-demo-showcase__heading">
          <div className="max-w-3xl">
            {copy.eyebrow && <div className="chatboc-section-kicker mb-4">{copy.eyebrow}</div>}
            <h2 ref={headingRef} id={headingId} tabIndex={-1} className="chatboc-section-heading focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">{copy.title || "Demos"}</h2>
            {copy.description && <p className="chatboc-section-copy mt-4">{copy.description}</p>}
          </div>
          {copy.retry_label && (retryRequested.current || loadError || (!loading && groups.length === 0)) && (
            <Button ref={retryButtonRef} variant="outline" className="enterprise-demo-showcase__retry" aria-disabled={loading} onClick={retryCatalog}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />}
              {copy.retry_label}
            </Button>
          )}
        </div>

        {loading ? (
          <Alert className="enterprise-demo-showcase__status" role="status">
            <Loader2 className="h-4 w-4 shrink-0 animate-spin motion-reduce:animate-none" aria-hidden="true" />
            <div>{copy.loading_title && <AlertTitle>{copy.loading_title}</AlertTitle>}
            {copy.loading_description && <AlertDescription>{copy.loading_description}</AlertDescription>}</div>
          </Alert>
        ) : null}

        {!loading && (loadError || groups.length === 0) ? (
          <div className="enterprise-demo-showcase__status" role="status">
            <p>{loadError ? copy.error_message : copy.empty_message}</p>
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

                    </div>

                    {cards.length ? (
                      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        {cards.map((item, index) => (
                          <DemoCard
                            key={String(item.id ?? item.key ?? item.slug ?? item.rubro_slug ?? `${sector}-${index}`)}
                            item={item as Rubro}
                            sector={sector}
                            group={group}
                            copy={copy}
                          />
                        ))}
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <PillarDemoCard sector={sector} group={group} copy={copy} />
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
