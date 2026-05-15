import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { apiFetch, ApiError, getErrorMessage, resolveTenantSlug } from '@/utils/api';
import {
  getEmployeeCoverageV2,
  getEmployeeRoutingV2,
  patchEmployeeRoutingScopeV2,
  type CoverageBucket,
  type EmployeeCoverageV2,
  type EmployeeRoutingV2,
} from '@/api/v2/saas';
import EmployeeRoutingMatrix from '@/components/admin/EmployeeRoutingMatrix';
import useRequireRole from '@/hooks/useRequireRole';
import { useUser } from '@/hooks/useUser';
import type { Role } from '@/utils/roles';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from '@/components/ui/accordion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import {
  AlertTriangle,
  KeyRound,
  Layers3,
  MapPinned,
  PencilLine,
  Sparkles,
  UserPlus,
  Users2,
} from 'lucide-react';

const EMPLOYEES_API_BASE = '/api/empleados';

type CategoryId = string;
type AnyRecord = Record<string, unknown>;

type Category = {
  id: CategoryId;
  slug: string;
  nombre: string;
  tipo?: string;
};

type EmployeeScope = {
  categorias: string[];
  zonas: string[];
  channels: string[];
  permisos: string[];
};

interface InternalUser {
  id: string | number;
  nombre: string;
  email: string;
  rol?: string | null;
  categorias?: Category[] | null;
  roles?: string[];
  scope?: EmployeeScope | null;
  raw?: unknown;
}

interface EmployeesResponse {
  employees?: unknown[];
  ticket_categories?: unknown[];
  categorias?: unknown[];
  categories?: unknown[];
  items?: unknown[];
}

const isValidEmail = (value: string) => /.+@.+\..+/.test(value.trim());

const isRecord = (value: unknown): value is AnyRecord =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value);

const asString = (value: unknown): string | undefined => {
  if (typeof value === 'string' && value.trim()) return value.trim();
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return undefined;
};

const first = (record: AnyRecord | undefined | null, keys: string[]) => {
  if (!record) return undefined;
  for (const key of keys) {
    const value = record[key];
    if (value !== undefined && value !== null) return value;
  }
  return undefined;
};

const normalizeStringList = (value: unknown): string[] => {
  if (Array.isArray(value)) {
    return value
      .flatMap((item) => normalizeStringList(item))
      .map((item) => item.trim())
      .filter(Boolean);
  }
  if (typeof value === 'string') {
    return value
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);
  }
  if (typeof value === 'number' && Number.isFinite(value)) return [String(value)];
  if (isRecord(value)) {
    const candidate = asString(first(value, ['value', 'key', 'id', 'slug', 'label', 'name', 'nombre']));
    return candidate ? [candidate] : [];
  }
  return [];
};

const unique = (items: string[]) => Array.from(new Set(items.map((item) => item.trim()).filter(Boolean)));

const normalizeScope = (value: unknown): EmployeeScope => {
  const record = isRecord(value) ? value : {};
  return {
    categorias: unique(normalizeStringList(first(record, ['categorias', 'categories']))),
    zonas: unique(normalizeStringList(first(record, ['zonas', 'zones']))),
    channels: unique(normalizeStringList(first(record, ['channels', 'canales']))),
    permisos: unique(normalizeStringList(first(record, ['permisos', 'permissions']))),
  };
};

const normalizeCategory = (value: unknown, index = 0): Category | null => {
  if (typeof value === 'string' && value.trim()) {
    const slug = value.trim();
    return { id: slug, slug, nombre: slug };
  }
  if (!isRecord(value)) return null;
  const slug =
    asString(first(value, ['value', 'slug', 'key', 'id', 'codigo', 'code'])) ??
    asString(first(value, ['nombre', 'label', 'name', 'title']));
  const nombre =
    asString(first(value, ['label', 'nombre', 'name', 'title'])) ??
    slug ??
    `categoria_${index + 1}`;
  const id = asString(first(value, ['id', 'value', 'slug', 'key'])) ?? slug ?? nombre;
  return {
    id,
    slug: slug ?? id,
    nombre,
    tipo: asString(value.tipo),
  };
};

