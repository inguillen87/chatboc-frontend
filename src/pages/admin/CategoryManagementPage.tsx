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
  Edit,
  FolderTree,
  Loader2,
  PlusCircle,
  RefreshCw,
  Trash2,
  Users2,
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
const withCount = (value: number, singular: string, plural: string) => `${value.toLocaleString('es-AR')} ${value === 1 ? singular : plural}`;
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
  if (!hasRequiredRole(user?.rol, ['tenant_admin', 'superadmin', 'catalog_manager'])) return <ViewState status="denied" title="No tenés acceso a la administración de temas" />;
  if (!scope) return <ViewState status="empty" title="Organización de los temas no verificada" />;
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
          ? 'Tu cuenta puede ver el panel, pero todavía no tiene permiso para administrar temas.'
          : 'No pudimos cargar los temas. Reintentá o pedile al equipo que revise esta sección.';
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
    catalogVerified ? withCount(categories.length, 'tema guardado', 'temas guardados') : 'Cantidad de temas guardados no verificada',
    routing ? `${withCount(routingTopicCount, 'tema informado', 'temas informados')} por las reglas de atención y todavía no guardado${routingTopicCount === 1 ? '' : 's'}` : 'Temas de las reglas de atención no informados',
    inventory ? `${withCount(inventory.summary.detected_topics, 'tema detectado', 'temas detectados')} en casos abiertos y todavía no guardado${inventory.summary.detected_topics === 1 ? '' : 's'}` : 'Casos abiertos no verificados',
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
    if (!window.confirm('Este tema dejará de estar disponible para clasificar casos nuevos. ¿Querés eliminarlo?')) {
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
      setError('No pudimos eliminar el tema. Revisá si tiene casos o reglas asociadas.');
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
        setError('El envío terminó, pero no pudimos confirmar el tema en la lista. Actualizá la información antes de volver a guardar.');
        return;
      }
      setUnconfirmedCategory(null);setSavedCategory(nombre); setCreateDraft(''); setIsDialogOpen(false);
    } catch {
      if (!scopeIsCurrent()) return;
      setError('No pudimos guardar el tema. Revisá el nombre y volvé a intentar.');
    } finally {
      mutationInFlight.current = false; if (scopeIsCurrent()) setIsSaving(false);
    }
  };
  const verifyUnconfirmedCategory=async()=>{
    if(!unconfirmedCategory||isSaving||!scopeIsCurrent())return;
    const name=unconfirmedCategory;const refreshed=await fetchCategories();if(!scopeIsCurrent())return;
    if(refreshed?.some(category=>normalizeKey(category.nombre)===normalizeKey(name))){setUnconfirmedCategory(null);setSavedCategory(name);setCreateDraft('');setIsDialogOpen(false);}
    else setError('El tema enviado todavía no pudo confirmarse. Conservamos el borrador; no se enviará nuevamente mientras su resultado siga pendiente.');
  };

  const topicsWithAvailablePeople = inventory
    ? inventory.items.filter((item) => (item.eligible_employee_count ?? 0) > 0).length
    : routing
      ? routedCategories
      : null;
  const peopleWithTopics = routing ? employeesWithCoverage : null;
  const casesWithoutOwner = routing?.queues.unassigned_count ?? null;
  const overviewItems = [
    {
      label: 'Temas disponibles',
      value: visibleCategories.length ? visibleCategories.length.toLocaleString('es-AR') : 'Todavía no hay',
      helper: 'Sirven para ordenar los casos que llegan.',
    },
    {
      label: 'Temas que alguien puede atender',
      value: topicsWithAvailablePeople === null ? 'No se pudo comprobar' : topicsWithAvailablePeople ? topicsWithAvailablePeople.toLocaleString('es-AR') : 'Todavía ninguno',
      helper: 'Al menos una persona tiene ese tema entre sus responsabilidades.',
    },
    {
      label: 'Personas con temas asignados',
      value: peopleWithTopics === null ? 'No se pudo comprobar' : peopleWithTopics ? peopleWithTopics.toLocaleString('es-AR') : 'Todavía ninguna',
      helper: 'Personas que ya tienen al menos un tema a cargo.',
    },
    {
      label: 'Casos sin responsable',
      value: casesWithoutOwner === null ? 'No se pudo comprobar' : casesWithoutOwner ? casesWithoutOwner.toLocaleString('es-AR') : 'Todos tienen responsable',
      helper: 'Casos abiertos que todavía esperan asignación.',
    },
  ];

  if (isLoading) {
    return (
      <div role="status" className="flex min-h-[60vh] items-center justify-center gap-3 text-muted-foreground">
        <Loader2 aria-hidden="true" className="h-8 w-8 animate-spin text-primary" />
        <span>Cargando temas de atención…</span>
      </div>
    );
  }

  return (
    <SectionErrorBoundary
      title="No pudimos cargar los temas"
      description="Reintentá la carga o volvé al panel."
      onRetry={() => fetchCategories()}
      resetKeys={[tenantSlug]}
      fallbackAction={<a href="/perfil" className="inline-flex min-h-11 items-center rounded-md underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">Volver al panel</a>}
    >
      <div className="mx-auto w-full max-w-7xl space-y-8 p-4 sm:p-6 lg:p-8">
        <section className="flex flex-col gap-5 border-b border-border/70 pb-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl space-y-2">
            <h1 className="text-3xl font-bold tracking-tight text-foreground">Temas de atención</h1>
            <p className="text-base text-muted-foreground">
              Acá ves cómo se ordenan los casos que llegan. Agregá un tema y después definí quién puede atenderlo.
            </p>
          </div>
          <Button className="min-h-11" onClick={handleCreate} disabled={isSaving || !catalogVerified || Boolean(unconfirmedCategory)}>
            <PlusCircle aria-hidden="true" className="mr-2 h-4 w-4" />
            Agregar tema
          </Button>
        </section>

        {savedCategory ? <div role="status" className="rounded-xl border border-border bg-muted/20 p-4">
          <p>El tema «{savedCategory}» ya está disponible. {canManageTeam ? 'Ahora definí quién puede atenderlo.' : 'Pedile a quien administra el equipo que defina quién puede atenderlo.'}</p>
          {canManageTeam ? <a href={responsibleHref} className="mt-2 inline-flex min-h-11 items-center rounded-md font-medium text-primary underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">Revisar quién atiende este tema</a> : null}
        </div> : null}
        {canManageTeam ? <a href={responsibleHref} className="inline-flex min-h-11 items-center gap-2 rounded-md font-medium text-primary underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"><Users2 size={18} aria-hidden="true" />Revisar quién atiende cada tema</a> : null}
        {unconfirmedCategory && !isDialogOpen ? <Button className="min-h-11" variant="outline" disabled={isSaving} onClick={()=>void verifyUnconfirmedCategory()}>Comprobar el tema enviado</Button> : null}

        {error && !isDialogOpen ? (
          <div role="alert" className="rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
            <p>{error}</p>
            <Button type="button" variant="outline" className="mt-3 min-h-11" onClick={() => void fetchCategories()} disabled={isSaving}>
              Reintentar
            </Button>
          </div>
        ) : null}

        <section aria-labelledby="resumen-temas" className="rounded-lg border border-border/70 bg-card p-5">
          <h2 id="resumen-temas" className="text-lg font-semibold text-foreground">Estado de la atención</h2>
          <dl className="mt-4 grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
            {overviewItems.map(({ label, value, helper }) => (
              <div key={label}>
                <dt className="text-sm font-medium text-muted-foreground">{label}</dt>
                <dd className="mt-1 text-2xl font-semibold text-foreground">{value}</dd>
                <p className="mt-1 text-sm text-muted-foreground">{helper}</p>
              </div>
            ))}
          </dl>
        </section>

        <section className="overflow-hidden rounded-lg border border-border/70 bg-card shadow-sm">
          <div className="border-b border-border/70 p-5">
            <div>
              <h2 className="text-xl font-semibold text-foreground">Temas disponibles</h2>
              <p className="text-sm text-muted-foreground">
                Revisá qué tema usa cada caso y si ya hay personas preparadas para atenderlo.
              </p>
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
                          <span className="text-sm font-medium text-amber-700 dark:text-amber-300">
                            {demand?.open_count ? 'Hay casos de este tema; falta agregarlo' : 'Falta agregarlo a la lista'}
                          </span>
                        ) : null}
                      </div>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {demand ? `${demand.open_count} casos abiertos · ${demand.unassigned_count} sin responsable` : assignedEmployees.length
                          ? `${assignedEmployees.length} persona${assignedEmployees.length === 1 ? ' tiene' : 's tienen'} este tema en su alcance.`
                          : 'No hay personas con este tema en su alcance publicado.'}
                      </p>
                    </div>
                    <div className="space-y-1 text-sm">
                      <p className="font-medium text-foreground">
                        {demand
                          ? demand.eligible_employee_count === null
                            ? 'Todavía no hay casos abiertos para comprobar quién puede atenderlos'
                            : demand.eligible_employee_count
                              ? `${demand.eligible_employee_count} persona${demand.eligible_employee_count === 1 ? '' : 's'} puede${demand.eligible_employee_count === 1 ? '' : 'n'} atender al menos un caso`
                              : 'Ninguna persona puede atender los casos abiertos de este tema'
                          : routing
                            ? assignedEmployees.length
                              ? `${assignedEmployees.length} persona${assignedEmployees.length === 1 ? '' : 's'} tiene${assignedEmployees.length === 1 ? '' : 'n'} este tema asignado`
                              : 'Ninguna persona tiene este tema asignado'
                            : 'No pudimos comprobar quién puede atender este tema'}
                      </p>
                      <p className="text-muted-foreground">{workload ? `${workload} casos abiertos asignados al equipo` : 'El equipo no tiene casos abiertos de este tema'}</p>
                    </div>
                    <div className="flex justify-start gap-2 lg:justify-end">
                      <Button className="min-h-11" variant="outline" size="sm" onClick={() => handleEdit(category)} disabled={isSaving || !catalogVerified || Boolean(unconfirmedCategory)} aria-label={`${canEdit ? 'Editar tema' : 'Revisar y agregar tema'}: ${category.nombre}`}>
                        <Edit aria-hidden="true" className="mr-2 h-4 w-4" />
                        {canEdit ? 'Editar' : 'Revisar y agregar tema'}
                      </Button>
                      {canEdit ? (
                        <Button className="min-h-11 min-w-11" variant="ghost" size="icon" onClick={() => handleDelete(category)} disabled={isSaving || !catalogVerified || Boolean(unconfirmedCategory)} aria-label={`Eliminar tema: ${category.nombre}`}>
                          <Trash2 aria-hidden="true" className="h-4 w-4 text-destructive" />
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
                <FolderTree aria-hidden="true" className="h-6 w-6" />
              </div>
              <div className="max-w-lg space-y-2">
                <h3 className="text-xl font-semibold text-foreground">Todavía no hay temas de atención</h3>
                <p className="text-sm text-muted-foreground">
                  Agregá el primer tema para ordenar los casos y definir quién puede atenderlos.
                </p>
              </div>
              <Button className="min-h-11" onClick={handleCreate} disabled={!catalogVerified || Boolean(unconfirmedCategory)}>
                <PlusCircle aria-hidden="true" className="mr-2 h-4 w-4" />
                Agregar el primer tema
              </Button>
            </div>
          )}
          <details className="group border-t border-border/70">
            <summary className="flex min-h-11 cursor-pointer list-none items-center px-5 py-3 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring [&::-webkit-details-marker]:hidden">
              Datos para soporte
            </summary>
            <div className="space-y-4 border-t border-border/70 p-5 text-sm text-muted-foreground">
              <p>{categorySourcesSummary}</p>
              {inventory ? (
                <p>
                  Los datos distinguen los temas guardados de los detectados en casos abiertos. La cantidad de personas disponibles indica quién puede atender al menos un caso del tema; no confirma que todos tengan responsable.
                </p>
              ) : (
                <p>No se pudo comprobar el origen de todos los temas ni la demanda abierta.</p>
              )}
              <Button className="min-h-11" variant="outline" onClick={fetchCategories} disabled={isSaving}>
                <RefreshCw aria-hidden="true" className="mr-2 h-4 w-4" />
                Actualizar información
              </Button>
            </div>
          </details>
        </section>

        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingCategory && editingCategory.source !== 'routing' ? 'Editar tema' : 'Agregar tema'}</DialogTitle>
              <DialogDescription>
                {editingCategory?.source === 'routing'
                  ? 'Este tema aparece en la información de atención, pero todavía no está guardado. Revisá el nombre antes de agregarlo. Después definí quién puede atenderlo desde Equipo.'
                  : 'El nombre se usa para clasificar casos. Después podés definir quién atiende el tema desde Equipo.'}
              </DialogDescription>
            </DialogHeader>
            {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
            {unconfirmedCategory ? <Button className="min-h-11" type="button" variant="outline" disabled={isSaving} onClick={()=>void verifyUnconfirmedCategory()}>Comprobar el tema</Button> : null}
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="category-name">Nombre</Label>
                <Input
                  id="category-name"
                  placeholder="Nombre claro del tema"
                  value={categoryName}
                  onChange={(event) => { setCategoryName(event.target.value); if (!editingCategory || editingCategory.source === 'routing') setCreateDraft(event.target.value); }}
                  autoFocus
                />
              </div>
              <DialogFooter>
                <Button className="min-h-11" type="button" variant="outline" onClick={() => setIsDialogOpen(false)} disabled={isSaving}>
                  Cancelar
                </Button>
                <Button className="min-h-11" type="submit" disabled={isSaving || !catalogVerified || Boolean(unconfirmedCategory) || !categoryName.trim()}>
                  {isSaving ? <Loader2 aria-hidden="true" className="mr-2 h-4 w-4 animate-spin" /> : null}
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
