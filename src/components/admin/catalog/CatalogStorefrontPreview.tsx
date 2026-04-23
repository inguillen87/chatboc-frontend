import React from 'react';
import { ShoppingCart, Smartphone, Globe, MessageSquare } from 'lucide-react';
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

export const CatalogStorefrontPreview: React.FC<CatalogStorefrontPreviewProps> = ({ products, mode, tenantName }) => {
  const getDeviceFrame = () => {
     if (mode === 'whatsapp') {
        return (
          <div className="w-[320px] h-[550px] bg-[#efeae2] border-[8px] border-zinc-800 rounded-3xl overflow-hidden relative shadow-xl mx-auto flex flex-col">
             <div className="bg-[#075e54] text-white p-3 flex items-center gap-3 shadow-md shrink-0">
                <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center font-bold text-sm">
                   {tenantName.substring(0, 1)}
                </div>
                <div>
                   <div className="font-semibold text-sm leading-tight">{tenantName}</div>
                   <div className="text-[10px] text-white/80">Cuenta de empresa</div>
                </div>
             </div>
             <div className="flex-1 overflow-y-auto p-4 space-y-4">
                <div className="bg-white rounded-lg p-3 shadow-sm relative">
                   <div className="font-medium text-[#075e54] text-xs mb-1">Catálogo actualizado</div>
                   <div className="text-sm mb-3">Revisa nuestros productos disponibles. ¿Qué te gustaría pedir?</div>

                   <div className="space-y-2">
                     {products.slice(0, 3).map((p, idx) => (
                        <div key={idx} className="flex items-center gap-2 border rounded p-1.5 bg-gray-50/50">
                           {p.imageUrl ? (
                             <img src={p.imageUrl} alt={p.name} className="w-10 h-10 object-cover rounded bg-gray-200" />
                           ) : (
                             <div className="w-10 h-10 bg-gray-200 rounded flex items-center justify-center"><ShoppingCart className="w-4 h-4 text-gray-400" /></div>
                           )}
                           <div className="flex-1 overflow-hidden">
                              <p className="text-[11px] font-medium truncate">{p.name}</p>
                              <p className="text-[10px] text-muted-foreground">${p.price?.toFixed(2) || 'Consultar'}</p>
                           </div>
                        </div>
                     ))}
                   </div>
                   <div className="mt-3 border-t pt-2 text-center text-[12px] text-blue-500 font-medium">Ver catálogo completo</div>
                </div>
             </div>
          </div>
        );
     }

     if (mode === 'widget') {
        return (
          <div className="w-[350px] h-[550px] bg-background border rounded-lg overflow-hidden relative shadow-2xl mx-auto flex flex-col">
             <div className="bg-primary text-primary-foreground p-3 flex items-center gap-3 shrink-0">
                <MessageSquare className="w-5 h-5" />
                <span className="font-semibold text-sm">Asistente Virtual</span>
             </div>
             <div className="flex-1 overflow-y-auto p-4 bg-muted/20">
                <div className="bg-background rounded-lg border shadow-sm p-3 inline-block max-w-[85%] float-left">
                   <p className="text-sm mb-2">Aquí tienes nuestro catálogo:</p>
                   <div className="flex overflow-x-auto gap-2 pb-2 -mx-1 px-1 snap-x">
                     {products.slice(0, 4).map((p, idx) => (
                        <div key={idx} className="w-32 shrink-0 border rounded bg-card snap-center">
                           <div className="aspect-square bg-muted rounded-t flex items-center justify-center">
                              {p.imageUrl ? <img src={p.imageUrl} alt={p.name} className="w-full h-full object-cover rounded-t" /> : <ShoppingCart className="w-6 h-6 text-muted-foreground" />}
                           </div>
                           <div className="p-2">
                              <p className="text-xs font-medium line-clamp-1">{p.name}</p>
                              <p className="text-xs font-bold mt-1">${p.price}</p>
                              <Button size="sm" variant="secondary" className="w-full h-6 text-[10px] mt-2">Agregar</Button>
                           </div>
                        </div>
                     ))}
                   </div>
                </div>
             </div>
          </div>
        );
     }

     return (
        <div className="w-full h-[550px] bg-background border rounded-lg overflow-hidden relative shadow-sm flex flex-col">
           <div className="border-b p-4 flex items-center justify-between bg-card shrink-0">
              <h2 className="font-bold">{tenantName} Store</h2>
              <div className="flex gap-2">
                 <Badge variant="outline">Portal Web</Badge>
                 <ShoppingCart className="w-5 h-5" />
              </div>
           </div>
           <div className="flex-1 overflow-y-auto p-6 bg-muted/10 grid grid-cols-2 md:grid-cols-4 gap-4 auto-rows-max">
              {products.map((p, idx) => (
                 <div key={idx} className="border rounded-lg bg-card p-3 flex flex-col h-full">
                    <div className="aspect-square bg-muted rounded-md mb-3 flex items-center justify-center">
                       {p.imageUrl ? <img src={p.imageUrl} alt={p.name} className="w-full h-full object-cover rounded-md" /> : <ShoppingCart className="w-8 h-8 text-muted-foreground/50" />}
                    </div>
                    <div className="flex-1">
                       <p className="text-xs font-medium text-primary mb-1">{p.category}</p>
                       <h3 className="text-sm font-semibold line-clamp-2">{p.name}</h3>
                       <p className="font-bold mt-2">${p.price}</p>
                    </div>
                    <Button size="sm" className="w-full mt-3 h-8 text-xs">Agregar al carrito</Button>
                 </div>
              ))}
           </div>
        </div>
     );
  };

  return (
    <div className="flex flex-col gap-4 w-full h-full">
      <div className="flex items-center justify-center p-8 bg-muted/30 border rounded-lg overflow-hidden">
         {getDeviceFrame()}
      </div>
    </div>
  );
};