const normalizeCategoryList = (value: unknown): Category[] => {
  if (!value) return [];
  const source = Array.isArray(value)
    ? value
    : isRecord(value)
      ? first(value, ['categorias', 'categories', 'ticket_categories', 'items'])
      : [];
  return (Array.isArray(source) ? source : [])
    .map(normalizeCategory)
    .filter((item): item is Category => Boolean(item));
};

const coverageBucketToCategory = (bucket: CoverageBucket): Category => ({
  id: bucket.id || bucket.label,
  slug: bucket.id || bucket.label,
  nombre: bucket.label || bucket.id,
});

const mergeCategories = (...groups: Category[][]): Category[] => {
  const map = new Map<string, Category>();
  groups.flat().forEach((category) => {
    const key = (category.slug || category.id || category.nombre).toLowerCase();
    if (!map.has(key)) map.set(key, category);
  });
  return Array.from(map.values());
};

const normalizeInternalUser = (value: unknown, index = 0): InternalUser | null => {
  if (!isRecord(value)) return null;
  const accesibilidad = isRecord(value.accesibilidad) ? value.accesibilidad : {};
  const rawScope = first(value, ['scope', 'employee_scope']) ?? first(accesibilidad, ['employee_scope', 'scope']);
  const id = first(value, ['id', 'user_id', 'employee_id']) as string | number | undefined;
  const nombre = asString(first(value, ['nombre', 'name', 'display_name'])) ?? asString(value.email) ?? `empleado_${index + 1}`;
  return {
    id: id ?? nombre,
    nombre,
    email: asString(value.email) ?? '',
    rol: asString(first(value, ['rol', 'role'])),
    roles: unique(normalizeStringList(value.roles)),
    categorias: normalizeCategoryList(first(value, ['categorias', 'categories', 'ticket_categories'])),
    scope: normalizeScope(rawScope),
    raw: value,
  };
};

const extractEmployees = (response: unknown): InternalUser[] => {
  const source = Array.isArray(response)
    ? response
    : isRecord(response)
      ? first(response, ['employees', 'items', 'users', 'data'])
      : [];
  return (Array.isArray(source) ? source : [])
    .map(normalizeInternalUser)
    .filter((item): item is InternalUser => Boolean(item));
};

const getBackendErrorText = (error: unknown): string | null => {
  if (error instanceof ApiError) {
    const body = error.body;
    if (typeof body === 'string' && body.trim()) return body.trim();
    if (body && typeof body === 'object') {
      const messageCandidates = [
        (body as AnyRecord).message,
        (body as AnyRecord).error,
        (body as AnyRecord).detail,
      ];
      for (const candidate of messageCandidates) {
        if (typeof candidate === 'string' && candidate.trim()) return candidate.trim();
      }
    }
  }
  return null;
};

const selectedCategorySlugs = (ids: CategoryId[], categories: Category[]) =>
  ids
    .map((id) => categories.find((cat) => cat.id === id || cat.slug === id))
    .filter((cat): cat is Category => Boolean(cat))
    .map((cat) => cat.slug || cat.nombre)
    .filter(Boolean);

const bucketsToValues = (items: CoverageBucket[]) => unique(items.map((item) => item.id || item.label));

const dimensionValues = (routing: EmployeeRoutingV2 | null, keys: string[]) => {
  const dimensions = routing?.dimensions ?? {};
  return unique(keys.flatMap((key) => normalizeStringList(dimensions[key])));
};

const employeeScopeValues = (employees: InternalUser[], key: keyof EmployeeScope) =>
  unique(employees.flatMap((employee) => employee.scope?.[key] ?? []));

const isUncovered = (bucket: CoverageBucket, noEmployees: boolean) => {
  const status = (bucket.status || '').toLowerCase();
  return noEmployees || bucket.count === 0 || status.includes('uncovered') || status.includes('missing') || status.includes('sin');
};

