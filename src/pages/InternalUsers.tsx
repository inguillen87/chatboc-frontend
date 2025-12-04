import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { apiFetch, ApiError, getErrorMessage, resolveTenantSlug } from '@/utils/api';
import useRequireRole from '@/hooks/useRequireRole';
import { useUser } from '@/hooks/useUser';
import type { Role } from '@/utils/roles';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from '@/components/ui/accordion';

const isValidEmail = (value: string) => /.+@.+\..+/.test(value.trim());

type CategoryId = number;

interface InternalUser {
  id: number;
  nombre: string;
  email: string;
  rol?: string | null;
  atendidos?: number | null;
  categoria_id?: CategoryId | null;
  categoria_ids?: CategoryId[] | null;
  categorias?: Category[] | null;
  abiertos?: number | null;
}

type Category = {
  id: number;
  nombre: string;
  tipo?: string;
};

export default function InternalUsers() {
  useRequireRole(['admin', 'super_admin'] as Role[]);
  const { user } = useUser();
  const [users, setUsers] = useState<InternalUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [nombre, setNombre] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rol, setRol] = useState('empleado');
  const [categoriaIds, setCategoriaIds] = useState<CategoryId[]>([]);
  const [categorySearch, setCategorySearch] = useState('');
  const [editingUser, setEditingUser] = useState<InternalUser | null>(null);
  const [editNombre, setEditNombre] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editPassword, setEditPassword] = useState('');
  const [editRol, setEditRol] = useState('empleado');
  const [editCategoriaIds, setEditCategoriaIds] = useState<CategoryId[]>([]);
  const [editCategorySearch, setEditCategorySearch] = useState('');

  const tenantSlug = useMemo(
    () =>
      resolveTenantSlug(
        user?.tenantSlug ||
          // @ts-expect-error: backend still returns snake_case occasionally
          (user as any)?.tenant_slug ||
          null,
      ),
    [user],
  );
  const buildTenantPath = useCallback(
    (suffix: string) => {
      if (!tenantSlug) throw new Error('No se pudo determinar el tenant');
      const normalizedSuffix = suffix.startsWith('/') ? suffix : `/${suffix}`;

      // Los endpoints municipales viven bajo el prefijo `/municipal`.
      // Usamos el tenantSlug para mantener la compatibilidad multi-entidad
      // y evitar hittear rutas públicas sin proxy (que devuelven HTML 404).
      return `/municipal/${tenantSlug}${normalizedSuffix}`;
    },
    [tenantSlug],
  );

  const filterStaffUsers = useCallback((list: InternalUser[] | null | undefined) => {
    if (!Array.isArray(list)) return [];
    return list.filter((user) => {
      const role = (user.rol || '').toLowerCase();
      return role === 'empleado' || role === 'admin' || role === 'super_admin';
    });
  }, []);

  const normalizeCategory = useCallback((raw: any): Category | null => {
    if (!raw || typeof raw !== 'object') return null;

    const idValue = raw.id ?? raw.categoria_id ?? raw.categoriaId ?? raw.slug ?? raw.codigo;
    const numericId = typeof idValue === 'number' ? idValue : Number(idValue);
    if (!Number.isFinite(numericId)) return null;

    const nameCandidate = [
      raw.nombre,
      raw.name,
      raw.titulo,
      raw.title,
      raw.label,
      raw.categoria,
    ].find((value) => typeof value === 'string' && value.trim().length > 0);

    if (!nameCandidate) return null;

    const nombre = nameCandidate.trim();
    if (!nombre) return null;

    const tipo = typeof raw.tipo === 'string' && raw.tipo.trim() ? raw.tipo.trim() : undefined;

    return { id: numericId, nombre, tipo };
  }, []);

  const mergeCategories = useCallback(
    (...categoryLists: (Category[] | null | undefined)[]): Category[] => {
      const map = new Map<string | number, Category>();

      categoryLists
        .flat()
        .forEach((category) => {
          const normalized = normalizeCategory(category);
          if (normalized) {
            const key = normalized.id?.toString?.() ?? '';
            if (key && !map.has(key)) {
              map.set(key, normalized);
            }
          }
        });

      return Array.from(map.values());
    },
    [normalizeCategory]
  );

  const extractCategories = useCallback(
    (data: any): Category[] => {
      const rawCategories = Array.isArray(data?.categorias)
        ? data.categorias
        : Array.isArray(data?.data?.categorias)
          ? data.data.categorias
          : Array.isArray(data?.categories)
            ? data.categories
            : Array.isArray(data?.data?.categories)
              ? data.data.categories
              : Array.isArray(data?.data)
                ? data.data
                : Array.isArray(data)
                  ? data
                  : [];
      return rawCategories
        .map(normalizeCategory)
        .filter((c): c is Category => Boolean(c));
    },
    [normalizeCategory]
  );

  const extractCategoriesFromUsers = useCallback(
    (list: InternalUser[] | null | undefined): Category[] => {
      if (!Array.isArray(list)) return [];

      const collected = list.flatMap((user) => {
        if (!user) return [] as Category[];
        const fromArray = Array.isArray(user.categorias) ? user.categorias : [];
        const fromIds = Array.isArray(user.categoria_ids)
          ? user.categoria_ids
              .map((id) => {
                const parsed = Number(id);
                return Number.isFinite(parsed) ? { id: parsed, nombre: String(id) } : null;
              })
              .filter((c): c is Category => Boolean(c))
          : [];
        const fromSingle =
          user.categoria_id && Number.isFinite(Number(user.categoria_id))
            ? [{ id: Number(user.categoria_id), nombre: String(user.categoria_id) }]
            : [];

        return [...fromArray, ...fromIds, ...fromSingle];
      });

      return collected
        .map(normalizeCategory)
        .filter((c): c is Category => Boolean(c));
    },
    [normalizeCategory]
  );

  const fetchWithTenant = useCallback(
    async <T,>(suffix: string, options: Parameters<typeof apiFetch<T>>[1] = {}) => {
      const path = buildTenantPath(suffix);
      return apiFetch<T>(path, { ...options, tenantSlug });
    },
    [buildTenantPath, tenantSlug],
  );

  const refreshUsers = useCallback(async () => {
    if (!tenantSlug) {
      setError('No se pudo determinar el tenant');
      return;
    }
    try {
      const data = await fetchWithTenant<InternalUser[]>('/empleados', { tenantSlug });
      const staffUsers = filterStaffUsers(data);
      setUsers(staffUsers);
      setCategories((prev) =>
        mergeCategories(prev, extractCategoriesFromUsers(staffUsers))
      );
    } catch (err: any) {
      setError(getErrorMessage(err, 'Error al cargar los usuarios'));
    }
  }, [extractCategoriesFromUsers, fetchWithTenant, filterStaffUsers, mergeCategories, tenantSlug]);

  useEffect(() => {
    if (!tenantSlug) {
      setLoading(false);
      setError('No se pudo determinar el tenant');
      return;
    }

    setLoading(true);
    setError(null);
    Promise.all([
      fetchWithTenant<InternalUser[]>('/empleados', { tenantSlug }).catch(err => {
        if (err instanceof ApiError && err.status === 404) return [];
        throw err;
      }),
      fetchWithTenant('/categorias', { tenantSlug, omitEntityToken: true }).catch(err => {
        if (err instanceof ApiError) {
          if (err.status === 404) {
            setError((prev) => prev ?? 'No se encontraron categorías disponibles.');
            return null;
          }
          setError((prev) => prev ?? getErrorMessage(err, 'No se pudieron cargar las categorías.'));
          return null;
        }
        throw err;
      }),
      fetchWithTenant('/tickets/categorias', { tenantSlug, omitEntityToken: true }).catch(err => {
        if (err instanceof ApiError) {
          setError((prev) => prev ?? getErrorMessage(err, 'No se pudieron cargar las categorías de tickets.'));
          return null;
        }
        return null;
      }),
      fetchWithTenant('/pedidos/categorias', { tenantSlug, omitEntityToken: true }).catch(err => {
        if (err instanceof ApiError) {
          setError((prev) => prev ?? getErrorMessage(err, 'No se pudieron cargar las categorías de pedidos.'));
          return null;
        }
        return null;
      }),
    ])
      .then(([usersData, categoriesData, ticketCategories, pedidoCategories]) => {
        const staffUsers = filterStaffUsers(usersData);
        setUsers(staffUsers);
        const merged = mergeCategories(
          extractCategories(categoriesData),
          extractCategories(ticketCategories),
          extractCategories(pedidoCategories),
          extractCategoriesFromUsers(staffUsers),
        );
        setCategories(merged);
        setLoading(false);
      })
      .catch(err => {
        setError(getErrorMessage(err, 'Error al cargar los datos'));
        setLoading(false);
      });

  }, [extractCategories, extractCategoriesFromUsers, fetchWithTenant, filterStaffUsers, mergeCategories, tenantSlug]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nombre.trim() || !email.trim() || !password.trim()) return;
    if (!isValidEmail(email)) {
      setError('Ingresá un email válido.');
      return;
    }
    if (!tenantSlug) {
      setError('No se pudo determinar el tenant');
      return;
    }
    if (hasAvailableCategories && categoriaIds.length === 0) {
      setError('Seleccioná al menos una categoría.');
      return;
    }
    setError(null);
    try {
      const payload: Record<string, any> = {
        nombre,
        email,
        password,
        rol,
        categoria_ids: categoriaIds,
      };

      await fetchWithTenant('/empleados', {
        method: 'POST',
        body: payload,
        tenantSlug,
      });
      await refreshUsers();
      setNombre('');
      setEmail('');
      setPassword('');
      setRol('empleado');
      setCategoriaIds([]);
      setCategorySearch('');
    } catch (err: any) {
      setError(getErrorMessage(err, 'Error al crear el usuario'));
    }
  };

  const handleDelete = async (user: InternalUser) => {
    if (!tenantSlug) {
      setError('No se pudo determinar el tenant');
      return;
    }
    const cargaAbiertos = typeof user.abiertos === 'number' ? user.abiertos : 0;
    const cargaTexto = cargaAbiertos > 0
      ? `Tiene ${cargaAbiertos} ticket(s) abiertos que deberás reasignar.`
      : 'Los tickets previos quedarán registrados sin asignación.';
    const wantsToDelete = window.confirm(
      `¿Eliminar el empleado ${user.nombre}? ${cargaTexto}`
    );
    if (!wantsToDelete) return;
    try {
      await fetchWithTenant(`/empleados/${user.id}`, { method: 'DELETE', tenantSlug });
      await refreshUsers();
    } catch (err: any) {
      setError(getErrorMessage(err, 'Error al eliminar el usuario'));
    }
  };

  const startEdit = (user: InternalUser) => {
    setEditingUser(user);
    setEditNombre(user.nombre || '');
    setEditEmail(user.email || '');
    setEditRol(user.rol || 'empleado');
    const userCategoryIds = [
      ...(Array.isArray(user.categoria_ids) ? user.categoria_ids : []),
      ...(Array.isArray(user.categorias) ? user.categorias.map((c) => c.id) : []),
      ...(user.categoria_id ? [user.categoria_id] : []),
    ]
      .map((value) => Number(value))
      .filter((value) => Number.isFinite(value)) as number[];
    setEditCategoriaIds(userCategoryIds);
    setEditPassword('');
    setEditCategorySearch('');
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;
    if (!editNombre.trim() || !editEmail.trim()) {
      setError('Completa los campos obligatorios.');
      return;
    }

    if (!isValidEmail(editEmail)) {
      setError('Ingresá un email válido.');
      return;
    }

    if (!tenantSlug) {
      setError('No se pudo determinar el tenant');
      return;
    }

    if (hasAvailableCategories && editCategoriaIds.length === 0) {
      setError('Seleccioná al menos una categoría.');
      return;
    }

    const payload: Record<string, any> = {
      nombre: editNombre.trim(),
      email: editEmail.trim(),
      rol: editRol,
      categoria_ids: editCategoriaIds,
    };
    if (editPassword.trim()) {
      payload.password = editPassword.trim();
    }

    try {
      setError(null);
      await fetchWithTenant(`/empleados/${editingUser.id}`, { method: 'PUT', body: payload, tenantSlug });
      await refreshUsers();
      setEditingUser(null);
      setEditPassword('');
      setEditCategoriaIds([]);
    } catch (err: any) {
      setError(getErrorMessage(err, 'Error al actualizar el usuario'));
    }
  };

  const resetEditState = () => {
    setEditingUser(null);
    setEditNombre('');
    setEditEmail('');
    setEditRol('empleado');
    setEditCategoriaIds([]);
    setEditPassword('');
    setEditCategorySearch('');
  };

  const normalizedCategories = useMemo(
    () => categories.filter((c): c is Category & { nombre: string } => typeof c?.nombre === 'string'),
    [categories]
  );

  const hasAvailableCategories = normalizedCategories.length > 0;

  const normalizeSearch = (value: string) => value.trim().toLowerCase();

  const filteredCategories = useMemo(
    () =>
      normalizedCategories.filter((c) =>
        c.nombre.toLowerCase().includes(normalizeSearch(categorySearch))
      ),
    [normalizedCategories, categorySearch]
  );

  const filteredEditCategories = useMemo(
    () =>
      normalizedCategories.filter((c) =>
        c.nombre.toLowerCase().includes(normalizeSearch(editCategorySearch))
      ),
    [normalizedCategories, editCategorySearch]
  );

  const toggleCategory = (id: CategoryId) => {
    setCategoriaIds((prev) => (prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]));
  };

  const toggleEditCategory = (id: CategoryId) => {
    setEditCategoriaIds((prev) => (prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]));
  };

  const getUserCategoryIds = (user: InternalUser) =>
    ([
      ...(Array.isArray(user.categoria_ids) ? user.categoria_ids : []),
      ...(Array.isArray(user.categorias) ? user.categorias.map((c) => c.id) : []),
      ...(user.categoria_id ? [user.categoria_id] : []),
    ]
      .map((value) => Number(value))
      .filter((value) => Number.isFinite(value)) as number[]);

  if (loading) return <p className="p-4">Cargando...</p>;
  if (error) return <p className="p-4 text-destructive">{error}</p>;

  return (
    <div className="p-4 max-w-3xl mx-auto space-y-4">
      <p className="text-sm text-muted-foreground">
        Los empleados usan credenciales propias para atender tickets y gestionar categorías internas. Los usuarios finales
        se registran aparte para usar el portal, canjear puntos o hacer reclamos.
      </p>
      <Accordion type="single" collapsible className="w-full">
        <AccordionItem value="item-1">
          <AccordionTrigger>Registrar nuevo empleado</AccordionTrigger>
          <AccordionContent>
            <form onSubmit={handleCreate} className="space-y-2 border-b pb-4">
              <Input
                placeholder="Nombre"
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
              />
              <Input
                type="email"
                placeholder="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              <Input
                type="password"
                placeholder="Contraseña"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <select
                value={rol}
                onChange={(e) => setRol(e.target.value)}
                className="w-full border rounded h-10 px-2 bg-input text-foreground"
              >
                <option key="rol-empleado" value="empleado">Empleado</option>
                <option key="rol-admin" value="admin">Admin</option>
              </select>
              {hasAvailableCategories ? (
                <div className="space-y-1">
                  <Input
                    placeholder="Buscar categoría"
                    value={categorySearch}
                    onChange={(e) => setCategorySearch(e.target.value)}
                  />
                  <div className="max-h-40 overflow-y-auto border rounded-md p-2 space-y-1 bg-background">
                    {filteredCategories.map((c) => (
                      <label key={c.id} className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={categoriaIds.includes(c.id)}
                          onChange={() => toggleCategory(c.id)}
                        />
                        <span>{c.nombre}</span>
                      </label>
                    ))}
                    {filteredCategories.length === 0 && (
                      <p className="text-sm text-muted-foreground">No hay categorías que coincidan.</p>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">Seleccioná al menos una categoría.</p>
                </div>
              ) : (
                <div className="rounded-md border border-dashed p-3 text-sm text-muted-foreground bg-muted/40">
                  No hay categorías disponibles en este momento. Podés registrar al empleado y asignarle sectores cuando estén configurados.
                </div>
              )}
              <Button type="submit" className="w-full">
                Registrar empleado
              </Button>
            </form>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
      {editingUser && (
        <div className="border rounded-lg p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-semibold">Editar empleado</h3>
            <Button variant="ghost" size="sm" onClick={resetEditState}>
              Cancelar
            </Button>
          </div>
          <form onSubmit={handleUpdate} className="space-y-2">
            <Input
              placeholder="Nombre"
              value={editNombre}
              onChange={(e) => setEditNombre(e.target.value)}
            />
            <Input
              type="email"
              placeholder="Email"
              value={editEmail}
              onChange={(e) => setEditEmail(e.target.value)}
              disabled
            />
            <p className="text-xs text-muted-foreground">El email es la credencial de acceso y no puede modificarse.</p>
            <Input
              type="password"
              placeholder="Nueva contraseña (opcional)"
              value={editPassword}
              onChange={(e) => setEditPassword(e.target.value)}
            />
            <select
              value={editRol}
              onChange={(e) => setEditRol(e.target.value)}
              className="w-full border rounded h-10 px-2 bg-input text-foreground"
            >
              <option key="edit-rol-empleado" value="empleado">Empleado</option>
              <option key="edit-rol-admin" value="admin">Admin</option>
            </select>
            {hasAvailableCategories ? (
              <div className="space-y-1">
                <Input
                  placeholder="Buscar categoría"
                  value={editCategorySearch}
                  onChange={(e) => setEditCategorySearch(e.target.value)}
                />
                <div className="max-h-40 overflow-y-auto border rounded-md p-2 space-y-1 bg-background">
                  {filteredEditCategories.map((c) => (
                    <label key={c.id} className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={editCategoriaIds.includes(c.id)}
                        onChange={() => toggleEditCategory(c.id)}
                      />
                      <span>{c.nombre}</span>
                    </label>
                  ))}
                  {filteredEditCategories.length === 0 && (
                    <p className="text-sm text-muted-foreground">No hay categorías que coincidan.</p>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">Seleccioná al menos una categoría.</p>
              </div>
            ) : (
              <div className="rounded-md border border-dashed p-3 text-sm text-muted-foreground bg-muted/40">
                No hay categorías disponibles en este momento. Podés editar al empleado y asignar sectores cuando estén configurados.
              </div>
            )}
            <Button type="submit" className="w-full">Actualizar</Button>
          </form>
        </div>
      )}
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left font-semibold">
            <th className="p-2">Nombre</th>
            <th className="p-2">Email</th>
            <th className="p-2">Rol</th>
            <th className="p-2">Categorías</th>
            <th className="p-2">Tickets abiertos</th>
            <th className="p-2">Tickets atendidos</th>
            <th className="p-2">Acciones</th>
          </tr>
        </thead>
        <tbody>
          {users.map((u) => {
            const categoryIds = getUserCategoryIds(u);
            const categoriaNombre = categoryIds
              .map((id) => categories.find((c) => c.id === id)?.nombre)
              .filter(Boolean)
              .join(', ');
            return (
              <tr key={u.id} className="border-t">
                <td className="p-2">{u.nombre}</td>
                <td className="p-2">{u.email}</td>
                <td className="p-2">{u.rol || '-'}</td>
                <td className="p-2">{categoriaNombre || '-'}</td>
                <td className="p-2">{u.abiertos ?? 0}</td>
                <td className="p-2">{u.atendidos || 0}</td>
                <td className="p-2">
                  <Button variant="outline" size="sm" className="mr-2" onClick={() => startEdit(u)}>Editar</Button>
                  <Button variant="destructive" size="sm" onClick={() => handleDelete(u)}>Eliminar</Button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
