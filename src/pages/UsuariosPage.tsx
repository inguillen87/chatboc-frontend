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
  useRequireRole(['admin', 'empleado'] as Role[]);
  const navigate = useNavigate();
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [marketingOnly, setMarketingOnly] = useState(false);

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
        <div className="grid gap-3">
          {usuarios.map(u => (
            <Card key={u.id} className="shadow-sm">
              <CardHeader>
                <CardTitle>{u.nombre}</CardTitle>
              </CardHeader>
              <CardContent className="text-sm flex flex-col gap-1">
                <span>{u.email}</span>
                {u.telefono && <span>{u.telefono}</span>}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