const toggleValue = (
  value: string,
  current: string[],
  setList: React.Dispatch<React.SetStateAction<string[]>>,
  options: { keepOne?: boolean } = {},
) => {
  if (current.includes(value)) {
    if (options.keepOne && current.length <= 1) return;
    setList(current.filter((item) => item !== value));
  } else {
    setList([...current, value]);
  }
};

const TeamStatCard = ({
  label,
  value,
  helper,
  icon: Icon,
}: {
  label: string;
  value: string;
  helper: string;
  icon: React.ElementType;
}) => (
  <Card className="overflow-hidden border-border/60 bg-background/80 shadow-sm">
    <CardContent className="relative p-4">
      <div className="absolute -right-6 top-1 h-20 w-20 rounded-full bg-primary/5 blur-2xl" />
      <div className="relative">
        <div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/10 text-primary ring-1 ring-primary/15">
          <Icon className="h-4 w-4" />
        </div>
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">{label}</p>
        <p className="mt-2 text-2xl font-bold tracking-tight text-foreground">{value}</p>
        <p className="mt-1 text-xs text-muted-foreground">{helper}</p>
      </div>
    </CardContent>
  </Card>
);

const CoverageColumn = ({
  title,
  items,
  emptyLabel,
}: {
  title: string;
  items: CoverageBucket[];
  emptyLabel: string;
}) => (
  <div className="rounded-2xl border border-border/60 bg-background/70 p-4 shadow-sm">
    <div className="mb-3 flex items-center justify-between">
      <p className="text-sm font-semibold text-foreground">{title}</p>
      <Badge variant="outline" className="rounded-full px-2.5 py-0.5 text-xs">
        {items.length}
      </Badge>
    </div>
    <div className="space-y-2">
      {items.slice(0, 7).map((item, index) => (
        <div key={`${title}-${item.id || index}`} className="flex items-center justify-between rounded-xl border border-border/60 bg-muted/20 px-3 py-2 text-sm">
          <span className="truncate pr-3">{item.label || `${emptyLabel}_${index + 1}`}</span>
          <Badge variant={item.count ? 'secondary' : 'outline'}>{item.count ? `${item.count}` : 'sin responsable'}</Badge>
        </div>
      ))}
      {!items.length ? <p className="text-sm text-muted-foreground">Sin datos publicados por backend.</p> : null}
    </div>
  </div>
);

