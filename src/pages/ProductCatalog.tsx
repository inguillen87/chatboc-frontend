import React, { useEffect, useMemo, useState } from 'react';
import { ApiError, apiFetch, getErrorMessage } from '@/utils/api';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import ProductCard, { AddToCartOptions, ProductDetails } from '@/components/product/ProductCard';
import { toast } from '@/components/ui/use-toast';
import { Input } from '@/components/ui/input';
import { Loader2, ShoppingCart, AlertTriangle, Search } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { useTenant } from '@/context/TenantContext';
import { enhanceProductDetails, normalizeProductsPayload } from '@/utils/cartPayload';
import useCartCount from '@/hooks/useCartCount';
import usePointsBalance from '@/hooks/usePointsBalance';
import UploadOrderFromFile from '@/components/cart/UploadOrderFromFile';
import { useUser } from '@/hooks/useUser';
import { buildTenantPath } from '@/utils/tenantPaths';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { addMarketItem } from '@/api/market';
import { apiClient } from '@/api/client';
import { UploadCloud } from 'lucide-react';
import type { TenantPublicInfo } from '@/types/tenant';

interface ProductCatalogProps {
  tenantSlug?: string;
}

const generatedIdPattern = /^(product|producto)-/i;

const normalizeSlugSignal = (value: unknown): string | null => {
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    return normalized || null;
  }
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return null;
};

const toProductIdString = (value: unknown): string | null => {
  if (typeof value === 'string') {
    const normalized = value.trim();
    return normalized || null;
  }
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return null;
};

const asRecord = (value: unknown): Record<string, unknown> | null =>
  value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;

const getNestedSlug = (record: Record<string, unknown> | null, key: string): string | null => {
  const nested = asRecord(record?.[key]);
  return normalizeSlugSignal(nested?.slug ?? nested?.tenant_slug ?? nested?.tenantSlug);
};

const getProductTenantSignals = (product: ProductDetails): string[] => {
  const raw = asRecord(product.source_payload);
  const values = [
    product.tenant_slug,
    product.tenant,
    product.owner_slug,
    product.tenant_id,
    raw?.tenant_slug,
    raw?.tenantSlug,
    raw?.tenant,
    raw?.owner_slug,
    raw?.ownerSlug,
    raw?.tenant_id,
    raw?.tenantId,
    getNestedSlug(raw, 'tenant'),
    getNestedSlug(raw, 'owner'),
  ];
  return values
    .map(normalizeSlugSignal)
    .filter((value): value is string => Boolean(value));
};

const normalizeVerticalSignal = (value: unknown): string | null => {
  const signal = normalizeSlugSignal(value);
  if (!signal) return null;

  if (/municip|gobierno|government|public|ciudad|comuna/.test(signal)) return 'public_sector';
  if (/pyme|empresa|commerce|comerc|market|tienda|bodega|retail/.test(signal)) return 'business';
  if (/educ|coleg|school|campus|familia/.test(signal)) return 'education';
  return null;
};

const getVerticalSignalsFromRecord = (record: Record<string, unknown> | null): string[] => {
  if (!record) return [];
  return [
    record.vertical,
    record.sector,
    record.tipo,
    record.tipo_chat,
    record.tipoChat,
    record.subvertical,
    record.rubro,
    asRecord(record.tenant)?.tipo,
    asRecord(record.tenant)?.vertical,
    asRecord(record.tenant)?.sector,
  ]
    .map(normalizeVerticalSignal)
    .filter((value): value is string => Boolean(value));
};

const getProductVerticalSignals = (product: ProductDetails): string[] => {
  const raw = asRecord(product.source_payload);
  return Array.from(
    new Set([
      ...getVerticalSignalsFromRecord(product as unknown as Record<string, unknown>),
      ...getVerticalSignalsFromRecord(raw),
    ]),
  );
};

const getTenantVerticalSignals = (
  tenantInfo: TenantPublicInfo | null | undefined,
  userInfo: unknown,
): string[] => {
  const userRecord = asRecord(userInfo);
  return Array.from(
    new Set([
      ...getVerticalSignalsFromRecord(tenantInfo as unknown as Record<string, unknown> | null),
      ...getVerticalSignalsFromRecord(userRecord),
    ]),
  );
};

