import React, { useEffect, useState } from "react";
import { apiFetch, getErrorMessage } from "@/utils/api";
import { safeLocalStorage } from "@/utils/safeLocalStorage";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { useNavigate } from "react-router-dom";
import useRequireRole from "@/hooks/useRequireRole";
import type { Role } from "@/utils/roles";

interface Usuario {
  id: number;
  nombre: string;
  email: string;
  telefono?: string;
  etiquetas?: string[];
}

export default function UsuariosPage() {
  useRequireRole(['admin', 'empleado', 'super_admin'] as Role[]);
  const navigate = useNavigate();
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [marketingOnly, setMarketingOnly] = useState(false);
  const [sortConfig, setSortConfig] = useState<{ key: keyof Usuario; direction: 'asc' | 'desc' } | null>(null);

  const sortedUsuarios = React.useMemo(() => {
    let sortableItems = [...usuarios];
    if (sortConfig !== null) {
      sortableItems.sort((a, b) => {
        if (a[sortConfig.key] < b[sortConfig.key]) {
          return sortConfig.direction === 'asc' ? -1 : 1;
        }
        if (a[sortConfig.key] > b[sortConfig.key]) {
          return sortConfig.direction === 'asc' ? 1 : -1;
        }
        return 0;
      });
    }
    return sortableItems;
  }, [usuarios, sortConfig]);

  const requestSort = (key: keyof Usuario) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  useEffect(() => {
    const token = safeLocalStorage.getItem("authToken");
    if (!token) {
      navigate("/login");
      return;
    }
    const fetchData = async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        if (search.trim()) params.set('search', search.trim());
        if (marketingOnly) params.set('marketing', 'true');
        const url = `/crm/clientes${params.toString() ? `?${params.toString()}` : ''}`;
        const data = await apiFetch<Usuario[]>(url);
        if (Array.isArray(data)) setUsuarios(data);
      } catch (e) {
        setError(getErrorMessage(e, 'No se pudieron cargar los usuarios'));
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [navigate, search, marketingOnly]);

  if (loading) return <div className="p-8">Cargando...</div>;
  if (error) return <div className="p-8 text-destructive">{error}</div>;

  return (
    <div className="p-4 md:p-6 flex flex-col gap-4 max-w-5xl mx-auto">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Usuarios Registrados</h1>
        <Button variant="outline" onClick={() => navigate("/perfil")}>Volver</Button>
      </header>
      <div className="flex items-center gap-4">
        <Input
          placeholder="Buscar nombre o email"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-xs"
        />
        <label className="flex items-center gap-2 text-sm">
          <Checkbox checked={marketingOnly} onCheckedChange={(v) => setMarketingOnly(Boolean(v))} />
          Solo con marketing
        </label>
      </div>
      {usuarios.length === 0 ? (
        <p>No hay usuarios registrados.</p>
      ) : (
        <Card>
          <CardContent>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left font-semibold">
                  <th className="p-2 cursor-pointer" onClick={() => requestSort('nombre')}>
                    Nombre {sortConfig?.key === 'nombre' ? (sortConfig.direction === 'asc' ? '▲' : '▼') : ''}
                  </th>
                  <th className="p-2 cursor-pointer" onClick={() => requestSort('email')}>
                    Email {sortConfig?.key === 'email' ? (sortConfig.direction === 'asc' ? '▲' : '▼') : ''}
                  </th>
                  <th className="p-2 cursor-pointer" onClick={() => requestSort('telefono')}>
                    Teléfono {sortConfig?.key === 'telefono' ? (sortConfig.direction === 'asc' ? '▲' : '▼') : ''}
                  </th>
                </tr>
              </thead>
              <tbody>
                {sortedUsuarios.map(u => (
                  <tr key={u.id} className="border-t">
                    <td className="p-2">{u.nombre}</td>
                    <td className="p-2">{u.email}</td>
                    <td className="p-2">{u.telefono || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
