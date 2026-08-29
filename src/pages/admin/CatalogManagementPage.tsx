import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useTenant } from '@/context/TenantContext';
import { apiClient } from '@/api/client';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import {
  Boxes,
  Check,
  CheckCircle2,
  Edit2,
  ExternalLink,
  Filter,
  Gauge,
  ImageOff,
  Loader2,
  PackageCheck,
  PackageX,
  Percent,
  Search,
  Sparkles,
  Tags,
  UploadCloud,
  AlertTriangle,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import { useUser } from '@/hooks/useUser';
import { CatalogPromotion, MarketplaceReadiness } from '@/types/catalog';
import { Progress } from '@/components/ui/progress';
import CatalogQualityCommandCenter from '@/components/admin/CatalogQualityCommandCenter';
import CatalogUploadWizard from '@/components/admin/catalog/CatalogUploadWizard';
import ProductImageManager from '@/components/admin/catalog/ProductImageManager';
import {
  getProductGalleryUrls,
  getProductImageAlt,
  getProductImageStatus,
  getProductPrimaryImage,
} from '@/utils/marketImages';

type CatalogManagementPageProps = {
  tenantSlugOverride?: string | null;
  embedded?: boolean;
};

const toRecord = (value: unknown): Record<string, any> =>
  value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, any>) : {};

const firstDefined = (record: Record<string, any>, keys: string[]) => {
  for (const key of keys) {
    if (record[key] !== undefined && record[key] !== null) return record[key];
  }
  return undefined;
};

const toFiniteMetric = (value: unknown): number | null => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
};

const normalizeCatalogRow = (row: unknown) => {
  const record = toRecord(row);
  const cells = toRecord(record.cells);
  return { ...cells, ...record };
};

const normalizeAdminCatalogItems = (catalog: any): any[] => {
  const directItems = Array.isArray(catalog?.items) ? catalog.items : [];
  if (directItems.length > 0) return directItems.map(normalizeCatalogRow);
  const rows = Array.isArray(catalog?.rows) ? catalog.rows : [];
  return rows.map(normalizeCatalogRow);
};

const getCatalogItemId = (product: any) =>
  firstDefined(toRecord(product), ['catalogo_item_id', 'catalog_item_id', 'item_id', 'product_id', 'id']);

const getCatalogPrice = (product: any) =>
  firstDefined(toRecord(product), ['price_numeric', 'price', 'precio', 'precio_unitario', 'amount']);

const getCatalogStock = (product: any) =>
  firstDefined(toRecord(product), [
    'stock_quantity',
    'stock',
    'stock_disponible',
    'cantidad',
    'inventory',
    'inventario',
    'available_quantity',
  ]);

const getCatalogStockStatus = (product: any) =>
  firstDefined(toRecord(product), ['stock_status', 'availability_status', 'available_to_sell']);

const getCatalogCategory = (product: any) =>
  firstDefined(toRecord(product), ['category', 'categoria']) || 'General';

const formatCurrency = (product: any) =>
  new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: product.currency || product.moneda || 'ARS',
  }).format(Number(getCatalogPrice(product) || 0));

type PromotionScope = 'cart' | 'category' | 'product';

type PromotionDraft = {
  name: string;
  description: string;
  value: string;
  fixedAmount: string;
  minCart: string;
  scope: PromotionScope;
  category: string;
  productId: string;
};

const emptyPromotionDraft: PromotionDraft = {
  name: '',
  description: '',
  value: '10',
  fixedAmount: '',
  minCart: '',
  scope: 'cart',
  category: 'all',
  productId: 'none',
};

