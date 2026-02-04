import React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Trash2, Plus, Palette } from "lucide-react";
import type { CatalogColumn, CatalogRow } from "@/types/catalog";

interface CatalogSpreadsheetEditorProps {
  columns: CatalogColumn[];
  rows: CatalogRow[];
  onUpdateColumn: (index: number, column: CatalogColumn) => void;
  onDeleteColumn: (index: number) => void;
  onAddColumn: () => void;
  onUpdateCell: (rowId: CatalogRow["id"], columnKey: string, value: string) => void;
  onCommitCell?: (rowId: CatalogRow["id"], columnKey: string, value: string) => void;
  onAddRow: () => void;
  onDeleteRow: (rowId: CatalogRow["id"]) => void;
  addRowLabel?: string | null;
  addColumnLabel?: string | null;
  emptyLabel?: string | null;
  emptyColumnsLabel?: string | null;
}

const CatalogSpreadsheetEditor: React.FC<CatalogSpreadsheetEditorProps> = ({
  columns,
  rows,
  onUpdateColumn,
  onDeleteColumn,
  onAddColumn,
  onUpdateCell,
  onCommitCell,
  onAddRow,
  onDeleteRow,
  addRowLabel,
  addColumnLabel,
  emptyLabel,
  emptyColumnsLabel,
}) => {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {addColumnLabel && (
          <Button type="button" variant="outline" size="sm" onClick={onAddColumn}>
            <Plus className="mr-2 h-4 w-4" /> {addColumnLabel}
          </Button>
        )}
        {addRowLabel && (
          <Button type="button" variant="outline" size="sm" onClick={onAddRow}>
            <Plus className="mr-2 h-4 w-4" /> {addRowLabel}
          </Button>
        )}
      </div>

      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead className="bg-muted/60">
            <tr>
              {columns.map((column, index) => (
                <th key={column.key} className="min-w-[160px] p-3 text-left align-top">
                  <div className="space-y-2">
                    <Input
                      value={column.label}
                      onChange={(event) =>
                        onUpdateColumn(index, { ...column, label: event.target.value })
                      }
                      className="h-8"
                    />
                    <div className="flex items-center gap-2">
                      {column.color && (
                        <Badge
                          variant="outline"
                          style={{ borderColor: column.color, color: column.color }}
                        >
                          {column.label || column.key}
                        </Badge>
                      )}
                      <label className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Palette className="h-3 w-3" />
                        <Input
                          type="color"
                          value={column.color || "#2563eb"}
                          onChange={(event) =>
                            onUpdateColumn(index, { ...column, color: event.target.value })
                          }
                          className="h-6 w-8 border-none bg-transparent p-0"
                        />
                      </label>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => onDeleteColumn(index)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </th>
              ))}
              {columns.length === 0 && emptyColumnsLabel && (
                <th className="p-3 text-left text-muted-foreground">{emptyColumnsLabel}</th>
              )}
              <th className="w-12 p-3"></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="border-t">
                {columns.map((column) => (
                  <td key={`${row.id}-${column.key}`} className="p-2">
                    <Input
                      value={String(row.cells?.[column.key] ?? "")}
                      onChange={(event) =>
                        onUpdateCell(row.id, column.key, event.target.value)
                      }
                      onBlur={(event) =>
                        onCommitCell?.(row.id, column.key, event.target.value)
                      }
                      className="h-8"
                    />
                  </td>
                ))}
                <td className="p-2 text-right">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => onDeleteRow(row.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </td>
              </tr>
            ))}
            {rows.length === 0 && emptyLabel && (
              <tr>
                <td colSpan={Math.max(columns.length + 1, 1)} className="p-6 text-center text-muted-foreground">
                  {emptyLabel}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default CatalogSpreadsheetEditor;
