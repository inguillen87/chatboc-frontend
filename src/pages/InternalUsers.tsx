import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { apiFetch, ApiError, getErrorMessage } from '@/utils/api';
import useRequireRole from '@/hooks/useRequireRole';
import { useUser } from '@/hooks/useUser';
import type { Role } from '@/utils/roles';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from '@/components/ui/accordion';

interface InternalUser {
  id: number;
  nombre: string;
  email: string;
  rol?: string | null;
  atendidos?: number | null;
  categoria_id?: number | null;
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
  const [categoriaId, setCategoriaId] = useState<number | ''>('');
  const [editingUser, setEditingUser] = useState<InternalUser | null>(null);
  const [editNombre, setEditNombre] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editPassword, setEditPassword] = useState('');
  const [editRol, setEditRol] = useState('empleado');
  const [editCategoriaId, setEditCategoriaId] = useState<number | ''>('');

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
    if (!nombre.trim() || !email.trim() || !password.trim() || !categoriaId) return;
    setError(null);
    try {
      await apiFetch(usersUrl, {
        method: 'POST',
        body: { nombre, email, password, rol, categoria_id: categoriaId },
      });
      await refreshUsers();
      setNombre('');
      setEmail('');
      setPassword('');
      setRol('empleado');
      setCategoriaId('');
    } catch (err: any) {
      setError(getErrorMessage(err, 'Error al crear el usuario'));
    }
  };

  const handleDelete = async (id: number) => {
    const deleteUrl = `${usersUrl}/${id}`;
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
    setEditCategoriaId(user.categoria_id ?? '');
    setEditPassword('');
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;
    if (!editNombre.trim() || !editEmail.trim() || !editCategoriaId) {
      setError('Completa los campos obligatorios.');
      return;
    }

    const updateUrl = `${usersUrl}/${editingUser.id}`;
    const payload: Record<string, any> = {
      nombre: editNombre.trim(),
      email: editEmail.trim(),
      rol: editRol,
      categoria_id: editCategoriaId,
    };
    if (editPassword.trim()) {
      payload.password = editPassword.trim();
    }

    try {
      setError(null);
      await apiFetch(updateUrl, { method: 'PUT', body: payload });
      await refreshUsers();
      setEditingUser(null);
      setEditPassword('');
    } catch (err: any) {
      setError(getErrorMessage(err, 'Error al actualizar el usuario'));
    }
  };

  const resetEditState = () => {
    setEditingUser(null);
    setEditNombre('');
    setEditEmail('');
    setEditRol('empleado');
    setEditCategoriaId('');
    setEditPassword('');
  };

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
              <select
                value={categoriaId}
                onChange={(e) => setCategoriaId(e.target.value ? Number(e.target.value) : '')}
                required
                className="w-full border rounded h-10 px-2 bg-input text-foreground"
              >
                <option key="cat-empty" value="">Selecciona categoría</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nombre}
                  </option>
                ))}
              </select>
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
            />
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
            <select
              value={editCategoriaId}
              onChange={(e) => setEditCategoriaId(e.target.value ? Number(e.target.value) : '')}
              required
              className="w-full border rounded h-10 px-2 bg-input text-foreground"
            >
              <option key="edit-cat-empty" value="">Selecciona categoría</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nombre}
                </option>
              ))}
            </select>
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
            <th className="p-2">Categoría</th>
            <th className="p-2">Tickets atendidos</th>
            <th className="p-2">Acciones</th>
          </tr>
        </thead>
        <tbody>
          {users.map((u) => {
            const categoriaNombre = categories.find((c) => c.id === u.categoria_id)?.nombre;
            return (
              <tr key={u.id} className="border-t">
                <td className="p-2">{u.nombre}</td>
                <td className="p-2">{u.email}</td>
                <td className="p-2">{u.rol || '-'}</td>
                <td className="p-2">{categoriaNombre || '-'}</td>
                <td className="p-2">{u.atendidos || 0}</td>
                <td className="p-2">
                  <Button variant="outline" size="sm" className="mr-2" onClick={() => startEdit(u)}>Editar</Button>
                  <Button variant="destructive" size="sm" onClick={() => handleDelete(u.id)}>Eliminar</Button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
