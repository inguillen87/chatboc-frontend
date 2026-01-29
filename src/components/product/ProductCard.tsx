import React, { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardFooter, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { formatCurrency } from '@/utils/currency';
import { getProductPlaceholderImage } from '@/utils/cartPayload';
import { ShoppingCart, ExternalLink } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

// Interfaz detallada del producto
export interface ProductDetails {
  id: number | string;
  nombre: string;
  descripcion?: string | null;
  precio_unitario: number;
  precio_puntos?: number | null;
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
  promocion_info?: string | null;
  precio_texto?: string | null;
  moneda?: string | null;
  talles?: string[] | null;
  colores?: string[] | null;
  precio_mayorista?: number | null;
  cantidad_minima_mayorista?: number | null;
  modalidad?: 'venta' | 'puntos' | 'donacion' | string | null;
  instrucciones_entrega?: string | null;
  origen?: 'api' | 'demo';
  disponible?: boolean;
  // Mirror Catalog fields
  checkout_type?: 'mercadolibre' | 'tiendanube' | 'chatboc' | null;
  external_url?: string | null;
}

export interface AddToCartOptions {
  quantity: number;
  mode: 'unit' | 'case';
}

interface ProductCardProps {
  product: ProductDetails;
  onAddToCart: (product: ProductDetails, options: AddToCartOptions) => void; // Callback para añadir al carrito
}

const MotionButton = motion(Button);

const ProductCard: React.FC<ProductCardProps> = ({ product, onAddToCart }) => {
  const {
    nombre,
    descripcion,
    precio_unitario,
    precio_puntos,
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
    modalidad: modalidadRaw,
    checkout_type,
    external_url,
  } = product;

  const modalidad = typeof modalidadRaw === 'string' ? modalidadRaw.toLowerCase() : 'venta';
  const isDonation = modalidad === 'donacion';
  const isPoints = modalidad === 'puntos';
  const modalityBadgeLabel = isDonation ? 'Donación' : isPoints ? 'Canje' : 'Venta';
  const pointsValue = isPoints
    ? Number.isFinite(Number(precio_puntos)) && precio_puntos !== null
      ? Number(precio_puntos)
      : Math.max(Math.round(precio_unitario || 0), 0)
    : null;

  const hasStock = typeof stock_disponible === 'number' && stock_disponible > 0;
  const stockText = typeof stock_disponible === 'number'
    ? `${stock_disponible} ${unidad_medida || 'disponible(s)'}`
    : (stock_disponible === null || stock_disponible === undefined) ? null : 'No disponible';

  const [mode, setMode] = useState<'unit' | 'case'>(
    precio_por_caja && unidades_por_caja ? 'case' : 'unit'
  );
  const [quantity, setQuantity] = useState<number>(1);
  const [lastAddedQty, setLastAddedQty] = useState<number>(1);
  const [addedFeedback, setAddedFeedback] = useState(false);

  const casePriceLabel = useMemo(() => {
    if (!precio_por_caja || !unidades_por_caja) return null;
    return `${formatCurrency(precio_por_caja)} por ${unidades_por_caja} unidades`;
  }, [precio_por_caja, unidades_por_caja]);

  const wholesaleLabel = useMemo(() => {
    if (!precio_mayorista || !cantidad_minima_mayorista) return null;
    return `Mayorista: ${formatCurrency(precio_mayorista)} (mín. ${cantidad_minima_mayorista} ${cantidad_minima_mayorista === 1 ? 'caja' : 'cajas'})`;
  }, [precio_mayorista, cantidad_minima_mayorista]);

  const placeholderImage = useMemo(() => getProductPlaceholderImage(product), [product]);
  const [imageSrc, setImageSrc] = useState<string | null>(product.imagen_url ?? placeholderImage);

  useEffect(() => {
    setImageSrc(product.imagen_url ?? placeholderImage);
  }, [product, placeholderImage]);

  const handleAddToCartClick = () => {
    if (quantity <= 0) return;
    const added = quantity;
    onAddToCart(product, { quantity: added, mode });
    setLastAddedQty(added);
    setQuantity(1);
    setAddedFeedback(true);
    setTimeout(() => setAddedFeedback(false), 900);
  };

  const isExternalCheckout = (checkout_type === 'mercadolibre' || checkout_type === 'tiendanube') && external_url;

  return (
    <Card className="relative flex flex-col justify-between w-full max-w-sm bg-card rounded-lg shadow-md hover:shadow-xl transition-shadow duration-300 overflow-hidden">
      <CardHeader className="p-0 relative">
        {imageSrc ? (
          <img
            src={imageSrc}
            alt={nombre}
            loading="lazy"
            onError={(event) => {
              const fallback = placeholderImage;
              if (event.currentTarget.src !== fallback) {
                setImageSrc(fallback);
              }
            }}
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
        <Badge variant={isDonation ? 'success' : isPoints ? 'outline' : 'secondary'} className="absolute top-2 left-2">
          {modalityBadgeLabel}
        </Badge>
        <AnimatePresence>
          {addedFeedback && (
            <motion.div
              initial={{ opacity: 0, scale: 0.8, y: -6 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.8, y: -6 }}
              transition={{ duration: 0.18 }}
              className="absolute top-3 left-3 rounded-full bg-primary text-primary-foreground text-xs px-3 py-1 shadow"
            >
              +{lastAddedQty} agregado
            </motion.div>
          )}
        </AnimatePresence>
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
          {isDonation ? (
            <p className="text-lg font-semibold text-green-700">Donación</p>
          ) : isPoints ? (
            <p className="text-xl font-bold text-primary">{pointsValue ?? 0} pts</p>
          ) : (
            <>
              <p className="text-xl font-bold text-primary">
                {formatCurrency(precio_unitario)}
              </p>
              {precio_anterior && precio_anterior > precio_unitario && (
                <span className="text-xs text-muted-foreground line-through">
                  {formatCurrency(precio_anterior)}
                </span>
              )}
            </>
          )}
        </div>
      </CardContent>

      <CardFooter className="p-4 flex flex-col gap-3 border-t">
        {!isDonation && !isExternalCheckout && (
          <div className="flex flex-wrap gap-2">
            <Button
              variant={mode === 'unit' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setMode('unit')}
              disabled={!precio_unitario && !isPoints}
            >
              {isPoints ? `${pointsValue ?? 0} pts` : `${formatCurrency(precio_unitario)} c/u`}
            </Button>
            {precio_por_caja && unidades_por_caja && (
              <Button
                variant={mode === 'case' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setMode('case')}
              >
                {isPoints && pointsValue
                  ? `${pointsValue * (unidades_por_caja || 1)} pts caja`
                  : `${formatCurrency(precio_por_caja)} caja`}
              </Button>
            )}
          </div>
        )}

        {isExternalCheckout ? (
           <Button
             className="w-full"
             variant={checkout_type === 'mercadolibre' ? 'secondary' : 'default'}
             asChild
           >
             <a href={external_url || '#'} target="_blank" rel="noopener noreferrer">
                {checkout_type === 'mercadolibre' ? 'Comprar en Mercado Libre' : 'Comprar en Tienda Online'}
                <ExternalLink className="ml-2 h-4 w-4" />
             </a>
           </Button>
        ) : (
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
            <MotionButton
              size="sm"
              onClick={handleAddToCartClick}
              disabled={stock_disponible === 0}
              className="flex-1"
              whileTap={{ scale: 0.96 }}
              whileHover={{ scale: 1.01 }}
              animate={addedFeedback ? { scale: [1, 1.05, 1], transition: { duration: 0.3 } } : undefined}
            >
              <ShoppingCart className="mr-2 h-4 w-4" />
              {isDonation
                ? 'Donar este ítem'
                : isPoints
                  ? `Canjear${pointsValue ? ` (${pointsValue} pts)` : ''}`
                  : mode === 'case'
                    ? 'Agregar cajas'
                    : 'Agregar'}
            </MotionButton>
          </div>
        )}
      </CardFooter>
    </Card>
  );
};

export default ProductCard;
