import React from 'react';
import { AlertTriangle, Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';

export interface CatalogPreviewItem {
  id: string | number;
  sku: string;
  name: string;
  price: number | string;
  stock: number | string;
  category: string;
  description?: string;
  image_url?: string;
  errors?: string[];
  warnings?: string[];
  metadata?: Array<{ key: string; value: string }>;
}

interface CatalogItemsTableProps {
  items: CatalogPreviewItem[];
  onUpdate: (id: string | number, field: keyof CatalogPreviewItem, value: any) => void;
  onDelete: (id: string | number) => void;
  readOnly?: boolean;
}

const CatalogItemsTable: React.FC<CatalogItemsTableProps> = ({ items, onUpdate, onDelete, readOnly = false }) => {
  return (
    <div className="relative max-h-[500px] overflow-y-auto rounded-md border">
      <Table>
        <TableHeader className="sticky top-0 z-10 bg-background shadow-sm">
          <TableRow>
            <TableHead className="w-[100px]">SKU</TableHead>
            <TableHead>Producto</TableHead>
            <TableHead className="w-[120px]">Precio</TableHead>
            <TableHead className="w-[100px]">Stock</TableHead>
            <TableHead className="w-[150px]">Categoria</TableHead>
            {!readOnly && <TableHead className="w-[50px]"></TableHead>}
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.length === 0 ? (
            <TableRow>
              <TableCell colSpan={readOnly ? 5 : 6} className="h-24 text-center">
                No se encontraron items.
              </TableCell>
            </TableRow>
          ) : (
            items.map((item) => (
              <TableRow key={item.id} className={cn(item.errors?.length ? 'bg-red-50/50' : '')}>
                <TableCell>
                  {readOnly ? (
                    <span className="font-mono text-xs">{item.sku || '-'}</span>
                  ) : (
                    <Input
                      value={item.sku}
                      onChange={(event) => onUpdate(item.id, 'sku', event.target.value)}
                      className="h-8 font-mono text-xs"
                      placeholder="SKU-001"
                    />
                  )}
                </TableCell>
                <TableCell>
                  <div className="flex flex-col gap-1">
                    {readOnly ? (
                      <div className="flex flex-col gap-1">
                        <span className="font-medium">{item.name}</span>
                        {item.metadata?.length ? (
                          <div className="flex flex-wrap gap-1 text-[10px] text-muted-foreground">
                            {item.metadata.map((entry) => (
                              <span key={`${entry.key}-${entry.value}`} className="rounded border border-muted px-1 py-0.5">
                                <span className="font-medium">{entry.key}</span>: {entry.value}
                              </span>
                            ))}
                          </div>
                        ) : null}
                      </div>
                    ) : (
                      <Input
                        value={item.name}
                        onChange={(event) => onUpdate(item.id, 'name', event.target.value)}
                        className={cn('h-8', !item.name && 'border-red-300')}
                        placeholder="Nombre del producto"
                      />
                    )}
                    {item.errors?.length ? (
                      <div className="mt-1 flex flex-wrap gap-1">
                        {item.errors.map((error, index) => (
                          <Badge key={`${error}-${index}`} variant="destructive" className="h-5 px-1 text-[10px]">{error}</Badge>
                        ))}
                      </div>
                    ) : null}
                    {item.warnings?.length ? (
                      <div className="mt-1 flex flex-wrap gap-1">
                        {item.warnings.map((warning, index) => (
                          <Badge
                            key={`${warning}-${index}`}
                            variant="secondary"
                            className="h-5 border-amber-200 bg-amber-50 px-1 text-[10px] text-amber-700"
                          >
                            <AlertTriangle className="mr-1 h-3 w-3" /> {warning}
                          </Badge>
                        ))}
                      </div>
                    ) : null}
                  </div>
                </TableCell>
                <TableCell>
                  {readOnly ? (
                    <span>${item.price}</span>
                  ) : (
                    <Input
                      type="number"
                      value={item.price}
                      onChange={(event) => onUpdate(item.id, 'price', parseFloat(event.target.value))}
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
                      onChange={(event) => onUpdate(item.id, 'stock', parseFloat(event.target.value))}
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
                      onChange={(event) => onUpdate(item.id, 'category', event.target.value)}
                      className="h-8"
                      placeholder="Categoria"
                    />
                  )}
                </TableCell>
                {!readOnly && (
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground hover:text-destructive"
                      onClick={() => onDelete(item.id)}
                    >
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
