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

  if (loading) return <div className="p-4">Cargando...</div>;
  if (error) return <div className="p-4 text-destructive">{error}</div>;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="bg-muted/20 p-4 rounded-lg">
          <h2 className="text-xl font-bold mb-2">Gestión de Empleados</h2>
          <p className="text-sm text-muted-foreground">
              Crea cuentas para tu equipo y asignales categorías de tickets específicas.
          </p>
      </div>

      {(lastCreatedEmployee || coverage) && (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
          {lastCreatedEmployee ? (
            <Card>
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
            <Card>
              <CardHeader>
                <CardTitle>Cobertura del equipo</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-4 md:grid-cols-3">
                <div className="space-y-2">
                  <p className="text-sm font-medium">Categorías</p>
                  {coverageCategories.slice(0, 5).map((item, index) => (
                    <div key={`coverage-category-${index}`} className="flex items-center justify-between text-sm">
                      <span>{item.categoria || item.label || item.name || `categoria_${index + 1}`}</span>
                      <Badge variant="outline">{item.employees ?? item.count ?? item.total ?? 0}</Badge>
                    </div>
                  ))}
                </div>
                <div className="space-y-2">
                  <p className="text-sm font-medium">Zonas</p>
                  {coverageZones.slice(0, 5).map((item, index) => (
                    <div key={`coverage-zone-${index}`} className="flex items-center justify-between text-sm">
                      <span>{item.zona || item.label || item.name || `zona_${index + 1}`}</span>
                      <Badge variant="outline">{item.employees ?? item.count ?? item.total ?? 0}</Badge>
                    </div>
                  ))}
                </div>
                <div className="space-y-2">
                  <p className="text-sm font-medium">Permisos</p>
                  {coveragePermissions.slice(0, 5).map((item, index) => (
                    <div key={`coverage-permission-${index}`} className="flex items-center justify-between text-sm">
                      <span>{item.permiso || item.label || item.name || `permiso_${index + 1}`}</span>
                      <Badge variant="outline">{item.employees ?? item.count ?? item.total ?? 0}</Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ) : null}
        </div>
      )}

      <Accordion type="single" collapsible className="w-full">
        <AccordionItem value="new-employee">
          <AccordionTrigger>Registrar Nuevo Empleado</AccordionTrigger>
          <AccordionContent>
            <form onSubmit={handleCreate} className="space-y-4 border p-4 rounded-md">
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

              <Button type="submit">Crear Empleado</Button>
            </form>
          </AccordionContent>
        </AccordionItem>
      </Accordion>

      {editingUser && (
          <div className="border p-4 rounded-md shadow-sm bg-card text-card-foreground">
              <div className="flex justify-between items-center mb-4">
                  <h3 className="font-semibold text-lg">Editar Empleado: {editingUser.nombre}</h3>
                  <Button variant="ghost" onClick={cancelEdit}>Cancelar</Button>
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
                  <Button type="submit">Guardar Cambios</Button>
              </form>
          </div>
      )}

      <div className="rounded-md border">
          <table className="w-full text-sm text-left">
              <thead className="bg-muted text-muted-foreground">
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
                              <Button variant="ghost" size="sm" onClick={() => startEdit(emp)}>Editar</Button>
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
  );
}
