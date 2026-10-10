import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { apiFetch, ApiError } from '@/utils/api';
import { getEmployeeRoutingV2, type EmployeeRoutingEmployee, type EmployeeRoutingV2 } from '@/api/v2/saas';
import { usePrivateAnalyticsScope } from '@/features/analytics/usePrivateAnalyticsScope';
import { ViewState } from '@/components/app-shell/ViewState';
import useRequireRole from '@/hooks/useRequireRole';
import { hasRequiredRole, type Role } from '@/utils/roles';
import { useUser } from '@/hooks/useUser';
import { privateBackendRead } from '@/utils/privateBackendRead';
import { panelReadOptions } from '@/utils/panelReadOptions';
import { captureChatbocSessionRevision, isChatbocSessionRevisionCurrent } from '@/utils/chatbocSessionRevision';
import SectionErrorBoundary from '@/components/errors/SectionErrorBoundary';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
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
  ArrowRight,
  Edit,
  FolderTree,
  Loader2,
  PlusCircle,
  RefreshCw,
  Route,
  Trash2,
  Users2,
  Workflow,
} from 'lucide-react';

type UnknownRecord = Record<string, unknown>;

interface Category {
  id?: string | number;
  nombre: string;
  slug?: string;
  source?: 'catalog' | 'routing';
}
interface CategoryInventoryItem {key:string;label:string;persisted_category_ids:number[];source_types:string[];open_count:number;unassigned_count:number;eligible_employee_count:number|null;coverage_reason_code:string}
interface CategoryInventory {items:CategoryInventoryItem[];summary:{persisted_categories:number;redacted_persisted_categories:number;detected_topics:number;open_count:number;unassigned_count:number}}
const count=(value:unknown):value is number=>typeof value==='number'&&Number.isSafeInteger(value)&&value>=0;
const readCategoryInventory=(routing:EmployeeRoutingV2|null,slug:string):CategoryInventory|null=>{
  const raw=routing?.raw, value=isRecord(raw)?raw.category_inventory:null;
  if(!isRecord(value)||value.contract_version!=='employee.category_inventory.v1'||value.population!=='open_tickets'||value.viewer_scope!=='tenant_dispatch'||
    value.coverage_basis!=='employees_eligible_for_at_least_one_current_open_ticket'||value.read_only!==true||value.writes_performed!==false||
    !isRecord(value.tenant)||value.tenant.slug!==slug||!count(value.tenant.id)||value.tenant.id<1||
    !isRecord(raw)||!isRecord(raw.tenant)||raw.tenant.slug!==slug||raw.tenant.id!==value.tenant.id||
    !isRecord(value.summary)||!['persisted_categories','redacted_persisted_categories','detected_topics','open_count','unassigned_count'].every(key=>count((value.summary as UnknownRecord)[key]))||
    Number(value.summary.redacted_persisted_categories)>Number(value.summary.persisted_categories)||Number(value.summary.unassigned_count)>Number(value.summary.open_count)||!Array.isArray(value.items))return null;
  const sources=['tenant_category_catalog','tenant_config','municipio_baseline_taxonomy','education_taxonomy','catalog_categories','open_tickets'];
  if(!value.items.every(item=>isRecord(item)&&typeof item.key==='string'&&item.key.trim().length>0&&typeof item.label==='string'&&item.label.trim().length>0&&
    Array.isArray(item.persisted_category_ids)&&item.persisted_category_ids.every(id=>count(id)&&id>0)&&
    Array.isArray(item.source_types)&&item.source_types.length>0&&item.source_types.every(source=>typeof source==='string'&&sources.includes(source))&&
    count(item.open_count)&&count(item.unassigned_count)&&item.unassigned_count<=item.open_count&&
    (item.open_count===0?item.eligible_employee_count===null&&item.coverage_reason_code==='no_current_open_ticket_evidence':count(item.eligible_employee_count)&&item.coverage_reason_code==='current_open_ticket_eligibility')))return null;
  const detected=value.items.filter(item=>(item as CategoryInventoryItem).persisted_category_ids.length===0&&(item as CategoryInventoryItem).open_count>0).length;
  if(new Set(value.items.map(item=>(item as UnknownRecord).key)).size!==value.items.length||value.summary.detected_topics!==detected)return null;
  return value as unknown as CategoryInventory;
};

const CATEGORY_API_BASE = '/municipal/categorias';

const isRecord = (value: unknown): value is UnknownRecord =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value);

