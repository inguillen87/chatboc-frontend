import React from 'react';
import type { ParsedProduct } from '@/utils/productParser';
import { Card, CardContent } from '@/components/ui/card';
import { formatCurrency } from '@/utils/currency';

interface Props {
  product: ParsedProduct;
}

const ProductCard: React.FC<Props> = ({ product }) => {
  const { nombre, presentacion, precio_unitario, marca, imagen_url } = product;
  const cleanPresentacion = presentacion === 'NaN' ? '' : presentacion;
  const numericPrice =
    typeof precio_unitario === 'number'
      ? precio_unitario
      : Number(precio_unitario);
  const showPrice =
    numericPrice !== undefined && numericPrice !== null && !isNaN(numericPrice);
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
        {cleanPresentacion && (
          <p className="text-xs text-muted-foreground text-center">{cleanPresentacion}</p>
        )}
        {showPrice && (
          <p className="font-bold text-sm text-primary">
            {formatCurrency(numericPrice)}
          </p>
        )}
        {marca && <p className="text-xs text-muted-foreground">{marca}</p>}
      </CardContent>
    </Card>
  );
};

export default ProductCard;