const matchesTenantVertical = (
  product: ProductDetails,
  tenantInfo: TenantPublicInfo | null | undefined,
  userInfo: unknown,
): boolean => {
  const productSignals = getProductVerticalSignals(product);
  const tenantSignals = getTenantVerticalSignals(tenantInfo, userInfo);
  if (!productSignals.length || !tenantSignals.length) return true;
  return productSignals.some((signal) => tenantSignals.includes(signal));
};

const belongsToTenant = (product: ProductDetails, tenantSlug: string): boolean => {
  const expected = normalizeSlugSignal(tenantSlug);
  if (!expected) return false;

  const signals = getProductTenantSignals(product);
  return signals.some((signal) => signal === expected);
};

const getProductCartId = (product: ProductDetails): string | null => {
  const raw = asRecord(product.source_payload);
  return toProductIdString(
    product.catalogo_item_id ??
      product.catalog_item_id ??
      raw?.catalogo_item_id ??
      raw?.catalog_item_id ??
      raw?.catalogItemId ??
      raw?.catalog_id ??
      raw?.catalogId ??
      product.item_id ??
      raw?.item_id,
  );
};

const hasRealCartId = (product: ProductDetails): boolean => {
  const id = getProductCartId(product);
  return Boolean(id && !generatedIdPattern.test(id));
};

const isMarkedAsNonRealProduct = (product: ProductDetails): boolean => {
  const raw = asRecord(product.source_payload);
  const source = normalizeSlugSignal(raw?.source ?? raw?.origin ?? raw?.origen ?? raw?.reason_code);
  const type = normalizeSlugSignal(raw?.type ?? raw?.kind ?? raw?.source_type);
  const booleanSignals = [
    raw?.is_demo,
    raw?.isDemo,
    raw?.demo,
    raw?.mock,
    raw?.is_mock,
    raw?.sample,
    raw?.placeholder,
  ];

  return (
    product.origen === 'demo' ||
    booleanSignals.some((value) => value === true || value === 'true') ||
    Boolean(source && /demo|mock|sample|placeholder/.test(source)) ||
    Boolean(type && /demo|mock|sample|placeholder/.test(type))
  );
};

const canRenderTenantCatalogProduct = (
  product: ProductDetails,
  tenantSlug: string,
  isAdmin: boolean,
  tenantInfo?: TenantPublicInfo | null,
  userInfo?: unknown,
): boolean => {
  if (!belongsToTenant(product, tenantSlug)) return false;
  if (!matchesTenantVertical(product, tenantInfo, userInfo)) return false;
  if (isMarkedAsNonRealProduct(product)) return false;
  if (!isAdmin && product.disponible === false) return false;
  return hasRealCartId(product) || Boolean(product.external_url);
};

const productMatchesSearch = (product: ProductDetails, searchTerm: string): boolean => {
  const query = searchTerm.trim().toLowerCase();
  if (!query) return true;

  return [
    product.nombre,
    product.descripcion,
    product.categoria,
    product.sku,
    product.marca,
    product.presentacion,
  ].some((value) => typeof value === 'string' && value.toLowerCase().includes(query));
};