const asString = (value: unknown): string | undefined => {
  if (typeof value === 'string' && value.trim()) return value.trim();
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return undefined;
};

const normalizeKey = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();

const uniqueStrings = (values: string[]) => {
  const seen = new Set<string>();
  return values.filter((value) => {
    const key = normalizeKey(value);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

const normalizeCategory = (value: unknown, index = 0): Category | null => {
  if (typeof value === 'string' && value.trim()) {
    return { id: `routing-${index}`, nombre: value.trim(), source: 'routing' };
  }
  if (!isRecord(value)) return null;
  const name =
    asString(value.nombre) ??
    asString(value.name) ??
    asString(value.label) ??
    asString(value.slug) ??
    asString(value.id);
  if (!name) return null;
  return {
    id: asString(value.id) ?? asString(value.category_id) ?? asString(value.slug) ?? `category-${index}`,
    nombre: name,
    slug: asString(value.slug) ?? asString(value.key),
    source: 'catalog',
  };
};

const pickCategoryArray = (payload: unknown): unknown[] => {
  if (Array.isArray(payload)) return payload;
  if (!isRecord(payload)) return [];
  const direct =
    payload.categorias ??
    payload.categories ??
    payload.items ??
    payload.ticket_categories ??
    payload.data;
  if (Array.isArray(direct)) return direct;
  if (isRecord(direct)) return pickCategoryArray(direct);
  return [];
};

const normalizeCategories = (payload: unknown) =>
  pickCategoryArray(payload)
    .map(normalizeCategory)
    .filter((item): item is Category => Boolean(item));

const getRoutingCategoryNames = (routing: EmployeeRoutingV2 | null) => {
  if (!routing) return [];
  return uniqueStrings([
    ...(routing.dimensions.categorias ?? []),
    ...(routing.dimensions.categories ?? []),
    ...(routing.dimensions.category ?? []),
  ]);
};

const employeeCategoryScope = (employee: EmployeeRoutingEmployee) =>
  uniqueStrings([
    ...(employee.scope.categorias ?? []),
    ...(Array.isArray(employee.scope.raw.categories) ? employee.scope.raw.categories : []),
  ].filter((value): value is string => typeof value === 'string' && value.trim().length > 0));

const isSameCategory = (category: Category, value: string) => {
  const categoryKeys = [category.nombre, category.slug].filter((item): item is string => Boolean(item));
  const normalizedValue = normalizeKey(value);
  return categoryKeys.some((item) => normalizeKey(item) === normalizedValue);
};

const buildVisibleCategories = (categories: Category[], routing: EmployeeRoutingV2 | null, inventory:CategoryInventory|null) => {
  const persisted = categories.map((category) => ({ ...category, source: 'catalog' as const }));
  const existingKeys = new Set(persisted.flatMap((category) => [category.nombre, category.slug].filter(Boolean).map((item) => normalizeKey(String(item)))));
  const routingOnly = (inventory ? inventory.items.filter(item=>item.persisted_category_ids.length===0).map(item=>item.label) : getRoutingCategoryNames(routing))
    .filter((name) => !existingKeys.has(normalizeKey(name)))
    .map((name, index) => ({
      id: `routing-${index}`,
      nombre: name,
      source: 'routing' as const,
    }));
  return [...persisted, ...routingOnly];
};

const CategoryManagementPage: React.FC = () => {
  useRequireRole(['tenant_admin', 'superadmin', 'catalog_manager'] as Role[]);
  const { user } = useUser();
  const { scope, pending, key } = usePrivateAnalyticsScope();
  if (pending) return <ViewState status="loading" title="Validando acceso" />;
  if (!hasRequiredRole(user?.rol, ['tenant_admin', 'superadmin', 'catalog_manager'])) return <ViewState status="denied" title="No tenés acceso a la administración de categorías" />;
  if (!scope) return <ViewState status="empty" title="Organización de las categorías no verificada" />;
  return <ScopedCategoryManagement key={key} tenantSlug={scope.tenantSlug} canManageTeam={hasRequiredRole(user?.rol, ['tenant_admin', 'superadmin'])} />;
};
const ScopedCategoryManagement: React.FC<{ tenantSlug: string; canManageTeam: boolean }> = ({ tenantSlug, canManageTeam }) => {

  const [categories, setCategories] = useState<Category[]>([]);
  const [routing, setRouting] = useState<EmployeeRoutingV2 | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [categoryName, setCategoryName] = useState('');
  const [createDraft, setCreateDraft] = useState('');
  const [catalogVerified, setCatalogVerified] = useState(false);
  const [savedCategory, setSavedCategory] = useState<string | null>(null);
  const [unconfirmedCategory,setUnconfirmedCategory]=useState<string|null>(null);
  const mounted = useRef(true), loadVersion = useRef(0), mutationInFlight = useRef(false);
  const sessionRevision = useRef(captureChatbocSessionRevision());
  const scopeIsCurrent = useCallback(() => mounted.current && isChatbocSessionRevisionCurrent(sessionRevision.current), []);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; loadVersion.current++; }; }, []);
  const responsibleHref = `/empleados?tenant_slug=${encodeURIComponent(tenantSlug)}`;

  const fetchCategories = useCallback(async () => {
    if (!scopeIsCurrent()) return null;
    const version = ++loadVersion.current;
    const isCurrent = () => scopeIsCurrent() && version === loadVersion.current;
    setIsLoading(true);
    setError(null);
    setCatalogVerified(false);
    try {
      const [categoryPayload, routingPayload] = await Promise.all([
        privateBackendRead(CATEGORY_API_BASE, tenantSlug, { isCurrent }),
        getEmployeeRoutingV2(tenantSlug, { isCurrent }).catch(() => null),
      ]);
      if (!isCurrent()) return null;
      const persisted = normalizeCategories(categoryPayload);
      setCategories(persisted);
      setCatalogVerified(true);
      setRouting(routingPayload);
      return persisted;
    } catch (err) {
      if (!isCurrent()) return null;
      const message =
        err instanceof ApiError && err.status === 403
          ? 'Tu cuenta puede ver el panel, pero todavia no tiene permiso para administrar categorias.'
          : 'No pudimos cargar las categorias. Reintenta o solicita al equipo que revise el modulo.';
      setError(message);
      return null;
    } finally {
      if (isCurrent()) setIsLoading(false);
    }
  }, [tenantSlug, scopeIsCurrent]);

  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  const inventory=useMemo(()=>readCategoryInventory(routing,tenantSlug),[routing,tenantSlug]);
  const visibleCategories = useMemo(() => buildVisibleCategories(categories, routing,inventory), [categories, routing,inventory]);
  const inventoryByName=useMemo(()=>new Map(inventory?.items.map(item=>[normalizeKey(item.label),item])),[inventory]);
  const routingTopicCount = visibleCategories.filter((category) => category.source === 'routing').length;
  const categorySourceLabels = [
    `${catalogVerified ? categories.length : 'Cantidad no verificada'} en catálogo`,
    routing ? `${routingTopicCount} temas de ruteo fuera del catálogo` : 'Temas de ruteo no informados',
    inventory ? `${inventory.summary.detected_topics} con demanda abierta fuera del catálogo` : 'Demanda abierta no verificada',
  ];
  const categorySourcesSummary = categorySourceLabels.join(' · ');

  const assignedByCategory = useMemo(() => {
    const employees = routing?.employees ?? [];
    return new Map(
      visibleCategories.map((category) => [
        category.nombre,
        employees.filter((employee) => employeeCategoryScope(employee).some((scope) => isSameCategory(category, scope))),
      ]),
    );
  }, [routing?.employees, visibleCategories]);

  const employeesWithCoverage = useMemo(() => {
    const employees = routing?.employees ?? [];
    return employees.filter((employee) => employeeCategoryScope(employee).length > 0).length;
  }, [routing?.employees]);

  const routedCategories = useMemo(
    () => visibleCategories.filter((category) => (assignedByCategory.get(category.nombre)?.length ?? 0) > 0).length,
    [assignedByCategory, visibleCategories],
  );

  const handleCreate = () => {
    setEditingCategory(null);
    setCategoryName(createDraft);
    setIsDialogOpen(true);
  };

  const handleEdit = (category: Category) => {
    setEditingCategory(category);
    setCategoryName(category.nombre);
    if (category.source === 'routing') setCreateDraft(category.nombre);
    setIsDialogOpen(true);
  };

  const handleDelete = async (category: Category) => {
    if (!catalogVerified || unconfirmedCategory || mutationInFlight.current || !scopeIsCurrent() || !category.id || category.source === 'routing') return;
    if (!window.confirm('Esta categoria dejara de estar disponible para nuevos reclamos. Queres eliminarla?')) {
      return;
    }
    mutationInFlight.current = true; setIsSaving(true);
    setError(null);
    try {
      await apiFetch(`${CATEGORY_API_BASE}/${encodeURIComponent(String(category.id))}`, {
        ...panelReadOptions(tenantSlug), singleAttempt: true, allowStartupRecovery: false, isCurrent: scopeIsCurrent,
        method: 'DELETE',
        tenantSlug,
      });
      if (!scopeIsCurrent()) return;
      await fetchCategories();
    } catch {
      if (!scopeIsCurrent()) return;
      setError('No pudimos eliminar la categoria. Revisa si tiene tickets o reglas asociadas.');
    } finally {
      mutationInFlight.current = false; if (scopeIsCurrent()) setIsSaving(false);
    }
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    const nombre = categoryName.trim();
    if (!nombre || !catalogVerified || unconfirmedCategory || mutationInFlight.current || !scopeIsCurrent()) return;

    const url =
      editingCategory?.id && editingCategory.source !== 'routing'
        ? `${CATEGORY_API_BASE}/${encodeURIComponent(String(editingCategory.id))}`
        : CATEGORY_API_BASE;
    const method = editingCategory?.id && editingCategory.source !== 'routing' ? 'PUT' : 'POST';

    mutationInFlight.current = true; setIsSaving(true);
    setError(null);
    try {
      await apiFetch(url, {
        ...panelReadOptions(tenantSlug), singleAttempt: true, allowStartupRecovery: false, isCurrent: scopeIsCurrent,
        method,
        body: { nombre },
        tenantSlug,
      });
      if (!scopeIsCurrent()) return;
      setUnconfirmedCategory(nombre);
      const refreshed = await fetchCategories();
      if (!scopeIsCurrent()) return;
      if (!refreshed?.some(category => normalizeKey(category.nombre) === normalizeKey(nombre))) {
        setError('El envío terminó, pero no pudimos confirmar la categoría en el catálogo. Actualizá el catálogo antes de volver a guardar.');
        return;
      }
      setUnconfirmedCategory(null);setSavedCategory(nombre); setCreateDraft(''); setIsDialogOpen(false);
    } catch {
      if (!scopeIsCurrent()) return;
      setError('No pudimos guardar la categoria. Revisa el nombre y vuelve a intentar.');
    } finally {
      mutationInFlight.current = false; if (scopeIsCurrent()) setIsSaving(false);
    }
  };
  const verifyUnconfirmedCategory=async()=>{
    if(!unconfirmedCategory||isSaving||!scopeIsCurrent())return;
    const name=unconfirmedCategory;const refreshed=await fetchCategories();if(!scopeIsCurrent())return;
    if(refreshed?.some(category=>normalizeKey(category.nombre)===normalizeKey(name))){setUnconfirmedCategory(null);setSavedCategory(name);setCreateDraft('');setIsDialogOpen(false);}
    else setError('La categoría enviada todavía no pudo confirmarse. Conservamos el borrador; no se enviará nuevamente mientras su resultado siga pendiente.');
  };

  const operationCards = [
    {
      label: 'Temas de atencion',
      value: visibleCategories.length,
      helper: categorySourcesSummary,
      icon: FolderTree,
    },
    {
      label: inventory ? 'Temas con personas compatibles' : 'Temas con alcance declarado',
      value: inventory ? inventory.items.filter(item=>(item.eligible_employee_count??0)>0).length : routing ? routedCategories : 'No informado',
      helper: inventory ? 'Compatibilidad con al menos un caso abierto, según el servidor.' : 'Personas con este tema en su alcance publicado.',
      icon: Route,
    },
    {
      label: 'Personas con temas declarados',
      value: routing ? employeesWithCoverage : 'No informado',
      helper: 'Personas con temas de atención en su alcance publicado.',
      icon: Users2,
    },
    {
      label: 'Sin asignar',
      value: routing?.queues.unassigned_count ?? 'No informado',
      helper: 'Tickets que esperan una persona responsable.',
      icon: Workflow,
    },
  ];

  if (isLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <SectionErrorBoundary
      title="No pudimos cargar categorías"
      description="Reintentá la carga o volvé al panel."
      onRetry={() => fetchCategories()}
      resetKeys={[tenantSlug]}
      fallbackAction={<a href="/perfil">Volver al panel</a>}
    >
      <div className="mx-auto w-full max-w-7xl space-y-8 p-4 sm:p-6 lg:p-8">
        <section className="flex flex-col gap-5 border-b border-border/70 pb-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl space-y-3">
            <Badge variant="outline" className="w-fit rounded-full px-3 py-1">
              Ruteo de reclamos
            </Badge>
            <h1 className="text-3xl font-bold tracking-tight text-foreground">Gestion de categorias</h1>
            <p className="text-base text-muted-foreground">
              Organiza los temas que llegan al inbox, conectalos con empleados y mantené la carga de trabajo visible.
              Cada categoria ayuda a que el caso entre ordenado y llegue al equipo correcto.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={fetchCategories} disabled={isSaving}>
              <RefreshCw className="mr-2 h-4 w-4" />
              Actualizar
            </Button>
            <Button onClick={handleCreate} disabled={isSaving || !catalogVerified || Boolean(unconfirmedCategory)}>
              <PlusCircle className="mr-2 h-4 w-4" />
              Crear categoria
            </Button>
          </div>
        </section>

        {savedCategory ? <div role="status" className="rounded-xl border border-border bg-muted/20 p-4">
          <p>La categoría «{savedCategory}» está en el catálogo. {canManageTeam ? 'El siguiente paso es revisar sus responsables.' : 'Pedile al administrador que revise sus responsables.'}</p>
          {canManageTeam ? <a href={responsibleHref} className="mt-2 inline-flex min-h-11 items-center underline underline-offset-4">Revisar responsables</a> : null}
        </div> : null}
        {canManageTeam ? <a href={responsibleHref} className="inline-flex min-h-11 items-center gap-2 underline underline-offset-4"><Users2 size={18} aria-hidden="true" />Ver equipo y responsables</a> : null}
        {inventory ? <p className="text-sm text-muted-foreground">Los temas de ruteo pueden provenir de la taxonomía publicada o de casos abiertos. Los temas con demanda abierta fuera del catálogo se cuentan por separado. La compatibilidad publicada indica personas que pueden atender al menos un caso abierto del tema; no garantiza que todos sus casos tengan cobertura.</p> : null}
        {unconfirmedCategory && !isDialogOpen ? <Button variant="outline" disabled={isSaving} onClick={()=>void verifyUnconfirmedCategory()}>Comprobar categoría enviada</Button> : null}

        {error && !isDialogOpen ? (
          <div className="rounded-2xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
            <span role="alert">{error}</span>
          </div>
        ) : null}

        <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {operationCards.map(({ label, value, helper, icon: Icon }) => (
            <div key={label} className="rounded-2xl border border-border/70 bg-card/70 p-4 shadow-sm">
              <div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Icon className="h-4 w-4" />
              </div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">{label}</p>
              <p className="mt-2 text-2xl font-bold text-foreground">{value}</p>
              <p className="mt-1 text-sm text-muted-foreground">{helper}</p>
            </div>
          ))}
        </section>

        <section className="grid gap-4 lg:grid-cols-3">
          {[
            ['Clasifica lo que llega', 'Cada reclamo, consulta o pedido queda asociado a un tema operativo.'],
            ['Deriva mejor', 'El ruteo usa estas categorias para sugerir empleados y equilibrar carga.'],
            ['Mide con sentido', 'Las metricas, mapas y prioridades se entienden por tema, zona y canal.'],
          ].map(([title, copy]) => (
            <div key={title} className="rounded-2xl border border-border/70 bg-muted/20 p-4">
              <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <ArrowRight className="h-4 w-4" />
              </div>
              <h2 className="font-semibold text-foreground">{title}</h2>
              <p className="mt-2 text-sm text-muted-foreground">{copy}</p>
            </div>
          ))}
        </section>

        <section className="overflow-hidden rounded-2xl border border-border/70 bg-card/70 shadow-sm">
          <div className="flex flex-col gap-2 border-b border-border/70 p-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-xl font-semibold text-foreground">Catálogo y temas de ruteo</h2>
              <p className="text-sm text-muted-foreground">
                Usa esta lista para mantener claro que atiende cada equipo.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {categorySourceLabels.map((label) => <Badge key={label} variant="secondary" className="w-fit rounded-full">{label}</Badge>)}
            </div>
          </div>

          {visibleCategories.length ? (
            <div className="divide-y divide-border/70">
              {visibleCategories.map((category) => {
                const assignedEmployees = assignedByCategory.get(category.nombre) ?? [];
                const demand=inventoryByName.get(normalizeKey(category.nombre));
                const workload = assignedEmployees.reduce((total, employee) => total + (employee.workload_open ?? 0), 0);
                const canEdit = category.source !== 'routing';
                return (
                  <div key={`${category.source}-${category.id ?? category.nombre}`} className="grid gap-4 p-5 lg:grid-cols-[1.2fr_1fr_auto] lg:items-center">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-lg font-semibold text-foreground">{category.nombre}</h3>
                        {category.source === 'routing' ? (
                          <Badge variant="outline" className="rounded-full">
                            {demand?.open_count ? 'demanda abierta · fuera del catálogo' : demand?.source_types.some((source) => source !== 'open_tickets') ? 'taxonomía de ruteo · fuera del catálogo' : 'tema de ruteo · fuera del catálogo'}
                          </Badge>
                        ) : null}
                      </div>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {demand ? `${demand.open_count} casos abiertos · ${demand.unassigned_count} sin responsable` : assignedEmployees.length
                          ? `${assignedEmployees.length} persona${assignedEmployees.length === 1 ? ' tiene' : 's tienen'} este tema en su alcance.`
                          : 'No hay personas con este tema en su alcance publicado.'}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Badge variant={assignedEmployees.length ? 'secondary' : 'outline'} className="rounded-full">
                        {demand ? demand.eligible_employee_count === null ? 'Compatibilidad no verificada: sin demanda actual' : `${demand.eligible_employee_count} personas compatibles con al menos un caso` : routing ? assignedEmployees.length ? 'Con cobertura declarada' : 'Sin cobertura declarada' : 'Cobertura no verificada'}
                      </Badge>
                      <Badge variant="outline" className="rounded-full">
                        {workload} abiertos del equipo
                      </Badge>
                    </div>
                    <div className="flex justify-start gap-2 lg:justify-end">
                      <Button variant="outline" size="sm" onClick={() => handleEdit(category)} disabled={isSaving || !catalogVerified || Boolean(unconfirmedCategory)} aria-label={`${canEdit ? 'Editar categoría' : 'Revisar y crear categoría'}: ${category.nombre}`}>
                        <Edit className="mr-2 h-4 w-4" />
                        {canEdit ? 'Editar' : 'Revisar y crear categoría'}
                      </Button>
                      {canEdit ? (
                        <Button variant="ghost" size="icon" onClick={() => handleDelete(category)} disabled={isSaving || !catalogVerified || Boolean(unconfirmedCategory)} aria-label={`Eliminar categoría: ${category.nombre}`}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center gap-4 px-6 py-14 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                <FolderTree className="h-6 w-6" />
              </div>
              <div className="max-w-lg space-y-2">
                <h3 className="text-xl font-semibold text-foreground">Todavia no hay categorias configuradas</h3>
                <p className="text-sm text-muted-foreground">
                  Crea la primera categoria para que los reclamos puedan agruparse y asignarse con mas claridad.
                </p>
              </div>
                <Button onClick={handleCreate} disabled={!catalogVerified || Boolean(unconfirmedCategory)}>
                <PlusCircle className="mr-2 h-4 w-4" />
                Crear primera categoria
              </Button>
            </div>
          )}
        </section>

        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingCategory && editingCategory.source !== 'routing' ? 'Editar categoría' : 'Crear categoría'}</DialogTitle>
              <DialogDescription>
                {editingCategory?.source === 'routing' ? 'Este tema fue publicado por ruteo y todavía no está en el catálogo. Revisá su nombre antes de crear la categoría. Los responsables se revisan en Equipo.' : 'El nombre se usa para clasificar tickets. La categoría y la cobertura de responsables se administran por separado.'}
              </DialogDescription>
            </DialogHeader>
            {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
            {unconfirmedCategory ? <Button type="button" variant="outline" disabled={isSaving} onClick={()=>void verifyUnconfirmedCategory()}>Comprobar catálogo</Button> : null}
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="category-name">Nombre</Label>
                <Input
                  id="category-name"
                  placeholder="Ejemplo: Alumbrado, Reclamos comerciales, Admisiones"
                  value={categoryName}
                  onChange={(event) => { setCategoryName(event.target.value); if (!editingCategory || editingCategory.source === 'routing') setCreateDraft(event.target.value); }}
                  autoFocus
                />
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)} disabled={isSaving}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={isSaving || !catalogVerified || Boolean(unconfirmedCategory) || !categoryName.trim()}>
                  {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Guardar
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </SectionErrorBoundary>
  );
};

export default CategoryManagementPage;