const OptionGroup = ({
  label,
  options,
  selected,
  onToggle,
  empty,
  keepOne,
}: {
  label: string;
  options: Array<{ value: string; label: string }>;
  selected: string[];
  onToggle: (value: string) => void;
  empty: string;
  keepOne?: boolean;
}) => (
  <div className="space-y-2">
    <label className="text-sm font-medium">{label}</label>
    <div className="flex min-h-11 flex-wrap gap-2 rounded-xl border border-border/70 bg-background p-2">
      {options.map((option) => {
        const active = selected.includes(option.value);
        return (
          <button
            key={option.value}
            type="button"
            onClick={() => {
              if (active && keepOne && selected.length <= 1) return;
              onToggle(option.value);
            }}
            className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
              active
                ? 'border-primary bg-primary text-primary-foreground shadow-sm'
                : 'border-border bg-muted/30 text-foreground hover:border-primary/50'
            }`}
          >
            {option.label}
          </button>
        );
      })}
      {!options.length ? <p className="px-1 py-1 text-xs text-muted-foreground">{empty}</p> : null}
    </div>
  </div>
);

const ScopeBadges = ({ employee }: { employee: InternalUser }) => {
  const scope = employee.scope ?? normalizeScope(null);
  const entries = [
    ...scope.categorias.map((item) => ({ key: `cat-${item}`, label: item, variant: 'secondary' as const })),
    ...scope.zonas.map((item) => ({ key: `zona-${item}`, label: item, variant: 'outline' as const })),
    ...scope.channels.map((item) => ({ key: `channel-${item}`, label: item, variant: 'outline' as const })),
    ...scope.permisos.map((item) => ({ key: `permiso-${item}`, label: item, variant: 'outline' as const })),
  ];
  if (!entries.length) return <span className="text-xs italic text-muted-foreground">Sin alcance configurado</span>;
  return (
    <div className="flex flex-wrap gap-1">
      {entries.map((item) => (
        <Badge key={`${employee.id}-${item.key}`} variant={item.variant}>
          {item.label}
        </Badge>
      ))}
    </div>
  );
};

export default function InternalUsers() {
  useRequireRole(['admin', 'super_admin', 'tenant_admin'] as Role[]);
  const { user } = useUser();
  const [employees, setEmployees] = useState<InternalUser[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [coverage, setCoverage] = useState<EmployeeCoverageV2 | null>(null);
  const [routing, setRouting] = useState<EmployeeRoutingV2 | null>(null);
  const [lastCreatedEmployee, setLastCreatedEmployee] = useState<InternalUser | null>(null);

  const [nombre, setNombre] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [roles, setRoles] = useState<string[]>(['empleado']);
  const [categoriaIds, setCategoriaIds] = useState<CategoryId[]>([]);
  const [selectedZonas, setSelectedZonas] = useState<string[]>([]);
  const [selectedChannels, setSelectedChannels] = useState<string[]>([]);
  const [selectedPermisos, setSelectedPermisos] = useState<string[]>([]);

  const [editingUser, setEditingUser] = useState<InternalUser | null>(null);
  const [editNombre, setEditNombre] = useState('');
  const [editPassword, setEditPassword] = useState('');
  const [editRoles, setEditRoles] = useState<string[]>(['empleado']);
  const [editCategoriaIds, setEditCategoriaIds] = useState<CategoryId[]>([]);
  const [editZonas, setEditZonas] = useState<string[]>([]);
  const [editChannels, setEditChannels] = useState<string[]>([]);
  const [editPermisos, setEditPermisos] = useState<string[]>([]);

  const tenantSlug = useMemo(
    () => resolveTenantSlug(user?.tenantSlug || (user as AnyRecord | undefined)?.tenant_slug),
    [user],
  );

  const fetchData = useCallback(async () => {
    if (!tenantSlug) return;
    setLoading(true);
    setError(null);
    try {
      const employeesData = await apiFetch<InternalUser[] | EmployeesResponse>(EMPLOYEES_API_BASE, { tenantSlug });
      const list = extractEmployees(employeesData);

      let cats = normalizeCategoryList(employeesData);
      if (cats.length === 0) {
        const categoriesData = await apiFetch<unknown>(`${EMPLOYEES_API_BASE}/categorias`, { tenantSlug }).catch(() => null);
        cats = normalizeCategoryList(categoriesData);
      }

      const [coverageData, routingData] = await Promise.all([
        getEmployeeCoverageV2(tenantSlug).catch(() => null),
        getEmployeeRoutingV2(tenantSlug).catch(() => null),
      ]);

      if (coverageData) {
        cats = mergeCategories(cats, coverageData.categories.map(coverageBucketToCategory));
      }

      setEmployees(list);
      setCategories(cats);
      setCoverage(coverageData);
      setRouting(routingData);
    } catch (err: unknown) {
      console.error(err);
      setError(getErrorMessage(err, 'Error al cargar empleados o categorias.'));
    } finally {
      setLoading(false);
    }
  }, [tenantSlug]);

  useEffect(() => {
    if (tenantSlug) {
      void fetchData();
    } else {
      setLoading(false);
      setError('No se pudo identificar el tenant.');
    }
  }, [tenantSlug, fetchData]);

  const roleOptions = useMemo(() => {
    const backendRoles = unique(employees.flatMap((employee) => [...(employee.roles ?? []), employee.rol ?? '']));
    return unique(['empleado', ...backendRoles]).map((role) => ({ value: role, label: role }));
  }, [employees]);

  const zoneOptions = useMemo(() => {
    const values = unique([
      ...dimensionValues(routing, ['zonas', 'zones']),
      ...bucketsToValues(coverage?.zones ?? []),
      ...employeeScopeValues(employees, 'zonas'),
    ]);
    return values.map((value) => ({ value, label: value }));
  }, [coverage?.zones, employees, routing]);

  const channelOptions = useMemo(() => {
    const values = unique([
      ...dimensionValues(routing, ['channels', 'canales', 'channel', 'canal']),
      ...bucketsToValues(coverage?.channels ?? []),
      ...employeeScopeValues(employees, 'channels'),
    ]);
    return values.map((value) => ({ value, label: value }));
  }, [coverage?.channels, employees, routing]);

  const permisoOptions = useMemo(() => {
    const values = unique([
      ...dimensionValues(routing, ['permisos', 'permissions']),
      ...bucketsToValues(coverage?.permisos ?? []),
      ...employeeScopeValues(employees, 'permisos'),
    ]);
    return values.map((value) => ({ value, label: value }));
  }, [coverage?.permisos, employees, routing]);

  const categoryOptions = useMemo(
    () => categories.map((cat) => ({ value: cat.id, label: cat.nombre })),
    [categories],
  );

  const coverageCategories = coverage?.categories || [];
  const coverageZones = coverage?.zones || [];
  const coverageChannels = coverage?.channels || [];
  const uncoveredCategories = coverageCategories.filter((item) => isUncovered(item, employees.length === 0));
  const routingEmployeesById = useMemo(() => {
    const map = new Map<string, number | undefined>();
    (routing?.employees ?? []).forEach((employee) => {
      map.set(String(employee.id), employee.workload_open);
      const email = asString(employee.raw.email);
      if (email) map.set(email.toLowerCase(), employee.workload_open);
    });
    return map;
  }, [routing?.employees]);
  const unassignedCount = routing?.queues.unassigned_count ?? 0;

  const resetCreateForm = () => {
    setNombre('');
    setEmail('');
    setPassword('');
    setRoles(['empleado']);
    setCategoriaIds([]);
    setSelectedZonas([]);
    setSelectedChannels([]);
    setSelectedPermisos([]);
  };

  const handleCreate = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!nombre.trim() || !email.trim() || !password.trim()) return;
    if (!isValidEmail(email)) {
      toast.error('Email invalido.');
      return;
    }
    if (!tenantSlug) return;

    try {
      const selectedCategories = selectedCategorySlugs(categoriaIds, categories);
      const selectedRoles = roles.map((role) => role.trim()).filter(Boolean);
      const scope = {
        categorias: selectedCategories,
        zonas: selectedZonas,
        channels: selectedChannels,
        permisos: selectedPermisos,
      };

      const payload = {
        name: nombre.trim(),
        email: email.trim(),
        password,
        roles: selectedRoles,
        categorias: selectedCategories,
        scope,
      };

      const createdResponse = await apiFetch<unknown>(EMPLOYEES_API_BASE, {
        method: 'POST',
        tenantSlug,
        body: payload,
      });

      const createdEmployee =
        normalizeInternalUser(
          isRecord(createdResponse)
            ? first(createdResponse, ['employee', 'created_employee', 'item', 'data']) ?? createdResponse
            : createdResponse,
        ) ?? null;

      setLastCreatedEmployee(createdEmployee);
      toast.success('Empleado creado correctamente.');
      await fetchData();
      resetCreateForm();
    } catch (err: unknown) {
      const backendMessage = getBackendErrorText(err);
      toast.error(backendMessage || getErrorMessage(err, 'Error al crear empleado.'));
    }
  };

  const startEdit = (employee: InternalUser) => {
    const scope = employee.scope ?? normalizeScope(null);
    const employeeCategoryIds = mergeCategories(employee.categorias ?? [], scope.categorias.map((item) => ({ id: item, slug: item, nombre: item })))
      .map((category) => categories.find((item) => item.slug === category.slug || item.nombre === category.nombre)?.id ?? category.id);
    setEditingUser(employee);
    setEditNombre(employee.nombre);
    setEditPassword('');
    setEditRoles(employee.roles?.length ? employee.roles : employee.rol ? [employee.rol] : ['empleado']);
    setEditCategoriaIds(unique(employeeCategoryIds));
    setEditZonas(scope.zonas);
    setEditChannels(scope.channels);
    setEditPermisos(scope.permisos);
  };

  const cancelEdit = () => {
    setEditingUser(null);
  };

  const handleUpdate = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!editingUser || !tenantSlug) return;

    try {
      const selectedCategories = selectedCategorySlugs(editCategoriaIds, categories);
      const selectedRoles = editRoles.map((role) => role.trim()).filter(Boolean);
      const scope = {
        categorias: selectedCategories,
        zonas: editZonas,
        channels: editChannels,
        permisos: editPermisos,
      };

      const payload: {
        name: string;
        roles: string[];
        categorias: string[];
        scope: EmployeeScope;
        password?: string;
      } = {
        name: editNombre.trim(),
        roles: selectedRoles,
        categorias: selectedCategories,
        scope,
      };
      if (editPassword) payload.password = editPassword;

      await apiFetch(`${EMPLOYEES_API_BASE}/${editingUser.id}`, {
        method: 'PUT',
        tenantSlug,
        body: payload,
      });
      await patchEmployeeRoutingScopeV2(editingUser.id, scope, tenantSlug);

      toast.success('Empleado actualizado.');
      setEditingUser(null);
      await fetchData();
    } catch (err: unknown) {
      const backendMessage = getBackendErrorText(err);
      toast.error(backendMessage || getErrorMessage(err, 'Error al actualizar empleado.'));
    }
  };

  if (loading) return <div className="p-4">Cargando...</div>;
  if (error) return <div className="p-4 text-destructive">{error}</div>;

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 pb-8">
      <div className="relative overflow-hidden rounded-[28px] border border-border/60 bg-gradient-to-br from-background via-primary/5 to-sky-500/10 p-6 shadow-sm">
        <div className="absolute -right-10 top-0 h-40 w-40 rounded-full bg-primary/10 blur-3xl" />
        <div className="absolute bottom-0 left-0 h-32 w-32 rounded-full bg-sky-500/10 blur-3xl" />
        <div className="relative space-y-5">
          <Badge variant="outline" className="w-fit border-primary/20 bg-background/80 px-3 py-1 text-primary">
            <Sparkles className="mr-2 h-3.5 w-3.5" />
            Team control center
          </Badge>
          <div>
            <h2 className="text-3xl font-black tracking-tight text-foreground">Gestion de empleados</h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
              Crea equipo operativo y limita su alcance por categorias, zonas, channels y permisos publicados por backend.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge variant="outline" className="rounded-full px-3 py-1">{employees.length} empleados</Badge>
            <Badge variant="outline" className="rounded-full px-3 py-1">{categories.length} categorias</Badge>
            <Badge variant="outline" className="rounded-full px-3 py-1">{uncoveredCategories.length} categorias sin responsable</Badge>
            <Badge variant="outline" className="rounded-full px-3 py-1">{unassignedCount} tickets sin asignar</Badge>
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <TeamStatCard label="Equipo" value={employees.length.toLocaleString('es-AR')} helper="Usuarios internos activos" icon={Users2} />
        <TeamStatCard label="Categorias" value={categories.length.toLocaleString('es-AR')} helper="Selector backend-first para alcance" icon={Layers3} />
        <TeamStatCard label="Zonas" value={coverageZones.length.toLocaleString('es-AR')} helper="Cobertura geografica publicada" icon={MapPinned} />
        <TeamStatCard label="Channels" value={coverageChannels.length.toLocaleString('es-AR')} helper="Canales operativos publicados" icon={KeyRound} />
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
        <Card className="overflow-hidden border-border/60 bg-background/85 shadow-sm">
          <CardHeader className="border-b border-border/50 bg-gradient-to-r from-emerald-500/5 via-primary/5 to-transparent">
            <CardTitle>Cobertura operativa</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 pt-6 md:grid-cols-3">
            <CoverageColumn title="Categorias" items={coverageCategories} emptyLabel="categoria" />
            <CoverageColumn title="Zonas" items={coverageZones} emptyLabel="zona" />
            <CoverageColumn title="Channels" items={coverageChannels} emptyLabel="channel" />
          </CardContent>
        </Card>

        <Card className="border-border/60 shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <AlertTriangle className="h-4 w-4 text-amber-500" />
              Categorias sin responsable
            </CardTitle>
          </CardHeader>
          <CardContent>
            {uncoveredCategories.length ? (
              <div className="flex flex-wrap gap-2">
                {uncoveredCategories.map((item) => (
                  <Badge key={item.id || item.label} variant="outline" className="rounded-full px-3 py-1">
                    {item.label || item.id}
                  </Badge>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No hay categorias sin responsable publicadas por backend.</p>
            )}
          </CardContent>
        </Card>
      </div>

      {lastCreatedEmployee ? (
        <Card className="border-border/60 shadow-sm">
          <CardHeader>
            <CardTitle>Ultimo empleado creado</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <p className="font-medium">{lastCreatedEmployee.nombre}</p>
              <p className="text-sm text-muted-foreground">{lastCreatedEmployee.email}</p>
            </div>
            <ScopeBadges employee={lastCreatedEmployee} />
          </CardContent>
        </Card>
      ) : null}

      <Accordion type="single" collapsible className="w-full" defaultValue="new-employee">
        <AccordionItem value="new-employee">
          <AccordionTrigger className="rounded-2xl px-4 py-3 text-left hover:no-underline">
            <span className="flex items-center gap-2">
              <UserPlus className="h-4 w-4 text-primary" />
              Registrar nuevo empleado
            </span>
          </AccordionTrigger>
          <AccordionContent>
            <form onSubmit={handleCreate} className="space-y-5 rounded-2xl border border-border/60 bg-card p-4 shadow-sm">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Nombre</label>
                  <Input value={nombre} onChange={(event) => setNombre(event.target.value)} placeholder="Mesa de entrada" required />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Email</label>
                  <Input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="equipo@tenant.gob.ar" required />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Contrasena temporal</label>
                  <Input type="password" value={password} onChange={(event) => setPassword(event.target.value)} required />
                </div>
              </div>

              <OptionGroup
                label="Roles"
                options={roleOptions}
                selected={roles}
                keepOne
                onToggle={(value) => toggleValue(value, roles, setRoles, { keepOne: true })}
                empty="Backend no publico roles adicionales."
              />
              <OptionGroup
                label="Categorias de tickets"
                options={categoryOptions}
                selected={categoriaIds}
                onToggle={(value) => toggleValue(value, categoriaIds, setCategoriaIds)}
                empty="No hay categorias publicadas por backend. Se consulta employee-coverage antes de ocultar este selector."
              />
              <div className="grid gap-4 lg:grid-cols-3">
                <OptionGroup
                  label="Zonas"
                  options={zoneOptions}
                  selected={selectedZonas}
                  onToggle={(value) => toggleValue(value, selectedZonas, setSelectedZonas)}
                  empty="Sin zonas publicadas."
                />
                <OptionGroup
                  label="Channels"
                  options={channelOptions}
                  selected={selectedChannels}
                  onToggle={(value) => toggleValue(value, selectedChannels, setSelectedChannels)}
                  empty="Sin channels publicados."
                />
                <OptionGroup
                  label="Permisos"
                  options={permisoOptions}
                  selected={selectedPermisos}
                  onToggle={(value) => toggleValue(value, selectedPermisos, setSelectedPermisos)}
                  empty="Sin permisos publicados."
                />
              </div>

              <Button type="submit" className="w-full gap-2 rounded-xl sm:w-auto">
                <UserPlus className="h-4 w-4" />
                Crear empleado
              </Button>
            </form>
          </AccordionContent>
        </AccordionItem>
      </Accordion>

      {editingUser ? (
        <div className="rounded-2xl border border-border/60 bg-card p-4 text-card-foreground shadow-sm">
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <h3 className="flex items-center gap-2 text-lg font-semibold">
              <PencilLine className="h-4 w-4 text-primary" />
              Editar empleado: {editingUser.nombre}
            </h3>
            <Button variant="ghost" onClick={cancelEdit} className="w-full sm:w-auto">Cancelar</Button>
          </div>
          <form onSubmit={handleUpdate} className="space-y-5">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <label className="text-sm font-medium">Nombre</label>
                <Input value={editNombre} onChange={(event) => setEditNombre(event.target.value)} required />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Nueva contrasena</label>
                <Input type="password" value={editPassword} onChange={(event) => setEditPassword(event.target.value)} placeholder="Dejar vacio para no cambiar" />
              </div>
            </div>

            <OptionGroup label="Roles" options={roleOptions} selected={editRoles} keepOne onToggle={(value) => toggleValue(value, editRoles, setEditRoles, { keepOne: true })} empty="Backend no publico roles adicionales." />
            <OptionGroup label="Categorias" options={categoryOptions} selected={editCategoriaIds} onToggle={(value) => toggleValue(value, editCategoriaIds, setEditCategoriaIds)} empty="Sin categorias publicadas." />
            <div className="grid gap-4 lg:grid-cols-3">
              <OptionGroup label="Zonas" options={zoneOptions} selected={editZonas} onToggle={(value) => toggleValue(value, editZonas, setEditZonas)} empty="Sin zonas publicadas." />
              <OptionGroup label="Channels" options={channelOptions} selected={editChannels} onToggle={(value) => toggleValue(value, editChannels, setEditChannels)} empty="Sin channels publicados." />
              <OptionGroup label="Permisos" options={permisoOptions} selected={editPermisos} onToggle={(value) => toggleValue(value, editPermisos, setEditPermisos)} empty="Sin permisos publicados." />
            </div>
            <Button type="submit" className="w-full gap-2 rounded-xl sm:w-auto">
              <Sparkles className="h-4 w-4" />
              Actualizar alcance
            </Button>
          </form>
        </div>
      ) : null}

      <div className="overflow-hidden rounded-[28px] border border-border/60 bg-card shadow-sm">
        <div className="border-b border-border/50 bg-gradient-to-r from-primary/5 via-sky-500/5 to-violet-500/5 px-5 py-4">
          <h3 className="text-base font-semibold tracking-tight text-foreground">Directorio interno</h3>
          <p className="mt-1 text-sm text-muted-foreground">Roles, alcance operativo y carga abierta por empleado.</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px] text-left text-sm">
            <thead className="bg-muted/60 text-muted-foreground">
              <tr>
                <th className="p-3 font-medium">Nombre</th>
                <th className="p-3 font-medium">Email</th>
                <th className="p-3 font-medium">Roles</th>
                <th className="p-3 font-medium">Alcance</th>
                <th className="p-3 font-medium">Tickets abiertos</th>
                <th className="p-3 text-right font-medium">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {employees.map((employee) => {
                const workload =
                  routingEmployeesById.get(String(employee.id)) ??
                  routingEmployeesById.get(employee.email.toLowerCase());
                const rolesToShow = unique([...(employee.roles ?? []), employee.rol ?? '']);
                return (
                  <tr key={employee.id} className="border-t transition-colors hover:bg-muted/50">
                    <td className="p-3 font-medium">{employee.nombre}</td>
                    <td className="p-3">{employee.email}</td>
                    <td className="p-3">
                      <div className="flex flex-wrap gap-1">
                        {rolesToShow.map((role) => (
                          <Badge key={`${employee.id}-${role}`} variant="outline" className="capitalize">
                            {role}
                          </Badge>
                        ))}
                      </div>
                    </td>
                    <td className="p-3">
                      <ScopeBadges employee={employee} />
                    </td>
                    <td className="p-3 font-semibold">{workload ?? '--'}</td>
                    <td className="p-3 text-right">
                      <Button variant="ghost" size="sm" className="gap-2" onClick={() => startEdit(employee)}>
                        <PencilLine className="h-4 w-4" />
                        Actualizar alcance
                      </Button>
                    </td>
                  </tr>
                );
              })}
              {employees.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-4 text-center text-muted-foreground">No hay empleados registrados.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>

      <EmployeeRoutingMatrix tenantSlug={tenantSlug} />
    </div>
  );
}
