import React, { useMemo, useState } from 'react';
import { Card, CardContent, CardFooter, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
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
  precio_por_caja?: number | null;
  unidades_por_caja?: number | null;
  promocion_activa?: string | null;
  precio_mayorista?: number | null;
  cantidad_minima_mayorista?: number | null;
}

export interface AddToCartOptions {
  quantity: number;
  mode: 'unit' | 'case';
}

interface ProductCardProps {
  product: ProductDetails;
  onAddToCart: (product: ProductDetails, options: AddToCartOptions) => void; // Callback para añadir al carrito
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
    precio_por_caja,
    unidades_por_caja,
    promocion_activa,
    precio_mayorista,
    cantidad_minima_mayorista,
  } = product;

  const hasStock = typeof stock_disponible === 'number' && stock_disponible > 0;
  const stockText = typeof stock_disponible === 'number'
    ? `${stock_disponible} ${unidad_medida || 'disponible(s)'}`
    : (stock_disponible === null || stock_disponible === undefined) ? null : 'No disponible';

  const [mode, setMode] = useState<'unit' | 'case'>(
    precio_por_caja && unidades_por_caja ? 'case' : 'unit'
  );
  const [quantity, setQuantity] = useState<number>(1);

  const casePriceLabel = useMemo(() => {
    if (!precio_por_caja || !unidades_por_caja) return null;
    return `${formatCurrency(precio_por_caja)} por ${unidades_por_caja} unidades`;
  }, [precio_por_caja, unidades_por_caja]);

  const wholesaleLabel = useMemo(() => {
    if (!precio_mayorista || !cantidad_minima_mayorista) return null;
    return `Mayorista: ${formatCurrency(precio_mayorista)} (mín. ${cantidad_minima_mayorista} ${cantidad_minima_mayorista === 1 ? 'caja' : 'cajas'})`;
  }, [precio_mayorista, cantidad_minima_mayorista]);

  const handleAddToCartClick = () => {
    if (quantity <= 0) return;
    onAddToCart(product, { quantity, mode });
    setQuantity(1);
  };

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

        {casePriceLabel && (
          <p className="text-xs text-muted-foreground mb-1">{casePriceLabel}</p>
        )}

        {wholesaleLabel && (
          <p className="text-xs text-muted-foreground mb-1">{wholesaleLabel}</p>
        )}

        {promocion_activa && (
          <Badge variant="success" className="mt-2">{promocion_activa}</Badge>
        )}

        <div className="mt-3">
          <p className="text-xl font-bold text-primary">
            {formatCurrency(precio_unitario)}
          </p>
          {precio_anterior && precio_anterior > precio_unitario && (
            <span className="text-xs text-muted-foreground line-through">
              {formatCurrency(precio_anterior)}
            </span>
          )}
        </div>
      </CardContent>

      <CardFooter className="p-4 flex flex-col gap-3 border-t">
        <div className="flex flex-wrap gap-2">
          <Button
            variant={mode === 'unit' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setMode('unit')}
            disabled={!precio_unitario}
          >
            {formatCurrency(precio_unitario)} c/u
          </Button>
          {precio_por_caja && unidades_por_caja && (
            <Button
              variant={mode === 'case' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setMode('case')}
            >
              {formatCurrency(precio_por_caja)} caja
            </Button>
          )}
        </div>

        <div className="flex items-center gap-2">
          <Input
            type="number"
            min={1}
            value={quantity}
            onChange={(event) => {
              const next = Number(event.target.value);
              if (!Number.isFinite(next) || next <= 0) {
                setQuantity(1);
                return;
              }
              setQuantity(Math.floor(next));
            }}
            className="w-20"
          />
          <Button
            size="sm"
            onClick={handleAddToCartClick}
            disabled={stock_disponible === 0}
            className="flex-1"
          >
            <ShoppingCart className="mr-2 h-4 w-4" />
            {mode === 'case' ? 'Agregar cajas' : 'Agregar'}
          </Button>
        </div>
      </CardFooter>
    </Card>
  );
};

export default ProductCard;
