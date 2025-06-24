import React, { useEffect, useState } from 'react';
import { apiFetch } from '@/utils/api';
import useRequireRole from '@/hooks/useRequireRole';
import type { Role } from '@/utils/roles';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

interface InternalUser {
  id: number;
  nombre: string;
  email: string;
  rol?: string | null;
  atendidos?: number | null;
}

interface Category {
  id: number;
  nombre: string;
}

export default function InternalUsers() {
  useRequireRole(['admin' as Role]);
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
        setError(err.message || 'Error');
        setLoading(false);
      });
    apiFetch<Category[]>('/municipal/categorias')
      .then((data) => setCategories(data))
      .catch(() => setCategories([]));
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
      setError(err.message || 'Error al crear el usuario');
    }
  };

  if (loading) return <p className="p-4">Cargando...</p>;
  if (error) return <p className="p-4 text-destructive">{error}</p>;

  return (
    <div className="p-4 max-w-3xl mx-auto space-y-4">
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
          <option value="empleado">Empleado</option>
          <option value="admin">Admin</option>
        </select>
        <select
          value={categoriaId}
          onChange={(e) => setCategoriaId(Number(e.target.value))}
          required
          className="w-full border rounded h-10 px-2 bg-input text-foreground"
        >
          <option value="">Selecciona categoría</option>
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
      <ul className="grid gap-3">
        {users.map((u) => (
          <li key={u.id} className="border-b pb-2">
            <p className="font-medium">{u.nombre}</p>
            <p className="text-sm text-muted-foreground">{u.email}</p>
            {u.rol && (
              <p className="text-sm text-muted-foreground">Rol: {u.rol}</p>
            )}
            {typeof u.atendidos === 'number' && (
              <p className="text-sm text-muted-foreground">
                Tickets atendidos: {u.atendidos}
              </p>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