export default function ProductCatalog({ tenantSlug: propTenantSlug }: ProductCatalogProps) {
  const [allProducts, setAllProducts] = useState<ProductDetails[]>([]);
  const [filteredProducts, setFilteredProducts] = useState<ProductDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('todos');
  const [selectedModality, setSelectedModality] = useState<'todos' | 'venta' | 'puntos' | 'donacion'>('todos');
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importLoading, setImportLoading] = useState(false);
  const { currentSlug, tenant } = useTenant();
  const { user } = useUser();
  const cartCount = useCartCount();
  const effectiveTenantSlug = useMemo(
    () => propTenantSlug ?? currentSlug ?? user?.tenantSlug ?? null,
    [propTenantSlug, currentSlug, user?.tenantSlug],
  );
  const { points: pointsBalance, requiresAuth: pointsRequireAuth, error: pointsError } = usePointsBalance({
    enabled: !!user,
    tenantSlug: effectiveTenantSlug,
  });
  const [showPointsAuthPrompt, setShowPointsAuthPrompt] = useState(false);
  const [pointsAuthMessage, setPointsAuthMessage] = useState<string>('Para usar tus puntos tenes que iniciar sesion o registrarte.');

  const catalogPath = buildTenantPath('/productos', effectiveTenantSlug);
  const cartPath = buildTenantPath('/cart', effectiveTenantSlug);
  const loginPath = buildTenantPath('/login', effectiveTenantSlug);
  const registerPath = buildTenantPath('/register', effectiveTenantSlug);
  const numberFormatter = useMemo(() => new Intl.NumberFormat('es-AR'), []);
  const productsApiPath = useMemo(
    () => effectiveTenantSlug
      ? `/api/public/tenants/${encodeURIComponent(effectiveTenantSlug)}/catalog`
      : '',
    [effectiveTenantSlug],
  );

  const shouldShowLiveLoyalty = !!user;
  const isAdmin = useMemo(() => {
    const r = user?.rol?.toLowerCase();
    return r === 'admin' || r === 'super_admin' || r === 'empleado';
  }, [user?.rol]);

  const sharedRequestOptions = useMemo(
    () => ({
      suppressPanel401Redirect: true,
      tenantSlug: effectiveTenantSlug ?? undefined,
      sendAnonId: true,
    }) as const,
    [effectiveTenantSlug],
  );

  useEffect(() => {
    setLoading(true);
    setError(null);

    if (!effectiveTenantSlug) {
      setAllProducts([]);
      setFilteredProducts([]);
      setError('No se pudo resolver el comercio para cargar el catalogo real.');
      setLoading(false);
      return;
    }

    apiFetch<unknown>(productsApiPath, sharedRequestOptions)
      .then((data) => {
          let normalized = normalizeProductsPayload(data, 'ProductCatalog')
            .map((item) => enhanceProductDetails({ ...item, origen: 'api' as const }));

          normalized = normalized.filter((item) =>
            canRenderTenantCatalogProduct(item, effectiveTenantSlug, isAdmin, tenant, user),
          );

        setAllProducts(normalized);
        setFilteredProducts(normalized);
      })
      .catch((err: any) => {
        setError(getErrorMessage(err, 'No se pudieron cargar los productos. Intenta de nuevo mas tarde.'));
      })
      .finally(() => setLoading(false));
  }, [effectiveTenantSlug, productsApiPath, sharedRequestOptions, isAdmin, tenant, user]);

  useEffect(() => {
    const normalizedCategory = selectedCategory.trim().toLowerCase();

    const filtered = allProducts.filter(product => {
      const matchesCategory =
        normalizedCategory === 'todos' ||
        (!!product.categoria && product.categoria.toLowerCase() === normalizedCategory);

      const modality = (product.modalidad ?? 'venta').toLowerCase();
      const matchesModality =
        selectedModality === 'todos' ||
        modality === selectedModality;

      return productMatchesSearch(product, searchTerm) && matchesCategory && matchesModality;
    });
    setFilteredProducts(filtered);
  }, [allProducts, searchTerm, selectedCategory, selectedModality]);

  const categories = useMemo(() => {
    const unique = new Map<string, string>();
    allProducts.forEach((product) => {
      if (product.categoria) {
        const normalized = product.categoria.trim().toLowerCase();
        if (normalized && !unique.has(normalized)) {
          unique.set(normalized, product.categoria.trim());
        }
      }
    });
    return [
      { value: 'todos', label: 'Todos' },
      ...Array.from(unique.entries()).map(([value, label]) => ({ value, label })),
    ];
  }, [allProducts]);

  const handleToggleAvailability = async (product: ProductDetails) => {
    if (!effectiveTenantSlug || !product.id) return;
    const newStatus = !product.disponible;
    const originalProducts = [...allProducts];

    // Optimistic update
    setAllProducts(prev => prev.map(p => p.id === product.id ? { ...p, disponible: newStatus } : p));

    try {
        // Use PUT to update the product. Assuming generic product update endpoint.
        await apiFetch(`/api/${effectiveTenantSlug}/productos/${product.id}`, {
            method: 'PUT',
            body: { disponible: newStatus },
            tenantSlug: effectiveTenantSlug
        });
        toast({ title: "Producto actualizado", description: `Disponibilidad cambiada a: ${newStatus ? 'Disponible' : 'No disponible'}` });
    } catch (err) {
        // Revert on error
        setAllProducts(originalProducts);
        toast({ variant: "destructive", title: "Error", description: "No se pudo actualizar el producto." });
        console.error("Failed to toggle availability", err);
    }
  };

  const handleImportCatalog = async () => {
    if (!effectiveTenantSlug || !importFile) return;
    setImportLoading(true);
    const toastId = toast.loading("Subiendo catalogo...", { description: "Por favor espere." });

    try {
      const formData = new FormData();
      formData.append('archivo', importFile);

      await apiClient.adminImportCatalog(effectiveTenantSlug, formData);

      toast.loading("Procesando y actualizando IA...", { id: toastId, description: "Esto puede tomar unos momentos." });
      setIsImportOpen(false);
      setImportFile(null);

      // Poll for completion
      const pollInterval = setInterval(async () => {
          try {
              const statusData = await apiClient.adminGetCatalogSyncStatus(effectiveTenantSlug);
              const pct = Math.round(statusData.progress * 100);

              if (statusData.status === 'completed') {
                  clearInterval(pollInterval);
                  setImportLoading(false);
                  toast.success("Catalogo actualizado", { id: toastId, description: "La busqueda inteligente esta lista." });
                  setTimeout(() => window.location.reload(), 1500);
              } else if (statusData.status === 'failed' || statusData.status === 'error') {
                  clearInterval(pollInterval);
                  setImportLoading(false);
                  toast.error("Error en procesamiento", { id: toastId, description: statusData.message || "Ocurrio un error." });
              } else {
                  toast.loading(`Actualizando IA (${pct}%)...`, { id: toastId });
              }
          } catch (e) {
              console.warn("Poll error", e);
          }
      }, 2000);

      // Safety timeout (5 minutes)
      setTimeout(() => {
          clearInterval(pollInterval);
          if (importLoading) {
             setImportLoading(false);
             toast.dismiss(toastId);
          }
      }, 300000);

    } catch (error) {
      console.error('Import failed', error);
      toast.error("Error de subida", { id: toastId, description: "No se pudo subir el archivo." });
      setImportLoading(false);
    }
  };

  const handleAddToCart = async (product: ProductDetails, options: AddToCartOptions) => {
    const isPointsProduct = (product.modalidad ?? '').toString().toLowerCase() === 'puntos';

    if (isPointsProduct && !user) {
      setPointsAuthMessage('Para usar tus puntos tenes que iniciar sesion o registrarte.');
      setShowPointsAuthPrompt(true);
      return;
    }

    const unitsPerCase = product.unidades_por_caja && product.unidades_por_caja > 0
        ? product.unidades_por_caja
        : 1;

    const quantity = Math.max(1, Math.floor(options.quantity));
    const mode = options.mode === 'case' && product.precio_por_caja && product.unidades_por_caja
        ? 'case'
        : 'unit';

    const totalUnits = mode === 'case' ? quantity * unitsPerCase : quantity;
    const quantityLabel = `${quantity} ${mode === 'case' ? 'caja(s)' : 'unidad(es)'}`;

    try {
      const shouldUseLocalCart = !effectiveTenantSlug;

      if (shouldUseLocalCart) {
        toast({
          title: 'No se pudo resolver el comercio',
          description: 'Necesitamos el comercio real para guardar el carrito.',
          variant: 'destructive',
        });
        return;
      }

      // Use the backend cart only; no local cart is created here.
      if (effectiveTenantSlug) {
          const catalogItemId = getProductCartId(product);
          if (!catalogItemId || !hasRealCartId(product)) {
            toast({
              title: 'Producto no disponible',
              description: 'Este item no tiene un identificador de catalogo valido para comprar.',
              variant: 'destructive',
            });
            return;
          }

          await addMarketItem(effectiveTenantSlug, {
              catalogo_item_id: catalogItemId,
              catalog_item_id: catalogItemId,
              productId: catalogItemId,
              quantity: totalUnits,
              cantidad: totalUnits,
          });
          toast({
            title: "Producto agregado",
            description: `${product.nombre} agregado al carrito. Escribe "Ver carrito" para continuar o toca el icono de carrito.`,
            className: "bg-green-500 text-white",
          });
      }

    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        const code = err.body?.code || err.body?.error_code || err.body?.errorCode;
        if (code === 'REQUIERE_LOGIN_PUNTOS') {
          setPointsAuthMessage('Para usar tus puntos tenes que iniciar sesion o registrarte.');
          setShowPointsAuthPrompt(true);
          return;
        }
      }
      toast({
        title: "Error",
        description: `No se pudo agregar ${product.nombre} al carrito.`,
        variant: "destructive",
      });
      console.error("Error agregando al carrito:", err);
    }
  };

  useEffect(() => {
    if (pointsRequireAuth) {
      setShowPointsAuthPrompt(true);
    }
  }, [pointsRequireAuth]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-200px)] p-4 text-muted-foreground">
        <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
        <p className="text-lg">Cargando productos...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-200px)] p-4 text-destructive">
        <AlertTriangle className="h-12 w-12 mb-4" />
        <p className="text-lg font-semibold">Ocurrio un error</p>
        <p>{error}</p>
        <Button onClick={() => window.location.reload()} className="mt-4">Reintentar</Button>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 md:p-8">
      <header className="mb-8">
        <div className="flex flex-col sm:flex-row justify-between items-center gap-4 mb-6">
          <h1 className="text-3xl md:text-4xl font-bold text-foreground">Nuestro Catalogo</h1>
          <div className="flex gap-2 w-full sm:w-auto">
            {isAdmin && (
              <Dialog open={isImportOpen} onOpenChange={setIsImportOpen}>
                <Button variant="outline" onClick={() => setIsImportOpen(true)}>
                  <UploadCloud className="mr-2 h-4 w-4" /> Importar
                </Button>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Importar Catalogo</DialogTitle>
                    <DialogDescription>Sube un archivo CSV o Excel para actualizar tus productos masivamente.</DialogDescription>
                  </DialogHeader>
                  <div className="grid w-full items-center gap-4 py-4">
                    <div
                      className={`
                        border-2 border-dashed rounded-xl p-8 text-center transition-colors cursor-pointer
                        ${importFile ? 'border-primary bg-primary/5' : 'border-muted-foreground/25 hover:border-primary/50 hover:bg-muted/30'}
                      `}
                      onClick={() => document.getElementById('catalog-file')?.click()}
                    >
                      <div className="flex flex-col items-center gap-3">
                        <div className="p-3 bg-background rounded-full shadow-sm border">
                          <UploadCloud className={`h-6 w-6 ${importFile ? 'text-primary' : 'text-muted-foreground'}`} />
                        </div>
                        <div className="space-y-1">
                          <p className="text-sm font-medium text-foreground">
                            {importFile ? importFile.name : "Hace click para seleccionar un archivo"}
                          </p>
                          {!importFile && (
                            <p className="text-xs text-muted-foreground">
                              Soporta CSV, Excel (.xlsx, .xls)
                            </p>
                          )}
                        </div>
                      </div>
                      <Input
                        id="catalog-file"
                        type="file"
                        className="hidden"
                        accept=".csv, .xlsx, .xls"
                        onChange={(e) => setImportFile(e.target.files?.[0] || null)}
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setIsImportOpen(false)}>Cancelar</Button>
                    <Button onClick={handleImportCatalog} disabled={!importFile || importLoading}>
                      {importLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                      Importar
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            )}
            <Button asChild variant="outline" className="w-full sm:w-auto relative">
              <Link to={cartPath} className="inline-flex items-center">
                <ShoppingCart className="mr-2 h-4 w-4" />
                Ver Carrito
                {cartCount > 0 && (
                  <span className="ml-2 inline-flex h-6 min-w-[1.5rem] items-center justify-center rounded-full bg-primary text-primary-foreground text-xs px-2">
                    {cartCount}
                  </span>
                )}
              </Link>
            </Button>
          </div>
        </div>
        {shouldShowLiveLoyalty && (
          <div className="w-full mb-4 rounded-lg border border-border bg-card p-4 shadow-sm grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <p className="text-sm text-muted-foreground">Saldo de puntos</p>
              <p className="text-xl font-bold text-primary">{numberFormatter.format(pointsBalance)} pts</p>
            </div>
            <div className="md:col-span-2">
              <p className="text-sm text-muted-foreground mb-2">Sube una nota de pedido para armar el carrito automaticamente.</p>
              <UploadOrderFromFile onCartUpdated={() => toast({ title: 'Carrito actualizado', description: 'Revisa tu carrito para confirmar los items detectados.' })} />
            </div>
          </div>
        )}
        {!user && (
          <div className="w-full mb-4 rounded-lg border border-dashed border-primary/30 bg-card p-4 shadow-sm grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-2">
              <p className="text-sm text-muted-foreground mb-2">Inicia sesion para ver tu saldo de puntos y canjear productos.</p>
              <div className="flex gap-2 flex-wrap">
                <Button asChild variant="default" size="sm">
                  <Link to={loginPath}>Iniciar sesion</Link>
                </Button>
                <Button asChild variant="outline" size="sm">
                  <Link to={registerPath}>Crear cuenta</Link>
                </Button>
              </div>
            </div>
            <div className="flex items-center justify-end">
              <Badge variant="outline">Puntos</Badge>
            </div>
          </div>
        )}
        {pointsError && shouldShowLiveLoyalty && (
          <div className="w-full mb-4 rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-destructive text-sm shadow-sm">
            {pointsError}
          </div>
        )}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Buscar productos por nombre, descripcion, categoria..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-10 py-2 text-base rounded-md border-border focus:ring-primary focus:border-primary"
          />
        </div>
        {categories.length > 1 && (
          <Tabs value={selectedCategory} onValueChange={setSelectedCategory} className="mt-4">
            <TabsList className="flex flex-wrap justify-start gap-2 bg-transparent p-0">
              {categories.map((category) => (
                <TabsTrigger
                  key={category.value}
                  value={category.value}
                  className="px-4 py-2 rounded-full border border-border data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
                >
                  {category.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        )}
        <div className="flex flex-wrap gap-2 mt-4">
          {[
            { value: 'todos', label: 'Todas las modalidades' },
            { value: 'venta', label: 'Compra' },
            { value: 'puntos', label: 'Canje con puntos' },
            { value: 'donacion', label: 'Donacion' },
          ].map((option) => (
            <Button
              key={option.value}
              variant={selectedModality === option.value ? 'default' : 'outline'}
              size="sm"
              onClick={() => setSelectedModality(option.value as typeof selectedModality)}
            >
              {option.label}
            </Button>
          ))}
        </div>
      </header>

      {filteredProducts.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {filteredProducts.map((product) => (
            <div key={product.id} className="relative group">
                {isAdmin && (
                    <div className="absolute top-2 right-2 z-10 bg-background/90 p-1.5 rounded-full border shadow-sm flex items-center gap-2">
                        <Label htmlFor={`avail-${product.id}`} className="sr-only">Disponible</Label>
                        <Switch
                            id={`avail-${product.id}`}
                            checked={product.disponible !== false}
                            onCheckedChange={() => handleToggleAvailability(product)}
                            className="scale-75"
                        />
                        <span className="text-[10px] font-semibold text-muted-foreground uppercase">{product.disponible === false ? 'Oculto' : 'Visible'}</span>
                    </div>
                )}
                <div className={product.disponible === false ? 'opacity-60 grayscale' : ''}>
                    <ProductCard
                    product={product}
                    onAddToCart={handleAddToCart}
                    />
                </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-12">
          <Search className="mx-auto h-16 w-16 text-muted-foreground mb-4" />
          <p className="text-xl text-muted-foreground">
            {allProducts.length > 0 ? "No se encontraron productos para tu busqueda." : "Aun no hay productos en el catalogo."}
          </p>
          {allProducts.length > 0 && searchTerm && (
             <p className="text-sm text-muted-foreground mt-2">Intenta con otros terminos de busqueda.</p>
          )}
        </div>
      )}

      <Dialog open={showPointsAuthPrompt} onOpenChange={setShowPointsAuthPrompt}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Inicia sesion para usar tus puntos</DialogTitle>
            <DialogDescription>{pointsAuthMessage}</DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex flex-col sm:flex-row sm:justify-end gap-2">
            <Button asChild variant="default">
              <Link to={loginPath}>Iniciar sesion</Link>
            </Button>
            <Button asChild variant="outline">
              <Link to={registerPath}>Crear cuenta</Link>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
