export interface PublicOrderTrackingResponse {
  id: number;
  nro_pedido: string;
  estado: 'pendiente' | 'confirmado' | 'en_proceso' | 'enviado' | 'entregado' | 'cancelado';
  asunto: string;
  monto_total: number;
  fecha_creacion: string;
  nombre_cliente: string;
  email_cliente: string;
  telefono_cliente: string;
  direccion: string;
  detalles: Array<{
    nombre_producto: string;
    cantidad: number;
    precio_unitario_original: number;
    subtotal_con_descuento: number;
    moneda: string;
    presentacion?: string;
    sku?: string;
  }>;
  pyme_nombre: string;
  tenant_slug: string;
  tenant_logo?: string;
  tenant_theme?: {
    primaryColor: string;
    secondaryColor: string;
  };
}
