import React, { useEffect, useMemo, useState } from 'react';
import { ApiError, NetworkError, apiFetch, getErrorMessage } from '@/utils/api';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import ProductCard, { AddToCartOptions, ProductDetails } from '@/components/product/ProductCard';
import { toast } from '@/components/ui/use-toast';
import { Input } from '@/components/ui/input';
import { Loader2, ShoppingCart, AlertTriangle, Search } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { useTenant } from '@/context/TenantContext';
import { DEFAULT_PUBLIC_PRODUCTS } from '@/data/defaultProducts';
import { DEMO_CATALOGS as MOCK_CATALOGS } from '@/data/mockCatalogs';
import { enhanceProductDetails, normalizeProductsPayload } from '@/utils/cartPayload';
import { addProductToLocalCart } from '@/utils/localCart';
import useCartCount from '@/hooks/useCartCount';
import { getDemoLoyaltySummary } from '@/utils/demoLoyalty';
import usePointsBalance from '@/hooks/usePointsBalance';
import UploadOrderFromFile from '@/components/cart/UploadOrderFromFile';
import { useUser } from '@/hooks/useUser';
import { buildTenantApiPath, buildTenantPath } from '@/utils/tenantPaths';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { safeLocalStorage } from '@/utils/safeLocalStorage';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { addMarketItem } from '@/api/market';

interface ProductCatalogProps {
  tenantSlug?: string;
  isDemoMode?: boolean;
}

