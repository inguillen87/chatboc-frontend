import React from 'react';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { MarketProduct } from '@/types/market';
import { formatCurrency } from '@/utils/currency';
import { ExternalLink, Share2, ShoppingBag, Sparkles, Star } from 'lucide-react';

interface ProductCardProps {
  product: MarketProduct;
  onAdd: (productId: string) => void;
  isAdding?: boolean;
}

const formatPrice = (value?: number | null): string => {
  if (typeof value !== 'number' || Number.isNaN(value)) return '';
  return formatCurrency(value, 'ARS');
};

export default function ProductCard({ product, onAdd, isAdding }: ProductCardProps) {
  const currency = (product.currency ?? 'ARS').toUpperCase();
  const displayPrice = product.priceText ?? formatPrice(product.price, currency);
  const hasRating = typeof product.rating === 'number' && typeof product.ratingCount === 'number';

  return (
    <Card className="flex h-full flex-col overflow-hidden shadow-sm transition hover:-translate-y-1 hover:shadow-xl">
      {product.imageUrl ? (
        <div className="group relative aspect-[4/3] w-full overflow-hidden bg-muted">
          <img
            src={product.imageUrl}
            alt={product.name}
            className="h-full w-full object-cover transition duration-500 ease-out group-hover:scale-[1.03]"
            loading="lazy"
          />
          {product.promoInfo ? (
            <span className="absolute left-3 top-3 rounded-full bg-white/90 px-3 py-1 text-xs font-semibold text-amber-700 shadow-sm">
              <Sparkles className="mr-1 inline h-3.5 w-3.5" /> {product.promoInfo}
            </span>
          ) : null}
        </div>
      ) : (
        <div className="flex aspect-[4/3] w-full items-center justify-center bg-muted text-muted-foreground">
          <ShoppingBag className="h-8 w-8" />
        </div>
      )}

      <CardHeader className="space-y-2 pb-2">
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="line-clamp-2 text-lg font-semibold leading-snug">
            {product.name}
          </CardTitle>
          {product.modality ? (
            <Badge variant="outline" className="whitespace-nowrap text-xs uppercase">
              {product.modality}
            </Badge>
          ) : null}
        </div>
        {product.category ? (
          <Badge variant="secondary" className="w-fit text-xs font-medium">
            {product.category}
          </Badge>
        ) : null}
        {hasRating ? (
          <div className="flex items-center gap-1 text-sm text-amber-600">
            <Star className="h-4 w-4 fill-amber-500 text-amber-500" />
            <span className="font-semibold">{product.rating?.toFixed(1)}</span>
            <span className="text-xs text-muted-foreground">({product.ratingCount})</span>
          </div>
        ) : null}
        {product.descriptionShort ? (
          <p className="line-clamp-2 text-sm text-muted-foreground">{product.descriptionShort}</p>
        ) : product.description ? (
          <p className="line-clamp-2 text-sm text-muted-foreground">{product.description}</p>
        ) : null}
      </CardHeader>

      <CardContent className="flex flex-wrap items-center gap-3 pb-4">
        {product.price !== null && product.price !== undefined ? (
          <div className="text-xl font-bold text-primary">{formatPrice(product.price)}</div>
        ) : null}
        {product.points ? (
          <Badge variant="secondary" className="text-sm font-medium">
            {product.points} pts
          </Badge>
        ) : null}
        {product.tags?.length ? (
          <div className="flex flex-wrap gap-1.5 text-[11px] text-muted-foreground">
            {product.tags.slice(0, 3).map((tag) => (
              <span key={tag} className="rounded-full bg-muted px-2 py-1">
                #{tag}
              </span>
            ))}
          </div>
        ) : null}
      </CardContent>

        <CardFooter className="mt-auto border-t bg-card/50 p-4">
          <motion.div whileTap={{ scale: 0.98 }} className="w-full">
            <Button
              className="w-full"
              onClick={() => onAdd(product.id)}
              disabled={isAdding}
            >
              <ShoppingBag className="mr-2 h-4 w-4" />
              {isAdding ? 'Agregando…' : 'Agregar al carrito'}
            </Button>
          </motion.div>
        </CardFooter>
      </Card>
    </motion.div>
  );
}
