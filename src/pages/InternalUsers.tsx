import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { apiFetch, ApiError, getErrorMessage, resolveTenantSlug } from '@/utils/api';
import useRequireRole from '@/hooks/useRequireRole';
import { useUser } from '@/hooks/useUser';
import type { Role } from '@/utils/roles';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from '@/components/ui/accordion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { PencilLine, Sparkles, UserPlus, Layers3, MapPinned, KeyRound, Users2 } from 'lucide-react';

const isValidEmail = (value: string) => /.+@.+\..+/.test(value.trim());

type CategoryId = number;

interface InternalUser {
  id: number;
  nombre: string;
  email: string;
  rol?: string | null;
  // For display purposes, mapping back from EmployeeCategoryAccess
  categorias?: Category[] | null;
  roles?: string[]; // Array of roles if backend supports it
  zonas?: string[] | null;
  permisos?: string[] | null;
  scope?: {
    categorias?: string[];
    zonas?: string[];
    permisos?: string[];
  } | null;
}

type Category = {
  id: number;
  slug: string;
  nombre: string;
  tipo?: string;
};

interface EmployeesResponse {
  employees: InternalUser[];
  ticket_categories: Category[];
}

interface CoverageItem {
  label?: string;
  name?: string;
  categoria?: string;
  zona?: string;
  permiso?: string;
  count?: number;
  total?: number;
  employees?: number;
}

interface EmployeeCoverageResponse {
  categorias?: CoverageItem[];
  zonas?: CoverageItem[];
  permisos?: CoverageItem[];
  items?: CoverageItem[];
}


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
  items: CoverageItem[];
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
      {items.slice(0, 5).map((item, index) => (
        <div key={`${title}-${index}`} className="flex items-center justify-between rounded-xl border border-border/60 bg-muted/20 px-3 py-2 text-sm">
          <span className="truncate pr-3">{item.categoria || item.zona || item.permiso || item.label || item.name || `${emptyLabel}_${index + 1}`}</span>
          <Badge variant="secondary">{item.employees ?? item.count ?? item.total ?? 0}</Badge>
        </div>
      ))}
      {!items.length ? <p className="text-sm text-muted-foreground">Sin datos disponibles.</p> : null}
    </div>
  </div>
);

const EMPLOYEES_API_BASE = '/api/empleados';

const getBackendErrorText = (error: unknown): string | null => {
  if (error instanceof ApiError) {
    const body = error.body;
    if (typeof body === 'string' && body.trim()) return body.trim();
    if (body && typeof body === 'object') {
      const messageCandidates = [
        (body as Record<string, unknown>).message,
        (body as Record<string, unknown>).error,
        (body as Record<string, unknown>).detail,
      ];
      for (const candidate of messageCandidates) {
        if (typeof candidate === 'string' && candidate.trim()) {
          return candidate.trim();
        }
      }
    }
  }

  return null;
};

