import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { apiFetch, ApiError, resolveTenantSlug } from '@/utils/api';
import { getEmployeeRoutingV2, type EmployeeRoutingEmployee, type EmployeeRoutingV2 } from '@/api/v2/saas';
import { useUser } from '@/hooks/useUser';
import useRequireRole from '@/hooks/useRequireRole';
import type { Role } from '@/utils/roles';
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

const buildVisibleCategories = (categories: Category[], routing: EmployeeRoutingV2 | null) => {
  const persisted = categories.map((category) => ({ ...category, source: 'catalog' as const }));
  const existingKeys = new Set(persisted.flatMap((category) => [category.nombre, category.slug].filter(Boolean).map((item) => normalizeKey(String(item)))));
  const routingOnly = getRoutingCategoryNames(routing)
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
  const tenantSlug = useMemo(
    () => resolveTenantSlug(user?.tenantSlug || (user as { tenant_slug?: string } | null)?.tenant_slug),
    [user],
  );

  const [categories, setCategories] = useState<Category[]>([]);
  const [routing, setRouting] = useState<EmployeeRoutingV2 | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [categoryName, setCategoryName] = useState('');

  const fetchCategories = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [categoryPayload, routingPayload] = await Promise.all([
        apiFetch<unknown>(CATEGORY_API_BASE, { sendEntityToken: true, tenantSlug }),
        getEmployeeRoutingV2(tenantSlug).catch(() => null),
      ]);
      setCategories(normalizeCategories(categoryPayload));
      setRouting(routingPayload);
    } catch (err) {
      const message =
        err instanceof ApiError && err.status === 403
          ? 'Tu cuenta puede ver el panel, pero todavia no tiene permiso para administrar categorias.'
          : 'No pudimos cargar las categorias. Reintenta o solicita al equipo que revise el modulo.';
      setError(message);
      setRouting(await getEmployeeRoutingV2(tenantSlug).catch(() => null));
    } finally {
      setIsLoading(false);
    }
  }, [tenantSlug]);

  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  const visibleCategories = useMemo(() => buildVisibleCategories(categories, routing), [categories, routing]);

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
    setCategoryName('');
    setIsDialogOpen(true);
  };

  const handleEdit = (category: Category) => {
    setEditingCategory(category);
    setCategoryName(category.nombre);
    setIsDialogOpen(true);
  };

  const handleDelete = async (category: Category) => {
    if (!category.id || category.source === 'routing') return;
    if (!window.confirm('Esta categoria dejara de estar disponible para nuevos reclamos. Queres eliminarla?')) {
      return;
    }
    setIsSaving(true);
    setError(null);
    try {
      await apiFetch(`${CATEGORY_API_BASE}/${encodeURIComponent(String(category.id))}`, {
        method: 'DELETE',
        sendEntityToken: true,
        tenantSlug,
      });
      await fetchCategories();
    } catch {
      setError('No pudimos eliminar la categoria. Revisa si tiene tickets o reglas asociadas.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    const nombre = categoryName.trim();
    if (!nombre) return;

    const url =
      editingCategory?.id && editingCategory.source !== 'routing'
        ? `${CATEGORY_API_BASE}/${encodeURIComponent(String(editingCategory.id))}`
        : CATEGORY_API_BASE;
    const method = editingCategory?.id && editingCategory.source !== 'routing' ? 'PUT' : 'POST';

    setIsSaving(true);
    setError(null);
    try {
      await apiFetch(url, {
        method,
        body: { nombre },
        sendEntityToken: true,
        tenantSlug,
      });
      setIsDialogOpen(false);
      await fetchCategories();
    } catch {
      setError('No pudimos guardar la categoria. Revisa el nombre y vuelve a intentar.');
    } finally {
      setIsSaving(false);
    }
  };

  const operationCards = [
    {
      label: 'Categorias activas',
      value: visibleCategories.length,
      helper: 'Temas disponibles para clasificar tickets.',
      icon: FolderTree,
    },
    {
      label: 'Categorias con equipo',
      value: routedCategories,
      helper: 'Ya tienen personas asignadas desde ruteo.',
      icon: Route,
    },
    {
      label: 'Personas cubiertas',
      value: employeesWithCoverage,
      helper: 'Empleados con categorias de atencion.',
      icon: Users2,
    },
    {
      label: 'Sin asignar',
      value: routing?.queues.unassigned_count ?? 0,
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
            <Button onClick={handleCreate} disabled={isSaving}>
              <PlusCircle className="mr-2 h-4 w-4" />
              Crear categoria
            </Button>
          </div>
        </section>

        {error ? (
          <div className="rounded-2xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
            {error}
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
              <h2 className="text-xl font-semibold text-foreground">Categorias de atencion</h2>
              <p className="text-sm text-muted-foreground">
                Usa esta lista para mantener claro que atiende cada equipo.
              </p>
            </div>
            <Badge variant="secondary" className="w-fit rounded-full">
              {visibleCategories.length} configuradas
            </Badge>
          </div>

          {visibleCategories.length ? (
            <div className="divide-y divide-border/70">
              {visibleCategories.map((category) => {
                const assignedEmployees = assignedByCategory.get(category.nombre) ?? [];
                const workload = assignedEmployees.reduce((total, employee) => total + (employee.workload_open ?? 0), 0);
                const canEdit = category.source !== 'routing';
                return (
                  <div key={`${category.source}-${category.id ?? category.nombre}`} className="grid gap-4 p-5 lg:grid-cols-[1.2fr_1fr_auto] lg:items-center">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-lg font-semibold text-foreground">{category.nombre}</h3>
                        {category.source === 'routing' ? (
                          <Badge variant="outline" className="rounded-full">
                            detectada por ruteo
                          </Badge>
                        ) : null}
                      </div>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {assignedEmployees.length
                          ? `${assignedEmployees.length} integrante${assignedEmployees.length === 1 ? '' : 's'} atienden esta categoria.`
                          : 'Todavia no tiene un equipo asignado.'}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Badge variant={assignedEmployees.length ? 'secondary' : 'outline'} className="rounded-full">
                        {assignedEmployees.length ? 'Con cobertura' : 'Sin cobertura'}
                      </Badge>
                      <Badge variant="outline" className="rounded-full">
                        {workload} abiertos
                      </Badge>
                    </div>
                    <div className="flex justify-start gap-2 lg:justify-end">
                      <Button variant="outline" size="sm" onClick={() => handleEdit(category)} disabled={isSaving}>
                        <Edit className="mr-2 h-4 w-4" />
                        {canEdit ? 'Editar' : 'Crear regla'}
                      </Button>
                      {canEdit ? (
                        <Button variant="ghost" size="icon" onClick={() => handleDelete(category)} disabled={isSaving}>
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
              <Button onClick={handleCreate}>
                <PlusCircle className="mr-2 h-4 w-4" />
                Crear primera categoria
              </Button>
            </div>
          )}
        </section>

        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingCategory ? 'Editar categoria' : 'Crear categoria'}</DialogTitle>
              <DialogDescription>
                El nombre se usa para clasificar tickets y conectar el tema con el equipo correspondiente.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="category-name">Nombre</Label>
                <Input
                  id="category-name"
                  placeholder="Ejemplo: Alumbrado, Reclamos comerciales, Admisiones"
                  value={categoryName}
                  onChange={(event) => setCategoryName(event.target.value)}
                  autoFocus
                />
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)} disabled={isSaving}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={isSaving || !categoryName.trim()}>
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
