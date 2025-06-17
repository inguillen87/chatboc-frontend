import React from 'react';
import type { ParsedProduct } from '@/utils/productParser';

interface Props {
  product: ParsedProduct;
}

const ProductCard: React.FC<Props> = ({ product }) => {
  const { nombre, presentacion, precio_unitario, marca, imagen_url } = product;
  return (
    <div className="border border-border rounded-xl p-3 bg-card shadow-sm flex flex-col gap-2 w-56">
      {imagen_url && (
        <img
          src={imagen_url}
          alt={nombre}
          className="w-full h-32 object-contain rounded-md"
        />
      )}
      <h4 className="font-semibold text-sm text-foreground">{nombre}</h4>
      <p className="text-xs text-muted-foreground">
        {presentacion || 'Sin presentación'}
      </p>
      <p className="font-bold text-sm text-primary">
        {precio_unitario ? `$${precio_unitario}` : 'Consultar precio'}
      </p>
      {marca && <p className="text-xs text-muted-foreground">{marca}</p>}
    </div>
  );
};

export default ProductCard;
