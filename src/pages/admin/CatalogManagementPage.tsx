import React, { useEffect, useMemo, useState } from 'react';
import { useTenant } from '@/context/TenantContext';
import { useUser } from '@/hooks/useUser';
import { fetchMarketCatalog } from '@/api/market';
import { apiClient } from '@/api/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from '@/components/ui/use-toast';
import { Loader2, UploadCloud, Search, ExternalLink, Edit2, Check, X } from 'lucide-react';
import CatalogUploadWizard from '@/components/catalog/CatalogUploadWizard';
import { getProductPlaceholderImage } from '@/utils/cartPayload';
import { ProductDetails } from '@/components/product/ProductCard';

export default function CatalogManagementPage() {
  const { currentSlug } = useTenant();
  const { user } = useUser();
  const [products, setProducts] = useState<ProductDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [isWizardOpen, setIsWizardOpen] = useState(false);

  // Filtering
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [stockFilter, setStockFilter] = useState('all');
  const [varietalFilter, setVarietalFilter] = useState('all');

  // Inline Editing
  const [editingId, setEditingId] = useState<string | number | null>(null);
  const [editPrice, setEditPrice] = useState<string>('');
  const [updatingId, setUpdatingId] = useState<string | number | null>(null);

  const isWinery = useMemo(() => {
    // Check various fields where rubro might be stored
    return (
      (user as any)?.rubro_slug === 'bodega' ||
      (user as any)?.rubro === 'bodega' ||
      (user as any)?.tipo_chat === 'bodega'
    );
  }, [user]);

  const loadProducts = async () => {
    if (!currentSlug) return;
    setLoading(true);
    try {
      const data = await fetchMarketCatalog(currentSlug);
      // Map MarketProduct to ProductDetails structure if needed, or rely on compatibility
      // fetchMarketCatalog returns { products: MarketProduct[] }
      // MarketProduct is compatible enough for our table usually, but let's check types.
      // We might need to cast or map.
      setProducts(data.products as unknown as ProductDetails[]);
    } catch (error) {
      console.error("Failed to load catalog", error);
      toast({ variant: "destructive", title: "Error", description: "Failed to load products." });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProducts();
  }, [currentSlug]);

  const categories = useMemo(() => {
    const cats = new Set(products.map(p => p.categoria).filter(Boolean));
    return Array.from(cats);
  }, [products]);

  const varietals = useMemo(() => {
    if (!isWinery) return [];
    // Assuming varietal might be in 'categoria' or extra fields.
    // Prompt says: "derived from extra_metadata.varietal or categoria"
    // For now we use category as fallback if extra_metadata isn't available on ProductDetails type yet
    return categories;
  }, [products, isWinery, categories]);

  const filteredProducts = useMemo(() => {
    return products.filter(p => {
      const matchSearch =
        p.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.descripcion?.toLowerCase().includes(searchTerm.toLowerCase());

      const matchCategory = categoryFilter === 'all' || p.categoria === categoryFilter;

      const matchStock = stockFilter === 'all'
        ? true
        : stockFilter === 'in_stock'
          ? (p.stock_disponible ?? 0) > 0
          : (p.stock_disponible ?? 0) <= 0;

      // Winery specific filter logic
      const matchVarietal = varietalFilter === 'all' || p.categoria === varietalFilter; // Simplified for now

      return matchSearch && matchCategory && matchStock && matchVarietal;
    });
  }, [products, searchTerm, categoryFilter, stockFilter, varietalFilter]);

  const startEditing = (product: ProductDetails) => {
    setEditingId(product.id);
    setEditPrice(String(product.precio_unitario));
  };

  const cancelEditing = () => {
    setEditingId(null);
    setEditPrice('');
  };

  const savePrice = async (product: ProductDetails) => {
    if (!currentSlug) return;
    const newPrice = parseFloat(editPrice);
    if (isNaN(newPrice)) {
      toast({ variant: "destructive", title: "Invalid Price" });
      return;
    }

    setUpdatingId(product.id);
    try {
      // Using generic PUT endpoint
      await apiClient.put(`/api/${currentSlug}/productos/${product.id}`, {
        precio_unitario: newPrice,
        tenantSlug: currentSlug
      });

      // Optimistic update
      setProducts(prev => prev.map(p => p.id === product.id ? { ...p, precio_unitario: newPrice } : p));
      toast({ title: "Price Updated" });
      setEditingId(null);
    } catch (error) {
      toast({ variant: "destructive", title: "Update Failed", description: "Could not update price." });
    } finally {
      setUpdatingId(null);
    }
  };

  const handleWizardComplete = () => {
    setIsWizardOpen(false);
    loadProducts(); // Reload table
  };

  return (
    <div className="container mx-auto p-4 md:p-8 space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold">Catalog Management</h1>
          <p className="text-muted-foreground">Manage your products, prices, and stock.</p>
        </div>
        <Dialog open={isWizardOpen} onOpenChange={setIsWizardOpen}>
          <DialogTrigger asChild>
            <Button>
              <UploadCloud className="mr-2 h-4 w-4" /> Import Catalog
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
             {/* Wizard handles its own header/content usually, but we wrapped it in Card.
                 Let's just render it. DialogContent adds some padding. */}
             <CatalogUploadWizard onComplete={handleWizardComplete} onCancel={() => setIsWizardOpen(false)} />
          </DialogContent>
        </Dialog>
      </div>

      {/* Filters */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 bg-card p-4 rounded-lg border shadow-sm">
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search products..."
            className="pl-8"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
          />
        </div>

        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger>
            <SelectValue placeholder="Category" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            {categories.map(c => <SelectItem key={c} value={c as string}>{c}</SelectItem>)}
          </SelectContent>
        </Select>

        <Select value={stockFilter} onValueChange={setStockFilter}>
          <SelectTrigger>
            <SelectValue placeholder="Stock Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Any Stock</SelectItem>
            <SelectItem value="in_stock">In Stock</SelectItem>
            <SelectItem value="out_of_stock">Out of Stock</SelectItem>
          </SelectContent>
        </Select>

        {isWinery && (
          <Select value={varietalFilter} onValueChange={setVarietalFilter}>
            <SelectTrigger>
               <SelectValue placeholder="Varietal" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Varietals</SelectItem>
              {varietals.map(v => <SelectItem key={v} value={v as string}>{v}</SelectItem>)}
            </SelectContent>
          </Select>
        )}
      </div>

      {/* Table */}
      <div className="rounded-md border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[80px]">Image</TableHead>
              <TableHead>Product</TableHead>
              <TableHead className="w-[150px]">Price</TableHead>
              <TableHead className="w-[100px]">Stock</TableHead>
              <TableHead className="w-[100px]">Link</TableHead>
              <TableHead className="w-[50px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={6} className="h-24 text-center">
                  <Loader2 className="h-6 w-6 animate-spin mx-auto" />
                </TableCell>
              </TableRow>
            ) : filteredProducts.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                  No products found.
                </TableCell>
              </TableRow>
            ) : (
              filteredProducts.map((product) => (
                <TableRow key={product.id}>
                  <TableCell>
                    <div className="h-12 w-12 rounded-md overflow-hidden bg-muted">
                        <img
                            src={product.imagen_url || getProductPlaceholderImage(product)}
                            alt={product.nombre}
                            className="h-full w-full object-cover"
                        />
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="font-medium">{product.nombre}</div>
                    <div className="text-sm text-muted-foreground truncate max-w-[200px]">
                      {product.descripcion}
                    </div>
                    {product.modalidad && (
                        <Badge variant="outline" className="mt-1 text-xs scale-90 origin-left">
                            {product.modalidad}
                        </Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    {editingId === product.id ? (
                        <div className="flex items-center gap-1">
                            <Input
                                type="number"
                                value={editPrice}
                                onChange={e => setEditPrice(e.target.value)}
                                className="h-8 w-24"
                                autoFocus
                            />
                            <Button size="icon" variant="ghost" className="h-8 w-8 text-green-600" onClick={() => savePrice(product)}>
                                {updatingId === product.id ? <Loader2 className="h-3 w-3 animate-spin"/> : <Check className="h-3 w-3"/>}
                            </Button>
                            <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" onClick={cancelEditing}>
                                <X className="h-3 w-3"/>
                            </Button>
                        </div>
                    ) : (
                        <div className="flex items-center gap-2 group cursor-pointer" onClick={() => startEditing(product)}>
                            <span>
                                {new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(product.precio_unitario)}
                            </span>
                            <Edit2 className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                        </div>
                    )}
                  </TableCell>
                  <TableCell>
                    {typeof product.stock_disponible === 'number' ? (
                        <Badge variant={product.stock_disponible > 0 ? 'secondary' : 'destructive'}>
                            {product.stock_disponible}
                        </Badge>
                    ) : (
                        <span className="text-sm text-muted-foreground">N/A</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {product.external_url && (
                        <a
                            href={product.external_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-primary hover:underline flex items-center gap-1 text-sm"
                        >
                            Link <ExternalLink className="h-3 w-3" />
                        </a>
                    )}
                  </TableCell>
                  <TableCell>
                      {/* More actions could go here */}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