export default function InternalUsers() {
  useRequireRole(['admin', 'super_admin', 'tenant_admin'] as Role[]);
  const { user } = useUser();
  const [employees, setEmployees] = useState<InternalUser[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [coverage, setCoverage] = useState<EmployeeCoverageResponse | null>(null);
  const [lastCreatedEmployee, setLastCreatedEmployee] = useState<InternalUser | null>(null);

  // Form states
  const [nombre, setNombre] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [roles, setRoles] = useState<string[]>(['empleado']);
  const [categoriaIds, setCategoriaIds] = useState<CategoryId[]>([]);

  // Edit states
  const [editingUser, setEditingUser] = useState<InternalUser | null>(null);
  const [editNombre, setEditNombre] = useState('');
  const [editPassword, setEditPassword] = useState(''); // Only if changing
  const [editRoles, setEditRoles] = useState<string[]>([]);
  const [editCategoriaIds, setEditCategoriaIds] = useState<CategoryId[]>([]);

  const tenantSlug = useMemo(
    () => resolveTenantSlug(user?.tenantSlug || (user as any)?.tenant_slug),
    [user]
  );

  const fetchData = useCallback(async () => {
    if (!tenantSlug) return;
    setLoading(true);
    setError(null);
    try {
      const employeesData = await apiFetch<InternalUser[] | EmployeesResponse>(EMPLOYEES_API_BASE, {
        tenantSlug,
      });

      // Extract employees and categories if included in the response
      const list = Array.isArray(employeesData)
        ? employeesData
        : (employeesData as any).employees || [];

      let cats: Category[] = Array.isArray((employeesData as any)?.ticket_categories)
        ? ((employeesData as any).ticket_categories as Category[])
        : [];

      // Fetch categories if they were not bundled with employees
      if (cats.length === 0) {
        const categoriesData = await apiFetch<Category[] | EmployeesResponse>(`${EMPLOYEES_API_BASE}/categorias`, {
          tenantSlug,
        }).catch(() => [] as Category[]);

        cats = Array.isArray(categoriesData)
          ? categoriesData
          : ((categoriesData as any).ticket_categories as Category[]) || [];
      }

      setEmployees(list);
      setCategories(cats);
      const coverageData = await apiFetch<EmployeeCoverageResponse>(
        `/api/admin/tenants/${tenantSlug}/employees/coverage`,
        { tenantSlug },
      ).catch(() => null);
      setCoverage(coverageData);
    } catch (err: any) {
      console.error(err);
      setError(getErrorMessage(err, 'Error al cargar empleados o categorías.'));
    } finally {
      setLoading(false);
    }
  }, [tenantSlug]);

  useEffect(() => {
    if (tenantSlug) {
      fetchData();
    } else {
      setLoading(false);
      setError("No se pudo identificar el tenant.");
    }
  }, [tenantSlug, fetchData]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nombre.trim() || !email.trim() || !password.trim()) return;
    if (!tenantSlug) return;

    try {
      const selectedCategories = categories
        .filter((cat) => categoriaIds.includes(cat.id))
        .map((cat) => cat.slug || cat.nombre)
        .filter((value): value is string => typeof value === 'string' && value.trim().length > 0);

      const selectedRoles = roles
        .map((role) => role.trim())
        .filter((role): role is string => role.length > 0);

      const payload = {
        name: nombre,
        email,
        password,
        roles: selectedRoles,
        categorias: selectedCategories,
      };

      const createdResponse = await apiFetch<any>(EMPLOYEES_API_BASE, {
        method: 'POST',
        tenantSlug,
        body: payload,
      });

      const createdEmployee =
        createdResponse?.employee ||
        createdResponse?.created_employee ||
        createdResponse?.item ||
        createdResponse?.data ||
        null;

      setLastCreatedEmployee(createdEmployee);

      toast.success("Empleado creado correctamente.");
      fetchData();

      // Reset form
      setNombre('');
      setEmail('');
      setPassword('');
      setCategoriaIds([]);
    } catch (err: any) {
      const backendMessage = getBackendErrorText(err);
      toast.error(backendMessage || getErrorMessage(err, 'Error al crear empleado.'));
    }
  };

  const startEdit = (u: InternalUser) => {
    setEditingUser(u);
    setEditNombre(u.nombre);
    setEditPassword('');
    // Ensure roles is array
    const userRoles = u.roles || (u.rol ? [u.rol] : ['empleado']);
    setEditRoles(userRoles);

    // Extract category IDs
    const userCatIds = u.categorias?.map(c => c.id) || [];
    setEditCategoriaIds(userCatIds);
  };

  const cancelEdit = () => {
    setEditingUser(null);
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser || !tenantSlug) return;

    try {
      const selectedCategoryIds = editCategoriaIds
        .map((id) => String(id).trim())
        .filter((value): value is string => value.length > 0);
      const selectedRoles = editRoles
        .map((role) => role.trim())
        .filter((role): role is string => role.length > 0);

      const payload: { name: string; roles: string[]; categorias: string[]; password?: string } = {
        name: editNombre,
        roles: selectedRoles,
        categorias: selectedCategoryIds,
      };
      if (editPassword) payload.password = editPassword;

      await apiFetch(`${EMPLOYEES_API_BASE}/${editingUser.id}`, {
        method: 'PUT',
        tenantSlug,
        body: payload,
      });

      toast.success("Empleado actualizado.");
      setEditingUser(null);
      fetchData();
    } catch (err: any) {
       const backendMessage = getBackendErrorText(err);
       toast.error(backendMessage || getErrorMessage(err, "Error al actualizar empleado."));
    }
  };

  const toggleCategory = (id: number, currentList: number[], setList: React.Dispatch<React.SetStateAction<number[]>>) => {
      if (currentList.includes(id)) {
          setList(currentList.filter(c => c !== id));
      } else {
          setList([...currentList, id]);
      }
  };

  const coverageCategories = coverage?.categorias || [];
  const coverageZones = coverage?.zonas || [];
  const coveragePermissions = coverage?.permisos || [];
  const coverageTotal = coverageCategories.length + coverageZones.length + coveragePermissions.length;

  if (loading) return <div className="p-4">Cargando...</div>;
  if (error) return <div className="p-4 text-destructive">{error}</div>;

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 pb-8">
      <div className="relative overflow-hidden rounded-[32px] border border-border/60 bg-gradient-to-br from-background via-primary/5 to-sky-500/10 p-6 shadow-sm">
        <div className="absolute -right-10 top-0 h-40 w-40 rounded-full bg-primary/10 blur-3xl" />
        <div className="absolute bottom-0 left-0 h-32 w-32 rounded-full bg-sky-500/10 blur-3xl" />
        <div className="relative space-y-5">
          <Badge variant="outline" className="w-fit border-primary/20 bg-background/80 px-3 py-1 text-primary">
            <Sparkles className="mr-2 h-3.5 w-3.5" />
            Team control center
          </Badge>
          <div>
            <h2 className="text-3xl font-black tracking-tight text-foreground">Gestión de Empleados</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
              Crea cuentas, asigna cobertura operativa y revisa rápidamente cómo está distribuido el equipo dentro del tenant.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge variant="outline" className="rounded-full px-3 py-1">{employees.length} empleados</Badge>
            <Badge variant="outline" className="rounded-full px-3 py-1">{categories.length} categorías</Badge>
            <Badge variant="outline" className="rounded-full px-3 py-1">{coverageTotal} señales de cobertura</Badge>
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <TeamStatCard label="Equipo" value={employees.length.toLocaleString('es-AR')} helper="Usuarios internos activos en la vista actual" icon={Users2} />
        <TeamStatCard label="Categorías" value={categories.length.toLocaleString('es-AR')} helper="Dominios/categorías disponibles para asignación" icon={Layers3} />
        <TeamStatCard label="Zonas" value={coverageZones.length.toLocaleString('es-AR')} helper="Cobertura geográfica informada por backend" icon={MapPinned} />
        <TeamStatCard label="Permisos" value={coveragePermissions.length.toLocaleString('es-AR')} helper="Permisos o alcances relevantes del equipo" icon={KeyRound} />
      </div>

      {(lastCreatedEmployee || coverage) && (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
          {lastCreatedEmployee ? (
            <Card className="border-border/60 shadow-sm">
              <CardHeader>
                <CardTitle>Último empleado creado</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <p className="font-medium">{lastCreatedEmployee.nombre}</p>
                  <p className="text-sm text-muted-foreground">{lastCreatedEmployee.email}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {(lastCreatedEmployee.roles || [lastCreatedEmployee.rol]).filter(Boolean).map((role) => (
                    <Badge key={role} variant="outline">{role}</Badge>
                  ))}
                  {(lastCreatedEmployee.scope?.categorias || []).map((categoria) => (
                    <Badge key={`created-category-${categoria}`} variant="secondary">{categoria}</Badge>
                  ))}
                  {(lastCreatedEmployee.scope?.zonas || []).map((zona) => (
                    <Badge key={`created-zone-${zona}`} variant="secondary">{zona}</Badge>
                  ))}
                  {(lastCreatedEmployee.scope?.permisos || []).map((permiso) => (
                    <Badge key={`created-permission-${permiso}`} variant="secondary">{permiso}</Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          ) : null}

          {coverage ? (
            <Card className="overflow-hidden border-border/60 bg-background/85 shadow-sm">
              <CardHeader className="border-b border-border/50 bg-gradient-to-r from-emerald-500/5 via-primary/5 to-transparent">
                <CardTitle>Cobertura del equipo</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-4 pt-6 md:grid-cols-3">
                <CoverageColumn title="Categorías" items={coverageCategories} emptyLabel="categoria" />
                <CoverageColumn title="Zonas" items={coverageZones} emptyLabel="zona" />
                <CoverageColumn title="Permisos" items={coveragePermissions} emptyLabel="permiso" />
              </CardContent>
            </Card>
          ) : null}
        </div>
      )}

      <Accordion type="single" collapsible className="w-full">
        <AccordionItem value="new-employee">
          <AccordionTrigger className="rounded-2xl px-4 py-3 text-left hover:no-underline">
            <span className="flex items-center gap-2">
              <UserPlus className="h-4 w-4 text-primary" />
              Registrar Nuevo Empleado
            </span>
          </AccordionTrigger>
          <AccordionContent>
            <form onSubmit={handleCreate} className="space-y-4 rounded-2xl border border-border/60 bg-card p-4 shadow-sm">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                      <label className="text-sm font-medium">Nombre</label>
                      <Input value={nombre} onChange={e => setNombre(e.target.value)} placeholder="Juan Perez" required />
                  </div>
                  <div className="space-y-2">
                      <label className="text-sm font-medium">Email</label>
                      <Input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="juan@mendoza.gob.ar" required />
                  </div>
                  <div className="space-y-2">
                      <label className="text-sm font-medium">Contraseña</label>
                      <Input type="password" value={password} onChange={e => setPassword(e.target.value)} required />
                  </div>
                  <div className="space-y-2">
                      <label className="text-sm font-medium">Rol</label>
                      <select
                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
                        value={roles[0]}
                        onChange={e => setRoles([e.target.value])}
                      >
                          <option value="empleado">Empleado</option>
                          <option value="tenant_admin">Admin del Tenant</option>
                      </select>
                  </div>
              </div>

              <div className="space-y-2">
                  <label className="text-sm font-medium">Categorías de Tickets Asignadas</label>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-2 border p-3 rounded-md max-h-40 overflow-y-auto">
                      {categories.map(cat => (
                          <label key={cat.id} className="flex items-center space-x-2 text-sm">
                              <input
                                type="checkbox"
                                checked={categoriaIds.includes(cat.id)}
                                onChange={() => toggleCategory(cat.id, categoriaIds, setCategoriaIds)}
                                className="rounded border-gray-300"
                              />
                              <span>{cat.nombre}</span>
                          </label>
                      ))}
                      {categories.length === 0 && <p className="text-xs text-muted-foreground col-span-full">No hay categorías disponibles.</p>}
                  </div>
              </div>

              <Button type="submit" className="w-full gap-2 rounded-xl sm:w-auto">
                <UserPlus className="h-4 w-4" />
                Crear Empleado
              </Button>
            </form>
          </AccordionContent>
        </AccordionItem>
      </Accordion>

      {editingUser && (
          <div className="rounded-2xl border border-border/60 bg-card p-4 shadow-sm text-card-foreground">
              <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <h3 className="flex items-center gap-2 text-lg font-semibold">
                    <PencilLine className="h-4 w-4 text-primary" />
                    Editar Empleado: {editingUser.nombre}
                  </h3>
                  <Button variant="ghost" onClick={cancelEdit} className="w-full sm:w-auto">Cancelar</Button>
              </div>
              <form onSubmit={handleUpdate} className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                          <label className="text-sm font-medium">Nombre</label>
                          <Input value={editNombre} onChange={e => setEditNombre(e.target.value)} required />
                      </div>
                      <div className="space-y-2">
                          <label className="text-sm font-medium">Nueva Contraseña (Opcional)</label>
                          <Input type="password" value={editPassword} onChange={e => setEditPassword(e.target.value)} placeholder="Dejar en blanco para no cambiar" />
                      </div>
                      <div className="space-y-2">
                          <label className="text-sm font-medium">Rol</label>
                          <select
                            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
                            value={editRoles[0]}
                            onChange={e => setEditRoles([e.target.value])}
                          >
                              <option value="empleado">Empleado</option>
                              <option value="tenant_admin">Admin del Tenant</option>
                          </select>
                      </div>
                  </div>
                  <div className="space-y-2">
                      <label className="text-sm font-medium">Categorías de Tickets Asignadas</label>
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-2 border p-3 rounded-md max-h-40 overflow-y-auto">
                          {categories.map(cat => (
                              <label key={cat.id} className="flex items-center space-x-2 text-sm">
                                  <input
                                    type="checkbox"
                                    checked={editCategoriaIds.includes(cat.id)}
                                    onChange={() => toggleCategory(cat.id, editCategoriaIds, setEditCategoriaIds)}
                                    className="rounded border-gray-300"
                                  />
                                  <span>{cat.nombre}</span>
                              </label>
                          ))}
                      </div>
                  </div>
                  <Button type="submit" className="w-full gap-2 rounded-xl sm:w-auto">
                    <Sparkles className="h-4 w-4" />
                    Guardar Cambios
                  </Button>
              </form>
          </div>
      )}

      <div className="overflow-hidden rounded-[28px] border border-border/60 bg-card shadow-sm">
          <div className="border-b border-border/50 bg-gradient-to-r from-primary/5 via-sky-500/5 to-violet-500/5 px-5 py-4">
            <h3 className="text-base font-semibold tracking-tight text-foreground">Directorio interno</h3>
            <p className="mt-1 text-sm text-muted-foreground">Vista rápida de roles, categorías y alcances operativos cargados por el backend.</p>
          </div>
          <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm text-left">
              <thead className="bg-muted/60 text-muted-foreground">
                  <tr>
                      <th className="p-3 font-medium">Nombre</th>
                      <th className="p-3 font-medium">Email</th>
                      <th className="p-3 font-medium">Roles</th>
                      <th className="p-3 font-medium">Categorías</th>
                      <th className="p-3 font-medium text-right">Acciones</th>
                  </tr>
              </thead>
              <tbody>
                  {employees.map(emp => (
                      <tr key={emp.id} className="border-t hover:bg-muted/50 transition-colors">
                          <td className="p-3">{emp.nombre}</td>
                          <td className="p-3">{emp.email}</td>
                          <td className="p-3">
                              {(emp.roles || [emp.rol]).map(r => (
                                  <span key={r} className="inline-block bg-primary/10 text-primary px-2 py-0.5 rounded text-xs mr-1 capitalize">
                                      {r}
                                  </span>
                              ))}
                              {emp.scope?.permisos?.map((permiso) => (
                                  <span key={`${emp.id}-${permiso}`} className="inline-block bg-muted text-foreground px-2 py-0.5 rounded text-xs mr-1 mt-1">
                                      {permiso}
                                  </span>
                              ))}
                          </td>
                          <td className="p-3">
                              {emp.categorias && emp.categorias.length > 0 ? (
                                  <div className="flex flex-wrap gap-1">
                                      {emp.categorias.map(c => (
                                          <span key={c.id} className="bg-secondary text-secondary-foreground px-2 py-0.5 rounded text-xs">
                                              {c.nombre}
                                          </span>
                                      ))}
                                  </div>
                              ) : (
                                  <span className="text-muted-foreground text-xs italic">Ninguna</span>
                              )}
                              {emp.scope?.zonas?.length ? (
                                  <div className="mt-1 flex flex-wrap gap-1">
                                      {emp.scope.zonas.map((zona) => (
                                          <span key={`${emp.id}-zona-${zona}`} className="bg-muted text-foreground px-2 py-0.5 rounded text-xs">
                                              {zona}
                                          </span>
                                      ))}
                                  </div>
                              ) : null}
                          </td>
                          <td className="p-3 text-right">
                              <Button variant="ghost" size="sm" className="gap-2" onClick={() => startEdit(emp)}>
                                <PencilLine className="h-4 w-4" />
                                Editar
                              </Button>
                          </td>
                      </tr>
                  ))}
                  {employees.length === 0 && (
                      <tr>
                          <td colSpan={5} className="p-4 text-center text-muted-foreground">No hay empleados registrados.</td>
                      </tr>
                  )}
              </tbody>
          </table>
          </div>
      </div>
    </div>
  );
}
