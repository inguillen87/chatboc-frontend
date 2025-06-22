import React, { useEffect, useState } from 'react';
import { apiFetch } from '@/utils/api';

interface InternalUser {
  id: number;
  nombre: string;
  email: string;
  rol?: string | null;
  atendidos?: number | null;
}

export default function InternalUsers() {
  const [users, setUsers] = useState<InternalUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
  }, []);

  if (loading) return <p className="p-4">Cargando...</p>;
  if (error) return <p className="p-4 text-destructive">{error}</p>;

  return (
    <div className="p-4 max-w-3xl mx-auto space-y-4">
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
