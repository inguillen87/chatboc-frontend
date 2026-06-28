import React from 'react';
import { Globe, MessageSquare, ShoppingCart, Smartphone } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

interface PreviewProduct {
  id: string;
  name: string;
  category: string;
  price?: number;
  stock?: number;
  imageUrl?: string;
  description?: string;
}

interface CatalogStorefrontPreviewProps {
  products: PreviewProduct[];
  mode: 'whatsapp' | 'widget' | 'portal';
  tenantName: string;
}

const formatPrice = (price?: number) =>
  typeof price === 'number' && Number.isFinite(price)
    ? new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(price)
    : 'Consultar';

const ProductThumb = ({ product, className = '' }: { product: PreviewProduct; className?: string }) => (
  <div className={`overflow-hidden bg-muted ${className}`}>
    {product.imageUrl ? (
      <img src={product.imageUrl} alt={product.name} className="h-full w-full object-cover" />
    ) : (
      <div className="flex h-full w-full items-center justify-center">
        <ShoppingCart className="h-5 w-5 text-muted-foreground" />
      </div>
    )}
  </div>
);

export const CatalogStorefrontPreview: React.FC<CatalogStorefrontPreviewProps> = ({ products, mode, tenantName }) => {
  if (mode === 'whatsapp') {
    return (
      <div className="flex justify-center rounded-xl border bg-muted/30 p-6">
        <div className="mx-auto flex h-[550px] w-[320px] flex-col overflow-hidden rounded-[28px] border-[8px] border-zinc-900 bg-[#efeae2] shadow-2xl">
          <div className="flex shrink-0 items-center gap-3 bg-[#075e54] p-3 text-white shadow-md">
            <Smartphone className="h-5 w-5" />
            <div>
              <div className="text-sm font-semibold leading-tight">{tenantName}</div>
              <div className="text-[10px] text-white/80">Cuenta de empresa</div>
            </div>
          </div>
          <div className="flex-1 space-y-4 overflow-y-auto p-4">
            <div className="rounded-xl bg-white p-3 text-zinc-900 shadow-sm">
              <div className="mb-1 text-xs font-semibold text-[#075e54]">Catalogo actualizado</div>
              <div className="mb-3 text-sm">Estos son los productos disponibles. Elegi uno y armamos el pedido.</div>
              <div className="space-y-2">
                {products.slice(0, 3).map((product) => (
                  <div key={product.id} className="flex items-center gap-2 rounded-lg border bg-zinc-50 p-1.5">
                    <ProductThumb product={product} className="h-10 w-10 rounded" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[11px] font-medium">{product.name}</p>
                      <p className="text-[10px] text-zinc-500">{formatPrice(product.price)}</p>
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-3 border-t pt-2 text-center text-[12px] font-medium text-blue-600">Ver catalogo completo</div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (mode === 'widget') {
    return (
      <div className="flex justify-center rounded-xl border bg-muted/30 p-6">
        <div className="mx-auto flex h-[550px] w-[350px] flex-col overflow-hidden rounded-xl border bg-background shadow-2xl">
          <div className="flex shrink-0 items-center gap-3 bg-primary p-3 text-primary-foreground">
            <MessageSquare className="h-5 w-5" />
            <span className="text-sm font-semibold">Asistente virtual</span>
          </div>
          <div className="flex-1 overflow-y-auto bg-muted/20 p-4">
            <div className="max-w-[88%] rounded-xl border bg-background p-3 shadow-sm">
              <p className="mb-2 text-sm">Te dejo el catalogo actualizado:</p>
              <div className="-mx-1 flex snap-x gap-2 overflow-x-auto px-1 pb-2">
                {products.slice(0, 4).map((product) => (
                  <div key={product.id} className="w-32 shrink-0 snap-center overflow-hidden rounded-lg border bg-card">
                    <ProductThumb product={product} className="aspect-square" />
                    <div className="p-2">
                      <p className="line-clamp-1 text-xs font-medium">{product.name}</p>
                      <p className="mt-1 text-xs font-bold">{formatPrice(product.price)}</p>
                      <Button size="sm" variant="secondary" className="mt-2 h-6 w-full text-[10px]">Agregar</Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-[550px] w-full flex-col overflow-hidden rounded-xl border bg-background shadow-sm">
      <div className="flex shrink-0 items-center justify-between border-b bg-card p-4">
        <div>
          <h2 className="font-bold">{tenantName}</h2>
          <p className="text-xs text-muted-foreground">Marketplace publico</p>
        </div>
        <div className="flex gap-2">
          <Badge variant="outline"><Globe className="mr-1 h-3 w-3" /> Portal</Badge>
          <ShoppingCart className="h-5 w-5" />
        </div>
      </div>
      <div className="grid flex-1 auto-rows-max grid-cols-2 gap-4 overflow-y-auto bg-muted/10 p-6 md:grid-cols-4">
        {products.map((product) => (
          <div key={product.id} className="flex h-full flex-col rounded-xl border bg-card p-3 shadow-sm">
            <ProductThumb product={product} className="mb-3 aspect-square rounded-lg" />
            <div className="min-w-0 flex-1">
              <p className="mb-1 truncate text-xs font-medium text-primary">{product.category}</p>
              <h3 className="line-clamp-2 text-sm font-semibold">{product.name}</h3>
              <p className="mt-2 font-bold">{formatPrice(product.price)}</p>
            </div>
            <Button size="sm" className="mt-3 h-8 w-full text-xs">Agregar al carrito</Button>
          </div>
        ))}
      </div>
    </div>
  );
};
