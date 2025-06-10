// src/pages/PedidosPage.tsx

import React, { useEffect, useState, useCallback } from 'react';
import { apiFetch } from '@/utils/api';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LogOut, ChevronLeft } from "lucide-react"; 
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useNavigate } from "react-router-dom"; 

// Interfaz para el tipo de Pedido (debe coincidir con la respuesta del backend)
interface Pedido {
  id: number;
  nro_pedido: string;
  asunto: string;
  estado: string;
  detalles: any; // Esto ya viene parseado del backend
  monto_total: number | null;
  fecha_creacion: string;
  nombre_cliente: string | null;
  email_cliente: string | null;
  telefono_cliente: string | null;
  rubro: string;
}

// Estados para los badges (pueden ser definidos en un archivo de constantes o aquí)
const PEDIDO_ESTADOS_BADGES: Record<string, string> = {
    'pendiente': 'bg-yellow-500/20 text-yellow-500 border-yellow-500/30',
    'en_proceso': 'bg-blue-500/20 text-blue-500 border-blue-500/30',
    'enviado': 'bg-purple-500/20 text-purple-500 border-purple-500/30',
    'entregado': 'bg-green-500/20 text-green-500 border-green-500/30',
    'cancelado': 'bg-red-500/20 text-red-500 border-red-500/30',
    'satisfecho': 'bg-green-500/20 text-green-500 border-green-500/30', // Puede ser diferente si quieres
};

export default function PedidosPage() {
  const navigate = useNavigate();
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPedidos = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiFetch<{ pedidos: Pedido[] }>('/user/pedidos'); // Llama al endpoint que creamos
      setPedidos(data.pedidos);
    } catch (err) {
      setError('Error al cargar los pedidos. Por favor, asegúrate de estar logueado.');
      console.error('Error fetching pedidos:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const token = localStorage.getItem("authToken");
    if (!token) {
      navigate('/login'); 
      return;
    }
    fetchPedidos();
  }, [fetchPedidos, navigate]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background dark:bg-gray-900 text-foreground">
        Cargando pedidos...
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background dark:bg-gray-900 text-foreground">
        <p className="text-red-500 mb-4">{error}</p>
        <Button onClick={() => navigate('/login')} className="bg-primary hover:bg-primary/90">
          Volver a Iniciar Sesión
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-background dark:bg-gradient-to-tr dark:from-slate-950 dark:to-slate-900 text-foreground py-8 px-2 sm:px-4 md:px-6 lg:px-8">
      <div className="w-full max-w-6xl mx-auto mb-8 flex items-center justify-between">
        <Button
          variant="ghost"
          onClick={() => navigate("/perfil")}
          className="text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="w-5 h-5 mr-2" /> Volver al Perfil
        </Button>
        <h1 className="text-3xl sm:text-4xl font-extrabold text-primary leading-tight text-center flex-1">
          Mis Pedidos
        </h1>
        <Button
          variant="outline"
          className="h-10 px-5 text-sm border-destructive text-destructive hover:bg-destructive/10"
          onClick={() => { localStorage.clear(); window.location.href = "/login"; }}
        >
          <LogOut className="w-4 h-4 mr-2" /> Salir
        </Button>
      </div>

      <div className="w-full max-w-6xl mx-auto">
        {pedidos.length === 0 ? (
          <p className="text-center text-muted-foreground text-lg">No tienes pedidos registrados en este momento.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {pedidos.map((pedido) => (
              <Card key={pedido.id} className="bg-card shadow-lg rounded-xl border border-border flex flex-col justify-between">
                <CardHeader className="pb-3">
                  <CardTitle className="text-xl font-semibold text-primary flex justify-between items-center">
                    <span>Pedido Nº {pedido.nro_pedido}</span>
                    <Badge 
                      className={cn("capitalize px-3 py-1 rounded-full text-xs", PEDIDO_ESTADOS_BADGES[pedido.estado] || 'bg-secondary text-secondary-foreground')}
                    >
                      {pedido.estado.replace(/_/g, ' ')}
                    </Badge>
                  </CardTitle>
                  <p className="text-sm text-muted-foreground">{pedido.asunto}</p>
                </CardHeader>
                <CardContent className="space-y-2 text-sm text-foreground flex-grow">
                  <p><strong>Cliente:</strong> {pedido.nombre_cliente || 'Anónimo'}</p>
                  {pedido.email_cliente && <p><strong>Email:</strong> {pedido.email_cliente}</p>}
                  {pedido.telefono_cliente && <p><strong>Teléfono:</strong> {pedido.telefono_cliente}</p>}
                  <p><strong>Fecha:</strong> {new Date(pedido.fecha_creacion).toLocaleString()}</p>
                  <p><strong>Rubro:</strong> {pedido.rubro}</p>
                  {/* Detalles del pedido (los productos) */}
                  {pedido.detalles && Array.isArray(pedido.detalles) && (
                    <div className="mt-2 bg-muted/50 p-3 rounded-lg border border-border">
                      <p className="font-semibold mb-1">Detalles del Pedido:</p>
                      <ul className="list-disc list-inside ml-2 text-xs">
                        {pedido.detalles.map((item: any, idx: number) => (
                          <li key={idx}>
                            {item.cantidad} {item.unidad} de {item.nombre} 
                            {item.sku && item.sku !== 'N/A' && ` (SKU: ${item.sku})`}
                            {item.precio_str && ` - $${item.precio_str}`}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {pedido.monto_total !== null && (
                    <p className="font-semibold text-base mt-2">Monto Total: ${pedido.monto_total.toFixed(2)}</p>
                  )}
                </CardContent>
                {/* Opcional: Botones de acción para la PYME (ej. "Marcar como En Proceso") */}
                <div className="px-6 pb-6 pt-2">
                    <Button 
                        variant="outline" 
                        className="w-full text-sm border-blue-500 text-blue-500 hover:bg-blue-500/10"
                        onClick={() => { /* Lógica para abrir modal de detalle/actualizar estado */ }}
                    >
                        Gestionar Pedido
                    </Button>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}