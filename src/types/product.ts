export interface Product {
  nombre: string;
  categoria: string;
  descripcion?: string;
  sku?: string;
  presentacion: string;
  talles?: string[] | string;
  colores?: string[] | string;
  precio_unitario: number | string | null;
  precio_pack?: number | string;
  stock?: number;
  marca?: string;
  imagen_url?: string;
}
