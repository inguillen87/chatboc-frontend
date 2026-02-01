import React from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Trash2, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface CatalogPreviewItem {
  id: string | number; // temporary ID for the frontend
  sku: string;
  name: string;
  price: number | string;
  stock: number | string;
  category: string;
  description?: string;
  image_url?: string;
  errors?: string[];
  warnings?: string[];
}

interface CatalogItemsTableProps {
  items: CatalogPreviewItem[];
  onUpdate: (id: string | number, field: keyof CatalogPreviewItem, value: any) => void;
  onDelete: (id: string | number) => void;
  readOnly?: boolean;
}

const CatalogItemsTable: React.FC<CatalogItemsTableProps> = ({ items, onUpdate, onDelete, readOnly = false }) => {
  return (
    <div className="rounded-md border max-h-[500px] overflow-y-auto relative">
      <Table>
        <TableHeader className="sticky top-0 bg-background z-10 shadow-sm">
          <TableRow>
            <TableHead className="w-[100px]">SKU</TableHead>
            <TableHead>Producto</TableHead>
            <TableHead className="w-[120px]">Precio</TableHead>
            <TableHead className="w-[100px]">Stock</TableHead>
            <TableHead className="w-[150px]">Categoría</TableHead>
            {!readOnly && <TableHead className="w-[50px]"></TableHead>}
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.length === 0 ? (
            <TableRow>
              <TableCell colSpan={6} className="h-24 text-center">
                No se encontraron items.
              </TableCell>
            </TableRow>
          ) : (
            items.map((item) => (
              <TableRow key={item.id} className={cn(item.errors?.length ? "bg-red-50/50" : "")}>
                <TableCell>
                    {readOnly ? (
                        <span className="font-mono text-xs">{item.sku || '-'}</span>
                    ) : (
                        <Input
                            value={item.sku}
                            onChange={(e) => onUpdate(item.id, 'sku', e.target.value)}
                            className="h-8 font-mono text-xs"
                            placeholder="SKU-001"
                        />
                    )}
                </TableCell>
                <TableCell>
                  <div className="flex flex-col gap-1">
                    {readOnly ? (
                        <span className="font-medium">{item.name}</span>
                    ) : (
                        <Input
                            value={item.name}
                            onChange={(e) => onUpdate(item.id, 'name', e.target.value)}
                            className={cn("h-8", !item.name && "border-red-300")}
                            placeholder="Nombre del producto"
                        />
                    )}
                    {(item.errors?.length || 0) > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1">
                            {item.errors?.map((err, i) => (
                                <Badge key={i} variant="destructive" className="text-[10px] px-1 h-5">{err}</Badge>
                            ))}
                        </div>
                    )}
                    {(item.warnings?.length || 0) > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1">
                            {item.warnings?.map((warn, i) => (
                                <Badge key={i} variant="secondary" className="text-[10px] px-1 h-5 text-amber-600 bg-amber-50 border-amber-200">
                                    <AlertTriangle className="w-3 h-3 mr-1"/> {warn}
                                </Badge>
                            ))}
                        </div>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                    {readOnly ? (
                        <span>${item.price}</span>
                    ) : (
                        <Input
                            type="number"
                            value={item.price}
                            onChange={(e) => onUpdate(item.id, 'price', parseFloat(e.target.value))}
                            className="h-8"
                            min={0}
                        />
                    )}
                </TableCell>
                <TableCell>
                    {readOnly ? (
                        <span>{item.stock}</span>
                    ) : (
                        <Input
                            type="number"
                            value={item.stock}
                            onChange={(e) => onUpdate(item.id, 'stock', parseFloat(e.target.value))}
                            className="h-8"
                            min={0}
                        />
                    )}
                </TableCell>
                <TableCell>
                     {readOnly ? (
                        <Badge variant="outline">{item.category || 'General'}</Badge>
                    ) : (
                        <Input
                            value={item.category}
                            onChange={(e) => onUpdate(item.id, 'category', e.target.value)}
                            className="h-8"
                            placeholder="Categoría"
                        />
                    )}
                </TableCell>
                {!readOnly && (
                  <TableCell>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={() => onDelete(item.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                )}
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
};

export default CatalogItemsTable;
