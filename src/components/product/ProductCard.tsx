import React from 'react';
import type { ParsedProduct } from '@/utils/productParser';
import { Card, CardContent } from '@/components/ui/card';

interface Props {
  product: ParsedProduct;
}

const ProductCard: React.FC<Props> = ({ product }) => {
  const { nombre, presentacion, precio_unitario, marca, imagen_url } = product;
  return (
    <Card className="border border-border bg-card rounded-xl shadow-sm hover:shadow-lg transition-all hover:-translate-y-1">
      <CardContent className="p-3 flex flex-col gap-2 items-center">
        {imagen_url && (
          <img
            src={imagen_url}
            alt={nombre}
            className="w-full h-32 object-contain rounded-md"
          />
        )}
        <h4 className="font-semibold text-sm text-center text-foreground line-clamp-2">
          {nombre}
        </h4>
        {presentacion && (
          <p className="text-xs text-muted-foreground text-center">{presentacion}</p>
        )}
        <p className="font-bold text-sm text-primary">
          {precio_unitario ? `$${precio_unitario}` : 'Consultar precio'}
        </p>
        {marca && <p className="text-xs text-muted-foreground">{marca}</p>}
      </CardContent>
    </Card>
  );
};

export default ProductCard;
