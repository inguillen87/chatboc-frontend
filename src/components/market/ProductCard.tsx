import React from 'react';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { MarketProduct } from '@/types/market';
import ProductPlaceholder from './ProductPlaceholder';
import { displayMarketPrice } from '@/utils/currency';
import { getMarketCommercialValidation } from '@/utils/marketValidation';
import { Check, ExternalLink, MessageCircle, Share2, ShoppingBag, Sparkles, Star } from 'lucide-react';

interface ProductCardProps {
  product: MarketProduct;
  /** Where the photo and the name lead: the product page. */
  detailHref?: string;
  onAdd: (productId: string) => void;
  onConsult?: (product: MarketProduct, reason?: string | null) => void;
  isAdding?: boolean;
}

export default function ProductCard({ product, onAdd, onConsult, isAdding, detailHref }: ProductCardProps) {
  const [justAdded, setJustAdded] = React.useState(false);
  const addedTimer = React.useRef<number | undefined>(undefined);
  React.useEffect(() => () => window.clearTimeout(addedTimer.current), []);
  const [shareNote, setShareNote] = React.useState<string | null>(null);
  // Share the store's own product page when the catalog has no share link:
  // the phone's share sheet when there is one, otherwise copy the link.
  const shareProduct = async () => {
    if (product.whatsappShareUrl) { window.open(product.whatsappShareUrl, '_blank', 'noopener,noreferrer'); return; }
    if (product.publicUrl) { window.open(product.publicUrl, '_blank', 'noopener,noreferrer'); return; }
    if (!detailHref) return;
    const url = new URL(detailHref, window.location.origin).toString();
    try {
      if (typeof navigator.share === 'function') { await navigator.share({ title: product.name, url }); return; }
      await navigator.clipboard.writeText(url);
      setShareNote('Link copiado');
      window.setTimeout(() => setShareNote(null), 2500);
    } catch {
      /* The person closed the share sheet or the clipboard is unavailable. */
    }
  };
  const currency = (product.currency ?? 'ARS').toUpperCase();
  const displayPrice = displayMarketPrice(product.priceText, product.price, currency) ?? '';
  const hasRating = typeof product.rating === 'number' && typeof product.ratingCount === 'number';
  const validation = getMarketCommercialValidation(product, product.inventory);
  const canAddToCart = validation.canStartCheckout && product.disponible !== false;

  return (
    <Card className="flex h-full flex-col overflow-hidden shadow-sm transition hover:-translate-y-1 hover:shadow-xl">
      {product.imageUrl ? (
        <div className="group relative aspect-[4/3] w-full overflow-hidden bg-muted">
          {detailHref ? <Link to={detailHref} tabIndex={-1} aria-hidden="true" className="absolute inset-0 z-[1]" /> : null}
          <img
            src={product.imageUrl}
            alt={product.imageAlt || product.name}
            className="h-full w-full object-cover transition duration-500 ease-out group-hover:scale-[1.03]"
            loading="lazy"
          />
          {product.galleryUrls?.length ? (
            <span className="absolute bottom-3 right-3 rounded-full bg-black/65 px-2 py-1 text-xs font-medium text-white">
              {product.galleryUrls.length} fotos
            </span>
          ) : null}
          {product.promoInfo ? (
            <span className="absolute left-3 top-3 rounded-full bg-white/90 px-3 py-1 text-xs font-semibold text-amber-700 shadow-sm">
              <Sparkles className="mr-1 inline h-3.5 w-3.5" /> {product.promoInfo}
            </span>
          ) : null}
        </div>
      ) : (
        <div className="aspect-[4/3] w-full" role="img" aria-label={product.category ? `${product.name}, ${product.category}` : product.name}>
          <ProductPlaceholder category={product.category} />
        </div>
      )}

      <CardHeader className="space-y-2 pb-2">
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="line-clamp-2 text-lg font-semibold leading-snug">
            {detailHref ? (
              <Link to={detailHref} className="hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm">
                {product.name}
              </Link>
            ) : product.name}
          </CardTitle>
          {product.modality && !['venta', 'compra', 'sale'].includes(product.modality.trim().toLowerCase()) ? (
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
        {product.promoInfo ? (
          <Badge variant="outline" className="w-fit border-amber-300 bg-amber-50 text-xs font-semibold text-amber-800">
            <Sparkles className="mr-1 h-3.5 w-3.5" />
            {product.promoInfo}
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
        {displayPrice ? <div className="text-xl font-bold text-primary">{displayPrice}</div> : null}
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

      <CardFooter className="mt-auto flex flex-col gap-2 border-t bg-card/50 p-4">
        <div className="grid w-full grid-cols-2 gap-2">
          {product.checkout_type === 'mercadolibre' && product.external_url && canAddToCart ? (
            <Button
              className="w-full bg-[#FFE600] font-semibold text-[#2D3277] transition-all hover:scale-105 hover:bg-[#FDD835] hover:shadow-md"
              asChild
            >
              <a href={product.external_url} target="_blank" rel="noopener noreferrer">
                Ver en ML
                <ExternalLink className="ml-2 h-4 w-4" />
              </a>
            </Button>
          ) : product.checkout_type === 'tiendanube' && product.external_url && canAddToCart ? (
            <Button
              className="w-full bg-[#2D3277] font-semibold text-white transition-all hover:scale-105 hover:bg-[#1E2150] hover:shadow-md"
              asChild
            >
              <a href={product.external_url} target="_blank" rel="noopener noreferrer">
                Ver en Tienda
                <ExternalLink className="ml-2 h-4 w-4" />
              </a>
            </Button>
          ) : (
            <Button
              className="w-full"
              onClick={() => {
                if (canAddToCart) {
                  onAdd(product.id);
                  setJustAdded(true);
                  window.clearTimeout(addedTimer.current);
                  addedTimer.current = window.setTimeout(() => setJustAdded(false), 2000);
                  return;
                }
                onConsult?.(product, validation.reason);
              }}
              disabled={isAdding || (!canAddToCart && !onConsult)}
              title={!canAddToCart && validation.reason ? validation.reason : undefined}
            >
              {justAdded && !isAdding ? <Check className="mr-2 h-4 w-4" /> : canAddToCart ? <ShoppingBag className="mr-2 h-4 w-4" /> : <MessageCircle className="mr-2 h-4 w-4" />}
              <span aria-live="polite">
                {isAdding ? 'Agregando…' : justAdded ? 'Agregado' : canAddToCart ? 'Agregar' : 'Consultar'}
              </span>
            </Button>
          )}
          <Button
            className="w-full"
            variant="outline"
            size="default"
            onClick={() => { void shareProduct(); }}
            disabled={!product.publicUrl && !product.whatsappShareUrl && !detailHref}
          >
            <Share2 className="mr-2 h-4 w-4" /> {shareNote ?? 'Compartir'}
          </Button>
        </div>
        {product.publicUrl ? (
          <Button asChild variant="ghost" className="h-9 justify-start px-2 text-xs text-muted-foreground">
            <a href={product.publicUrl} target="_blank" rel="noreferrer">
              <ExternalLink className="mr-2 h-3.5 w-3.5" /> Ver detalle publico
            </a>
          </Button>
        ) : null}
        {!canAddToCart && validation.reason ? (
          <p className="text-xs text-muted-foreground">{validation.reason}</p>
        ) : null}
      </CardFooter>
    </Card>
  );
}
