import React from 'react';
import { Card, CardContent, CardFooter, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { formatCurrency } from '@/utils/currency';
import { ShoppingCart } from 'lucide-react';

// Interfaz detallada del producto
export interface ProductDetails {
  id: number | string;
  nombre: string;
  descripcion?: string | null;
  precio_unitario: number;
  precio_anterior?: number | null;
  imagen_url?: string | null;
  presentacion?: string | null;
  categoria?: string | null;
  badge?: string | null;
  badge_variant?: 'default' | 'secondary' | 'destructive' | 'outline' | 'success' | 'warning';
  stock_disponible?: number | null;
  unidad_medida?: string | null;
  sku?: string | null;
  marca?: string | null;
}

interface ProductCardProps {
  product: ProductDetails;
  onAddToCart: (product: ProductDetails) => void; // Callback para añadir al carrito
}

const ProductCard: React.FC<ProductCardProps> = ({ product, onAddToCart }) => {
  const {
    nombre,
    descripcion,
    precio_unitario,
    precio_anterior,
    imagen_url,
    presentacion,
    badge,
    badge_variant = 'secondary', // default badge variant
    stock_disponible,
    unidad_medida,
    marca,
  } = product;

  const hasStock = typeof stock_disponible === 'number' && stock_disponible > 0;
  const stockText = typeof stock_disponible === 'number'
    ? `${stock_disponible} ${unidad_medida || 'disponible(s)'}`
    : (stock_disponible === null || stock_disponible === undefined) ? null : 'No disponible';

  return (
    <Card className="flex flex-col justify-between w-full max-w-sm bg-card rounded-lg shadow-md hover:shadow-xl transition-shadow duration-300 overflow-hidden">
      <CardHeader className="p-0 relative">
        {imagen_url ? (
          <img
            src={imagen_url}
            alt={nombre}
            className="w-full h-48 object-cover" // Ajustar altura de imagen
          />
        ) : (
          <div className="w-full h-48 bg-muted flex items-center justify-center">
            <ShoppingCart className="w-16 h-16 text-muted-foreground" /> {/* Placeholder Icon */}
          </div>
        )}
        {badge && (
          <Badge variant={badge_variant} className="absolute top-2 right-2">
            {badge}
          </Badge>
        )}
      </CardHeader>

      <CardContent className="p-4 flex-grow">
        <CardTitle className="text-lg font-semibold text-foreground mb-1 truncate" title={nombre}>
          {nombre}
        </CardTitle>

        {presentacion && presentacion !== 'NaN' && (
          <p className="text-xs text-muted-foreground mb-1">{presentacion}</p>
        )}

        {descripcion && (
          <CardDescription className="text-sm text-muted-foreground mb-2 h-10 overflow-hidden text-ellipsis">
            {descripcion}
          </CardDescription>
        )}

        {marca && (
          <p className="text-xs text-muted-foreground mb-2">Marca: {marca}</p>
        )}

        {stockText && (
           <p className={`text-xs mb-2 ${hasStock ? 'text-green-600' : 'text-red-600'}`}>
             Stock: {stockText}
           </p>
        )}
      </CardContent>

      <CardFooter className="p-4 flex flex-col items-start sm:flex-row sm:items-center sm:justify-between gap-2 border-t">
        <div className="flex flex-col">
          <p className="text-xl font-bold text-primary">
            {formatCurrency(precio_unitario)}
          </p>
          {precio_anterior && precio_anterior > precio_unitario && (
            <span className="text-xs text-muted-foreground line-through">
              {formatCurrency(precio_anterior)}
            </span>
          )}
        </div>
        <Button
          size="sm"
          onClick={() => onAddToCart(product)}
          disabled={stock_disponible === 0} // Deshabilitar si no hay stock
          className="w-full sm:w-auto"
        >
          <ShoppingCart className="mr-2 h-4 w-4" />
          Agregar
        </Button>
      </CardFooter>
    </Card>
  );
};

export default ProductCard;
