export interface PublicOrderTrackingResponse {
  id?: number | string | null;
  tracking_id?: string;
  contract_version?: string;
  privacy?: {
    public_payload?: boolean;
    pii_redacted?: boolean;
    redacted_fields?: string[];
    private_detail_required?: string;
    [key: string]: unknown;
  };
  support_context?: Record<string, unknown>;
  nro_pedido: string;
  estado: 'pendiente' | 'confirmado' | 'en_proceso' | 'enviado' | 'entregado' | 'cancelado';
  asunto?: string | null;
  monto_total?: number | null;
  fecha_creacion?: string | null;
  nombre_cliente?: string | null;
  email_cliente?: string | null;
  telefono_cliente?: string | null;
  direccion?: string | null;
  delivery_summary?: string | null;
  latitud?: number | string | null;
  longitud?: number | string | null;
  lat?: number | string | null;
  lng?: number | string | null;
  latitude?: number | string | null;
  longitude?: number | string | null;
  delivery_location?: Record<string, unknown> | null;
  customer_location?: Record<string, unknown> | null;
  store_location?: Record<string, unknown> | null;
  driver_location?: Record<string, unknown> | null;
  detalles: Array<{
    nombre_producto: string;
    cantidad: number;
    precio_unitario_original: number;
    subtotal_con_descuento: number;
    moneda: string;
    presentacion?: string;
    sku?: string;
  }>;
  pyme_nombre?: string;
  tenant_slug?: string;
  tenant_logo?: string | null;
  tenant_theme?: {
    primaryColor: string;
    secondaryColor: string;
  };
}
