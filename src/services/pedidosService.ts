import { apiFetch } from '@/utils/api';
// Definir el tipo Pedido aquí o importarlo de un archivo de tipos
export interface Pedido {
  id: number;
  nro_pedido: string;
  asunto: string;
  estado: string;
  detalles: Array<{ cantidad: number; unidad: string; nombre: string; sku?: string; precio_str?: string }>;
  monto_total: number | null;
  fecha_creacion: string;
  nombre_cliente: string | null;
  email_cliente: string | null;
  telefono_cliente: string | null;
  rubro: string;
}

export const getPedidos = async (): Promise<{pedidos: Pedido[]}> => {
  try {
    const response = await apiFetch<{pedidos: Pedido[]}>('/pedidos');
    return response;
  } catch (error) {
    console.error('Error fetching pedidos:', error);
    throw error;
  }
};