export default function ProductCatalog({ tenantSlug: propTenantSlug, isDemoMode }: ProductCatalogProps) {
  const [allProducts, setAllProducts] = useState<ProductDetails[]>([]);
  const [filteredProducts, setFilteredProducts] = useState<ProductDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('todos');
  const [selectedModality, setSelectedModality] = useState<'todos' | 'venta' | 'puntos' | 'donacion'>('todos');
  const [catalogSource, setCatalogSource] = useState<'api' | 'fallback'>('api');
  const [cartMode, setCartMode] = useState<'api' | 'local'>('api');
  const [hasDemoModalities, setHasDemoModalities] = useState(false);
  const [loyaltySummary] = useState(() => getDemoLoyaltySummary());
  const { currentSlug } = useTenant();
  const { user } = useUser();
  const cartCount = useCartCount();
  const effectiveTenantSlug = useMemo(
    () => propTenantSlug ?? currentSlug ?? user?.tenantSlug ?? safeLocalStorage.getItem('tenantSlug') ?? null,
    [propTenantSlug, currentSlug, user?.tenantSlug],
  );
  const { points: pointsBalance, requiresAuth: pointsRequireAuth, error: pointsError } = usePointsBalance({
    enabled: !!user,
    tenantSlug: effectiveTenantSlug,
  });
  const [showPointsAuthPrompt, setShowPointsAuthPrompt] = useState(false);
  const [pointsAuthMessage, setPointsAuthMessage] = useState<string>('Para usar tus puntos tenés que iniciar sesión o registrarte.');

  const catalogPath = buildTenantPath('/productos', effectiveTenantSlug);
  const cartPath = buildTenantPath('/cart', effectiveTenantSlug);
  const loginPath = buildTenantPath('/login', effectiveTenantSlug);
  const registerPath = buildTenantPath('/register', effectiveTenantSlug);
  const numberFormatter = useMemo(() => new Intl.NumberFormat('es-AR'), []);
  const productsApiPath = useMemo(
    () => buildTenantApiPath('/productos', effectiveTenantSlug),
    [effectiveTenantSlug],
  );

  const shouldShowDemoLoyalty = catalogSource === 'fallback' || cartMode === 'local';
  const shouldShowLiveLoyalty = !shouldShowDemoLoyalty && !!user;
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

  const shouldUseDemoCatalog = (err: unknown) => {
    return (
      (err instanceof ApiError && [400, 401, 403, 405].includes(err.status)) ||
      err instanceof NetworkError
    );
  };

  const activateDemoCatalog = () => {
    try {
        setCatalogSource('fallback');
        setCartMode('local');
        let sourceProducts = DEFAULT_PUBLIC_PRODUCTS;

        if (effectiveTenantSlug) {
            // Find matching mock catalog key
            const key = Object.keys(MOCK_CATALOGS).find(k => effectiveTenantSlug.includes(k));

            if (key) {
                sourceProducts = MOCK_CATALOGS[key].map(p => ({
                    id: String(p.id),
                    nombre: p.name,
                    descripcion: p.description ?? null,
                    precio_unitario: typeof p.price === 'number' ? p.price : parseFloat(String(p.price || 0)),
                    modalidad: p.modality ?? 'venta',
                    precio_puntos: p.points ?? null,
                    imagen_url: p.imageUrl ?? null,
                    categoria: p.category ?? null,
                    marca: p.brand ?? null,
                    promocion_activa: p.promoInfo ?? null,
                    disponible: true,
                    origen: 'demo' as const,
                    checkout_type: p.checkout_type,
                    external_url: p.external_url
                }));
            }
        }

        setAllProducts(sourceProducts);
        setFilteredProducts(sourceProducts);
        setError(null);
        setHasDemoModalities(false);
    } catch (e) {
        console.error("Error loading demo catalog", e);
        // Safe fallback
        setAllProducts(DEFAULT_PUBLIC_PRODUCTS);
        setFilteredProducts(DEFAULT_PUBLIC_PRODUCTS);
    }
  };

  const mergeWithDemoModalities = (products: ProductDetails[]) => {
    const modalitySet = new Set(
      products.map((product) => (product.modalidad ? product.modalidad.toLowerCase() : 'venta')),
    );

    const complementary = DEFAULT_PUBLIC_PRODUCTS.filter((product) => {
      const modality = product.modalidad ? product.modalidad.toLowerCase() : 'venta';
      return ['puntos', 'donacion'].includes(modality) && !modalitySet.has(modality);
    }).map((product, index) => ({ ...product, id: `demo-${product.id ?? index}`, origen: 'demo' as const }));

    if (complementary.length === 0) {
      return { products, added: false };
    }

    const existingIds = new Set(products.map((product) => String(product.id)));
    const uniqueComplements = complementary.filter((product) => !existingIds.has(String(product.id)));

    return { products: [...products, ...uniqueComplements], added: uniqueComplements.length > 0 };
  };

  useEffect(() => {
    setLoading(true);
    setError(null);

    // If demo mode is explicitly enabled and we have a matching mock, load it immediately
    if (isDemoMode && effectiveTenantSlug) {
        const key = Object.keys(MOCK_CATALOGS).find(k => effectiveTenantSlug.includes(k));
        if (key) {
            activateDemoCatalog();
            setLoading(false);
            return;
        }
    }

    if (!effectiveTenantSlug) {
      activateDemoCatalog();
      setLoading(false);
      return;
    }

    apiFetch<unknown>(productsApiPath, sharedRequestOptions)
      .then((data) => {
          let normalized = normalizeProductsPayload(data, 'ProductCatalog')
            .map((item) => enhanceProductDetails({ ...item, origen: 'api' as const }));

          // Admins see all products (to manage them), public only sees available ones
          if (!isAdmin) {
             normalized = normalized.filter((item) => item.disponible !== false);
          }

        if (normalized.length === 0) {
          activateDemoCatalog();
        } else {
          const { products: withDemo, added } = mergeWithDemoModalities(normalized);
          setCatalogSource('api');
          setCartMode('api');
          setHasDemoModalities(added);
          setAllProducts(withDemo);
          setFilteredProducts(withDemo);
        }
      })
      .catch((err: any) => {
        if (shouldUseDemoCatalog(err) || (err instanceof ApiError && err.status === 404)) {
          activateDemoCatalog();
          return;
        }
        setError(getErrorMessage(err, 'No se pudieron cargar los productos. Intenta de nuevo más tarde.'));
      })
      .finally(() => setLoading(false));
  }, [effectiveTenantSlug, productsApiPath, sharedRequestOptions]);

  useEffect(() => {
    const lowercasedFilter = searchTerm.toLowerCase();
    const normalizedCategory = selectedCategory.trim().toLowerCase();
    const filtered = allProducts.filter(product => {
      const matchesSearch =
        product.nombre.toLowerCase().includes(lowercasedFilter) ||
        (product.descripcion && product.descripcion.toLowerCase().includes(lowercasedFilter)) ||
        (product.categoria && product.categoria.toLowerCase().includes(lowercasedFilter)) ||
        (product.marca && product.marca.toLowerCase().includes(lowercasedFilter));

      const matchesCategory =
        normalizedCategory === 'todos' ||
        (!!product.categoria && product.categoria.toLowerCase() === normalizedCategory);

      const modality = (product.modalidad ?? 'venta').toLowerCase();
      const matchesModality =
        selectedModality === 'todos' ||
        modality === selectedModality;

      return matchesSearch && matchesCategory && matchesModality;
    });
    setFilteredProducts(filtered);
  }, [searchTerm, allProducts, selectedCategory, selectedModality]);

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

  const handleAddToCart = async (product: ProductDetails, options: AddToCartOptions) => {
    const isPointsProduct = (product.modalidad ?? '').toString().toLowerCase() === 'puntos';

    if (isPointsProduct && !user) {
      setPointsAuthMessage('Para usar tus puntos tenés que iniciar sesión o registrarte.');
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
      const isDemoProduct = product.origen === 'demo';
      const shouldUseLocalCart = cartMode === 'local' || isDemoProduct || !effectiveTenantSlug;

      if (shouldUseLocalCart) {
        addProductToLocalCart(product, totalUnits);
        toast({
          title: '✅ Producto agregado',
          description: `${product.nombre} se guardó en tu carrito (${quantityLabel}). Escribe “Ver carrito” o usa el botón para continuar.`,
        });
        return;
      }

      // Use centralized API function which handles correct payload and 400/fallback internally
      if (effectiveTenantSlug) {
          await addMarketItem(effectiveTenantSlug, {
              productId: String(product.id),
              quantity: totalUnits
          });
          toast({
            title: "✅ Producto agregado",
            description: `${product.nombre} agregado al carrito. Escribe “Ver carrito” para continuar o toca el ícono de carrito.`,
            className: "bg-green-500 text-white",
          });
      }

    } catch (err) {
      // Fallback handled by addMarketItem implicitly by returning local cart if API fails with 40x
      // But if it throws completely, we catch here.
      // Check if the error suggests we should switch to local mode
      if (shouldUseDemoCatalog(err)) {
        setCartMode('local');
        addProductToLocalCart(product, totalUnits);
        toast({
            title: 'Modo demo activo',
            description: `${product.nombre} se guardó en tu carrito local (${quantityLabel}).`,
        });
        return;
      }

      if (err instanceof ApiError && err.status === 401) {
        const code = err.body?.code || err.body?.error_code || err.body?.errorCode;
        if (code === 'REQUIERE_LOGIN_PUNTOS') {
          setPointsAuthMessage('Para usar tus puntos tenés que iniciar sesión o registrarte.');
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
        <p className="text-lg font-semibold">Ocurrió un error</p>
        <p>{error}</p>
        <Button onClick={() => window.location.reload()} className="mt-4">Reintentar</Button>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 md:p-8">
      <header className="mb-8">
        <div className="flex flex-col sm:flex-row justify-between items-center gap-4 mb-6">
          <h1 className="text-3xl md:text-4xl font-bold text-foreground">Nuestro Catálogo</h1>
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
        {(catalogSource === 'fallback' || cartMode === 'local' || hasDemoModalities) && (
          <div className="flex flex-wrap gap-2 mb-4">
            {catalogSource === 'fallback' && (
              <Badge variant="secondary">Catálogo demo para visitantes</Badge>
            )}
            {cartMode === 'local' && (
              <Badge variant="outline">Carrito demo guardado en este dispositivo</Badge>
            )}
            {hasDemoModalities && cartMode !== 'local' && (
              <Badge variant="outline">Incluye opciones demo de canje y donación</Badge>
            )}
          </div>
        )}
        {shouldShowDemoLoyalty && (
          <div className="w-full mb-4 rounded-xl border border-primary/20 bg-gradient-to-r from-primary/5 via-primary/10 to-transparent p-4 shadow-sm">
            <p className="text-sm uppercase tracking-wide text-primary/80 font-semibold mb-2">Puntos en modo demo</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <p className="text-sm text-muted-foreground">Saldo disponible</p>
                <p className="text-xl font-bold text-primary">{numberFormatter.format(loyaltySummary.points)} pts</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Encuestas y sondeos respondidos</p>
                <p className="text-lg font-semibold">{loyaltySummary.surveysCompleted}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Ideas y reclamos registrados</p>
                <p className="text-lg font-semibold">{loyaltySummary.suggestionsShared + loyaltySummary.claimsFiled}</p>
              </div>
            </div>
          </div>
        )}
        {shouldShowLiveLoyalty && (
          <div className="w-full mb-4 rounded-lg border border-border bg-card p-4 shadow-sm grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <p className="text-sm text-muted-foreground">Saldo de puntos</p>
              <p className="text-xl font-bold text-primary">{numberFormatter.format(pointsBalance)} pts</p>
            </div>
            <div className="md:col-span-2">
              <p className="text-sm text-muted-foreground mb-2">Sube una nota de pedido para armar el carrito automáticamente.</p>
              <UploadOrderFromFile onCartUpdated={() => toast({ title: 'Carrito actualizado', description: 'Revisa tu carrito para confirmar los ítems detectados.' })} />
            </div>
          </div>
        )}
        {!shouldShowDemoLoyalty && !user && (
          <div className="w-full mb-4 rounded-lg border border-dashed border-primary/30 bg-card p-4 shadow-sm grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-2">
              <p className="text-sm text-muted-foreground mb-2">Inicia sesión para ver tu saldo de puntos y canjear productos.</p>
              <div className="flex gap-2 flex-wrap">
                <Button asChild variant="default" size="sm">
                  <Link to={loginPath}>Iniciar sesión</Link>
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
            placeholder="Buscar productos por nombre, descripción, categoría..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 text-base rounded-md border-border focus:ring-primary focus:border-primary"
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
            { value: 'donacion', label: 'Donación' },
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
            {allProducts.length > 0 ? "No se encontraron productos para tu búsqueda." : "Aún no hay productos en el catálogo."}
          </p>
          {allProducts.length > 0 && searchTerm && (
             <p className="text-sm text-muted-foreground mt-2">Intenta con otros términos de búsqueda.</p>
          )}
        </div>
      )}

      <Dialog open={showPointsAuthPrompt} onOpenChange={setShowPointsAuthPrompt}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Inicia sesión para usar tus puntos</DialogTitle>
            <DialogDescription>{pointsAuthMessage}</DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex flex-col sm:flex-row sm:justify-end gap-2">
            <Button asChild variant="default">
              <Link to={loginPath}>Iniciar sesión</Link>
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
