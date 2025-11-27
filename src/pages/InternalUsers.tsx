import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { apiFetch, ApiError, getErrorMessage } from '@/utils/api';
import useRequireRole from '@/hooks/useRequireRole';
import { useUser } from '@/hooks/useUser';
import type { Role } from '@/utils/roles';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from '@/components/ui/accordion';

const isValidEmail = (value: string) => /.+@.+\..+/.test(value.trim());

interface InternalUser {
  id: number;
  nombre: string;
  email: string;
  rol?: string | null;
  atendidos?: number | null;
  categoria_id?: number | null;
  categoria_ids?: number[] | null;
  categorias?: Category[] | null;
  abiertos?: number | null;
}

interface Category {
  id: number;
  nombre: string;
}

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
  const [categoriaIds, setCategoriaIds] = useState<number[]>([]);
  const [categorySearch, setCategorySearch] = useState('');
  const [editingUser, setEditingUser] = useState<InternalUser | null>(null);
  const [editNombre, setEditNombre] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editPassword, setEditPassword] = useState('');
  const [editRol, setEditRol] = useState('empleado');
  const [editCategoriaIds, setEditCategoriaIds] = useState<number[]>([]);
  const [editCategorySearch, setEditCategorySearch] = useState('');

  const entityType = useMemo(() => (user?.tipo_chat === 'pyme' ? 'pyme' : 'municipal'), [user]);
  const usersUrl = useMemo(() => (entityType === 'pyme' ? '/pyme/usuarios' : '/municipal/usuarios'), [entityType]);
  const categoriesUrl = useMemo(() => (entityType === 'pyme' ? '/pyme/categorias' : '/municipal/categorias'), [entityType]);

  const refreshUsers = useCallback(async () => {
    try {
      const data = await apiFetch<InternalUser[]>(usersUrl);
      setUsers(data || []);
    } catch (err: any) {
      setError(getErrorMessage(err, 'Error al cargar los usuarios'));
    }
  }, [usersUrl]);

  useEffect(() => {
    setLoading(true);
    setError(null);
    Promise.all([
      apiFetch<InternalUser[]>(usersUrl).catch(err => {
        if (err instanceof ApiError && err.status === 404) return [];
        throw err;
      }),
      apiFetch<{ categorias: Category[] }>(categoriesUrl, { sendEntityToken: true }).catch(err => {
        if (err instanceof ApiError && err.status === 404) return { categorias: [] };
        throw err;
      })
    ]).then(([usersData, categoriesData]) => {
      setUsers(usersData || []);
      setCategories(categoriesData?.categorias || []);
      setLoading(false);
    }).catch(err => {
      setError(getErrorMessage(err, 'Error al cargar los datos'));
      setLoading(false);
    });

  }, [categoriesUrl, usersUrl]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nombre.trim() || !email.trim() || !password.trim()) return;
    if (!isValidEmail(email)) {
      setError('Ingresá un email válido.');
      return;
    }
    if (categoriaIds.length === 0) {
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

      if (categoriaIds.length === 1) {
        payload.categoria_id = categoriaIds[0];
      }

      await apiFetch(usersUrl, {
        method: 'POST',
        body: payload,
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
    const cargaAbiertos = typeof user.abiertos === 'number' ? user.abiertos : 0;
    const cargaTexto = cargaAbiertos > 0
      ? `Tiene ${cargaAbiertos} ticket(s) abiertos que deberás reasignar.`
      : 'Los tickets previos quedarán registrados sin asignación.';
    const wantsToDelete = window.confirm(
      `¿Eliminar el empleado ${user.nombre}? ${cargaTexto}`
    );
    if (!wantsToDelete) return;
    const deleteUrl = `${usersUrl}/${user.id}`;
    try {
      await apiFetch(deleteUrl, { method: 'DELETE' });
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
    const userCategoryIds =
      user.categoria_ids ||
      user.categorias?.map((c) => c.id) ||
      (user.categoria_id ? [user.categoria_id] : []);
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

    const updateUrl = `${usersUrl}/${editingUser.id}`;
    if (editCategoriaIds.length === 0) {
      setError('Seleccioná al menos una categoría.');
      return;
    }

    const payload: Record<string, any> = {
      nombre: editNombre.trim(),
      email: editEmail.trim(),
      rol: editRol,
      categoria_ids: editCategoriaIds,
    };

    if (editCategoriaIds.length === 1) {
      payload.categoria_id = editCategoriaIds[0];
    }
    if (editPassword.trim()) {
      payload.password = editPassword.trim();
    }

    try {
      setError(null);
      await apiFetch(updateUrl, { method: 'PUT', body: payload });
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

  const toggleCategory = (id: number) => {
    setCategoriaIds((prev) => (prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]));
  };

  const toggleEditCategory = (id: number) => {
    setEditCategoriaIds((prev) => (prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]));
  };

  const getUserCategoryIds = (user: InternalUser) =>
    user.categoria_ids || user.categorias?.map((c) => c.id) || (user.categoria_id ? [user.categoria_id] : []);

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