const CatalogManagementPage = ({ tenantSlugOverride, embedded = false }: CatalogManagementPageProps) => {
  const { currentSlug, tenant } = useTenant();
  const { user } = useUser();
  const [products, setProducts] = useState<any[]>([]);
  const [catalogContract, setCatalogContract] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [catalogSnapshotLoaded, setCatalogSnapshotLoaded] = useState(false);
  const [catalogSnapshotTenant, setCatalogSnapshotTenant] = useState<string | null>(null);
  const [catalogDetailsLoaded, setCatalogDetailsLoaded] = useState(false);
  const [catalogDetailUnavailable, setCatalogDetailUnavailable] = useState(false);
  const [catalogLoadError, setCatalogLoadError] = useState<string | null>(null);
  const [catalogStale, setCatalogStale] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [stockFilter, setStockFilter] = useState('all');
  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [uploadOpen, setUploadOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | number | null>(null);
  const [editPrice, setEditPrice] = useState('');
  const [editStock, setEditStock] = useState('');
  const [updatingId, setUpdatingId] = useState<string | number | null>(null);
  const [varietalFilter, setVarietalFilter] = useState('all');
  const [promotions, setPromotions] = useState<CatalogPromotion[]>([]);
  const [promotionDraft, setPromotionDraft] = useState<PromotionDraft>(emptyPromotionDraft);
  const [creatingPromotion, setCreatingPromotion] = useState(false);
  const [togglingPromotionId, setTogglingPromotionId] = useState<string | null>(null);
  const catalogRequestSequence = useRef(0);

  const effectiveTenantSlug = tenantSlugOverride || currentSlug;

  const isWinery = useMemo(
    () => tenant?.rubro_slug === 'bodega' || user?.rubro === 'bodega' || effectiveTenantSlug?.includes('bodega'),
    [tenant, user, effectiveTenantSlug],
  );

  const loadProducts = async () => {
    const requestSequence = ++catalogRequestSequence.current;
    const hadConfirmedSnapshot =
      catalogSnapshotLoaded && Boolean(effectiveTenantSlug) && catalogSnapshotTenant === effectiveTenantSlug;
    setLoading(true);
    setCatalogLoadError(null);
    if (!hadConfirmedSnapshot) {
      setCatalogContract(null);
      setProducts([]);
      setPromotions([]);
      setCatalogSnapshotLoaded(false);
      setCatalogSnapshotTenant(null);
      setCatalogDetailsLoaded(false);
      setCatalogDetailUnavailable(false);
      setCatalogStale(false);
    }
    try {
      if (!effectiveTenantSlug) {
        setCatalogContract(null);
        setProducts([]);
        setPromotions([]);
        setCatalogSnapshotLoaded(false);
        setCatalogSnapshotTenant(null);
        setCatalogDetailsLoaded(false);
        setCatalogDetailUnavailable(false);
        setCatalogStale(false);
        setCatalogLoadError('No hay una organización seleccionada para consultar el catálogo.');
        return;
      }

      const catalog = await apiClient.adminGetCatalog(effectiveTenantSlug);
      if (requestSequence !== catalogRequestSequence.current) return;
      let catalogItems: any[] | null = null;
      try {
        const detail = await apiClient.adminListProducts(effectiveTenantSlug);
        catalogItems = Array.isArray(detail) ? detail.map(normalizeCatalogRow) : [];
      } catch (detailError) {
        console.warn('Catalog summary loaded without item detail:', detailError);
      }

      if (requestSequence !== catalogRequestSequence.current) return;

      setCatalogContract(catalog);
      setProducts(catalogItems ?? normalizeAdminCatalogItems(catalog));
      setCatalogDetailsLoaded(catalogItems !== null || Array.isArray(catalog?.items) || Array.isArray(catalog?.rows));
      setCatalogDetailUnavailable(catalogItems === null && !Array.isArray(catalog?.items) && !Array.isArray(catalog?.rows));
      setCatalogSnapshotLoaded(true);
      setCatalogSnapshotTenant(effectiveTenantSlug);
      setCatalogStale(false);
      setPromotions(Array.isArray(catalog?.promotions?.items) ? catalog.promotions.items : []);
    } catch (error) {
      if (requestSequence !== catalogRequestSequence.current) return;
      console.error('Error loading catalog:', error);
      if (!hadConfirmedSnapshot) {
        setCatalogContract(null);
        setProducts([]);
        setPromotions([]);
        setCatalogSnapshotLoaded(false);
        setCatalogSnapshotTenant(null);
        setCatalogDetailsLoaded(false);
        setCatalogDetailUnavailable(false);
      }
      setCatalogStale(hadConfirmedSnapshot);
      setCatalogLoadError(
        hadConfirmedSnapshot
          ? 'No se pudo actualizar el catálogo. Se conserva la última lectura confirmada y se marca como desactualizada.'
          : 'No se pudo confirmar el catálogo de esta organización. Reintentá la consulta.',
      );
      toast.error('No se pudo confirmar el catálogo.');
    } finally {
      if (requestSequence === catalogRequestSequence.current) setLoading(false);
    }
  };

  useEffect(() => {
    void loadProducts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [effectiveTenantSlug]);

  const startEditing = (product: any) => {
    const itemId = getCatalogItemId(product);
    setEditingId(itemId ?? product.id);
    setEditPrice(String(getCatalogPrice(product) ?? ''));
    setEditStock(String(getCatalogStock(product) ?? ''));
  };

  const cancelEditing = () => {
    setEditingId(null);
    setEditPrice('');
    setEditStock('');
  };

  const handleItemUpdate = async (product: any) => {
    if (!effectiveTenantSlug) return;
    const itemId = getCatalogItemId(product);
    if (!itemId) {
      toast.error('El item no tiene identificador de catalogo.');
      return;
    }

    const newPrice = editPrice.trim() ? Number(editPrice) : null;
    const newStock = editStock.trim() ? Number(editStock) : null;
    if (editPrice.trim() && !Number.isFinite(newPrice)) {
      toast.error('Precio invalido');
      return;
    }
    if (editStock.trim() && !Number.isFinite(newStock)) {
      toast.error('Stock invalido');
      return;
    }

    const payload: Record<string, unknown> = { inventory_source: 'tenant_admin_inline_edit' };
    if (newPrice !== null) {
      payload.price = newPrice;
      payload.precio = String(newPrice);
    }
    if (newStock !== null) {
      payload.stock_quantity = newStock;
      payload.stock = newStock;
    }

    setUpdatingId(itemId);
    try {
      const response = await apiClient.adminUpdateCatalogItem(effectiveTenantSlug, itemId, payload);
      const updatedItem = response?.item || response?.data?.item || response;
      setProducts((prev) =>
        prev.map((productItem) =>
          String(getCatalogItemId(productItem)) === String(itemId) ? { ...productItem, ...toRecord(updatedItem) } : productItem,
        ),
      );
      if (response?.catalog_version) {
        setCatalogContract((prev: any) => ({ ...(prev || {}), catalog_version: response.catalog_version }));
      }
      toast.success('Cambio confirmado por backend');
      cancelEditing();
    } catch (error) {
      console.error('Update failed', error);
      toast.error('No se pudo actualizar el item');
    } finally {
      setUpdatingId(null);
    }
  };

  const categories = Array.from(new Set(products.map((product) => getCatalogCategory(product)).filter(Boolean)));
  const varietals = isWinery
    ? Array.from(new Set(products.map((product) => product.extra_metadata?.varietal || product.varietal).filter(Boolean)))
    : [];

  const filteredProducts = products.filter((product) => {
    const name = product.name || product.nombre || '';
    const desc = product.description || product.descripcion || '';
    const cat = product.category || product.categoria;
    const stock = getCatalogStock(product);
    const stockStatus = getCatalogStockStatus(product);
    const varietal = product.extra_metadata?.varietal || product.varietal;
    const price = Number(getCatalogPrice(product) || 0);

    const matchesSearch =
      name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      desc.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = categoryFilter === 'all' || cat === categoryFilter;
    const matchesStock =
      stockFilter === 'all' ||
      (stockFilter === 'in_stock' ? Number(stock) > 0 || stock === 'Consultar' : Number(stock) === 0 || stockStatus === 'out_of_stock');
    const matchesPrice = (!minPrice || price >= Number(minPrice)) && (!maxPrice || price <= Number(maxPrice));
    const matchesVarietal = !isWinery || varietalFilter === 'all' || varietal === varietalFilter;

    return matchesSearch && matchesCategory && matchesStock && matchesVarietal && matchesPrice;
  });

  const imageStats = useMemo(() => {
    const missingImages = products.filter((product) => getProductImageStatus(product) === 'missing').length;
    const withGallery = products.filter((product) => getProductGalleryUrls(product).length > 1).length;
    return { missingImages, withGallery };
  }, [products]);
  const marketplaceReadiness = catalogContract?.marketplace_readiness as MarketplaceReadiness | null | undefined;

  const inventoryStats = useMemo(() => {
    const summary = toRecord(catalogContract?.summary);
    const inventory = toRecord(catalogContract?.inventory);
    const readinessMetrics = toRecord(marketplaceReadiness?.metrics);
    const hasItemDetail =
      catalogDetailsLoaded ||
      Array.isArray(catalogContract?.items) ||
      Array.isArray(catalogContract?.rows);
    const derivedAvailable = hasItemDetail
      ? products.filter((product) => {
          const stockStatus = getCatalogStockStatus(product);
          const available = firstDefined(toRecord(product), ['available_to_sell', 'disponible', 'available']);
          const stock = toFiniteMetric(getCatalogStock(product));
          if (available === false) return false;
          return (
            available === true ||
            stockStatus === 'in_stock' ||
            stockStatus === 'available' ||
            (stock !== null && stock > 0)
          );
        }).length
      : null;
    const total =
      toFiniteMetric(firstDefined(summary, ['items_total', 'products'])) ??
      toFiniteMetric(readinessMetrics.products_total) ??
      (hasItemDetail ? products.length : null);
    const available =
      toFiniteMetric(firstDefined(summary, ['items_available', 'products_available'])) ??
      toFiniteMetric(readinessMetrics.products_available) ??
      derivedAvailable;
    const stockUnknown =
      toFiniteMetric(summary.stock_unknown) ??
      (hasItemDetail
        ? products.filter((product) => getCatalogStockStatus(product) === 'stock_unknown').length
        : null);
    const missingImages =
      toFiniteMetric(firstDefined(summary, ['missing_images', 'products_without_image'])) ??
      (total !== null && toFiniteMetric(readinessMetrics.products_with_images) !== null
        ? Math.max(total - Number(readinessMetrics.products_with_images), 0)
        : hasItemDetail
          ? imageStats.missingImages
          : null);
    return {
      total,
      available,
      stockUnknown,
      missingImages,
      hasItemDetail,
      catalogVersion: catalogContract?.catalog_version || inventory?.rules?.catalog_version,
      requestId: catalogContract?.request_id,
    };
  }, [catalogContract, catalogDetailsLoaded, imageStats.missingImages, marketplaceReadiness?.metrics, products]);

  const handleImageUpdated = (updatedProduct: Record<string, any>) => {
    setProducts((prev) =>
      prev.map((product) => (String(product.id) === String(updatedProduct.id) ? { ...product, ...updatedProduct } : product)),
    );
  };

  const activePromotions = promotions.filter((promotion) => promotion.is_active !== false);
  const promotionEndpoint =
    catalogContract?.promotions?.create_endpoint || catalogContract?.promotions?.endpoint || null;
  const promotionOwnerId = useMemo(() => {
    if (typeof promotionEndpoint !== 'string') return null;
    const match = /^\/api\/pymes\/(\d+)\/promociones\/?$/.exec(promotionEndpoint);
    if (!match) return null;
    const parsed = Number(match[1]);
    return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
  }, [promotionEndpoint]);

  const handleCreatePromotion = async () => {
    if (!promotionOwnerId) {
      toast.error('El contrato del tenant no habilitó la administración de promociones.');
      return;
    }

    const value = Number(promotionDraft.value);
    const fixedAmount = Number(promotionDraft.fixedAmount);
    const minCart = Number(promotionDraft.minCart);
    if (!promotionDraft.name.trim()) {
      toast.error('La promocion necesita un nombre.');
      return;
    }
    if (promotionDraft.scope !== 'cart' && (!Number.isFinite(value) || value <= 0)) {
      toast.error('El porcentaje debe ser mayor a 0.');
      return;
    }

    const payload: Record<string, unknown> = {
      nombre_promocion: promotionDraft.name.trim(),
      descripcion_publica: promotionDraft.description.trim() || undefined,
      is_active: true,
    };

    if (promotionDraft.scope === 'cart') {
      const usesFixedAmount = Number.isFinite(fixedAmount) && fixedAmount > 0;
      payload.tipo_promocion = usesFixedAmount ? 'TOTAL_CARRITO_DESCUENTO_FIJO' : 'TOTAL_CARRITO_DESCUENTO_PORCENTAJE';
      payload.valor_descuento = usesFixedAmount ? fixedAmount : value;
      if (Number.isFinite(minCart) && minCart > 0) payload.monto_minimo_carrito = minCart;
    }

    if (promotionDraft.scope === 'category') {
      if (!promotionDraft.category || promotionDraft.category === 'all') {
        toast.error('Elegi una categoria para aplicar el descuento.');
        return;
      }
      payload.tipo_promocion = 'PORCENTAJE_CATEGORIA';
      payload.valor_descuento = value;
      payload.alcances = [{ tipo_alcance: 'CATEGORIA', nombre_categoria: promotionDraft.category }];
    }

    if (promotionDraft.scope === 'product') {
      if (!promotionDraft.productId || promotionDraft.productId === 'none') {
        toast.error('Elegi un producto para aplicar el descuento.');
        return;
      }
      payload.tipo_promocion = 'PORCENTAJE_PRODUCTO';
      payload.valor_descuento = value;
      payload.alcances = [{ tipo_alcance: 'PRODUCTO', catalogo_item_id: promotionDraft.productId }];
    }

    setCreatingPromotion(true);
    try {
      const created = await apiClient.adminCreatePromotion(promotionOwnerId, payload, effectiveTenantSlug || undefined);
      setPromotions((prev) => [created, ...prev.filter((promotion) => promotion.id !== created.id)]);
      setPromotionDraft(emptyPromotionDraft);
      toast.success('Promocion creada y lista para el marketplace.');
    } catch (error) {
      console.error('Error creating promotion:', error);
      toast.error('No se pudo crear la promocion.');
    } finally {
      setCreatingPromotion(false);
    }
  };

  const handleTogglePromotion = async (promotion: CatalogPromotion) => {
    if (!promotionOwnerId || !promotion.id) return;
    const nextActive = promotion.is_active === false;
    setTogglingPromotionId(promotion.id);
    try {
      const updated = await apiClient.adminTogglePromotion(
        promotionOwnerId,
        promotion.id,
        nextActive,
        effectiveTenantSlug || undefined,
      );
      setPromotions((prev) => prev.map((item) => (item.id === promotion.id ? { ...item, ...updated } : item)));
      toast.success(nextActive ? 'Promocion activada.' : 'Promocion pausada.');
    } catch (error) {
      console.error('Error toggling promotion:', error);
      toast.error('No se pudo actualizar la promocion.');
    } finally {
      setTogglingPromotionId(null);
    }
  };

  return (
    <div className={embedded ? 'space-y-6' : 'container mx-auto p-6 space-y-6'}>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Catalogo e inventario</h1>
          <p className="text-muted-foreground">Edita precio y stock solo con confirmacion del backend.</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {inventoryStats.catalogVersion ? <Badge variant="outline">catalog_version: {String(inventoryStats.catalogVersion)}</Badge> : null}
            {inventoryStats.requestId ? <Badge variant="secondary">request_id: {String(inventoryStats.requestId)}</Badge> : null}
          </div>
        </div>
        <div className="flex gap-2">
          <Dialog open={uploadOpen} onOpenChange={setUploadOpen}>
            <DialogTrigger asChild>
              <Button disabled={!effectiveTenantSlug}>
                <UploadCloud className="mr-2 h-4 w-4" /> Importar
              </Button>
            </DialogTrigger>
            <DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto sm:max-w-[800px]">
              <DialogHeader className="sr-only">
                <DialogTitle>Importar catalogo</DialogTitle>
                <DialogDescription>Sube un archivo para analizarlo y actualizar el catalogo del tenant.</DialogDescription>
              </DialogHeader>
              <CatalogUploadWizard tenantSlug={effectiveTenantSlug || ''} onFinish={() => { setUploadOpen(false); void loadProducts(); }} />
            </DialogContent>
          </Dialog>
          <Button onClick={() => void loadProducts()} variant="outline" size="sm" disabled={!effectiveTenantSlug || loading}>
            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Filter className="mr-2 h-4 w-4" />}
            Recargar
          </Button>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-4">
        <MetricCard icon={Boxes} label="Ítems registrados" value={String(inventoryStats.total ?? '--')} />
        <MetricCard icon={PackageCheck} label="Disponibilidad informada" value={String(inventoryStats.available ?? '--')} />
        <MetricCard icon={PackageX} label="Stock sin validar" value={String(inventoryStats.stockUnknown ?? '--')} />
        <MetricCard icon={ImageOff} label="Sin imagen" value={String(inventoryStats.missingImages ?? '--')} />
      </div>

      {catalogLoadError ? (
        <div
          className={`rounded-xl border px-4 py-3 text-sm ${
            catalogStale
              ? 'border-amber-200 bg-amber-50 text-amber-950'
              : 'border-destructive/25 bg-destructive/5 text-destructive'
          }`}
          data-testid="catalog-load-error"
        >
          <p className="flex items-center gap-2 font-semibold">
            <AlertTriangle className="h-4 w-4" />
            {catalogStale ? 'Lectura desactualizada' : 'Catálogo sin confirmar'}
          </p>
          <p className="mt-1">{catalogLoadError}</p>
        </div>
      ) : null}

      {!loading && catalogSnapshotLoaded && !inventoryStats.hasItemDetail ? (
        <div
          className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900"
          data-testid="catalog-summary-without-item-detail"
        >
          El resumen informa {inventoryStats.total ?? 'una cantidad no verificada'} registros de catálogo.{' '}
          {catalogDetailUnavailable
            ? 'El servicio de fichas no respondió en esta lectura.'
            : 'Las fichas no forman parte del contrato recibido.'}{' '}
          Se conservan los indicadores sin inventar detalle. Su origen aún no está informado: no se consideran publicados
          ni validados.
        </div>
      ) : null}

      {marketplaceReadiness ? <MarketplaceReadinessPanel readiness={marketplaceReadiness} /> : null}

      <Card className="overflow-hidden border-primary/10">
        <CardHeader className="border-b bg-muted/30 pb-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-xl">
                <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Tags className="h-4 w-4" />
                </span>
                Marketplace y promociones
              </CardTitle>
              <p className="mt-1 text-sm text-muted-foreground">
                Crea descuentos por carrito, categoria o producto sin salir del catalogo operativo.
              </p>
            </div>
            <div className="flex flex-wrap gap-2 text-sm">
              <Badge variant="outline">{activePromotions.length} activas</Badge>
              <Badge variant="secondary">{promotions.length} totales</Badge>
              {promotionEndpoint ? <Badge variant="outline">Canal de promociones vinculado</Badge> : null}
            </div>
          </div>
        </CardHeader>
        <CardContent className="grid gap-5 p-5 xl:grid-cols-[minmax(0,1fr)_420px]">
          <div className="space-y-3">
            {promotions.length === 0 ? (
              <div className="rounded-lg border border-dashed p-5 text-sm text-muted-foreground">
                Todavia no hay promociones configuradas. Crea una primera regla para que el marketplace, WhatsApp y checkout muestren valor comercial real.
              </div>
            ) : (
              <div className="grid gap-3 md:grid-cols-2">
                {promotions.slice(0, 6).map((promotion) => (
                  <div key={promotion.id} className="rounded-lg border bg-background p-4 shadow-sm">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate font-semibold">{promotion.nombre_promocion || 'Promocion sin nombre'}</p>
                        <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                          {promotion.descripcion_publica || promotion.tipo_promocion || 'Regla comercial activa'}
                        </p>
                      </div>
                      <Badge variant={promotion.is_active === false ? 'secondary' : 'default'}>
                        {promotion.is_active === false ? 'Pausada' : 'Activa'}
                      </Badge>
                    </div>
                    <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-1">
                        <Percent className="h-3 w-3" />
                        {promotion.valor_descuento ?? 0}
                        {String(promotion.tipo_promocion || '').includes('FIJO') ? ' fijo' : '%'}
                      </span>
                      {promotion.monto_minimo_carrito ? (
                        <span className="rounded-full bg-muted px-2 py-1">Min ${promotion.monto_minimo_carrito}</span>
                      ) : null}
                      {promotion.alcances?.[0]?.nombre_categoria ? (
                        <span className="rounded-full bg-muted px-2 py-1">{promotion.alcances[0].nombre_categoria}</span>
                      ) : null}
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="mt-4 w-full"
                      onClick={() => void handleTogglePromotion(promotion)}
                      disabled={togglingPromotionId === promotion.id}
                    >
                      {togglingPromotionId === promotion.id ? <Loader2 className="mr-2 h-3 w-3 animate-spin" /> : <Sparkles className="mr-2 h-3 w-3" />}
                      {promotion.is_active === false ? 'Activar' : 'Pausar'}
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-xl border bg-card p-4 shadow-sm">
            <div className="mb-4">
              <p className="font-semibold">Nueva promocion rapida</p>
              <p className="text-sm text-muted-foreground">Publica reglas simples que el carrito ya puede evaluar.</p>
            </div>
            <div className="space-y-3">
              <Input
                value={promotionDraft.name}
                onChange={(event) => setPromotionDraft((prev) => ({ ...prev, name: event.target.value }))}
                placeholder="Nombre visible, ej: 15% en uniformes"
              />
              <Input
                value={promotionDraft.description}
                onChange={(event) => setPromotionDraft((prev) => ({ ...prev, description: event.target.value }))}
                placeholder="Detalle corto para WhatsApp y marketplace"
              />
              <Select
                value={promotionDraft.scope}
                onValueChange={(value) => setPromotionDraft((prev) => ({ ...prev, scope: value as PromotionScope }))}
              >
                <SelectTrigger><SelectValue placeholder="Alcance" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="cart">Compra minima</SelectItem>
                  <SelectItem value="category">Categoria</SelectItem>
                  <SelectItem value="product">Producto</SelectItem>
                </SelectContent>
              </Select>

              {promotionDraft.scope === 'category' ? (
                <Select
                  value={promotionDraft.category}
                  onValueChange={(value) => setPromotionDraft((prev) => ({ ...prev, category: value }))}
                >
                  <SelectTrigger><SelectValue placeholder="Categoria" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Elegir categoria</SelectItem>
                    {categories.map((category: any) => <SelectItem key={category} value={category}>{category}</SelectItem>)}
                  </SelectContent>
                </Select>
              ) : null}

              {promotionDraft.scope === 'product' ? (
                <Select
                  value={promotionDraft.productId}
                  onValueChange={(value) => setPromotionDraft((prev) => ({ ...prev, productId: value }))}
                >
                  <SelectTrigger><SelectValue placeholder="Producto" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Elegir producto</SelectItem>
                    {products.slice(0, 80).map((product) => {
                      const itemId = getCatalogItemId(product);
                      if (!itemId) return null;
                      return (
                        <SelectItem key={String(itemId)} value={String(itemId)}>
                          {product.name || product.nombre || itemId}
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              ) : null}

              <div className="grid grid-cols-2 gap-3">
                <Input
                  type="number"
                  min={0}
                  value={promotionDraft.value}
                  onChange={(event) => setPromotionDraft((prev) => ({ ...prev, value: event.target.value }))}
                  placeholder="% descuento"
                />
                <Input
                  type="number"
                  min={0}
                  value={promotionDraft.minCart}
                  onChange={(event) => setPromotionDraft((prev) => ({ ...prev, minCart: event.target.value }))}
                  placeholder="Min compra"
                  disabled={promotionDraft.scope !== 'cart'}
                />
              </div>
              {promotionDraft.scope === 'cart' ? (
                <Input
                  type="number"
                  min={0}
                  value={promotionDraft.fixedAmount}
                  onChange={(event) => setPromotionDraft((prev) => ({ ...prev, fixedAmount: event.target.value }))}
                  placeholder="Monto fijo opcional"
                />
              ) : null}
              <Button className="w-full" onClick={() => void handleCreatePromotion()} disabled={creatingPromotion || !promotionOwnerId}>
                {creatingPromotion ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
                Crear promocion
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col gap-4 md:flex-row">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Buscar por nombre..." className="pl-8" value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} />
            </div>
            <div className="flex items-center gap-2">
              <Input placeholder="Min $" className="w-[90px]" type="number" value={minPrice} onChange={(event) => setMinPrice(event.target.value)} />
              <Input placeholder="Max $" className="w-[90px]" type="number" value={maxPrice} onChange={(event) => setMaxPrice(event.target.value)} />
            </div>
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-[180px]"><SelectValue placeholder="Categoria" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                {categories.map((category: any) => <SelectItem key={category} value={category}>{category}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={stockFilter} onValueChange={setStockFilter}>
              <SelectTrigger className="w-[150px]"><SelectValue placeholder="Stock" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todo</SelectItem>
                <SelectItem value="in_stock">Con stock</SelectItem>
                <SelectItem value="no_stock">Sin stock</SelectItem>
              </SelectContent>
            </Select>
            {isWinery ? (
              <Select value={varietalFilter} onValueChange={setVarietalFilter}>
                <SelectTrigger className="w-[150px]"><SelectValue placeholder="Varietal" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  {varietals.map((varietal: any) => <SelectItem key={varietal} value={varietal}>{varietal}</SelectItem>)}
                </SelectContent>
              </Select>
            ) : null}
          </div>
        </CardHeader>
        <CardContent>
          {loading && !catalogSnapshotLoaded ? (
            <div className="flex justify-center p-8"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[80px]">Imagen</TableHead>
                    <TableHead>Item</TableHead>
                    <TableHead className="w-[180px]">Precio</TableHead>
                    <TableHead className="w-[130px]">Stock</TableHead>
                    <TableHead className="w-[90px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {catalogLoadError && !catalogStale ? (
                    <TableRow>
                      <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                        No se pudo confirmar el catálogo. Reintentá la consulta para habilitar sus fichas.
                      </TableCell>
                    </TableRow>
                  ) : !inventoryStats.hasItemDetail ? (
                    <TableRow>
                      <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                        Las fichas no están disponibles en esta lectura. Los indicadores superiores provienen únicamente
                        del resumen confirmado para la organización.
                      </TableCell>
                    </TableRow>
                  ) : filteredProducts.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">No hay ítems disponibles con estos filtros.</TableCell>
                    </TableRow>
                  ) : (
                    filteredProducts.map((product) => {
                      const itemId = getCatalogItemId(product) ?? product.id;
                      const isEditing = String(editingId) === String(itemId);
                      return (
                        <TableRow key={String(itemId)}>
                          <TableCell>
                            <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded bg-muted">
                              {getProductPrimaryImage(product) ? (
                                <img src={getProductPrimaryImage(product) || ''} alt={getProductImageAlt(product)} className="h-full w-full object-cover" />
                              ) : (
                                <ImageOff className="h-5 w-5 text-muted-foreground" />
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="font-medium">{product.name || product.nombre || product.title || itemId}</div>
                            <div className="max-w-[260px] truncate text-xs text-muted-foreground">{product.description || product.descripcion}</div>
                            {getProductImageStatus(product) === 'missing' ? <Badge variant="destructive" className="mt-1 text-xs">Sin imagen</Badge> : null}
                          </TableCell>
                          <TableCell>
                            {isEditing ? (
                              <Input type="number" value={editPrice} onChange={(event) => setEditPrice(event.target.value)} className="h-8 w-28" autoFocus />
                            ) : (
                              <button type="button" className="flex items-center gap-2 rounded p-1 hover:bg-muted/50" onClick={() => startEditing(product)}>
                                {formatCurrency(product)}
                                <Edit2 className="h-3 w-3 text-muted-foreground" />
                              </button>
                            )}
                          </TableCell>
                          <TableCell>
                            {isEditing ? (
                              <Input type="number" value={editStock} onChange={(event) => setEditStock(event.target.value)} className="h-8 w-24" min={0} />
                            ) : (
                              <StockBadge product={product} />
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              {isEditing ? (
                                <>
                                  <Button size="icon" variant="ghost" className="h-8 w-8 text-green-600" onClick={() => void handleItemUpdate(product)}>
                                    {String(updatingId) === String(itemId) ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
                                  </Button>
                                  <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" onClick={cancelEditing}>
                                    <X className="h-3 w-3" />
                                  </Button>
                                </>
                              ) : (
                                <>
                                  {effectiveTenantSlug ? <ProductImageManager tenantSlug={effectiveTenantSlug} product={product} onUpdated={handleImageUpdated} /> : null}
                                  {product.external_url ? (
                                    <a href={product.external_url} target="_blank" rel="noopener noreferrer" title="Ver enlace externo">
                                      <ExternalLink className="h-4 w-4 text-muted-foreground hover:text-primary" />
                                    </a>
                                  ) : null}
                                </>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <CatalogQualityCommandCenter tenantSlug={effectiveTenantSlug} marketplace={catalogContract || undefined} />
    </div>
  );
};

const MetricCard = ({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: string }) => (
  <Card>
    <CardContent className="p-4">
      <div className="mb-2 inline-flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
        <Icon className="h-4 w-4" />
      </div>
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="text-2xl font-semibold">{value}</p>
    </CardContent>
  </Card>
);

const MarketplaceReadinessPanel = ({ readiness }: { readiness: MarketplaceReadiness }) => {
  const rawScore = toFiniteMetric(readiness.score);
  const score = rawScore === null ? null : Math.max(0, Math.min(100, rawScore));
  const blockers = readiness.blockers ?? [];
  const warnings = readiness.warnings ?? [];
  const metrics = readiness.metrics ?? {};
  const ready = readiness.ready === true;
  const readinessKnown = typeof readiness.ready === 'boolean';
  const totalProducts = toFiniteMetric(metrics.products_total);
  const availableProducts = toFiniteMetric(metrics.products_available);
  const metricValue = (value: unknown) => {
    const parsed = toFiniteMetric(value);
    return parsed === null ? '--' : String(parsed);
  };
  const availabilityValue =
    totalProducts === null || availableProducts === null ? '--' : `${availableProducts}/${totalProducts}`;
  const checkoutValue =
    metrics.checkout_configured === true
      ? 'Configurado'
      : metrics.checkout_configured === false
        ? 'Pendiente'
        : 'Sin verificar';

  return (
    <Card className="overflow-hidden border-primary/10">
      <CardContent className="p-0">
        <div className="grid gap-0 lg:grid-cols-[340px_minmax(0,1fr)]">
          <div className="border-b bg-muted/30 p-5 lg:border-b-0 lg:border-r">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                  <Gauge className="h-4 w-4" />
                  Preparación del marketplace
                </p>
                <h2 className="mt-2 text-2xl font-bold">{score === null ? '--' : `${score}%`}</h2>
              </div>
              <Badge variant={ready ? 'default' : blockers.length ? 'destructive' : 'secondary'}>
                {ready ? 'Sin bloqueos' : blockers.length ? 'Bloqueado' : readinessKnown ? 'Revisar' : 'Sin verificar'}
              </Badge>
            </div>
            <Progress value={score ?? 0} className="mt-4 h-2" />
            <p className="mt-3 text-sm text-muted-foreground">
              Estado calculado por backend con productos, imágenes, precios, stock, promociones y checkout.
            </p>
          </div>

          <div className="grid gap-4 p-5 xl:grid-cols-[minmax(0,1fr)_300px]">
            <div className="space-y-3">
              {blockers.length ? (
                <div className="rounded-lg border border-destructive/25 bg-destructive/5 p-4">
                  <p className="mb-3 flex items-center gap-2 font-semibold text-destructive">
                    <AlertTriangle className="h-4 w-4" />
                    Bloqueos para vender
                  </p>
                  <div className="space-y-3">
                    {blockers.map((item) => (
                      <ReadinessIssue key={item.id || item.label || item.next_action} item={item} />
                    ))}
                  </div>
                </div>
              ) : ready ? (
                <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-emerald-900">
                  <p className="flex items-center gap-2 font-semibold">
                    <CheckCircle2 className="h-4 w-4" />
                    Sin bloqueos técnicos reportados
                  </p>
                  <p className="mt-1 text-sm text-emerald-800">
                    La verificación técnica no detectó bloqueos. La publicación y el origen de los registros requieren
                    validación aparte.
                  </p>
                </div>
              ) : (
                <div className="rounded-lg border bg-muted/30 p-4 text-foreground">
                  <p className="flex items-center gap-2 font-semibold">
                    <AlertTriangle className="h-4 w-4 text-muted-foreground" />
                    Validación técnica incompleta
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    El contrato no confirmó si existen bloqueos. Revisá el estado antes de publicar o habilitar checkout.
                  </p>
                </div>
              )}

              {warnings.length ? (
                <div className="rounded-lg border p-4">
                  <p className="mb-3 font-semibold">Mejoras recomendadas</p>
                  <div className="grid gap-3 md:grid-cols-2">
                    {warnings.slice(0, 4).map((item) => (
                      <ReadinessIssue key={item.id || item.label || item.next_action} item={item} compact />
                    ))}
                  </div>
                </div>
              ) : null}
            </div>

            <div className="grid grid-cols-2 gap-3 text-sm xl:grid-cols-1">
              <ReadinessMetric label="Disponibilidad informada" value={availabilityValue} />
              <ReadinessMetric label="Con imagen" value={metricValue(metrics.products_with_images)} />
              <ReadinessMetric label="Con precio" value={metricValue(metrics.products_with_prices)} />
              <ReadinessMetric label="Con promo" value={metricValue(metrics.products_with_promotions)} />
              <ReadinessMetric label="Stock bajo" value={metricValue(metrics.low_stock)} />
              <ReadinessMetric label="Checkout" value={checkoutValue} />
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

const ReadinessIssue = ({
  item,
  compact = false,
}: {
  item: NonNullable<MarketplaceReadiness['warnings']>[number];
  compact?: boolean;
}) => (
  <div className={compact ? 'rounded-lg bg-muted/40 p-3' : ''}>
    <p className="font-medium">{item.label || item.id || 'Accion pendiente'}</p>
    {item.next_action ? <p className="mt-1 text-sm text-muted-foreground">{item.next_action}</p> : null}
  </div>
);

const ReadinessMetric = ({ label, value }: { label: string; value: string }) => (
  <div className="rounded-lg border bg-background p-3">
    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
    <p className="mt-1 font-semibold">{value}</p>
  </div>
);

const StockBadge = ({ product }: { product: any }) => {
  const stock = getCatalogStock(product);
  const stockStatus = getCatalogStockStatus(product);
  if (stockStatus === 'stock_unknown') return <Badge variant="secondary">Sin validar</Badge>;
  if (stock === 'Consultar') return <Badge variant="outline">Consultar</Badge>;
  return (
    <Badge variant={Number(stock) > 0 ? 'outline' : 'destructive'}>
      {Number(stock) > 0 ? `${stock} un.` : 'Agotado'}
    </Badge>
  );
};

export default CatalogManagementPage;
