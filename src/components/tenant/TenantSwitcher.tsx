import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';

import { useTenant } from '@/context/TenantContext';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';

interface TenantSwitcherProps {
  className?: string;
}

const formatOptionLabel = (nombre?: string | null, slug?: string | null) => {
  if (nombre && nombre.trim()) {
    return nombre.trim();
  }
  return slug ?? '';
};

export const TenantSwitcher = ({ className }: TenantSwitcherProps) => {
  const {
    currentSlug,
    followedTenants,
    isLoadingFollowedTenants,
  } = useTenant();
  const navigate = useNavigate();

  const options = useMemo(() => followedTenants.filter((item) => item.slug), [followedTenants]);

  const selectValue = useMemo(() => {
    if (!currentSlug) return undefined;
    return options.some((item) => item.slug === currentSlug) ? currentSlug : undefined;
  }, [currentSlug, options]);

  if (!isLoadingFollowedTenants && options.length === 0) {
    return null;
  }

  const handleChange = (value: string) => {
    if (!value) return;
    const encoded = encodeURIComponent(value);
    navigate(`/t/${encoded}`);
  };

  return (
    <div className={className}>
      <Label className="text-xs font-medium text-muted-foreground">Espacios guardados</Label>
      <div className="mt-1.5">
        {isLoadingFollowedTenants && options.length === 0 ? (
          <Skeleton className="h-10 w-full rounded-md" />
        ) : (
          <Select value={selectValue} onValueChange={handleChange}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Elegí un espacio seguido" />
            </SelectTrigger>
            <SelectContent>
              {options.map((item) => (
                <SelectItem key={item.slug} value={item.slug}>
                  {formatOptionLabel(item.nombre, item.slug)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>
    </div>
  );
};

export default TenantSwitcher;
