import React, { useRef } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import {
  CatalogPreviewV1,
  ColumnMapping,
  CatalogField,
  ImportRow
} from '@/types/catalog-import';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, CheckCircle, Ban } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ImportMappingTableProps {
  preview: CatalogPreviewV1;
  mapping: ColumnMapping;
  onMappingChange: (columnKey: string, field: CatalogField) => void;
  onCellValueChange?: (rowId: string, columnKey: string, value: any) => void;
}

const FIELD_OPTIONS: { value: CatalogField; label: string; required?: boolean }[] = [
  { value: 'product_name', label: 'Nombre Producto', required: true },
  { value: 'price', label: 'Precio', required: true },
  { value: 'sku', label: 'SKU / Código' },
  { value: 'category', label: 'Categoría' },
  { value: 'stock', label: 'Stock / Cantidad' },
  { value: 'currency', label: 'Moneda' },
  { value: 'description', label: 'Descripción' },
  { value: 'image_url', label: 'URL Imagen' },
  { value: 'ignore', label: 'Ignorar Columna' },
];

export const ImportMappingTable: React.FC<ImportMappingTableProps> = ({
  preview,
  mapping,
  onMappingChange,
  onCellValueChange,
}) => {
  const parentRef = useRef<HTMLDivElement>(null);

  const rows = preview.rows_sample || [];
  const columns = preview.columns || [];

  const rowVirtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 48, // approximate row height
    overscan: 5,
  });

  return (
    <div className="flex flex-col border rounded-md shadow-sm h-[500px] bg-white dark:bg-slate-950">
      {/* Header with Mapping Controls */}
      <div className="flex divide-x border-b bg-muted/30 overflow-hidden shrink-0">
        {/* Sticky index column header */}
        <div className="w-12 p-3 font-medium text-xs text-muted-foreground flex items-center justify-center shrink-0 bg-muted/50">
          #
        </div>

        <div className="flex-1 overflow-x-auto hide-scrollbar flex">
          {columns.map((col) => {
            const mappedField = mapping[col.key];
            const isIgnored = mappedField === 'ignore';
            const isMapped = mappedField && !isIgnored;

            return (
              <div
                key={col.key}
                className={cn(
                  "flex-shrink-0 w-48 p-2 border-r last:border-r-0 flex flex-col gap-2 transition-colors",
                  isIgnored ? "bg-slate-100 dark:bg-slate-900/50 opacity-60" : "bg-white dark:bg-slate-950"
                )}
              >
                <div className="flex items-center justify-between">
                   <span className="text-xs font-bold truncate max-w-[120px]" title={col.label}>
                     {col.label}
                   </span>
                   {col.confidence && col.confidence < 0.7 && (
                     <Badge variant="outline" className="text-[10px] h-4 px-1 text-amber-600 border-amber-200">
                       Low Conf.
                     </Badge>
                   )}
                </div>

                <Select
                  value={mappedField || 'ignore'}
                  onValueChange={(val) => onMappingChange(col.key, val as CatalogField)}
                >
                  <SelectTrigger className={cn(
                    "h-7 text-xs",
                    isMapped ? "border-green-500 text-green-700 bg-green-50 dark:bg-green-950/30 dark:text-green-400" : ""
                  )}>
                    <SelectValue placeholder="Ignorar" />
                  </SelectTrigger>
                  <SelectContent>
                    {FIELD_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label} {opt.required && "*"}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            );
          })}
        </div>
      </div>

      {/* Virtualized Body */}
      <div
        ref={parentRef}
        className="flex-1 overflow-auto"
      >
        <div
          style={{
            height: `${rowVirtualizer.getTotalSize()}px`,
            width: '100%',
            position: 'relative',
          }}
        >
          {rowVirtualizer.getVirtualItems().map((virtualRow) => {
            const row = rows[virtualRow.index];
            return (
              <div
                key={virtualRow.key}
                data-index={virtualRow.index}
                ref={rowVirtualizer.measureElement}
                className={cn(
                  "absolute top-0 left-0 w-full flex divide-x border-b hover:bg-slate-50 dark:hover:bg-slate-900/50 transition-colors",
                )}
                style={{
                  transform: `translateY(${virtualRow.start}px)`,
                }}
              >
                 {/* Index Column */}
                <div className="w-12 p-2 flex items-center justify-center text-xs text-muted-foreground bg-muted/10 shrink-0">
                  {virtualRow.index + 1}
                </div>

                {/* Data Columns */}
                <div className="flex-1 flex">
                   {columns.map((col) => {
                     const cellValue = row.cells[col.key];
                     const isIgnored = mapping[col.key] === 'ignore';

                     return (
                       <div
                         key={col.key}
                         className={cn(
                           "flex-shrink-0 w-48 p-2 text-sm truncate flex items-center",
                           isIgnored ? "text-muted-foreground opacity-50 bg-slate-50/50 dark:bg-slate-900/20" : ""
                         )}
                         title={String(cellValue)}
                       >
                         {/* Simple inline edit or display */}
                         {onCellValueChange && !isIgnored ? (
                           <input
                             className="w-full bg-transparent border-none focus:outline-none focus:ring-1 focus:ring-primary rounded px-1"
                             value={cellValue ?? ''}
                             onChange={(e) => onCellValueChange(row.row_id, col.key, e.target.value)}
                           />
                         ) : (
                           <span>{cellValue ?? <span className="text-gray-300 italic">null</span>}</span>
                         )}
                       </div>
                     );
                   })}
                </div>
              </div>
            );
          })}
        </div>

        {rows.length === 0 && (
          <div className="h-full flex flex-col items-center justify-center text-muted-foreground p-10">
            <Ban className="h-8 w-8 mb-2 opacity-50" />
            <p>No hay datos para mostrar en la vista previa.</p>
          </div>
        )}
      </div>
    </div>
  );
};
