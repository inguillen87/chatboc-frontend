import React from 'react';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { MarketProduct } from '@/types/market';
import { formatCurrency } from '@/utils/currency';
import { ExternalLink, Share2, ShoppingBag, Sparkles } from 'lucide-react';

interface ProductCardProps {
  product: MarketProduct;
  onAdd: (productId: string) => void;
  isAdding?: boolean;
}

const formatPrice = (value?: number | null, currency = 'ARS'): string => {
  if (typeof value !== 'number' || Number.isNaN(value)) return '';
  return formatCurrency(value, currency);
};

export default function ProductCard({ product, onAdd, isAdding }: ProductCardProps) {
  const currency = (product.currency ?? 'ARS').toUpperCase();
  const displayPrice = product.priceText ?? formatPrice(product.price, currency);

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
        {product.descriptionShort ? (
          <p className="line-clamp-2 text-sm text-muted-foreground">{product.descriptionShort}</p>
        ) : product.description ? (
          <p className="line-clamp-2 text-sm text-muted-foreground">{product.description}</p>
        ) : null}
      </CardHeader>

      <CardContent className="flex flex-wrap items-center gap-3 pb-4">
        {displayPrice ? <div className="text-xl font-bold text-primary">{displayPrice}</div> : null}
        {product.points ? (
          <Badge variant="secondary" className="text-sm font-medium">
            {product.points} pts
          </Badge>
        ) : null}
        {product.promoInfo ? (
          <Badge variant="outline" className="text-xs font-medium text-amber-700">
            <Sparkles className="mr-1 h-3 w-3" /> {product.promoInfo}
          </Badge>
        ) : null}
      </CardContent>

      <CardFooter className="mt-auto flex flex-col gap-2 border-t bg-card/50 p-4">
        <div className="grid w-full grid-cols-2 gap-2">
          <Button
            className="w-full"
            onClick={() => onAdd(product.id)}
            disabled={isAdding}
          >
            <ShoppingBag className="mr-2 h-4 w-4" />
            {isAdding ? 'Agregando…' : 'Agregar'}
          </Button>
          <Button
            className="w-full"
            variant="outline"
            size="default"
            onClick={() => {
              if (product.whatsappShareUrl) {
                window.open(product.whatsappShareUrl, '_blank', 'noopener,noreferrer');
                return;
              }
              if (product.publicUrl) {
                window.open(product.publicUrl, '_blank', 'noopener,noreferrer');
              }
            }}
            disabled={!product.publicUrl && !product.whatsappShareUrl}
          >
            <Share2 className="mr-2 h-4 w-4" /> Compartir
          </Button>
        </div>
        {product.publicUrl ? (
          <Button asChild variant="ghost" className="h-9 justify-start px-2 text-xs text-muted-foreground">
            <a href={product.publicUrl} target="_blank" rel="noreferrer">
              <ExternalLink className="mr-2 h-3.5 w-3.5" /> Ver detalle público
            </a>
          </Button>
        ) : null}
      </CardFooter>
    </Card>
  );
}
