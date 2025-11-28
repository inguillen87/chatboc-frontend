import React from 'react';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { MarketProduct } from '@/types/market';
import { formatCurrency } from '@/utils/currency';
import { ShoppingBag } from 'lucide-react';

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
  return (
    <Card className="flex h-full flex-col overflow-hidden shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg">
      {product.imageUrl ? (
        <div className="aspect-[4/3] w-full bg-muted">
          <img
            src={product.imageUrl}
            alt={product.name}
            className="h-full w-full object-cover"
            loading="lazy"
          />
        </div>
      ) : (
        <div className="flex aspect-[4/3] w-full items-center justify-center bg-muted text-muted-foreground">
          <ShoppingBag className="h-8 w-8" />
        </div>
      )}

      <CardHeader className="space-y-2 pb-2">
        <CardTitle className="line-clamp-2 text-lg font-semibold leading-snug">
          {product.name}
        </CardTitle>
        {product.description ? (
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
      </CardContent>

      <CardFooter className="mt-auto border-t bg-card/50 p-4">
        <Button
          className="w-full"
          onClick={() => onAdd(product.id)}
          disabled={isAdding}
        >
          <ShoppingBag className="mr-2 h-4 w-4" />
          {isAdding ? 'Agregando…' : 'Agregar al carrito'}
        </Button>
      </CardFooter>
    </Card>
  );
}
