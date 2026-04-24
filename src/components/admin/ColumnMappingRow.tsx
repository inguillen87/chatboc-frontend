import React from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { SystemField } from '@/utils/columnMatcher'; // Assuming SystemField is defined here or imported
import { Badge } from '@/components/ui/badge'; // For the 'sugerido' badge

interface ColumnMappingRowProps {
  systemField: SystemField;
  userColumns: string[];
  selectedValue: string | null;
  onMappingChange: (systemFieldKey: string, userColumn: string | null) => void;
  isSuggested?: boolean; // To indicate if the current mapping was auto-suggested
  similarity?: number; // Optional: to show similarity score for transparency
}

const ColumnMappingRow: React.FC<ColumnMappingRowProps> = ({
  systemField,
  userColumns,
  selectedValue,
  onMappingChange,
  isSuggested,
  similarity,
}) => {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 gap-4 items-center py-3 border-b border-border last:border-b-0">
      <div className="text-sm font-medium text-foreground">
        {systemField.label}
        {systemField.key === 'nombre' && <span className="text-destructive ml-1">*</span>} {/* Example: Mark 'nombre' as required */}
      </div>
      <div className="col-span-1 md:col-span-2">
        <Select
          value={selectedValue || ''}
          onValueChange={(value) => onMappingChange(systemField.key, value === '' ? null : value)}
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Seleccionar columna..." />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">
              <em>No mapear / Ignorar</em>
            </SelectItem>
            {userColumns.map((col) => (
              <SelectItem key={col} value={col}>
                {col}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {isSuggested && (
        <div className="hidden md:flex items-center space-x-2">
          <Badge variant="outline" className="text-xs bg-green-100 text-green-700 border-green-300">
            Sugerido ✨
          </Badge>
          {similarity !== undefined && (
            <span className="text-xs text-muted-foreground" title="Nivel de confianza">
              ({(similarity * 100).toFixed(0)}%)
            </span>
          )}
        </div>
      )}
    </div>
  );
};

export default ColumnMappingRow;
