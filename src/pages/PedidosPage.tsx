import React, { useEffect, useReducer, useCallback } from 'react';
import { useNavigate } from "react-router-dom";
import { apiFetch } from '@/utils/api';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { LogOut, ChevronLeft, AlertCircle, Inbox } from "lucide-react";
import { cn } from "@/lib/utils";
import { safeLocalStorage } from "@/utils/safeLocalStorage";

// --- Interfaces y Tipos ---
interface Pedido {
  id: number;
  nro_pedido: string;
  asunto: string;
  estado: string;
  detalles: Array<{
    cantidad: number;
    unidad: string;
    nombre: string;
    sku?: string;
    precio_str?: string;
  }>;
  monto_total: number | null;
  fecha_creacion: string;
  nombre_cliente: string | null;
  email_cliente: string | null;
  telefono_cliente: string | null;
  rubro: string;
}

interface State {
  pedidos: Pedido[];
  loading: boolean;
  error: string | null;
}

type Action =
  | { type: 'FETCH_START' }
  | { type: 'FETCH_SUCCESS'; payload: Pedido[] }
  | { type: 'FETCH_ERROR'; payload: string };

// --- Constantes ---
const PEDIDO_ESTADOS_BADGES: Record<string, string> = {
  'pendiente': 'bg-yellow-500/20 text-yellow-500 border-yellow-500/30 hover:bg-yellow-500/30',
  'en_proceso': 'bg-blue-500/20 text-blue-500 border-blue-500/30 hover:bg-blue-500/30',
  'enviado': 'bg-purple-500/20 text-purple-500 border-purple-500/30 hover:bg-purple-500/30',
  'entregado': 'bg-green-500/20 text-green-500 border-green-500/30 hover:bg-green-500/30',
  'satisfecho': 'bg-emerald-500/20 text-emerald-500 border-emerald-500/30 hover:bg-emerald-500/30',
  'cancelado': 'bg-red-500/20 text-red-500 border-red-500/30 hover:bg-red-500/30',
};

// --- Reducer para manejar el estado ---
const initialState: State = {
  pedidos: [],
  loading: true,
  error: null,
};

function pedidosReducer(state: State, action: Action): State {
  switch (action.type) {
    case 'FETCH_START':
      return { ...state, loading: true, error: null };
    case 'FETCH_SUCCESS':
      return { ...state, loading: false, pedidos: action.payload };
    case 'FETCH_ERROR':
      return { ...state, loading: false, error: action.payload };
    default:
      return state;
  }
}

