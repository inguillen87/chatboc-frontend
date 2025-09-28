import { useMemo } from 'react';
import { addDays } from 'date-fns';
import { CalendarIcon, Share2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/components/ui/use-toast';
import type { FilterCatalogResponse } from '@/services/analyticsService';
import { useAnalyticsFilters } from '@/context/AnalyticsFiltersContext';

interface AnalyticsFilterBarProps {
  filters?: FilterCatalogResponse;
  loading?: boolean;
}

interface MultiFilterProps {
  label: string;
  placeholder?: string;
  values: string[];
  options: string[];
  onChange: (values: string[]) => void;
}

function MultiSelectFilter({ label, placeholder, values, options, onChange }: MultiFilterProps) {
  const display = values.length ? `${values.length} seleccionados` : placeholder ?? 'Todos';
  const normalizedOptions = useMemo(
    () => options.map((option) => ({ value: option, label: option })),
    [options],
  );
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="min-w-[160px] justify-start gap-2">
          {label}
          <span className="truncate text-xs text-muted-foreground">{display}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-0" align="start">
        <Command>
          <CommandInput placeholder={`Filtrar ${label.toLowerCase()}`} />
          <CommandList>
            <CommandEmpty>Sin resultados</CommandEmpty>
            <CommandGroup>
              {normalizedOptions.map((option) => {
                const isSelected = values.includes(option.value);
                return (
                  <CommandItem
                    key={option.value}
                    onSelect={() => {
                      if (isSelected) {
                        onChange(values.filter((value) => value !== option.value));
                      } else {
                        onChange([...values, option.value]);
                      }
                    }}
                    className="flex items-center gap-2"
                  >
                    <Checkbox checked={isSelected} className="mr-2" />
                    <span>{option.label}</span>
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
          <div className="flex items-center justify-between border-t p-2 text-xs">
            <Button variant="ghost" size="sm" onClick={() => onChange([])}>
              Limpiar
            </Button>
            <span className="text-muted-foreground">{values.length} activos</span>
          </div>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

export function AnalyticsFilterBar({ filters, loading }: AnalyticsFilterBarProps) {
  const { filters: state, setDateRange, setFilters } = useAnalyticsFilters();
  const { toast } = useToast();

  const from = useMemo(() => new Date(state.from), [state.from]);
  const to = useMemo(() => new Date(state.to), [state.to]);

  const handleShare = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      toast({ description: 'Link copiado al portapapeles' });
    } catch (error) {
      console.error('No se pudo copiar la URL', error);
      toast({ description: 'No se pudo copiar la URL', variant: 'destructive' });
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-lg border bg-background/60 p-3">
      <Select
        value={state.tenantId}
        onValueChange={(value) => setFilters({ tenantId: value })}
      >
        <SelectTrigger className="w-[200px]">
          <SelectValue placeholder="Entidad" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="tenant-municipio-1">tenant-municipio-1</SelectItem>
          <SelectItem value="tenant-municipio-2">tenant-municipio-2</SelectItem>
          <SelectItem value="tenant-pyme-1">tenant-pyme-1</SelectItem>
          <SelectItem value="tenant-pyme-2">tenant-pyme-2</SelectItem>
        </SelectContent>
      </Select>
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" className="justify-start gap-2">
            <CalendarIcon className="h-4 w-4" />
            <span>
              {state.from} - {state.to}
            </span>
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            initialFocus
            mode="range"
            defaultMonth={from}
            selected={{ from, to }}
            onSelect={(range) => {
              if (!range?.from || !range?.to) return;
              setDateRange(range.from, range.to);
            }}
            numberOfMonths={2}
          />
          <div className="flex items-center justify-between border-t p-3 text-xs">
            <Button variant="ghost" size="sm" onClick={() => setDateRange(addDays(new Date(), -30), new Date())}>
              Últimos 30 días
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setDateRange(addDays(new Date(), -7), new Date())}>
              Últimos 7 días
            </Button>
          </div>
        </PopoverContent>
      </Popover>

      <MultiSelectFilter
        label="Canales"
        placeholder="Todos"
        values={state.canal ?? []}
        options={filters?.canales ?? []}
        onChange={(value) => setFilters({ canal: value })}
      />
      <MultiSelectFilter
        label="Categorías"
        placeholder="Todas"
        values={state.categoria ?? []}
        options={filters?.categorias ?? []}
        onChange={(value) => setFilters({ categoria: value })}
      />
      <MultiSelectFilter
        label="Estados"
        placeholder="Todos"
        values={state.estado ?? []}
        options={filters?.estados ?? []}
        onChange={(value) => setFilters({ estado: value })}
      />
      <MultiSelectFilter
        label="Agentes"
        placeholder="Todos"
        values={state.agente ?? []}
        options={filters?.agentes ?? []}
        onChange={(value) => setFilters({ agente: value })}
      />
      <MultiSelectFilter
        label="Zonas"
        placeholder="Todas"
        values={state.zona ?? []}
        options={filters?.zonas ?? []}
        onChange={(value) => setFilters({ zona: value })}
      />

      <Button variant="outline" size="sm" className="ml-auto gap-2" onClick={handleShare} disabled={loading}>
        <Share2 className="h-4 w-4" /> Compartir vista
      </Button>
    </div>
  );
}
