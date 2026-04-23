import React, { useState, useEffect, useMemo } from 'react';
import { CatalogStorefrontPreview } from '@/components/admin/catalog/CatalogStorefrontPreview';
import { useTenant } from '@/context/TenantContext';
import { apiClient } from '@/api/client';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogTrigger } from '@/components/ui/dialog';
import { Loader2, Search, Filter, Save, ExternalLink, ImageOff, UploadCloud, Edit2, Check, X } from 'lucide-react';
import { toast } from 'sonner';
import { useUser } from '@/hooks/useUser';
import CatalogUploadWizard from '@/components/admin/catalog/CatalogUploadWizard';

const CatalogManagementPage = () => {
  const { currentSlug, tenant } = useTenant();
  const { user } = useUser();
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [stockFilter, setStockFilter] = useState('all');
  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [uploadOpen, setUploadOpen] = useState(false);

  // Inline Edit State
  const [editingId, setEditingId] = useState<string | number | null>(null);
  const [editPrice, setEditPrice] = useState<string>('');
  const [updatingId, setUpdatingId] = useState<string | number | null>(null);

  // Dynamic Industry Filters
  const [varietalFilter, setVarietalFilter] = useState('all');

  // Determine industry type
  const isWinery = useMemo(() =>
    tenant?.rubro_slug === 'bodega' || user?.rubro === 'bodega' || currentSlug?.includes('bodega'),
  [tenant, user, currentSlug]);

  useEffect(() => {
    if (currentSlug) {
      loadProducts();
    }
  }, [currentSlug]);

  const loadProducts = async () => {
    setLoading(true);
    try {
      if (!currentSlug) return;
      const data = await apiClient.adminListProducts(currentSlug);
      setProducts(data || []);
    } catch (error) {
      console.error('Error loading products:', error);
      toast.error("Error al cargar productos.");
    } finally {
      setLoading(false);
    }
  };

  const startEditing = (product: any) => {
    setEditingId(product.id);
    setEditPrice(String(product.price || product.precio_unitario || 0));
  };

  const cancelEditing = () => {
    setEditingId(null);
    setEditPrice('');
  };

  const handlePriceUpdate = async (product: any) => {
    if (!currentSlug) return;
    const newPrice = parseFloat(editPrice);
    if (isNaN(newPrice)) {
        toast.error("Precio inválido");
        return;
    }

    setUpdatingId(product.id);
    try {
        await apiClient.adminUpdateProduct(currentSlug, product.id, { price: newPrice });
        setProducts(prev => prev.map(p => p.id === product.id ? { ...p, price: newPrice, precio_unitario: newPrice } : p));
        toast.success("Precio actualizado");
        setEditingId(null);
    } catch (error) {
        console.error("Update failed", error);
        toast.error("No se pudo actualizar el precio");
    } finally {
        setUpdatingId(null);
    }
  };

  // Extract unique categories for filter
  const categories = Array.from(new Set(products.map(p => p.category || p.categoria).filter(Boolean)));

  // Extract unique varietals for winery filter
  const varietals = isWinery ? Array.from(new Set(products.map(p => p.extra_metadata?.varietal || p.varietal).filter(Boolean))) : [];

  const filteredProducts = products.filter(p => {
      const name = p.name || p.nombre || '';
      const desc = p.description || p.descripcion || '';
      const cat = p.category || p.categoria;
      const stock = p.stock || p.stock_disponible;
      const varietal = p.extra_metadata?.varietal || p.varietal;

      const matchesSearch = name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                            desc.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesCategory = categoryFilter === 'all' || cat === categoryFilter;
      const matchesStock = stockFilter === 'all' ||
                           (stockFilter === 'in_stock' ? (stock > 0 || stock === 'Consultar') : (stock === 0));

      const price = parseFloat(p.price || p.precio_unitario || 0);
      const matchesPrice = (!minPrice || price >= parseFloat(minPrice)) &&
                           (!maxPrice || price <= parseFloat(maxPrice));

      const matchesVarietal = !isWinery || varietalFilter === 'all' || varietal === varietalFilter;

      return matchesSearch && matchesCategory && matchesStock && matchesVarietal && matchesPrice;
  });

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center flex-wrap gap-4">
        <div>
            <h1 className="text-3xl font-bold tracking-tight">Gestión de Catálogo</h1>
            <p className="text-muted-foreground">Administra tus productos, precios y stock.</p>
        </div>
        <div className="flex gap-2">
            <Dialog open={uploadOpen} onOpenChange={setUploadOpen}>
                <DialogTrigger asChild>
                    <Button>
                        <UploadCloud className="mr-2 h-4 w-4" /> Importar
                    </Button>
                </DialogTrigger>
                <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto sm:max-w-[800px]">
                    <CatalogUploadWizard
                        onFinish={() => { setUploadOpen(false); loadProducts(); }}
                    />
                </DialogContent>
            </Dialog>
            <Button onClick={loadProducts} variant="outline" size="sm">
                <Filter className="mr-2 h-4 w-4" /> Recargar
            </Button>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-3">
            <div className="flex flex-col md:flex-row gap-4">
                <div className="relative flex-1">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Buscar por nombre..."
                        className="pl-8"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
                <div className="flex items-center gap-2">
                    <Input
                        placeholder="Min $"
                        className="w-[90px]"
                        type="number"
                        value={minPrice}
                        onChange={(e) => setMinPrice(e.target.value)}
                    />
                    <Input
                        placeholder="Max $"
                        className="w-[90px]"
                        type="number"
                        value={maxPrice}
                        onChange={(e) => setMaxPrice(e.target.value)}
                    />
                </div>
                <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                    <SelectTrigger className="w-[180px]">
                        <SelectValue placeholder="Categoría" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">Todas</SelectItem>
                        {categories.map((c: any) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                    </SelectContent>
                </Select>

                <Select value={stockFilter} onValueChange={setStockFilter}>
                    <SelectTrigger className="w-[150px]">
                        <SelectValue placeholder="Stock" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">Todo</SelectItem>
                        <SelectItem value="in_stock">En Stock</SelectItem>
                        <SelectItem value="no_stock">Sin Stock</SelectItem>
                    </SelectContent>
                </Select>

                {isWinery && (
                    <Select value={varietalFilter} onValueChange={setVarietalFilter}>
                        <SelectTrigger className="w-[150px] border-purple-200 bg-purple-50 text-purple-900">
                            <SelectValue placeholder="Varietal" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">Todos</SelectItem>
                            {varietals.map((v: any) => <SelectItem key={v} value={v}>{v}</SelectItem>)}
                        </SelectContent>
                    </Select>
                )}
            </div>
        </CardHeader>
        <CardContent>
            {loading ? (
                <div className="flex justify-center p-8"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
            ) : (
                <div className="rounded-md border">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="w-[80px]">Imagen</TableHead>
                                <TableHead>Producto</TableHead>
                                <TableHead className="w-[150px]">Precio</TableHead>
                                <TableHead className="w-[100px]">Stock</TableHead>
                                <TableHead className="w-[50px]"></TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {filteredProducts.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={5} className="text-center h-24 text-muted-foreground">
                                        No se encontraron productos.
                                    </TableCell>
                                </TableRow>
                            ) : (
                                filteredProducts.map((product) => (
                                    <TableRow key={product.id}>
                                        <TableCell>
                                            <div className="h-10 w-10 rounded bg-muted flex items-center justify-center overflow-hidden">
                                                {product.image_url || product.imagen_url ? (
                                                    <img src={product.image_url || product.imagen_url} alt="" className="h-full w-full object-cover" />
                                                ) : (
                                                    <ImageOff className="h-5 w-5 text-muted-foreground" />
                                                )}
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <div className="font-medium">{product.name || product.nombre}</div>
                                            <div className="text-xs text-muted-foreground truncate max-w-[200px]">{product.description || product.descripcion}</div>
                                            {isWinery && (product.extra_metadata?.varietal || product.varietal) && (
                                                <Badge variant="outline" className="mt-1 text-xs border-purple-200 text-purple-700">
                                                    {product.extra_metadata?.varietal || product.varietal}
                                                </Badge>
                                            )}
                                            {product.modalidad && (
                                                <Badge variant="secondary" className="mt-1 ml-2 text-xs scale-90">
                                                    {product.modalidad}
                                                </Badge>
                                            )}
                                        </TableCell>
                                        <TableCell>
                                            {editingId === product.id ? (
                                                <div className="flex items-center gap-1">
                                                    <span className="text-xs text-muted-foreground">$</span>
                                                    <Input
                                                        type="number"
                                                        value={editPrice}
                                                        onChange={e => setEditPrice(e.target.value)}
                                                        className="h-8 w-20 text-right px-2"
                                                        autoFocus
                                                    />
                                                    <Button size="icon" variant="ghost" className="h-8 w-8 text-green-600 hover:text-green-700" onClick={() => handlePriceUpdate(product)}>
                                                        {updatingId === product.id ? <Loader2 className="h-3 w-3 animate-spin"/> : <Check className="h-3 w-3"/>}
                                                    </Button>
                                                    <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive hover:text-red-700" onClick={cancelEditing}>
                                                        <X className="h-3 w-3"/>
                                                    </Button>
                                                </div>
                                            ) : (
                                                <div className="flex items-center gap-2 group cursor-pointer p-1 rounded hover:bg-muted/50" onClick={() => startEditing(product)}>
                                                    <span>
                                                        {new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(product.price || product.precio_unitario || 0)}
                                                    </span>
                                                    <Edit2 className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                                                </div>
                                            )}
                                        </TableCell>
                                        <TableCell>
                                            <Badge variant={(product.stock > 0 || product.stock_disponible > 0 || product.stock === 'Consultar') ? 'outline' : 'destructive'}>
                                                {(product.stock === 'Consultar') ? 'Consultar' : ((product.stock ?? product.stock_disponible) > 0 ? `${product.stock ?? product.stock_disponible} un.` : 'Agotado')}
                                            </Badge>
                                        </TableCell>
                                        <TableCell>
                                            {product.external_url && (
                                                <a href={product.external_url} target="_blank" rel="noopener noreferrer" title="Ver enlace externo">
                                                    <ExternalLink className="h-4 w-4 text-muted-foreground hover:text-primary" />
                                                </a>
                                            )}
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </div>
            )}
        </CardContent>
      </Card>
    </div>
  );
};

export default CatalogManagementPage;