// --- Componente de Tarjeta de Pedido ---
const PedidoCard = ({ pedido }: { pedido: Pedido }) => (
  <Card className="bg-card shadow-lg rounded-xl border border-border flex flex-col justify-between transition-transform duration-300 hover:scale-[1.02] hover:shadow-primary/20">
    <CardHeader className="pb-4">
      <CardTitle className="text-xl font-bold text-primary flex justify-between items-center">
        <span>Pedido #{pedido.nro_pedido}</span>
        <Badge className={cn("capitalize px-3 py-1 rounded-full text-xs font-semibold", PEDIDO_ESTADOS_BADGES[pedido.estado] || 'bg-secondary text-secondary-foreground')}>
          {pedido.estado.replace(/_/g, ' ')}
        </Badge>
      </CardTitle>
      <p className="text-sm text-muted-foreground pt-1">{pedido.asunto}</p>
    </CardHeader>
    <CardContent className="space-y-3 text-sm text-foreground flex-grow">
      <div>
        <p><strong>Cliente:</strong> {pedido.nombre_cliente || 'N/A'}</p>
        <p><strong>Fecha:</strong> {new Date(pedido.fecha_creacion).toLocaleDateString('es-AR', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
        <p><strong>Rubro:</strong> <span className="capitalize">{pedido.rubro}</span></p>
      </div>
      {pedido.detalles && Array.isArray(pedido.detalles) && pedido.detalles.length > 0 && (
        <div className="mt-2 bg-muted/50 p-3 rounded-lg border border-border/60">
          <p className="font-semibold mb-2 text-primary/90">Detalles:</p>
          <ul className="list-disc list-inside space-y-1 text-xs">
            {pedido.detalles.map((item, idx) => (
              <li key={idx}>
                <span className="font-medium">{item.cantidad} {item.unidad}</span> de {item.nombre}
              </li>
            ))}
          </ul>
        </div>
      )}
      {pedido.monto_total !== null && (
        <p className="font-bold text-lg mt-3 text-right">Total: ${pedido.monto_total.toFixed(2)}</p>
      )}
    </CardContent>
    <CardFooter>
       <Button variant="outline" className="w-full text-sm border-primary text-primary hover:bg-primary/10 hover:text-primary">
         Gestionar Pedido
       </Button>
    </CardFooter>
  </Card>
);

// --- Componente de Esqueleto de Carga ---
const SkeletonCard = () => (
  <Card className="bg-card shadow-lg rounded-xl border border-border flex flex-col justify-between">
    <CardHeader className="pb-4">
      <Skeleton className="h-7 w-3/4 rounded-md" />
      <Skeleton className="h-4 w-1/2 mt-2 rounded-md" />
    </CardHeader>
    <CardContent className="space-y-3">
      <Skeleton className="h-4 w-full rounded-md" />
      <Skeleton className="h-4 w-5/6 rounded-md" />
      <Skeleton className="h-10 w-full mt-4 rounded-md" />
    </CardContent>
    <CardFooter>
      <Skeleton className="h-10 w-full rounded-md" />
    </CardFooter>
  </Card>
);

// --- Componente de Cabecera de Página ---
const PageHeader = ({ onLogout }: { onLogout: () => void }) => {
  const navigate = useNavigate();
  return (
    <div className="w-full max-w-7xl mx-auto mb-8 flex items-center justify-between">
      <Button variant="ghost" onClick={() => navigate("/perfil")} className="text-muted-foreground hover:text-foreground">
        <ChevronLeft className="w-5 h-5 mr-2" /> Volver al Perfil
      </Button>
      <h1 className="text-3xl sm:text-4xl font-extrabold text-primary leading-tight text-center flex-1 hidden sm:block">
        Panel de Pedidos
      </h1>
      <Button variant="outline" className="h-10 px-5 text-sm border-destructive text-destructive hover:bg-destructive/10" onClick={onLogout}>
        <LogOut className="w-4 h-4 mr-2" /> Salir
      </Button>
    </div>
  );
};


// --- Componente Principal de la Página ---
export default function PedidosPage() {
  const navigate = useNavigate();
  const [state, dispatch] = useReducer(pedidosReducer, initialState);

  const handleLogout = () => {
    safeLocalStorage.clear();
    navigate('/login');
  };

  const fetchPedidos = useCallback(async () => {
    dispatch({ type: 'FETCH_START' });
    try {
      // AQUÍ ESTÁ LA ÚNICA CORRECCIÓN: Se quitó la barra "/" del final.
      const data = await apiFetch<Pedido[]>('/pedidos');
      dispatch({ type: 'FETCH_SUCCESS', payload: data });
    } catch (err) {
      console.error('Error fetching pedidos:', err);
      dispatch({ type: 'FETCH_ERROR', payload: 'Error al cargar los pedidos. Por favor, asegúrate de estar logueado.' });
    }
  }, []);

  useEffect(() => {
    const token = safeLocalStorage.getItem("authToken");
    if (!token) {
      navigate('/login');
      return;
    }
    fetchPedidos();
  }, [fetchPedidos, navigate]);
  
  // --- Renderizado Condicional ---
  
  if (state.error) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background dark:bg-gray-900 text-foreground p-4">
        <AlertCircle className="w-16 h-16 text-destructive mb-4" />
        <h2 className="text-2xl font-semibold mb-2">Ocurrió un Error</h2>
        <p className="text-red-500 mb-6 text-center">{state.error}</p>
        <Button onClick={() => navigate('/login')} className="bg-primary hover:bg-primary/90">
          <ChevronLeft className="w-4 h-4 mr-2" /> Volver a Iniciar Sesión
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-muted/40 dark:bg-gradient-to-tr dark:from-slate-950 dark:to-slate-900 text-foreground py-8 px-4 md:px-6 lg:px-8">
      <PageHeader onLogout={handleLogout} />

      <main className="w-full max-w-7xl mx-auto">
        {state.loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {Array.from({ length: 6 }).map((_, index) => <SkeletonCard key={index} />)}
          </div>
        ) : state.pedidos.length === 0 ? (
          <div className="text-center text-muted-foreground text-lg mt-16">
             <Inbox className="w-20 h-20 mx-auto text-gray-400 mb-4" />
             <h3 className="text-2xl font-semibold text-foreground">No hay pedidos</h3>
             <p>Aún no se han registrado pedidos. Los nuevos pedidos aparecerán aquí.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {state.pedidos.map((pedido) => <PedidoCard key={pedido.id} pedido={pedido} />)}
          </div>
        )}
      </main>
    </div>
  );
}