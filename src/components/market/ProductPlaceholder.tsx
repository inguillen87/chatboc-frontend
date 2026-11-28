import React from 'react';
import {
  Apple, Baby, BookOpen, Car, Coffee, CookingPot, CupSoda, Dumbbell, Flower2, Gift, Hammer,
  PawPrint, PencilLine, Pill, Shirt, ShoppingBag, Smartphone, Sofa, Sparkles, SprayCan, Wheat, Wine,
  type LucideIcon,
} from 'lucide-react';

const plain = (value: string) => value.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/** Category words to a drawing. First match wins; unknown categories get a shopping bag. */
const RULES: Array<[RegExp, LucideIcon]> = [
  [/mascota|veterinaria|\bpet\b|perro|gato/, PawPrint],
  [/almacen|despensa|alimento|comestible|panader|kiosco/, Wheat],
  [/bebida|gaseosa|jugo/, CupSoda],
  [/vino|bodega|cerveza|licor/, Wine],
  [/cafe|cafeteria|te\b|infusion/, Coffee],
  [/fruta|verdura|verduleria|organico/, Apple],
  [/limpieza|higiene del hogar/, SprayCan],
  [/bazar|cocina|menaje/, CookingPot],
  [/ferreteria|herramienta|construccion|corralon/, Hammer],
  [/libreria|papeleria|oficina|escolar/, PencilLine],
  [/libro|editorial/, BookOpen],
  [/perfumeria|cosmetica|belleza|cuidado personal/, Sparkles],
  [/farmacia|salud|botiquin/, Pill],
  [/ropa|indumentaria|moda|calzado|textil/, Shirt],
  [/tecnologia|electronica|celular|computacion/, Smartphone],
  [/mueble|hogar|deco/, Sofa],
  [/bebe|infantil|jugueteria|juguete/, Baby],
  [/deporte|fitness|gimnasio/, Dumbbell],
  [/auto|repuesto|lubricentro/, Car],
  [/vivero|jardin|planta/, Flower2],
  [/regalo|regaleria/, Gift],
];

export function categoryIcon(category?: string | null): LucideIcon {
  const text = plain(category ?? '');
  return RULES.find(([rule]) => rule.test(text))?.[1] ?? ShoppingBag;
}

/** A calm drawing for a product without its own photo: its category, never a stock photo. */
export default function ProductPlaceholder({ category, compact = false }: { category?: string | null; compact?: boolean }) {
  const Icon = categoryIcon(category);
  return (
    <div
      data-testid="product-placeholder"
      className="flex h-full w-full items-center justify-center bg-gradient-to-br from-primary/10 via-muted to-muted text-primary/80"
    >
      <div className="text-center">
        <span className={`mx-auto flex items-center justify-center rounded-full bg-background/70 shadow-sm ring-1 ring-primary/15 ${compact ? 'h-10 w-10' : 'h-16 w-16'}`}>
          <Icon className={compact ? 'h-5 w-5' : 'h-8 w-8'} aria-hidden="true" strokeWidth={1.75} />
        </span>
        {!compact && category ? <p className="mt-2 text-xs font-medium text-muted-foreground">{category}</p> : null}
      </div>
    </div>
  );
}
