import React from 'react';
import { useSearchParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { TicketInboxPage } from '@/components/tickets/inbox';
import EducationShell from '@/components/education/EducationShell';
import { useEducationShellData } from '@/hooks/useEducationShellData';
import type { EducationStaffFilter } from '@/types/education';

const FilterGroup = ({
  title,
  filters,
  searchParams,
  onSelectFilter,
}: {
  title: string;
  filters: EducationStaffFilter[];
  searchParams: URLSearchParams;
  onSelectFilter: (queryKey: string | undefined, queryValue: string | undefined, isActive: boolean) => void;
}) => {
  if (filters.length === 0) return null;

  return (
    <div className="space-y-2">
      <p className="text-xs font-medium text-foreground">{title}</p>
      <div className="flex flex-wrap gap-2">
        {filters.map((filter) => {
          const isActive = filter.query_key ? searchParams.get(filter.query_key) === filter.query_value : false;
          return (
            <Button
              key={filter.id}
              size="sm"
              variant={isActive ? 'default' : 'outline'}
              onClick={() => onSelectFilter(filter.query_key, filter.query_value, isActive)}
            >
              {filter.label}
            </Button>
          );
        })}
      </div>
    </div>
  );
};

export default function EducationStaffInboxPage() {
  const { data } = useEducationShellData('staff');
  const [searchParams, setSearchParams] = useSearchParams();

  const filters = data?.staff_filters ?? [];
  const sensitivityFilters = data?.staff_sensitivity_filters ?? [];
  const contextFields = data?.staff_context_fields ?? [];
  const caseTimeline = data?.staff_case_timeline ?? [];
  const presetCategory = searchParams.get('case_type') ?? undefined;
  const presetSensitivity = searchParams.get('sensitivity') ?? undefined;

  const onSelectFilter = (queryKey: string | undefined, queryValue: string | undefined, isActive: boolean) => {
    if (!queryKey) return;
    const next = new URLSearchParams(searchParams);
    if (isActive || !queryValue) {
      next.delete(queryKey);
    } else {
      next.set(queryKey, queryValue);
    }
    setSearchParams(next);
  };

  return (
    <EducationShell persona="staff">
      <div className="grid gap-4 xl:grid-cols-[360px,1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Contexto alumno/familia</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm text-muted-foreground">
            {contextFields.length > 0 ? (
              <div className="space-y-1">
                {contextFields.map((field) => (
                  <p key={field.id}>
                    <span className="font-medium text-foreground">{field.label}:</span> {field.value}
                  </p>
                ))}
              </div>
            ) : (
              <p>Placeholder para ficha contextual sensible según permisos del staff.</p>
            )}
            <FilterGroup
              title="Filtros de caso"
              filters={filters}
              searchParams={searchParams}
              onSelectFilter={onSelectFilter}
            />
            <FilterGroup
              title="Sensibilidad"
              filters={sensitivityFilters}
              searchParams={searchParams}
              onSelectFilter={onSelectFilter}
            />
            {caseTimeline.length > 0 ? (
              <div className="space-y-2">
                <p className="text-xs font-medium text-foreground">Timeline contextual</p>
                <div className="space-y-2">
                  {caseTimeline.map((entry) => (
                    <div key={entry.id} className="rounded-md border p-2">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-foreground">{entry.label}</span>
                        {entry.kind ? <Badge variant="outline">{entry.kind}</Badge> : null}
                      </div>
                      {entry.timestamp ? <p className="text-xs text-muted-foreground">{entry.timestamp}</p> : null}
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
            <p>Preparado para consumir <code>/api/v1/education/cases/*</code> y <code>/api/v1/education/family-context/*</code>.</p>
          </CardContent>
        </Card>
        <div className="min-w-0">
          <TicketInboxPage presetCategory={presetCategory} presetSensitivity={presetSensitivity} />
        </div>
      </div>
    </EducationShell>
  );
}
