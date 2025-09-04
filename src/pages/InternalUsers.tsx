import React, { useEffect, useState } from 'react';
import { apiFetch, ApiError, getErrorMessage } from '@/utils/api';
import useRequireRole from '@/hooks/useRequireRole';
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
  const [users, setUsers] = useState<InternalUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [nombre, setNombre] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rol, setRol] = useState('empleado');
  const [categoriaId, setCategoriaId] = useState<number | ''>('');

  useEffect(() => {
    apiFetch<InternalUser[]>('/municipal/usuarios')
      .then((data) => {
        setUsers(data);
        setLoading(false);
      })
      .catch((err: any) => {
        if (err instanceof ApiError && err.status === 404) {
          setError('Funcionalidad no disponible');
        } else {
          setError(getErrorMessage(err, 'Error'));
        }
        setLoading(false);
      });
    apiFetch<{ categorias: Category[] }>('/municipal/categorias', { sendEntityToken: true })
      .then((data) => {
        if (Array.isArray(data.categorias)) {
          setCategories(data.categorias);
        } else {
          setCategories([]);
        }
      })
      .catch((err: any) => {
        if (err instanceof ApiError && err.status === 404) {
          setError('Funcionalidad no disponible');
        }
        setCategories([]);
      });
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nombre.trim() || !email.trim() || !password.trim() || !categoriaId) return;
    try {
      await apiFetch('/municipal/usuarios', {
        method: 'POST',
        body: { nombre, email, password, rol, categoria_id: categoriaId },
      });
      const data = await apiFetch<InternalUser[]>('/municipal/usuarios');
      setUsers(data);
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
    try {
      await apiFetch(`/municipal/usuarios/${id}`, { method: 'DELETE' });
      const data = await apiFetch<InternalUser[]>('/municipal/usuarios');
      setUsers(data);
    } catch (err: any) {
      setError(getErrorMessage(err, 'Error al eliminar el usuario'));
    }
  };

  if (loading) return <p className="p-4">Cargando...</p>;
  if (error) return <p className="p-4 text-destructive">{error}</p>;

  return (
    <div className="p-4 max-w-3xl mx-auto space-y-4">
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
                onChange={(e) => setCategoriaId(Number(e.target.value))}
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
                  <Button variant="outline" size="sm" className="mr-2">Editar</Button>
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
