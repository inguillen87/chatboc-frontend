import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { PremiumTerritoryHeatmap } from './PremiumTerritoryMap';
import type { OperationsHeatmapPoint, OperationsHeatmapV1 } from './analyticsTypes';

vi.mock('@/components/LazyMapLibreMap', () => ({
  default: (props: {
    heatmapData?: Array<{
      id?: string | number;
      lat?: number;
      lng?: number;
      direccion?: string;
      addressCellLabel?: string;
      ticket?: string;
      ticketId?: string;
      sourceModel?: 'TenantTicket' | 'MunicipioTicket' | 'PymeTicket';
      recordSource?: string;
      ticketIdentityStatus?: 'valid' | 'missing' | 'ambiguous' | 'unsupported';
      categoria?: string;
      barrio?: string;
      estado?: string;
      canal?: string;
      categoryColor?: string;
      fuente?: string;
    }>;
    fitToBounds?: Array<[number, number]>;
    fitBoundsRequestKey?: string;
    provider?: string;
    mapStyleUrl?: string | null;
    maptilerKey?: string | null;
    googleMapsKey?: string | null;
    ariaLabel?: string;
    ariaDescribedBy?: string;
    showHeatmap?: boolean;
    showPoints?: boolean;
    showPointLabels?: boolean;
    pointLabelMode?: string;
    pointLabelMinZoom?: number;
    heatmapRadiusScale?: number;
    heatmapPalette?: string;
    adaptiveZoomMode?: boolean;
    disableClientClustering?: boolean;
    onFeatureSelect?: (point: {
      id?: string | number;
      ticket?: string;
      ticketId?: string;
      sourceModel?: 'TenantTicket' | 'MunicipioTicket' | 'PymeTicket';
      recordSource?: string;
      ticketIdentityStatus?: 'valid' | 'missing' | 'ambiguous' | 'unsupported';
      categoria?: string;
      barrio?: string;
      estado?: string;
      canal?: string;
      categoryColor?: string;
    }) => void;
    popupContext?: string;
    boundsPadding?: { top?: number; right?: number; bottom?: number; left?: number };
    evidence?: unknown;
    showEvidenceBadge?: boolean;
    geoLayerConfig?: {
      contract_version?: string;
      source?: { features?: unknown[] };
      layers?: {
        heatmap?: { id?: string };
        clusters?: { id?: string };
        points?: { id?: string };
      };
      telemetry?: { event_endpoint?: string; events?: string[] };
      source_options?: { enabled_layers?: string[]; default_viewport_id?: string };
      interactions?: { time_slider?: { enabled?: boolean; field?: string } };
    } | null;
  }) => (
    <div
      data-testid="mock-live-map"
      data-points={String(props.heatmapData?.length ?? 0)}
      data-point-ids={(props.heatmapData ?? []).map((point) => String(point.id ?? '')).join('|')}
      data-point-sources={(props.heatmapData ?? []).map((point) => point.fuente ?? '').join('|')}
      data-addresses={(props.heatmapData ?? [])
        .map((point) => point.addressCellLabel ?? point.direccion ?? '')
        .filter(Boolean)
        .join('|')}
      data-categories={(props.heatmapData ?? []).map((point) => point.categoria ?? '').join('|')}
      data-zones={(props.heatmapData ?? []).map((point) => point.barrio ?? '').join('|')}
      data-channels={(props.heatmapData ?? []).map((point) => point.canal ?? '').join('|')}
      data-category-colors={(props.heatmapData ?? []).map((point) => point.categoryColor ?? '').join('|')}
      data-bounds={String(props.fitToBounds?.length ?? 0)}
      data-bounds-coordinates={JSON.stringify(props.fitToBounds ?? [])}
      data-fit-request-key={props.fitBoundsRequestKey ?? ''}
      data-provider={props.provider}
      data-style-url={props.mapStyleUrl ?? ''}
      data-maptiler-key={props.maptilerKey ?? ''}
      data-google-key={props.googleMapsKey ?? ''}
      data-aria-label={props.ariaLabel ?? ''}
      data-aria-describedby={props.ariaDescribedBy ?? ''}
      data-show-heatmap={String(Boolean(props.showHeatmap))}
      data-show-points={String(Boolean(props.showPoints))}
      data-show-point-labels={String(Boolean(props.showPointLabels))}
      data-point-label-mode={props.pointLabelMode ?? ''}
      data-point-label-min-zoom={String(props.pointLabelMinZoom ?? '')}
      data-heatmap-radius={String(props.heatmapRadiusScale ?? '')}
      data-heatmap-palette={props.heatmapPalette ?? ''}
      data-adaptive-zoom={String(Boolean(props.adaptiveZoomMode))}
      data-disable-client-clustering={String(Boolean(props.disableClientClustering))}
      data-popup-context={props.popupContext ?? ''}
      data-bounds-padding={JSON.stringify(props.boundsPadding ?? {})}
      data-evidence-present={String(Boolean(props.evidence))}
      data-show-evidence-badge={String(props.showEvidenceBadge !== false)}
      data-geo-contract={props.geoLayerConfig?.contract_version ?? ''}
      data-geo-features={String(props.geoLayerConfig?.source?.features?.length ?? 0)}
      data-geo-heat-layer={props.geoLayerConfig?.layers?.heatmap?.id ?? ''}
      data-geo-point-layer={props.geoLayerConfig?.layers?.points?.id ?? ''}
      data-geo-telemetry-endpoint={props.geoLayerConfig?.telemetry?.event_endpoint ?? ''}
      data-geo-telemetry-events={props.geoLayerConfig?.telemetry?.events?.join('|') ?? ''}
      data-geo-enabled-layers={props.geoLayerConfig?.source_options?.enabled_layers?.join('|') ?? ''}
      data-geo-default-viewport={props.geoLayerConfig?.source_options?.default_viewport_id ?? ''}
      data-geo-time-slider={props.geoLayerConfig?.interactions?.time_slider?.enabled ? 'true' : 'false'}
    >
      <button
        type="button"
        onClick={() =>
          props.onFeatureSelect?.(props.heatmapData?.[0] ?? {})
        }
      >
        Seleccionar punto de muestra
      </button>
    </div>
  ),
}));

const TEST_OFFICIAL_BOUNDARY_SHA = 'a'.repeat(64);

const buildPoints = (count: number): OperationsHeatmapPoint[] =>
  Array.from({ length: count }, (_, index) => ({
    id: `point-${index}`,
    lat: -34.61 + index * 0.0001,
    lng: -60.91 + index * 0.0001,
    weight: 2,
    previous: 1,
    barrio: 'Centro',
    categoria: 'reclamos',
    canal: 'whatsapp',
  }));

const openTerritoryFilters = () => {
  const toolbar = screen.getByTestId('territory-filter-toolbar') as HTMLDetailsElement;
  if (!toolbar.open) {
    fireEvent.click(toolbar.querySelector('summary') as HTMLElement);
  }
  return toolbar;
};

const chooseTerritoryFacet = (name: string, value: string) => {
  openTerritoryFilters();
  fireEvent.change(screen.getByRole('combobox', { name }), { target: { value } });
};

describe('PremiumTerritoryHeatmap', () => {
  it('separates the bounded map workspace from secondary territorial intelligence', () => {
    const points = buildPoints(6);
    const heatmap = {
      contract_version: 'operations.heatmap.v1',
      points,
      cells: [],
      hotspots: [],
      facets: [],
      category_layers: [],
      render_contract: { can_render_heatmap: true, layers: ['points'] },
      quality: { state: 'ready', visible_points: 6, can_render_heatmap: true },
    } as OperationsHeatmapV1;

    render(<PremiumTerritoryHeatmap points={points} heatmap={heatmap} />);

    const layout = screen.getByTestId('territory-map-layout');
    const mapShell = screen.getByTestId('territory-map-shell');
    const executiveRail = screen.getByTestId('territory-executive-rail');
    const executiveStrip = screen.getByTestId('territory-executive-strip');
    const intelligenceDetails = screen.getByTestId('territory-intelligence-details');
    const intelligenceWorkspace = screen.getByTestId('territory-intelligence-workspace');

    expect(layout).toHaveClass('items-start');
    const filterDisclosure = screen.getByTestId('territory-filter-toolbar') as HTMLDetailsElement;
    expect(filterDisclosure).toHaveClass('order-3');
    expect(filterDisclosure.tagName).toBe('DETAILS');
    expect(filterDisclosure).not.toHaveAttribute('open');
    expect(layout).toHaveClass('order-4');
    expect(executiveStrip).toHaveClass('order-5');
    expect(mapShell).toHaveClass('self-start');
    expect(intelligenceWorkspace).toHaveClass('lg:grid-cols-2');
    expect(intelligenceWorkspace).not.toHaveClass('2xl:grid-cols-3');
    expect(layout).toContainElement(mapShell);
    expect(layout).toContainElement(executiveRail);
    expect(executiveRail).not.toContainElement(intelligenceWorkspace);
    expect(layout).not.toHaveAttribute('data-territory-map-layout');
    expect(layout.parentElement).not.toHaveAttribute('style');
    expect(executiveRail).toHaveClass('w-full');
    expect(executiveRail).not.toHaveClass('2xl:sticky');
    expect(executiveRail.querySelector('details')).not.toHaveAttribute('open');
    expect(screen.getByTestId('territory-inspector-summary')).toHaveTextContent('6 puntos');
    expect(screen.getByTestId('territory-inspector-summary')).toHaveTextContent('cobertura');
    expect(screen.getByTestId('territory-inspector-summary')).toHaveTextContent('pendientes');
    expect(intelligenceDetails).not.toHaveAttribute('open');
    expect(screen.getByText('Análisis y acciones territoriales')).toBeInTheDocument();
    expect(layout.className).not.toContain('2xl:grid-cols');
    expect(filterDisclosure).not.toHaveClass('sticky');
    expect(screen.getByTestId('territory-primary-summary')).toHaveTextContent('Puntos mapeados 6');
    expect(screen.queryByText('Globo territorial interactivo')).toBeNull();
    expect(screen.getByRole('radio', { name: 'Clústeres' })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getAllByRole('radio').map((control) => control.textContent)).toEqual([
      'Mapa operativo',
      'Clústeres',
      'Solo calor',
    ]);
    expect(mapShell).not.toContainElement(screen.getByTestId('territory-display-mode-control'));
    expect(screen.queryByRole('radio', { name: 'Automático' })).toBeNull();
    expect(screen.queryByRole('radio', { name: 'Ambos' })).toBeNull();
    const liveMap = screen.getByTestId('mock-live-map');
    expect(liveMap).toHaveAttribute('data-show-heatmap', 'false');
    expect(liveMap).toHaveAttribute('data-show-points', 'true');
    expect(liveMap).toHaveAttribute('data-point-label-min-zoom', '7');
    expect(liveMap).toHaveAttribute('data-disable-client-clustering', 'false');
    const describedBy = liveMap.getAttribute('data-aria-describedby');
    expect(describedBy).toBeTruthy();
    expect(document.getElementById(describedBy!)).toHaveTextContent('Ver datos accesibles');
    expect(screen.getByRole('button', { name: 'Ver datos accesibles (6)' })).toBeInTheDocument();
    openTerritoryFilters();
    expect(screen.getAllByRole('combobox')).toHaveLength(3);
  });

  it('keeps the Junín territorial truth visible in the compact filter disclosure', () => {
    const points = buildPoints(12).map((point) => ({
      ...point,
      coordinate_jurisdiction_status: 'within' as const,
    }));
    const heatmap = {
      contract_version: 'operations.heatmap.v1',
      points,
      cells: [],
      hotspots: [],
      facets: [],
      category_layers: [],
      render_contract: { can_render_heatmap: true, layers: ['base_heatmap', 'category_layers'] },
      privacy: { mode: 'privileged_exact', minimum_sample_size: 3 },
      quality: { state: 'partial', visible_points: 12, can_render_heatmap: true },
      jurisdiction: {
        state: 'configured',
        enforced: true,
        containment_method: 'point_in_polygon',
        containment_verified: true,
        boundary_authority: {
          kind: 'official',
          source_ref: 'https://ide.mendoza.gov.ar/fixture-junin',
          snapshot_sha256: TEST_OFFICIAL_BOUNDARY_SHA,
        },
        city: 'Junín',
        state_name: 'Mendoza',
        bounds: { west: -61, south: -35, east: -60, north: -34 },
        excluded_coordinate_records: 9,
        review_candidate_count: 9,
      },
      territorial_facets: {
        summary: {
          ticket_records: 63,
          mapped_records: 12,
          pending_geocode_records: 34,
          records_outside_jurisdiction: 9,
        },
        categories: [{ key: 'reclamos', label: 'Reclamos', count: 63, mapped_count: 12, pending_geocode_count: 34, outside_jurisdiction_count: 9 }],
        addresses: [],
        explicit_zones: [],
      },
    } as OperationsHeatmapV1;

    render(<PremiumTerritoryHeatmap points={points} heatmap={heatmap} />);

    expect(screen.getByTestId('territory-filter-disclosure-summary')).toHaveTextContent(
      '12 mapeados · 34 pendientes · 9 para revisar',
    );
    expect(screen.getByTestId('territory-outside-jurisdiction')).toHaveTextContent(
      'Fuera de jurisdicción / revisar · 9',
    );
    expect(screen.getByTestId('mock-live-map')).toHaveAttribute('data-points', '12');
  });

  it('promotes asynchronously loaded mapped data to the hybrid default without overriding an operator choice', () => {
    const { rerender } = render(<PremiumTerritoryHeatmap points={[]} />);
    const points: OperationsHeatmapPoint[] = [
      { id: 'async-bache', lat: -34.61, lng: -60.91, categoria: 'Baches', barrio: 'Centro' },
      { id: 'async-luz', lat: -34.62, lng: -60.92, categoria: 'Luminarias', barrio: 'Norte' },
    ];
    const heatmap = {
      contract_version: 'operations.heatmap.v1',
      points,
      cells: [],
      hotspots: [],
      facets: [],
      category_layers: [],
      render_contract: { can_render_heatmap: true, layers: ['base_heatmap', 'category_layers'] },
      privacy: { mode: 'privileged_exact', minimum_sample_size: 10 },
      quality: { state: 'ready', visible_points: 2, can_render_heatmap: true },
    } as OperationsHeatmapV1;

    rerender(<PremiumTerritoryHeatmap points={points} heatmap={heatmap} />);

    const map = screen.getByTestId('mock-live-map');
    expect(screen.getByRole('radio', { name: 'Mapa operativo' })).toHaveAttribute('aria-checked', 'true');
    expect(map).toHaveAttribute('data-show-heatmap', 'true');
    expect(map).toHaveAttribute('data-show-points', 'true');

    fireEvent.click(screen.getByRole('radio', { name: 'Solo calor' }));
    rerender(<PremiumTerritoryHeatmap points={[...points]} heatmap={{ ...heatmap, points: [...points] }} />);

    expect(screen.getByRole('radio', { name: 'Solo calor' })).toHaveAttribute('aria-checked', 'true');
    expect(map).toHaveAttribute('data-show-heatmap', 'true');
    expect(map).toHaveAttribute('data-show-points', 'false');
  });

  it('keeps the live map unobstructed and filters visible heat points by category and zone', () => {
    const points: OperationsHeatmapPoint[] = [
      { id: 'bache-centro', lat: -34.61, lng: -60.91, categoria: 'Baches', barrio: 'Centro', weight: 3 },
      { id: 'bache-norte', lat: -34.62, lng: -60.92, categoria: 'Baches', barrio: 'Norte', weight: 2 },
      {
        id: 'municipio_ticket:419',
        record_source: 'municipio_ticket',
        lat: -34.63,
        lng: -60.93,
        categoria: 'Luminarias',
        barrio: 'Centro',
        estado: 'nuevo',
        canal: 'whatsapp',
        weight: 1,
      },
      { id: 'luz-pendiente', lat: -34.64, lng: -60.94, categoria: 'Luminarias', barrio: 'sin_zona', weight: 1 },
    ];
    const heatmap = {
      contract_version: 'operations.heatmap.v1',
      points,
      cells: [],
      hotspots: [],
      facets: [],
      category_layers: [],
      render_contract: { can_render_heatmap: true, layers: ['base_heatmap', 'category_layers'] },
      privacy: { mode: 'privileged_exact', minimum_sample_size: 10 },
      quality: { state: 'ready', visible_points: 4, can_render_heatmap: true },
    } as OperationsHeatmapV1;

    render(<PremiumTerritoryHeatmap points={points} heatmap={heatmap} />);

    const map = screen.getByTestId('mock-live-map');
    const legend = screen.getByTestId('territory-live-legend');
    expect(map.getAttribute('data-points')).toBe('4');
    expect(map.getAttribute('data-categories')).toBe('Baches|Baches|Luminarias|Luminarias');
    expect(map.getAttribute('data-zones')).toBe('Centro|Norte|Centro|sin_zona');
    expect(map.getAttribute('data-channels')).toBe('||whatsapp|');
    const categoryColors = (map.getAttribute('data-category-colors') ?? '').split('|');
    expect(categoryColors[0]).toBe(categoryColors[1]);
    expect(categoryColors[2]).toBe(categoryColors[3]);
    expect(categoryColors[0]).not.toBe(categoryColors[2]);
    expect(map.getAttribute('data-geo-features')).toBe('4');
    expect(map.getAttribute('data-show-points')).toBe('true');
    expect(map.getAttribute('data-show-heatmap')).toBe('true');
    expect(map.getAttribute('data-show-point-labels')).toBe('true');
    expect(map.getAttribute('data-point-label-mode')).toBe('count');
    expect(map.getAttribute('data-point-label-min-zoom')).toBe('7');
    expect(map.getAttribute('data-disable-client-clustering')).toBe('false');
    expect(map.getAttribute('data-heatmap-palette')).toBe('faro');
    expect(map.getAttribute('data-adaptive-zoom')).toBe('false');
    expect(map.getAttribute('data-heatmap-radius')).toBe('2.35');
    expect(legend).not.toHaveClass('absolute');
    expect(screen.queryByTestId('territory-boundary-empty-state')).toBeNull();
    expect(screen.queryByRole('button', { name: /sin_zona/i })).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: /^Capas por categoría/ }));
    expect(map.getAttribute('data-show-points')).toBe('false');
    expect(map.getAttribute('data-show-point-labels')).toBe('false');
    expect(map.getAttribute('data-disable-client-clustering')).toBe('true');
    expect(screen.getByRole('radio', { name: 'Solo calor' })).toHaveAttribute('aria-checked', 'true');
    fireEvent.click(screen.getByRole('button', { name: /^Capas por categoría/ }));
    expect(screen.getByRole('radio', { name: 'Mapa operativo' })).not.toBeDisabled();
    expect(screen.getByRole('radio', { name: 'Mapa operativo' })).toHaveAttribute('aria-checked', 'true');
    expect(map.getAttribute('data-show-points')).toBe('true');
    expect(map.getAttribute('data-show-point-labels')).toBe('true');
    expect(map.getAttribute('data-disable-client-clustering')).toBe('false');
    expect(screen.getByTestId('territory-display-mode-status')).toHaveTextContent(
      'se agrupan con contador, sin separar puntos artificialmente',
    );

    chooseTerritoryFacet('Filtrar mapa por categoría', 'baches');
    expect(map.getAttribute('data-points')).toBe('2');
    expect(map.getAttribute('data-geo-features')).toBe('2');
    expect(map.getAttribute('data-heatmap-radius')).toBe('2.8');
    expect(map.getAttribute('data-fit-request-key')).toContain('baches');
    expect(map.getAttribute('data-bounds-coordinates')).toBe(
      JSON.stringify([
        [-60.91, -34.61],
        [-60.92, -34.62],
      ]),
    );
    expect(screen.getByRole('button', { name: 'Quitar filtro de categoría Baches' })).toBeInTheDocument();

    chooseTerritoryFacet('Filtrar mapa por zona o barrio', 'centro');
    expect(map.getAttribute('data-points')).toBe('1');
    expect(map.getAttribute('data-geo-features')).toBe('1');
    expect(map.getAttribute('data-heatmap-radius')).toBe('2.8');

    fireEvent.click(screen.getByRole('button', { name: /Luminarias\s+2/ }));
    expect(map.getAttribute('data-points')).toBe('1');
    expect(screen.getByRole('button', { name: /Luminarias\s+2/ })).toHaveAttribute('aria-pressed', 'true');
    expect(map.getAttribute('data-fit-request-key')).toContain('luminarias');
    expect(map.getAttribute('data-bounds-coordinates')).toBe(JSON.stringify([[-60.93, -34.63]]));

    fireEvent.click(screen.getByRole('radio', { name: 'Clústeres' }));
    expect(map.getAttribute('data-show-heatmap')).toBe('false');
    expect(map.getAttribute('data-show-points')).toBe('true');
    expect(map.getAttribute('data-show-point-labels')).toBe('true');
    expect(map.getAttribute('data-disable-client-clustering')).toBe('false');
    expect(map.getAttribute('data-points')).toBe('1');

    fireEvent.click(screen.getByRole('button', { name: /^Capas por categoría/ }));
    expect(screen.getByRole('radio', { name: 'Solo calor' })).toHaveAttribute('aria-checked', 'true');
    fireEvent.click(screen.getByRole('radio', { name: 'Solo calor' }));
    fireEvent.click(screen.getByRole('button', { name: /^Capas por categoría/ }));
    expect(screen.getByRole('radio', { name: 'Solo calor' })).toHaveAttribute('aria-checked', 'true');
    expect(map.getAttribute('data-disable-client-clustering')).toBe('true');

    fireEvent.click(screen.getByRole('radio', { name: 'Clústeres' }));
    expect(map.getAttribute('data-disable-client-clustering')).toBe('false');

    fireEvent.click(screen.getByRole('radio', { name: 'Solo calor' }));
    expect(map.getAttribute('data-show-heatmap')).toBe('true');
    expect(map.getAttribute('data-show-points')).toBe('false');
    expect(map.getAttribute('data-show-point-labels')).toBe('false');
    expect(map.getAttribute('data-disable-client-clustering')).toBe('true');
    expect(map.getAttribute('data-points')).toBe('1');

    fireEvent.click(screen.getByRole('button', { name: 'Seleccionar punto de muestra' }));
    expect(screen.getByTestId('territory-selected-point')).toHaveTextContent('Luminarias');
    expect(screen.getByTestId('territory-selected-point')).toHaveTextContent('Estado · Nuevo');
    expect(screen.getByTestId('territory-selected-point')).toHaveTextContent('Canal · WhatsApp');
    expect(screen.getByTestId('territory-selected-point')).toHaveTextContent('Zona · Centro');
    expect(screen.getByRole('link', { name: 'Abrir reclamo' })).toHaveAttribute(
      'href',
      '/perfil?tab=tickets&source_model=MunicipioTicket&ticket_id=419',
    );
    fireEvent.click(screen.getByRole('button', { name: 'Cerrar detalle' }));
    expect(screen.queryByTestId('territory-selected-point')).toBeNull();
  });

  it('keeps mapped categories filterable when the canonical facet list is partial', () => {
    const points: OperationsHeatmapPoint[] = [
      {
        id: 'mapped-alumbrado',
        lat: -34.61,
        lng: -60.91,
        categoria: 'Alumbrado publico',
        barrio: 'Centro',
        canal: 'whatsapp',
      },
      {
        id: 'mapped-bache',
        lat: -34.62,
        lng: -60.92,
        categoria: 'Baches',
        barrio: 'Norte',
        canal: 'web',
      },
    ];
    const heatmap = {
      contract_version: 'operations.heatmap.v1',
      points,
      cells: [],
      hotspots: [],
      facets: [],
      category_layers: [],
      render_contract: { can_render_heatmap: true, layers: ['base_heatmap', 'category_layers'] },
      privacy: { mode: 'privileged_exact', minimum_sample_size: 10 },
      quality: { state: 'ready', visible_points: 2, can_render_heatmap: true },
      territorial_facets: {
        categories: [
          {
            key: 'luminarias',
            label: 'Luminarias',
            count: 1,
            mapped_count: 1,
            raw_categories: [{ key: 'Alumbrado publico', label: 'Alumbrado publico', count: 1 }],
          },
        ],
        explicit_zones: [],
        addresses: [],
      },
    } as OperationsHeatmapV1;

    render(<PremiumTerritoryHeatmap points={points} heatmap={heatmap} />);

    const map = screen.getByTestId('mock-live-map');
    openTerritoryFilters();
    expect(screen.getByRole('option', { name: 'Luminarias' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Baches' })).toBeInTheDocument();
    expect(map.getAttribute('data-category-colors')).not.toContain('||');

    chooseTerritoryFacet('Filtrar mapa por categoría', 'baches');
    expect(map).toHaveAttribute('data-points', '1');
    expect(map).toHaveAttribute('data-categories', 'Baches');
    expect(map).toHaveAttribute('data-zones', 'Norte');
    expect(map).toHaveAttribute('data-channels', 'web');

    fireEvent.click(screen.getByRole('button', { name: /Luminarias\s+1/ }));
    expect(map).toHaveAttribute('data-points', '1');
    expect(map).toHaveAttribute('data-categories', 'Alumbrado publico');
    expect(map).toHaveAttribute('data-zones', 'Centro');
    expect(map).toHaveAttribute('data-channels', 'whatsapp');
  });

  it('fails closed when a territorial point publishes conflicting ticket models', () => {
    const points: OperationsHeatmapPoint[] = [
      {
        id: 'municipio_ticket:419',
        source_model: 'MunicipioTicket',
        record_source: 'tenant_ticket',
        ticket_id: 419,
        lat: -34.61,
        lng: -60.91,
        categoria: 'Luminarias',
        barrio: 'Centro',
      },
    ];
    const heatmap = {
      contract_version: 'operations.heatmap.v1',
      points,
      cells: [],
      hotspots: [],
      facets: [],
      category_layers: [],
      render_contract: { can_render_heatmap: true, layers: ['points'] },
      privacy: { mode: 'privileged_exact', minimum_sample_size: 10 },
      quality: { state: 'ready', visible_points: 1, can_render_heatmap: true },
    } as OperationsHeatmapV1;

    render(<PremiumTerritoryHeatmap points={points} heatmap={heatmap} />);
    fireEvent.click(screen.getByRole('button', { name: 'Seleccionar punto de muestra' }));

    expect(screen.getByTestId('territory-selected-point')).toHaveTextContent('Luminarias');
    expect(screen.queryByRole('link', { name: 'Abrir reclamo' })).toBeNull();
    expect(screen.getByText('Sin vínculo CRM verificable')).toBeInTheDocument();
  });

  it('scopes executive metrics to Luminarias and avoids invented metrics for combined filters', () => {
    const points: OperationsHeatmapPoint[] = [
      {
        id: 'luz-centro',
        lat: -33.081,
        lng: -68.469,
        categoria: 'Luminarias',
        barrio: 'Centro',
        coordinate_jurisdiction_status: 'within',
        weight: 1,
      },
      {
        id: 'luz-centro-2',
        lat: -33.0805,
        lng: -68.4685,
        categoria: 'Alumbrado publico',
        raw_category: 'Alumbrado publico',
        barrio: 'Centro',
        coordinate_jurisdiction_status: 'within',
        weight: 1,
      },
      {
        id: 'luz-norte',
        lat: -33.071,
        lng: -68.459,
        categoria: 'Luminarias',
        barrio: 'Norte',
        coordinate_jurisdiction_status: 'within',
        weight: 1,
      },
      {
        id: 'bache-centro',
        lat: -33.082,
        lng: -68.47,
        categoria: 'Baches',
        barrio: 'Centro',
        coordinate_jurisdiction_status: 'within',
        weight: 1,
      },
    ];
    const heatmap = {
      contract_version: 'operations.heatmap.v1',
      points,
      cells: [],
      hotspots: [],
      facets: [],
      category_layers: [],
      render_contract: { can_render_heatmap: true, layers: ['base_heatmap', 'category_layers'] },
      privacy: { mode: 'privileged_exact', minimum_sample_size: 10 },
      quality: { state: 'partial', coverage_percent: 19.1, visible_points: 12, pending_geocode: 34, can_render_heatmap: true },
      location_quality: {
        total_ticket_records: 63,
        ticket_records_with_coordinates: 12,
        ticket_records_pending_geocode: 34,
        ticket_records_outside_jurisdiction: 9,
        coordinate_coverage_pct: 19.1,
      },
      jurisdiction: {
        state: 'configured',
        enforced: true,
        containment_method: 'point_in_polygon',
        containment_verified: true,
        boundary_authority: {
          kind: 'official',
          source_ref: 'https://ide.mendoza.gov.ar/fixture-junin',
          snapshot_sha256: TEST_OFFICIAL_BOUNDARY_SHA,
        },
        city: 'Junín',
        state_name: 'Mendoza',
        bounds: { west: -68.6, south: -33.3, east: -68.3, north: -32.9 },
      },
      territorial_facets: {
        summary: { ticket_records: 63, mapped_records: 12, pending_geocode_records: 34, records_outside_jurisdiction: 9 },
        categories: [
          {
            key: 'luminarias',
            label: 'Luminarias',
            count: 38,
            mapped_count: 3,
            pending_geocode_count: 23,
            outside_jurisdiction_count: 9,
            raw_categories: [
              { key: 'Luminarias', label: 'Luminarias', count: 34 },
              { key: 'Alumbrado publico', label: 'Alumbrado publico', count: 4 },
            ],
          },
          { key: 'baches', label: 'Baches', count: 25, mapped_count: 9, pending_geocode_count: 11 },
        ],
        addresses: [],
        explicit_zones: [],
      },
      map_narrative: {
        headline: 'Narrativa territorial global',
        operator_summary: 'Este texto sólo corresponde al universo sin filtros.',
      },
      operational_hotspots: [
        { id: 'global-hotspot', key: 'global-hotspot', label: 'Global', operational_score: 99, signals: { tickets: 63 } },
      ],
      map_layers: {
        contract_version: 'analytics.geo_layers.v1',
        operator_metrics: { total_cases: 63, visible_layers: 4, top_category: 'baches', critical_hotspots: 1 },
      },
    } as OperationsHeatmapV1;

    render(<PremiumTerritoryHeatmap points={points} heatmap={heatmap} />);

    const map = screen.getByTestId('mock-live-map');
    chooseTerritoryFacet('Filtrar mapa por categoría', 'luminarias');

    expect(map).toHaveAttribute('data-points', '3');
    expect(screen.getByTestId('territory-header-volume')).toHaveTextContent('38');
    expect(screen.getByTestId('territory-header-coverage')).toHaveTextContent('7,9%');
    expect(screen.getByTestId('territory-header-pending')).toHaveTextContent('23');
    expect(screen.getByTestId('territory-summary-visible')).toHaveTextContent('Puntos visibles3');
    expect(screen.getByTestId('territory-summary-pending')).toHaveTextContent('23');
    expect(screen.getByTestId('territory-radar-coverage')).toHaveTextContent('7,9%');
    expect(screen.getByTestId('territory-radar-pending')).toHaveTextContent('23');
    expect(screen.getByTestId('territory-rail-coverage')).toHaveTextContent('7,9%');
    expect(screen.getByTestId('territory-rail-pending')).toHaveTextContent('23');
    expect(screen.getByTestId('territory-outside-jurisdiction')).toHaveTextContent('Fuera de jurisdicción / revisar · 9');
    expect(screen.getByTestId('territory-boundary-status')).toHaveTextContent('Alcance configurado · Junín');
    expect(screen.getByTestId('territory-scoped-insights-note')).toHaveTextContent('faceta territorial canónica');
    expect(screen.queryByTestId('backend-map-contract-card')).toBeNull();
    expect(screen.queryByTestId('operational-hotspots-panel')).toBeNull();
    expect(screen.queryByText('Narrativa territorial global')).toBeNull();

    chooseTerritoryFacet('Filtrar mapa por zona o barrio', 'centro');

    expect(map).toHaveAttribute('data-points', '2');
    expect(screen.getByTestId('territory-header-volume')).toHaveTextContent('2');
    expect(screen.getByTestId('territory-header-coverage')).toHaveTextContent('—');
    expect(screen.getByTestId('territory-header-pending')).toHaveTextContent('—');
    expect(screen.getByTestId('territory-radar-coverage')).toHaveTextContent('—');
    expect(screen.getByTestId('territory-radar-pending')).toHaveTextContent('—');
    expect(screen.queryByTestId('territory-outside-jurisdiction')).toBeNull();
    expect(screen.queryByTestId('territory-radar-sweep')).toBeNull();
    expect(screen.getByTestId('territory-scoped-insights-note')).toHaveTextContent('no informa el denominador de esta intersección');
  });

  it('filters by backend address cells while keeping household numbers out of the executive map', () => {
    const points: OperationsHeatmapPoint[] = [
      {
        id: 'luz-centro-1',
        lat: -34.61,
        lng: -60.91,
        categoria: 'Luminarias',
        barrio: 'Centro',
        direccion: 'Don Bosco 55, Junín',
        cell_id: 'h3:centro-a',
        address_cell_label: 'Sector Centro A',
        weight: 2,
      },
      {
        id: 'luz-centro-2',
        lat: -34.611,
        lng: -60.911,
        categoria: 'Luminarias',
        barrio: 'Centro',
        direccion: 'Don Bosco 99, Junín',
        cell_id: 'h3:centro-a',
        address_cell_label: 'Sector Centro A',
        weight: 3,
      },
      {
        id: 'bache-norte',
        lat: -34.62,
        lng: -60.92,
        categoria: 'Baches',
        barrio: 'Norte',
        direccion: 'Belgrano 102, Junín',
        weight: 1,
      },
    ];
    const heatmap = {
      contract_version: 'operations.heatmap.v1',
      points,
      cells: [],
      hotspots: [],
      facets: [],
      category_layers: [],
      render_contract: { can_render_heatmap: true, layers: ['base_heatmap', 'category_layers'] },
      privacy: { mode: 'privileged_exact', minimum_sample_size: 10 },
      quality: { state: 'ready', visible_points: 3, can_render_heatmap: true },
    } as OperationsHeatmapV1;

    render(<PremiumTerritoryHeatmap points={points} heatmap={heatmap} />);

    const map = screen.getByTestId('mock-live-map');
    expect(map.getAttribute('data-addresses')).toContain('Sector Centro A');
    expect(map.getAttribute('data-addresses')).toContain('Corredor Belgrano');
    expect(map.getAttribute('data-addresses')).not.toMatch(/Don Bosco 55|Don Bosco 99|Belgrano 102/);
    expect(document.body.textContent).not.toMatch(/Don Bosco 55|Don Bosco 99|Belgrano 102/);
    expect(screen.getByText('Sin domicilio exacto')).toBeTruthy();

    openTerritoryFilters();
    const sectorOption = screen.getByRole('option', { name: 'Sector Centro A' }) as HTMLOptionElement;
    chooseTerritoryFacet('Filtrar mapa por corredor o celda', sectorOption.value);
    expect(map.getAttribute('data-points')).toBe('2');
    expect(map.getAttribute('data-geo-features')).toBe('2');
  });

  it('unifies intersection order, removes geographic suffixes and bounds safe corridor facets', () => {
    const points: OperationsHeatmapPoint[] = [
      {
        id: 'intersection-a',
        lat: -33.081,
        lng: -68.469,
        categoria: 'Luminarias',
        direccion: 'Don Bosco esquina Sarmiento, M5570, MZ, AR',
      },
      {
        id: 'intersection-b',
        lat: -33.082,
        lng: -68.47,
        categoria: 'Luminarias',
        direccion: 'Sarmiento y Don Bosco en Junín centro',
      },
      {
        id: 'narrative',
        lat: -33.083,
        lng: -68.471,
        categoria: 'Luminarias',
        direccion: 'Justamente al lado hay una luminaria apagada',
      },
    ];
    const heatmap = {
      contract_version: 'operations.heatmap.v1',
      points,
      cells: [],
      hotspots: [],
      facets: [],
      category_layers: [],
      render_contract: { can_render_heatmap: true, layers: ['base_heatmap', 'category_layers'] },
      privacy: { mode: 'privileged_exact', minimum_sample_size: 10 },
      quality: { state: 'ready', visible_points: 3, can_render_heatmap: true },
      territorial_facets: {
        summary: { ticket_records: 20, mapped_records: 3 },
        categories: [{ key: 'luminarias', label: 'Luminarias', count: 20, mapped_count: 3 }],
        addresses: [
          { key: 'don-bosco-sarmiento-a', label: 'Don Bosco esquina Sarmiento, M5570, MZ, AR', count: 5, mapped_count: 1 },
          { key: 'don-bosco-sarmiento-b', label: 'Sarmiento y Don Bosco en Junín centro', count: 4, mapped_count: 1 },
          { key: '25-de-mayo', label: '25 de Mayo 10, Junín', count: 3, mapped_count: 0 },
          { key: 'mitre-b', label: 'Avenida Mitre 20, Mendoza', count: 2, mapped_count: 0 },
          { key: 'belgrano', label: 'Belgrano 30, Junín', count: 2, mapped_count: 0 },
          { key: 'rivadavia', label: 'Rivadavia 40, Junín', count: 1, mapped_count: 0 },
          { key: 'san-martin', label: 'San Martín 50, Junín', count: 1, mapped_count: 0 },
          { key: 'alem', label: 'Alem 60, Junín', count: 1, mapped_count: 0 },
          { key: 'espejo', label: 'Espejo 70, Junín', count: 1, mapped_count: 0 },
          { key: 'narrative', label: 'Luminaria apagada frente a la plaza', count: 99, mapped_count: 1 },
        ],
        explicit_zones: [],
      },
    } as OperationsHeatmapV1;

    render(<PremiumTerritoryHeatmap points={points} heatmap={heatmap} />);

    const map = screen.getByTestId('mock-live-map');
    expect(map.getAttribute('data-addresses')).toBe(
      'Intersección Don Bosco / Sarmiento|Intersección Don Bosco / Sarmiento',
    );
    expect(document.body.textContent).not.toMatch(/M5570|\bMZ\b|\bAR\b|Junín centro|luminaria apagada frente/i);

    openTerritoryFilters();
    const intersectionFilter = screen.getByRole('option', {
      name: 'Intersección Don Bosco / Sarmiento',
    }) as HTMLOptionElement;
    expect(document.body.textContent).toContain('Corredor 25 de Mayo');
    expect(document.body.textContent).not.toContain('Corredor de Mayo');
    const locationFilter = screen.getByRole('combobox', { name: 'Filtrar mapa por corredor o celda' }) as HTMLSelectElement;
    expect(locationFilter.options).toHaveLength(7);

    chooseTerritoryFacet('Filtrar mapa por corredor o celda', intersectionFilter.value);
    const locationSelect = screen.getByRole('combobox', { name: 'Filtrar mapa por corredor o celda' });
    const locationCounts = document.getElementById(locationSelect.getAttribute('aria-describedby') ?? '');
    expect(locationCounts).toHaveTextContent('Total 9');
    expect(locationCounts).toHaveTextContent('Mapeados 2');
    expect(map).toHaveAttribute('data-points', '2');
  });

  it('separates outside-jurisdiction review from pending geocoding and never plots rejected coordinates', () => {
    const points: OperationsHeatmapPoint[] = [
      {
        id: 'inside-1',
        lat: -33.0812,
        lng: -68.4691,
        categoria: 'Baches',
        direccion: 'Belgrano 10, Junín',
        coordinate_jurisdiction_status: 'within',
        weight: 2,
      },
      {
        id: 'inside-2',
        lat: -33.082,
        lng: -68.47,
        categoria: 'Baches',
        direccion: 'Belgrano 20, Junín',
        coordinate_jurisdiction_status: 'within',
        weight: 2,
      },
      {
        id: 'outside-1',
        lat: -34.5889,
        lng: -60.9462,
        categoria: 'Baches',
        direccion: 'Belgrano 999, Junín, Buenos Aires',
        coordinate_jurisdiction_status: 'outside',
        weight: 100,
      },
    ];
    const heatmap = {
      contract_version: 'operations.heatmap.v1',
      points,
      cells: [],
      hotspots: [],
      facets: [],
      category_layers: [],
      render_contract: { can_render_heatmap: true, layers: ['base_heatmap', 'category_layers'] },
      privacy: { mode: 'privileged_exact', minimum_sample_size: 10 },
      quality: { state: 'ready', coverage_percent: 99, visible_points: 2, pending_geocode: 4, can_render_heatmap: true },
      location_quality: {
        total_ticket_records: 6,
        ticket_records_with_coordinates: 2,
        ticket_records_outside_jurisdiction: 1,
        ticket_records_pending_geocode: 3,
        coordinate_coverage_pct: 33.33,
      },
      jurisdiction: {
        state: 'configured',
        enforced: true,
        containment_method: 'point_in_polygon',
        containment_verified: true,
        boundary_authority: {
          kind: 'official',
          source_ref: 'https://ide.mendoza.gov.ar/fixture-junin',
          snapshot_sha256: TEST_OFFICIAL_BOUNDARY_SHA,
        },
        city: 'Junín',
        state_name: 'Mendoza',
        excluded_coordinate_records: 1,
        review_candidate_count: 1,
      },
      jurisdiction_review: { candidate_count: 1, status: 'pending' },
      territorial_facets: {
        summary: { ticket_records: 6, mapped_records: 2, records_outside_jurisdiction: 1, pending_geocode_records: 3 },
        categories: [
          { key: 'baches', label: 'Baches', count: 3, mapped_count: 2, outside_jurisdiction_count: 1 },
        ],
        addresses: [
          { key: 'belgrano', label: 'Belgrano 999, Junín', count: 3, mapped_count: 2, outside_jurisdiction_count: 1 },
        ],
        explicit_zones: [],
      },
    } as OperationsHeatmapV1;

    render(<PremiumTerritoryHeatmap points={points} heatmap={heatmap} />);

    const map = screen.getByTestId('mock-live-map');
    expect(map.getAttribute('data-points')).toBe('2');
    expect(map.getAttribute('data-geo-features')).toBe('2');
    expect(map.getAttribute('data-addresses')).toBe('Corredor Belgrano|Corredor Belgrano');
    expect(document.body.textContent).not.toContain('Belgrano 999');

    expect(screen.getByTestId('territory-jurisdiction')).toHaveTextContent('Alcance · Junín, Mendoza');
    expect(screen.getByTestId('territory-boundary-status')).toHaveTextContent('Alcance configurado · Junín');
    expect(screen.queryByText(/^sin límites$/i)).toBeNull();
    expect(screen.getByTestId('territory-outside-jurisdiction')).toHaveTextContent(
      'Fuera de jurisdicción / revisar · 1',
    );
    expect(screen.getByTestId('territory-outside-jurisdiction')).toHaveAccessibleName(
      '1 coordenada fuera de jurisdicción, excluidas del mapa y pendientes de revisión',
    );
    expect(screen.getAllByText('33,3%').length).toBeGreaterThan(0);
    expect(screen.getAllByText('3').length).toBeGreaterThan(0);

    openTerritoryFilters();
    const bachesOption = screen.getByRole('option', { name: 'Baches' }) as HTMLOptionElement;
    const corridorOption = screen.getByRole('option', { name: 'Corredor Belgrano' }) as HTMLOptionElement;
    chooseTerritoryFacet('Filtrar mapa por corredor o celda', corridorOption.value);
    const locationSelect = screen.getByRole('combobox', { name: 'Filtrar mapa por corredor o celda' });
    expect(document.getElementById(locationSelect.getAttribute('aria-describedby') ?? '')).toHaveTextContent('Revisar 1');
    chooseTerritoryFacet('Filtrar mapa por categoría', bachesOption.value);
    const categorySelect = screen.getByRole('combobox', { name: 'Filtrar mapa por categoría' });
    const categoryCounts = document.getElementById(categorySelect.getAttribute('aria-describedby') ?? '');
    expect(categoryCounts).toHaveTextContent('Total 3');
    expect(categoryCounts).toHaveTextContent('Mapeados 2');
    expect(categoryCounts).toHaveTextContent('Revisar 1');
  });

  it('keeps canonical complaint categories visible when every record is pending or outside jurisdiction', () => {
    const points: OperationsHeatmapPoint[] = [
      {
        id: 'inside-bache',
        lat: -33.0812,
        lng: -68.4691,
        categoria: 'Baches',
        direccion: 'Belgrano 10, Junín',
        coordinate_jurisdiction_status: 'within',
      },
    ];
    const heatmap = {
      contract_version: 'operations.heatmap.v1',
      points,
      cells: [],
      hotspots: [],
      facets: [],
      category_layers: [],
      render_contract: { can_render_heatmap: true, layers: ['base_heatmap', 'category_layers'] },
      geo_layers: {
        contract_version: 'operations.heatmap.geo_layers.v1',
        points: {
          type: 'FeatureCollection',
          features: [
            {
              type: 'Feature',
              id: 'inside-bache',
              geometry: { type: 'Point', coordinates: [-68.4691, -33.0812] },
              properties: { categoria: 'Baches', direccion: 'Belgrano 10, Junín' },
            },
          ],
        },
      },
      privacy: { mode: 'privileged_exact', minimum_sample_size: 10 },
      quality: { state: 'ready', visible_points: 1, can_render_heatmap: true },
      location_quality: {
        total_ticket_records: 7,
        ticket_records_with_coordinates: 1,
        ticket_records_outside_jurisdiction: 1,
        ticket_records_pending_geocode: 5,
        coordinate_coverage_pct: 14.29,
      },
      jurisdiction: {
        state: 'configured',
        enforced: true,
        containment_method: 'point_in_polygon',
        containment_verified: true,
        boundary_authority: {
          kind: 'official',
          source_ref: 'https://ide.mendoza.gov.ar/fixture-junin',
          snapshot_sha256: TEST_OFFICIAL_BOUNDARY_SHA,
        },
        city: 'Junín',
        state_name: 'Mendoza',
      },
      territorial_facets: {
        summary: {
          ticket_records: 7,
          mapped_records: 1,
          records_outside_jurisdiction: 1,
          pending_geocode_records: 5,
        },
        categories: [
          { key: 'baches', label: 'Baches', count: 2, mapped_count: 1, pending_geocode_count: 1 },
          {
            key: 'luminarias',
            label: 'Luminarias',
            count: 5,
            mapped_count: 0,
            pending_geocode_count: 4,
            outside_jurisdiction_count: 1,
          },
        ],
        addresses: [
          {
            key: 'rivadavia-144',
            label: 'Rivadavia 144, Junín',
            count: 5,
            mapped_count: 0,
            pending_geocode_count: 4,
            outside_jurisdiction_count: 1,
          },
        ],
        explicit_zones: [],
      },
    } as OperationsHeatmapV1;

    render(<PremiumTerritoryHeatmap points={points} heatmap={heatmap} />);

    openTerritoryFilters();
    const categoryFilter = screen.getByRole('option', { name: 'Luminarias' }) as HTMLOptionElement;
    expect(screen.getByRole('option', { name: 'Corredor Rivadavia' })).toBeTruthy();
    expect(document.body.textContent).not.toContain('Rivadavia 144');

    chooseTerritoryFacet('Filtrar mapa por categoría', categoryFilter.value);

    const categorySelect = screen.getByRole('combobox', { name: 'Filtrar mapa por categoría' });
    const categoryCounts = document.getElementById(categorySelect.getAttribute('aria-describedby') ?? '');
    expect(categoryCounts).toHaveTextContent('Total 5');
    expect(categoryCounts).toHaveTextContent('Mapeados 0');
    expect(categoryCounts).toHaveTextContent('Pendientes 4');
    expect(categoryCounts).toHaveTextContent('Revisar 1');

    const map = screen.getByTestId('mock-live-map');
    expect(map.getAttribute('data-points')).toBe('0');
    expect(map.getAttribute('data-geo-features')).toBe('0');
    expect(screen.getByTestId('territory-filter-empty')).toHaveTextContent('Sin puntos mapeados para Luminarias');
    expect(screen.getByTestId('territory-display-mode-status')).toHaveTextContent(
      'No se agregan puntos estimados',
    );
    expect(screen.getByTestId('territory-filter-empty')).toHaveTextContent('Pendientes de geocodificar · 4');
    expect(screen.getByTestId('territory-filter-empty')).toHaveTextContent('Fuera de jurisdicción / revisar · 1');
    expect(screen.getByRole('link', { name: 'Abrir cola pendiente' })).toHaveAttribute(
      'href',
      '/perfil?tab=tickets&focus=open_geocoding_queue&facet=luminarias',
    );
    expect(screen.getByRole('button', { name: 'Quitar último filtro' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Restablecer mapa' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Restablecer mapa' }));
    expect(map).toHaveAttribute('data-points', '1');
    expect(screen.queryByTestId('territory-filter-empty')).toBeNull();
  });

  it('blocks raw coordinate density for samples from one through nine under aggregated privacy', () => {
    const points = buildPoints(9);
    const heatmap = {
      contract_version: 'operations.heatmap.v1',
      points,
      cells: [],
      hotspots: [],
      facets: [],
      category_layers: [],
      render_contract: { can_render_heatmap: true, layers: ['base_heatmap', 'category_layers'] },
      privacy: {
        mode: 'aggregated',
        minimum_sample_size: 10,
        raw_points_redacted: true,
        suppressed: { exact_points: true },
      },
      quality: { state: 'ready', visible_points: 9, can_render_heatmap: true },
    } as OperationsHeatmapV1;

    render(<PremiumTerritoryHeatmap points={points} heatmap={heatmap} minSampleSize={10} />);

    expect(screen.queryByTestId('mock-live-map')).toBeNull();
    expect(screen.queryByTestId('live-territory-map')).toBeNull();
    expect(screen.getByRole('radio', { name: 'Solo calor' })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByRole('radio', { name: 'Mapa operativo' })).toBeDisabled();
    expect(screen.getByRole('radio', { name: 'Clústeres' })).toBeDisabled();
    expect(screen.getByRole('button', { name: /^Capas por categoría/ })).toBeDisabled();
    expect(screen.queryByRole('option', { name: /^Baches ·/ })).toBeNull();
    expect(screen.queryByRole('option', { name: /^Centro ·/ })).toBeNull();
    expect(screen.getAllByText(/Segmentación protegida · mínimo 10 registros/)).toHaveLength(2);
    expect(screen.getByTestId('territory-boundary-empty-state')).toBeInTheDocument();
    expect(screen.getByTestId('territory-display-mode-status')).toHaveTextContent(
      'No se dibujan puntos ni densidad territorial',
    );
  });

  it('does not turn ten raw coordinates into a k-anonymous heat cell', () => {
    const points = buildPoints(10);
    const heatmap = {
      contract_version: 'operations.heatmap.v1',
      points,
      cells: [],
      hotspots: [],
      facets: [],
      category_layers: [],
      render_contract: { can_render_heatmap: true, layers: ['base_heatmap'] },
      privacy: {
        mode: 'aggregated',
        k_min: 10,
        raw_points_redacted: true,
        suppressed: { exact_points: true },
      },
      quality: { state: 'ready', visible_points: 10, can_render_heatmap: true },
    } as OperationsHeatmapV1;

    render(<PremiumTerritoryHeatmap points={points} heatmap={heatmap} />);

    expect(screen.queryByTestId('mock-live-map')).toBeNull();
    expect(screen.queryByTestId('live-territory-map')).toBeNull();
    expect(screen.getByTestId('territory-display-mode-status')).toHaveTextContent(
      'No se dibujan puntos ni densidad territorial',
    );
  });

  it('renders only backend k-anonymous aggregate cells when exact coordinates are protected', () => {
    const heatmap = {
      contract_version: 'operations.heatmap.v1',
      points: [],
      cells: [{
        cell_id: 'cell-centro',
        centroid_lat: -34.61,
        centroid_lon: -60.91,
        count: 10,
        dominant_category: 'Luminarias',
      }],
      hotspots: [],
      facets: [],
      category_layers: [],
      render_contract: { can_render_heatmap: true, layers: ['base_heatmap'] },
      privacy: {
        mode: 'aggregated',
        k_min: 10,
        raw_points_redacted: true,
        suppressed: { exact_points: true },
      },
      quality: { state: 'ready', visible_points: 1, can_render_heatmap: true },
    } as OperationsHeatmapV1;

    render(<PremiumTerritoryHeatmap points={[]} heatmap={heatmap} />);

    const map = screen.getByTestId('mock-live-map');
    expect(map).toHaveAttribute('data-points', '1');
    expect(map).toHaveAttribute('data-point-ids', 'cell-centro');
    expect(map).toHaveAttribute('data-point-sources', 'heatmap_cell');
    expect(map).toHaveAttribute('data-show-heatmap', 'true');
    expect(map).toHaveAttribute('data-show-points', 'false');
    expect(map).toHaveAttribute('data-show-point-labels', 'false');
    expect(map).toHaveAttribute('data-evidence-present', 'false');
    expect(map).toHaveAttribute('data-show-evidence-badge', 'false');
  });

  it('never claims an active heat view when both territorial layers are disabled', () => {
    const points = buildPoints(3);
    const heatmap = {
      contract_version: 'operations.heatmap.v1',
      points,
      cells: [],
      hotspots: [],
      facets: [],
      category_layers: [],
      render_contract: { can_render_heatmap: true, layers: ['base_heatmap', 'category_layers'] },
      privacy: { mode: 'privileged_exact', minimum_sample_size: 10 },
      quality: { state: 'ready', visible_points: 3, can_render_heatmap: true },
    } as OperationsHeatmapV1;

    render(<PremiumTerritoryHeatmap points={points} heatmap={heatmap} />);

    const map = screen.getByTestId('mock-live-map');
    fireEvent.click(screen.getByRole('button', { name: /^Capas por categoría/ }));
    expect(screen.getByRole('radio', { name: 'Solo calor' })).toHaveAttribute('aria-checked', 'true');
    expect(map).toHaveAttribute('data-show-heatmap', 'true');

    fireEvent.click(screen.getByRole('button', { name: /^Calor territorial/ }));

    expect(screen.getByRole('radio', { name: 'Solo calor' })).toBeDisabled();
    expect(map).toHaveAttribute('data-show-heatmap', 'false');
    expect(map).toHaveAttribute('data-show-points', 'false');
    expect(screen.getByTestId('territory-display-mode-status')).toHaveTextContent(
      'No hay una capa territorial activa',
    );

    fireEvent.click(screen.getByRole('button', { name: /^Capas por categoría/ }));
    expect(screen.getByRole('radio', { name: 'Clústeres' })).toHaveAttribute('aria-checked', 'true');
    expect(map).toHaveAttribute('data-show-points', 'true');
  });

  it('toggles commerce geo features without exposing customer fields', () => {
    const points: OperationsHeatmapPoint[] = [
      { id: 'ticket:1', lat: -34.61, lng: -60.91, source: 'ticket', label: 'Reclamo' },
      { id: 'order:1', lat: -34.62, lng: -60.92, source: 'commerce', label: 'Pedido comercial' },
    ];
    const heatmap = {
      contract_version: 'operations.heatmap.v1',
      points,
      cells: [],
      hotspots: [],
      facets: [],
      category_layers: [],
      render_contract: { layers: ['base_heatmap', 'commerce_activity'] },
      geo_layers: {
        contract_version: 'operations.heatmap_geo_layers.v1',
        provider: 'geojson',
        coordinate_order: 'lng_lat',
        points: {
          type: 'FeatureCollection',
          features: points.map((point) => ({
            type: 'Feature',
            geometry: { type: 'Point', coordinates: [point.lng, point.lat] },
            properties: { id: point.id, source: point.source, label: point.label },
          })),
        },
      },
      quality: { state: 'ready', visible_points: 2, can_render_heatmap: true },
    } as OperationsHeatmapV1;

    render(<PremiumTerritoryHeatmap points={points} heatmap={heatmap} />);

    const map = screen.getByTestId('mock-live-map');
    const commerceToggle = screen.getByRole('button', { name: /^Pedidos y ventas/ });
    expect(map.getAttribute('data-geo-features')).toBe('2');
    expect(map.getAttribute('data-points')).toBe('2');
    expect(commerceToggle.getAttribute('aria-pressed')).toBe('true');

    fireEvent.click(commerceToggle);

    expect(map.getAttribute('data-geo-features')).toBe('1');
    expect(map.getAttribute('data-points')).toBe('1');
    expect(commerceToggle.getAttribute('aria-pressed')).toBe('false');
    expect(document.body.textContent).not.toContain('cliente privado');
  });

  it('renders contract-driven layers, quality state and geocoding action', () => {
    const heatmap = {
      contract_version: 'operations.heatmap.v1',
      points: buildPoints(12).map((point, index) =>
        index === 0
          ? {
              ...point,
              label: 'Ticket centro',
              actions: [
                {
                  id: 'open_record',
                  label: 'Abrir ticket caliente',
                  method: 'GET',
                  endpoint: '/api/v2/tickets/11',
                  ui_hint: 'open_ticket',
                },
              ],
            }
          : point,
      ),
      cells: [],
      hotspots: [],
      operational_hotspots: [
        {
          id: '-34.604:-58.382',
          lat: -34.604,
          lng: -58.382,
          count: 5,
          weight: 6.8,
          operational_score: 41,
          rank_reason: 'sla_breached',
          top_category: 'reclamos',
          top_channel: 'whatsapp',
          latest_event_at: '2026-07-03T12:00:00Z',
          signals: {
            breached_sla: 2,
            overdue: 2,
            unassigned: 1,
            recent_24h: 4,
            tickets: 3,
            surveys: 1,
            analytics_events: 1,
          },
          recommended_action: {
            label: 'Abrir zona prioritaria',
            ui_hint: 'focus_map_cell_and_filter_tickets',
            filters: {
              category: 'reclamos',
              channel: 'whatsapp',
              cell_id: '-34.604:-58.382',
            },
          },
        },
      ],
      facets: [],
      category_layers: [],
      summary: {
        operational_hotspots: 1,
      },
      legend: {
        contract_version: 'operations.map.legend.v1',
        legend_items: [
          { label: 'SLA critico', color: '#ef4444', source: 'points' },
          { label: 'WhatsApp activo', color: '#22d3ee', bucket: 'cells' },
        ],
      },
      layer_style_contract: {
        contract_version: 'operations.map.styles.v1',
        palette: ['#3b82f6', '#14b8a6', '#f59e0b'],
        legend_items: [{ label: 'Prioridad IA', color: '#a855f7', description: 'prediccion operativa' }],
      },
      map_experience: {
        preferred_visualization: 'interactive_globe_heatmap',
        layer_groups: ['base_heatmap', 'ai_risk_layers', 'whatsapp_activity'],
        empty_state_behavior: 'show_geocoding_queue_and_ai_summary',
      },
      quality: {
        state: 'degraded',
        label: 'Cobertura parcial',
        coverage_percent: 42,
        visible_points: 12,
        pending_geocode: 7,
        empty_state_action: {
          title: 'Resolver direcciones',
          method: 'PATCH',
          endpoint_template: '/api/tickets/{record_id}/ubicacion',
        },
      },
      geocoding: {
        status: 'queued',
        candidate_count: 7,
        candidates: [
          {
            record_id: 11,
            address: 'Av. Siempre Viva 123',
            category: 'reclamos',
            source: 'tickets',
            actions: [
              {
                id: 'update_location',
                label: 'Actualizar ubicacion',
                method: 'PATCH',
                endpoint: '/api/v2/tickets/11',
                priority: 'high',
                ui_hint: 'open_geocoding_queue',
                body_template: { location: { lat: 'number', lng: 'number' } },
              },
            ],
          },
        ],
      },
      realtime: {
        poll_seconds: 30,
        sources: ['tickets'],
        socket_events: ['operations.heatmap.updated'],
        latest_event_at: '2026-07-03T12:00:00Z',
      },
      map_narrative: {
        headline: 'Zona centro requiere seguimiento',
        operator_summary: 'Alta demanda concentrada con reclamos pendientes de coordenadas.',
        primary_cta: {
          label: 'Abrir cola operativa',
          ui_hint: 'open_geocoding_queue',
        },
      },
      viewport_presets: {
        default_preset_id: 'centro',
        presets: [
          {
            id: 'centro',
            label: 'Centro operativo',
            mode: 'fly_to',
            default: true,
            zoom: 13,
            radius_km: 2.5,
          },
        ],
      },
      hotspot_actions: {
        safe_by_default: true,
        writes_enabled: false,
        actions: [{ label: 'Asignar inspector', method: 'PATCH', endpoint: '/api/tickets/11' }],
        playbook: [{ label: 'Validar zona caliente' }],
      },
      ai_status: {
        status: 'local_fallback',
        mode: 'municipal_risk_detection',
        safe_to_render_without_hf_token: true,
        ai_layers_ready: true,
        map_layer_hints: ['risk_pulses', 'whatsapp_activity'],
      },
      ai_layers: {
        contract_version: 'huggingface.map_ai_layers.v1',
        layers: [{ key: 'priority_forecast', label: 'Prioridad IA', count: 2 }],
      },
      map_layers: {
        contract_version: 'analytics.geo_layers.v1',
        provider: {
          style_url: 'https://tiles.backend/style.json',
        },
        intensity: { total_cases: 44, total_items: 6 },
        category_heatmap: { layer_id: 'municipal-demand-heat' },
        hotspots: {
          point_layer_id: 'municipal-hotspot-points',
          focus: {
            category: 'reclamos',
            count: 22,
            risk: { level: 'critical', label: 'Critico' },
          },
        },
        visual_system: {
          renderer: 'webgl_heatmap',
          animations: { radar_sweep: true, pulse_hotspots: true },
        },
        operator_metrics: {
          total_cases: 44,
          visible_layers: 6,
          top_category: 'reclamos',
          critical_hotspots: 1,
        },
        telemetry: {
          event_endpoint: '/api/v2/analytics/map-events',
          events: ['map_loaded', 'cluster_click'],
        },
      },
    } satisfies OperationsHeatmapV1;

    render(
      <PremiumTerritoryHeatmap
        points={heatmap.points}
        heatmap={heatmap}
        mapConfig={{
          provider: 'maplibre',
          style_url: 'https://tiles.test/style.json',
          maptiler_key: 'maptiler-test',
          google_maps_key: 'google-test',
        }}
      />,
    );

    expect(screen.getByTestId('live-territory-map')).toBeTruthy();
    const liveMap = screen.getByTestId('mock-live-map');
    expect(liveMap.getAttribute('data-points')).toBe('12');
    expect(liveMap.getAttribute('data-bounds')).toBe('12');
    expect(liveMap.getAttribute('data-provider')).toBe('maplibre');
    expect(liveMap.getAttribute('data-style-url')).toBe('https://tiles.test/style.json');
    expect(liveMap.getAttribute('data-maptiler-key')).toBe('maptiler-test');
    expect(liveMap.getAttribute('data-google-key')).toBe('google-test');
    expect(liveMap.getAttribute('data-aria-label')).toBe(
      'Mapa territorial interactivo de reclamos, encuestas y actividad agregada',
    );
    expect(liveMap.getAttribute('data-geo-contract')).toBe('operations.heatmap.geo_layers.v1');
    expect(liveMap.getAttribute('data-geo-features')).toBe('12');
    expect(liveMap.getAttribute('data-geo-heat-layer')).toBe('municipal-demand-heat');
    expect(liveMap.getAttribute('data-geo-point-layer')).toBe('municipal-hotspot-points');
    expect(liveMap.getAttribute('data-geo-telemetry-endpoint')).toBe('/api/v2/analytics/map-events');
    expect(liveMap.getAttribute('data-geo-telemetry-events')).toContain('map_loaded');
    expect(liveMap.getAttribute('data-geo-telemetry-events')).toContain('cluster_click');
    expect(liveMap.getAttribute('data-geo-enabled-layers')).toContain('heat');
    expect(liveMap.getAttribute('data-geo-default-viewport')).toBe('centro');
    expect(liveMap.getAttribute('data-geo-time-slider')).toBe('true');
    expect(liveMap.getAttribute('data-show-heatmap')).toBe('true');
    expect(liveMap.getAttribute('data-show-points')).toBe('true');
    expect(liveMap.getAttribute('data-show-point-labels')).toBe('true');
    expect(liveMap.getAttribute('data-point-label-mode')).toBe('count');
    expect(liveMap.getAttribute('data-disable-client-clustering')).toBe('false');
    expect(liveMap.getAttribute('data-heatmap-radius')).toBe('1.9');
    expect(liveMap.getAttribute('data-heatmap-palette')).toBe('faro');
    expect(liveMap.getAttribute('data-popup-context')).toBe('territory');
    expect(liveMap.getAttribute('data-bounds-padding')).toBe('{"top":40,"right":40,"bottom":40,"left":40}');
    expect(screen.getAllByText('Cobertura parcial').length).toBeGreaterThan(0);
    expect(screen.getByText('Mapa territorial interactivo')).toBeTruthy();
    expect(screen.getAllByText('Riesgo IA').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Ubicaciones pendientes').length).toBeGreaterThan(0);
    const executiveStrip = screen.getByTestId('territory-executive-strip');
    expect(executiveStrip.textContent).toContain('Lectura ejecutiva');
    expect(executiveStrip.textContent).toContain('Puntos visibles');
    expect(executiveStrip.textContent).toContain('12');
    expect(executiveStrip.textContent).toContain('Pendientes');
    expect(executiveStrip.textContent).toContain('7');
    expect(executiveStrip.textContent).toContain('Foco territorial');
    expect(executiveStrip.textContent).toContain('reclamos');
    expect(executiveStrip.textContent).toContain('Próxima acción');
    expect(executiveStrip.textContent).toContain('Abrir cola operativa');
    const commandLoop = screen.getByTestId('territory-command-loop');
    expect(commandLoop.textContent).toContain('Pulso operativo territorial');
    expect(commandLoop.textContent).toContain('Ciclo de decisión asistido');
    expect(commandLoop.textContent).toContain('1 zona crítica');
    expect(commandLoop.textContent).not.toContain('1 zonas críticas');
    expect(commandLoop.textContent).toContain('reclamos');
    expect(commandLoop.textContent).toContain('Abrir cola operativa');
    expect(commandLoop.textContent).toContain('42%');
    expect(commandLoop.textContent).toContain('Actualización pendiente');
    expect(commandLoop.textContent).not.toContain('En línea');
    expect(screen.getAllByTestId('territory-command-card').length).toBe(4);
    const commandLoopCta = screen.getByRole('link', { name: /abrir cola crm/i });
    expect(commandLoopCta.getAttribute('href')).toContain('/perfil?tab=tickets');
    expect(commandLoopCta.getAttribute('href')).toContain('focus=open_geocoding_queue');
    const decisionRadar = screen.getByTestId('territory-decision-radar');
    expect(decisionRadar).toBeTruthy();
    expect(screen.getByText('Radar de decisión')).toBeTruthy();
    expect(decisionRadar.textContent).toContain('Abrir cola operativa');
    expect(screen.getByText('Motivo prioritario')).toBeTruthy();
    expect(screen.getByText('Capas activas')).toBeTruthy();
    expect(screen.getByText('Datos pendientes')).toBeTruthy();
    expect(decisionRadar.textContent).toContain('En revisión');
    expect(screen.getByTestId('backend-map-contract-card')).toBeTruthy();
    expect(screen.getAllByText('Mapa de calor acelerado').length).toBeGreaterThan(0);
    expect(screen.getByText('radar activo')).toBeTruthy();
    expect(screen.getByText('Zonas críticas')).toBeTruthy();
    expect(screen.getByText('22 casos agrupados en el foco operativo.')).toBeTruthy();
    const liveLegend = screen.getByTestId('territory-live-legend');
    expect(liveLegend).toBeTruthy();
    expect(liveLegend).not.toHaveClass('absolute');
    expect(liveLegend.textContent).toContain('Lectura territorial');
    expect(liveLegend.textContent).toContain('12 puntos visibles');
    expect(screen.getByTestId('territory-filter-toolbar').textContent).toContain('Categoría de reclamo');
    expect(screen.getByTestId('territory-filter-toolbar').textContent).toContain('reclamos');
    expect(screen.getByTestId('territory-filter-toolbar').textContent).toContain('Zona o barrio');
    expect(liveLegend.textContent).toContain('círculos por categoría');
    expect(document.body.textContent).toContain('Mapa territorial pendiente de validación');
    expect(document.body.textContent).not.toContain('Zona centro requiere seguimiento');
    expect(document.body.textContent).not.toMatch(/[ap]\. m\.\./i);
    expect(screen.getByTestId('operational-hotspots-panel')).toBeTruthy();
    expect(screen.getByText('Prioridades territoriales')).toBeTruthy();
    expect(screen.getByText('Focos para actuar primero')).toBeTruthy();
    expect(screen.getByText('SLA vencido')).toBeTruthy();
    expect(screen.getByText('SLA: 2')).toBeTruthy();
    expect(screen.getByText('sin responsable: 1')).toBeTruthy();
    expect(screen.getByText('24h: 4')).toBeTruthy();
    expect(screen.getAllByTestId('operational-hotspot-item').length).toBe(1);
    expect(screen.getByRole('radiogroup', { name: 'Visualización del mapa' })).toBeTruthy();
    expect(screen.getByText('Resumen operativo asistido')).toBeTruthy();
    expect(document.body.textContent).toContain('Mapa territorial pendiente de validación');
    expect(document.body.textContent).toContain('La fuente no informó una clasificación verificable');
    expect(screen.getByText('Análisis local seguro')).toBeTruthy();
    expect(screen.getAllByText('Detección municipal de riesgos').length).toBeGreaterThan(0);
    expect(screen.getByText('Centro operativo')).toBeTruthy();
    expect(screen.getByText('Encuadre automático - zoom 13 - 2,5 km')).toBeTruthy();
    expect(screen.getByTestId('heatmap-action-loop')).toBeTruthy();
    expect(screen.getAllByTestId('heatmap-action-item').length).toBeGreaterThanOrEqual(4);
    expect(screen.getByText('Asignar inspector')).toBeTruthy();
    expect(screen.getByText('Actualizar ubicación')).toBeTruthy();
    expect(screen.getByText('Abrir ticket caliente')).toBeTruthy();
    expect(screen.getAllByText('preparación segura').length).toBeGreaterThan(0);
    expect(screen.getByTestId('heatmap-action-loop').textContent).not.toContain('/api/');
    const crmLinks = screen.getAllByRole('link', { name: /abrir en crm/i });
    expect(crmLinks.length).toBeGreaterThan(0);
    expect(crmLinks.some((link) => link.getAttribute('href')?.includes('/perfil?tab=tickets'))).toBe(true);
    expect(crmLinks.some((link) => link.getAttribute('href')?.includes('ticket_id=11'))).toBe(true);
    expect(crmLinks.some((link) => link.getAttribute('href')?.includes('focus=open_geocoding_queue'))).toBe(true);
    expect(screen.getByText('Acciones protegidas - solo preparación operativa')).toBeTruthy();
  });

  it('shows an honest boundary state instead of a synthetic atlas when coordinates and boundaries are absent', () => {
    render(<PremiumTerritoryHeatmap points={[{ id: 'draft-only', weight: 1, categoria: 'reclamos' }]} />);

    expect(screen.queryByTestId('live-territory-map')).toBeNull();
    expect(screen.queryByRole('img', { name: 'Inteligencia territorial' })).toBeNull();
    expect(screen.getAllByText('Sin delimitación territorial oficial').length).toBeGreaterThan(0);
    expect(screen.getByTestId('territory-boundary-empty-state')).toBeTruthy();
    expect(screen.getByTestId('territory-zone-analytics-unavailable')).toBeTruthy();
    expect(screen.queryByText('Zona seleccionada')).toBeNull();
    expect(screen.queryByText('Tasa cada 1.000')).toBeNull();
  });

  it('keeps ungeocoded records in a safe queue and never fabricates territorial routes', () => {
    const heatmap = {
      contract_version: 'operations.heatmap.v1',
      points: [],
      cells: [],
      hotspots: [],
      facets: [],
      category_layers: [],
      quality: { state: 'partial', visible_points: 0, can_render_heatmap: false },
      geo_layers: {
        boundaries: {
          type: 'FeatureCollection',
          metadata: { source: 'Catastro municipal', official: true },
          features: [{
            type: 'Feature',
            id: 'centro',
            geometry: {
              type: 'Polygon',
              coordinates: [[[-61, -34.7], [-60.8, -34.7], [-60.8, -34.5], [-61, -34.5], [-61, -34.7]]],
            },
            properties: { nombre: 'Centro oficial' },
          }],
        },
      },
      geocoding: {
        status: 'pending',
        candidate_count: 1,
        candidates: [{
          record_id: 'opaque-1',
          category: 'Luminarias',
          address: 'Belgrano 1234, Junín, domicilio particular',
        }],
      },
    } satisfies OperationsHeatmapV1;

    render(<PremiumTerritoryHeatmap points={[]} heatmap={heatmap} />);

    const mapShell = screen.getByTestId('territory-map-shell');
    expect(screen.queryByRole('img', { name: 'Inteligencia territorial' })).toBeNull();
    expect(screen.queryByTestId('live-territory-map')).toBeNull();
    expect(screen.getByTestId('territory-activity-empty-state')).toHaveTextContent(
      'Sin actividad territorial mapeada',
    );
    expect(screen.queryByTestId('territory-hud-overlay')).toBeNull();
    expect(screen.queryByTestId('territory-radar-sweep')).toBeNull();
    expect(screen.queryByTestId('territory-selected-crosshair')).toBeNull();
    expect(mapShell.querySelectorAll('svg[role="img"], animate, animateTransform, animateMotion')).toHaveLength(0);
    expect(screen.getByTestId('territory-geocoding-queue')).toHaveTextContent('Cola de ubicaciones pendientes');
    expect(screen.getByTestId('territory-geocoding-queue')).toHaveTextContent('Sin coordenadas');
    expect(screen.getByTestId('territory-geocoding-queue')).toHaveTextContent('no se dibujan en el mapa');
    expect(document.body.textContent).not.toContain('Belgrano 1234');
  });

  it('rejects impossible territorial totals and coverage instead of publishing contradictory metrics', () => {
    const points = buildPoints(3);
    const heatmap = {
      contract_version: 'operations.heatmap.v1',
      points,
      cells: [],
      hotspots: [],
      facets: [],
      category_layers: [],
      render_contract: { can_render_heatmap: true, layers: ['points'] },
      quality: { state: 'ready', visible_points: 3, can_render_heatmap: true, coverage_percent: 150 },
      territorial_facets: {
        summary: { ticket_records: 2, mapped_records: 3 },
        categories: [{ key: 'luminarias', label: 'Luminarias', count: 2, mapped_count: 3 }],
        explicit_zones: [],
        addresses: [],
      },
    } satisfies OperationsHeatmapV1;

    render(<PremiumTerritoryHeatmap points={points} heatmap={heatmap} />);

    expect(screen.getByTestId('territory-contract-integrity-warning')).toHaveTextContent(
      'Métricas territoriales en revisión',
    );
    expect(screen.getByTestId('territory-primary-summary')).toHaveTextContent('Puntos mapeados 3');
    expect(screen.getByTestId('territory-header-coverage')).toHaveTextContent('—');
    expect(document.body.textContent).not.toContain('150%');
    openTerritoryFilters();
    expect(screen.queryByRole('option', { name: 'Luminarias' })).toBeNull();
  });

  it('fails closed when canonical summary and location quality disagree', () => {
    const points = buildPoints(3);
    const heatmap = {
      contract_version: 'operations.heatmap.v1',
      points,
      cells: [],
      hotspots: [],
      facets: [],
      category_layers: [],
      render_contract: { can_render_heatmap: true, layers: ['points'] },
      privacy: { mode: 'privileged_exact', minimum_sample_size: 10 },
      quality: { state: 'partial', visible_points: 3, can_render_heatmap: true },
      territorial_facets: {
        summary: {
          ticket_records: 6,
          mapped_records: 3,
          pending_geocode_records: 2,
          records_outside_jurisdiction: 1,
        },
        categories: [],
        explicit_zones: [],
        addresses: [],
      },
      location_quality: {
        total_ticket_records: 6,
        ticket_records_with_coordinates: 2,
        ticket_records_pending_geocode: 3,
        ticket_records_outside_jurisdiction: 1,
        coordinate_coverage_pct: 33.3,
      },
    } satisfies OperationsHeatmapV1;

    render(<PremiumTerritoryHeatmap points={points} heatmap={heatmap} />);

    expect(screen.getByTestId('territory-contract-integrity-warning')).toHaveTextContent(
      'Métricas territoriales en revisión',
    );
    expect(screen.getByTestId('territory-header-coverage')).toHaveTextContent('—');
    expect(screen.getByTestId('territory-header-pending')).toHaveTextContent('—');
    expect(screen.getByTestId('territory-radar-coverage')).toHaveTextContent('—');
    expect(screen.getByTestId('territory-radar-pending')).toHaveTextContent('—');
    expect(document.body.textContent).not.toContain('33,3%');
    expect(document.body.textContent).not.toContain('Registros territoriales 6');
  });

  it('fails closed when an enforced jurisdiction has only bounds and no authoritative containment contract', () => {
    const points: OperationsHeatmapPoint[] = [
      {
        id: 'outside-bounds',
        lat: -34.61,
        lng: -60.91,
        categoria: 'Luminarias',
        barrio: 'Centro',
        coordinate_jurisdiction_status: 'within',
      },
      {
        id: 'invalid-wgs84',
        lat: 91,
        lng: -68.45,
        categoria: 'Baches',
        barrio: 'Centro',
        coordinate_jurisdiction_status: 'within',
      },
    ];
    const heatmap = {
      contract_version: 'operations.heatmap.v1',
      points,
      cells: [],
      hotspots: [],
      facets: [],
      category_layers: [],
      render_contract: { can_render_heatmap: true, layers: ['points'] },
      privacy: { mode: 'privileged_exact', minimum_sample_size: 10 },
      quality: { state: 'partial', visible_points: 2, can_render_heatmap: true },
      jurisdiction: {
        state: 'configured',
        enforced: true,
        city: 'Junín',
        state_name: 'Mendoza',
        bounds: { west: -68.6, south: -33.3, east: -68.3, north: -32.9 },
      },
    } satisfies OperationsHeatmapV1;

    render(<PremiumTerritoryHeatmap points={points} heatmap={heatmap} />);

    expect(screen.queryByTestId('mock-live-map')).toBeNull();
    expect(screen.getByTestId('territory-primary-summary')).toHaveTextContent('Puntos mapeados 0');
    expect(screen.getByTestId('territory-unverified-scope')).toHaveTextContent(
      'Alcance sin validar · 1 oculta',
    );
    expect(screen.queryByTestId('territory-outside-jurisdiction')).toBeNull();
    expect(document.body.textContent).not.toContain('-34.61');
    expect(document.body.textContent).not.toContain('-60.91');
  });

  it('fails closed for a municipal map when point containment is not authoritatively verified', () => {
    const points: OperationsHeatmapPoint[] = [
      { id: 'legacy-junin', lat: -33.136, lng: -68.49, categoria: 'Baches', weight: 2 },
      { id: 'legacy-san-martin', lat: -33.0808, lng: -68.4895, categoria: 'Baches', weight: 3 },
      { id: 'legacy-palmira', lat: -33.0567, lng: -68.4954, categoria: 'Luminarias', weight: 4 },
    ];
    const heatmap = {
      contract_version: 'operations.heatmap.v1',
      tenant: { slug: 'junin', tipo: 'municipio' },
      points,
      cells: [],
      hotspots: [],
      operational_hotspots: [
        {
          id: 'unverified-hotspot',
          top_category: 'Luminarias',
          operational_score: 99,
          recommended_action: 'Despachar una cuadrilla',
        },
      ],
      map_layers: {
        contract_version: 'operations.map-layers.v1',
        layers: ['private_priority_layer'],
        operator_metrics: { total_cases: 3, critical_hotspots: 1, top_category: 'Luminarias' },
        visual_system: { renderer: 'Renderer territorial confidencial' },
      },
      summary: { operational_hotspots: 7 },
      hotspot_actions: {
        actions: [{ label: 'Despachar cuadrilla confidencial' }],
      },
      map_narrative: {
        headline: 'Prioridad territorial confidencial',
        primary_cta: { label: 'Abrir prioridad confidencial' },
      },
      realtime: {
        latest_event_at: new Date().toISOString(),
        poll_seconds: 20,
        sources: ['canal_confidencial'],
      },
      response_provenance: {
        mode: 'real',
        server_trusted_classification: true,
        real_responses_included: 3,
        synthetic_responses_included: 0,
        unverified_responses_included: 0,
      },
      territorial_facets: {
        summary: {
          ticket_records: 63,
          mapped_records: 12,
          pending_geocode_records: 34,
          records_outside_jurisdiction: 9,
        },
        categories: [
          { key: 'luminarias', label: 'Luminarias', count: 38, mapped_count: 3, pending_geocode_count: 23, outside_jurisdiction_count: 12 },
        ],
        explicit_zones: [
          { key: 'centro', label: 'Centro', count: 20, mapped_count: 4, pending_geocode_count: 10, outside_jurisdiction_count: 6 },
        ],
        addresses: [
          { key: 'san-martin', label: 'Corredor San Martín', count: 10, mapped_count: 4, pending_geocode_count: 4, outside_jurisdiction_count: 2 },
        ],
      },
      facets: [],
      category_layers: [],
      render_contract: { can_render_heatmap: true, layers: ['points'] },
      quality: { state: 'partial', visible_points: 3, can_render_heatmap: true },
      geocoding: {
        status: 'pending',
        recommended_action: { label: 'Abrir cola en CRM', href: '/perfil?tab=tickets&focus=open_geocoding_queue' },
        candidates: [
          {
            record_id: 999,
            category: 'Categoría confidencial',
            address: 'Calle confidencial 1234, Junín',
            actions: [{ label: 'Geocodificar candidato confidencial' }],
          },
        ],
      },
      jurisdiction: {
        state: 'configured',
        enforced: true,
        containment_method: 'operational_envelope',
        containment_verified: false,
        truth_boundary: 'operational_envelope_not_official_boundary',
        bounds: { west: -68.6, south: -33.2, east: -68.3, north: -32.9 },
      },
    } as OperationsHeatmapV1;

    render(<PremiumTerritoryHeatmap points={points} heatmap={heatmap} demoProfile="gobierno" />);

    expect(screen.queryByTestId('mock-live-map')).toBeNull();
    expect(screen.getByTestId('territory-scope-unverified-state')).toHaveTextContent(
      'Alcance territorial no validado',
    );
    expect(screen.getByTestId('territory-scope-unverified-state')).toHaveTextContent(
      'no se dibujan puntos, calor, celdas ni focos',
    );
    expect(screen.getByTestId('territory-unverified-scope')).toHaveTextContent(
      'Alcance sin validar · 3 ocultas',
    );
    expect(screen.getByTestId('territory-unverified-scope')).toHaveAccessibleName(
      '3 coordenadas ocultadas hasta validar el alcance territorial',
    );
    expect(screen.queryByTestId('territory-outside-jurisdiction')).toBeNull();
    expect(screen.queryByTestId('backend-map-contract-card')).toBeNull();
    expect(screen.queryByTestId('operational-hotspots-panel')).toBeNull();
    expect(screen.queryByTestId('territory-geocoding-queue')).toBeNull();
    expect(document.body.textContent).not.toContain('Abrir cola en CRM');
    expect(document.body.textContent).not.toContain('Categoría confidencial');
    expect(document.body.textContent).not.toContain('Calle confidencial');
    expect(document.body.textContent).not.toContain('Geocodificar candidato confidencial');
    expect(document.body.textContent).not.toContain('Despachar una cuadrilla');
    expect(document.body.textContent).not.toContain('Despachar cuadrilla confidencial');
    expect(document.body.textContent).not.toContain('Prioridad territorial confidencial');
    expect(document.body.textContent).not.toContain('Renderer territorial confidencial');
    expect(document.body.textContent).not.toContain('canal confidencial');
    expect(document.body.textContent).not.toContain('Actualizado recientemente');
    expect(document.body.textContent).not.toContain('20s');
    expect(document.body.textContent).not.toContain('Datos territoriales verificados');
    expect(document.body.textContent).not.toContain('El mapa conserva los puntos y celdas disponibles');
    expect(screen.getByTestId('territory-header-coverage')).toHaveTextContent('—');
    expect(screen.getByTestId('territory-header-pending')).toHaveTextContent('—');
    const commandScope = screen
      .getAllByTestId('territory-command-card')
      .find((card) => card.getAttribute('data-metric') === 'territory-command-scope');
    expect(commandScope).toBeDefined();
    expect(commandScope).toHaveTextContent('—');
    expect(commandScope).toHaveTextContent('Alcance territorial no validado');
    expect(screen.getByTestId('territory-radar-layers')).toHaveTextContent('—');
    expect(screen.getByTestId('territory-radar-layers')).toHaveTextContent('Alcance territorial no validado');
    expect(screen.getByTestId('territory-summary-pending')).toHaveTextContent('Alcance territorial no validado');
    expect(screen.getByText('Frecuencia configurada').parentElement).toHaveTextContent('--');
    expect(screen.getByTestId('territory-display-mode-status')).toHaveTextContent(
      'Alcance territorial no validado',
    );
    expect(screen.getByTestId('territory-filter-disclosure-summary')).toHaveTextContent(
      '0 mapeados · — pendientes · 0 para revisar',
    );
    openTerritoryFilters();
    expect(screen.queryByRole('option', { name: 'Luminarias' })).toBeNull();
    expect(screen.queryByRole('option', { name: 'Centro' })).toBeNull();
    expect(screen.queryByRole('option', { name: 'Corredor San Martín' })).toBeNull();
    expect(document.body.textContent).not.toContain('-33.0567');
    expect(document.body.textContent).not.toContain('-33.0808');
  });

  it('requires containment_verified even when an official-looking authority is present', () => {
    const points: OperationsHeatmapPoint[] = [
      {
        id: 'authority-with-invalid-snapshot',
        lat: -33.136,
        lng: -68.49,
        categoria: 'Luminarias',
        coordinate_jurisdiction_status: 'within',
      },
    ];
    const heatmap = {
      contract_version: 'operations.heatmap.v1',
      tenant: { slug: 'junin', tipo: 'municipio' },
      points,
      cells: [],
      hotspots: [],
      facets: [],
      category_layers: [],
      render_contract: { can_render_heatmap: true, layers: ['points'] },
      quality: { state: 'partial', visible_points: 1, can_render_heatmap: true },
      jurisdiction: {
        state: 'configured',
        enforced: true,
        containment_method: 'point_in_polygon',
        containment_verified: false,
        boundary_authority: {
          kind: 'official',
          source_ref: 'https://example.invalid/official-looking-boundary',
        },
      },
      geo_layers: {
        boundaries: {
          type: 'FeatureCollection',
          metadata: { official: true, synthetic: false, source: 'Fuente con snapshot no validado' },
          features: [
            {
              type: 'Feature',
              id: 'official-looking',
              properties: { name: 'JUNIN' },
              geometry: {
                type: 'Polygon',
                coordinates: [[
                  [-68.52, -33.16],
                  [-68.46, -33.16],
                  [-68.46, -33.11],
                  [-68.52, -33.11],
                  [-68.52, -33.16],
                ]],
              },
            },
          ],
        },
      },
    } as OperationsHeatmapV1;

    render(<PremiumTerritoryHeatmap points={points} heatmap={heatmap} demoProfile="gobierno" />);

    expect(screen.queryByTestId('mock-live-map')).toBeNull();
    expect(screen.getByTestId('territory-unverified-scope')).toHaveTextContent('1 oculta');
    expect(screen.getByTestId('territory-scope-unverified-state')).toBeInTheDocument();
  });

  it('never substitutes bounds for a missing official polygon and requires explicit per-point containment evidence', () => {
    const points: OperationsHeatmapPoint[] = [
      {
        id: 'backend-verified-within',
        lat: -33.136,
        lng: -68.49,
        categoria: 'Luminarias',
        coordinate_jurisdiction_status: 'within',
      },
      {
        id: 'bounds-only',
        lat: -33.12,
        lng: -68.47,
        categoria: 'Baches',
      },
      {
        id: 'generic-verified-is-not-containment',
        lat: -33.13,
        lng: -68.48,
        categoria: 'Baches',
        coordinate_jurisdiction_status: 'verified',
      },
      {
        id: 'generic-validated-is-not-containment',
        lat: -33.14,
        lng: -68.5,
        categoria: 'Luminarias',
        coordinate_jurisdiction_status: 'validated',
      },
    ];
    const heatmap = {
      contract_version: 'operations.heatmap.v1',
      tenant: { slug: 'junin', tipo: 'municipio' },
      points,
      cells: [],
      hotspots: [],
      facets: [],
      category_layers: [],
      render_contract: { can_render_heatmap: true, layers: ['points'] },
      quality: { state: 'ready', visible_points: 2, can_render_heatmap: true },
      jurisdiction: {
        state: 'configured',
        enforced: true,
        containment_method: 'point_in_polygon',
        containment_verified: true,
        boundary_authority: {
          kind: 'official',
          source_ref: 'https://ide.mendoza.gov.ar/verified-server-contract',
          snapshot_sha256: TEST_OFFICIAL_BOUNDARY_SHA,
        },
        bounds: { west: -68.6, south: -33.2, east: -68.3, north: -32.9 },
      },
    } as OperationsHeatmapV1;

    render(<PremiumTerritoryHeatmap points={points} heatmap={heatmap} />);

    const map = screen.getByTestId('mock-live-map');
    expect(map).toHaveAttribute('data-points', '1');
    expect(map).toHaveAttribute('data-point-ids', 'backend-verified-within');
    expect(map.getAttribute('data-point-ids')).not.toContain('bounds-only');
    expect(map.getAttribute('data-point-ids')).not.toContain('generic-verified-is-not-containment');
    expect(map.getAttribute('data-point-ids')).not.toContain('generic-validated-is-not-containment');
    expect(screen.getByTestId('territory-outside-jurisdiction')).toHaveTextContent(
      'Fuera de jurisdicción / revisar · 3',
    );
  });

  it('uses the official polygon before labels and maps only points contained by Junín', () => {
    const points: OperationsHeatmapPoint[] = [
      {
        id: 'junin-contained',
        lat: -33.136,
        lng: -68.49,
        categoria: 'Luminarias',
        barrio: 'Palmira',
        coordinate_jurisdiction_status: 'within',
      },
      {
        id: 'palmira-outside',
        lat: -33.0567,
        lng: -68.4954,
        categoria: 'Luminarias',
        barrio: 'Junín',
        coordinate_jurisdiction_status: 'within',
      },
    ];
    const heatmap = {
      contract_version: 'operations.heatmap.v1',
      tenant: { slug: 'junin', tipo: 'municipio' },
      points,
      cells: [],
      hotspots: [],
      facets: [],
      category_layers: [],
      render_contract: { can_render_heatmap: true, layers: ['points'] },
      quality: { state: 'ready', visible_points: 1, can_render_heatmap: true },
      jurisdiction: {
        state: 'configured',
        enforced: true,
        containment_method: 'point_in_polygon',
        containment_verified: true,
        boundary_authority: {
          kind: 'official',
          source_ref: 'https://ide.mendoza.gov.ar/fixture-controlada',
          snapshot_sha256: TEST_OFFICIAL_BOUNDARY_SHA,
        },
      },
      geo_layers: {
        boundaries: {
          type: 'FeatureCollection',
          metadata: {
            official: true,
            synthetic: false,
            source: 'IDE Mendoza · fixture controlada',
            provenance: {
              source_ref: 'https://ide.mendoza.gov.ar/fixture-controlada',
              snapshot_sha256: TEST_OFFICIAL_BOUNDARY_SHA,
            },
          },
          features: [
            {
              type: 'Feature',
              id: '09',
              properties: { name: 'JUNIN' },
              geometry: {
                type: 'Polygon',
                coordinates: [[
                  [-68.52, -33.16],
                  [-68.46, -33.16],
                  [-68.46, -33.11],
                  [-68.52, -33.11],
                  [-68.52, -33.16],
                ]],
              },
            },
          ],
        },
      },
    } as OperationsHeatmapV1;

    render(<PremiumTerritoryHeatmap points={points} heatmap={heatmap} demoProfile="gobierno" />);

    const map = screen.getByTestId('mock-live-map');
    expect(map).toHaveAttribute('data-points', '1');
    expect(map).toHaveAttribute('data-point-ids', 'junin-contained');
    expect(map.getAttribute('data-bounds-coordinates')).not.toContain('-33.0567');
    expect(screen.getByTestId('territory-outside-jurisdiction')).toHaveTextContent(
      'Fuera de jurisdicción / revisar · 1',
    );
  });

  it('fails closed when the official polygon metadata belongs to a different source snapshot', () => {
    const points: OperationsHeatmapPoint[] = [
      {
        id: 'point-with-mismatched-boundary',
        lat: -33.136,
        lng: -68.49,
        categoria: 'Luminarias',
        coordinate_jurisdiction_status: 'within',
      },
    ];
    const heatmap = {
      contract_version: 'operations.heatmap.v1',
      tenant: { slug: 'junin', tipo: 'municipio' },
      points,
      cells: [],
      hotspots: [],
      facets: [],
      category_layers: [],
      render_contract: { can_render_heatmap: true, layers: ['points'] },
      quality: { state: 'ready', visible_points: 1, can_render_heatmap: true },
      jurisdiction: {
        state: 'configured',
        enforced: true,
        containment_method: 'point_in_polygon',
        containment_verified: true,
        boundary_authority: {
          kind: 'official',
          source_ref: 'https://ide.mendoza.gov.ar/junin-snapshot',
          snapshot_sha256: TEST_OFFICIAL_BOUNDARY_SHA,
        },
      },
      geo_layers: {
        boundaries: {
          type: 'FeatureCollection',
          metadata: {
            official: true,
            synthetic: false,
            source: 'IDE Mendoza',
            provenance: {
              source_ref: 'https://ide.mendoza.gov.ar/another-department',
              snapshot_sha256: TEST_OFFICIAL_BOUNDARY_SHA,
            },
          },
          features: [
            {
              type: 'Feature',
              id: '09',
              properties: { name: 'JUNIN' },
              geometry: {
                type: 'Polygon',
                coordinates: [[
                  [-68.52, -33.16],
                  [-68.46, -33.16],
                  [-68.46, -33.11],
                  [-68.52, -33.11],
                  [-68.52, -33.16],
                ]],
              },
            },
          ],
        },
      },
    } as OperationsHeatmapV1;

    render(<PremiumTerritoryHeatmap points={points} heatmap={heatmap} demoProfile="gobierno" />);

    expect(screen.queryByTestId('mock-live-map')).toBeNull();
    expect(screen.getByTestId('territory-scope-unverified-state')).toBeInTheDocument();
    expect(screen.getByTestId('territory-unverified-scope')).toHaveTextContent('1 oculta');
  });

  it('shows the backend-derived provenance legend instead of claiming every point is real', () => {
    const points = buildPoints(4);
    const heatmap = {
      contract_version: 'operations.heatmap.v1',
      points,
      cells: [],
      hotspots: [],
      facets: [],
      category_layers: [],
      quality: { state: 'ready', visible_points: 4, can_render_heatmap: true },
      response_provenance: {
        contract_version: 'surveys.response_provenance.v1',
        mode: 'synthetic',
        server_trusted_classification: true,
        contains_synthetic: true,
        synthetic_responses_included: 4,
      },
    } satisfies OperationsHeatmapV1;

    render(<PremiumTerritoryHeatmap points={points} heatmap={heatmap} />);

    expect(screen.getByTestId('territory-data-provenance')).toHaveTextContent('Datos sintéticos declarados');
    expect(document.body.textContent).toContain('El sistema declaró respuestas sintéticas incluidas');
    expect(document.body.textContent).not.toContain('Los puntos son reales');
    expect(document.body.textContent).toContain('Cobertura técnica disponible');
    expect(document.body.textContent).not.toContain('Mapa listo para operar');
  });

  it('enables zonal metrics only with explicit official boundaries and backend population', () => {
    const points = buildPoints(12);
    const heatmap = {
      contract_version: 'operations.heatmap.v1',
      points,
      cells: [],
      hotspots: [],
      facets: [],
      category_layers: [],
      privacy: {
        mode: 'aggregated',
        minimum_sample_size: 10,
        population_source: 'INDEC 2022',
      },
      geo_layers: {
        boundaries: {
          type: 'FeatureCollection',
          metadata: { source: 'Catastro municipal', official: true },
          features: [
            {
              type: 'Feature',
              id: 'centro',
              geometry: {
                type: 'Polygon',
                coordinates: [[[-61, -34.7], [-60.8, -34.7], [-60.8, -34.5], [-61, -34.5], [-61, -34.7]]],
              },
              properties: { nombre: 'Centro oficial', poblacion: 32000 },
            },
          ],
        },
      },
      quality: { state: 'ready', visible_points: 12, can_render_heatmap: true },
    } satisfies OperationsHeatmapV1;

    render(<PremiumTerritoryHeatmap points={points} heatmap={heatmap} />);

    expect(screen.getByText('Zona seleccionada')).toBeTruthy();
    expect(screen.getAllByText('Centro oficial').length).toBeGreaterThan(0);
    expect(screen.getByText('privacidad agregada')).toBeTruthy();
    expect(screen.getByText('Tasa cada 1.000')).toBeTruthy();
    expect(screen.queryByTestId('territory-zone-analytics-unavailable')).toBeNull();
    expect(screen.queryByText('Sin delimitación territorial oficial')).toBeNull();
  });

  it('does not trust an unproven boundary collection as official', () => {
    const points = buildPoints(12);
    const heatmap = {
      contract_version: 'operations.heatmap.v1',
      points,
      cells: [],
      hotspots: [],
      facets: [],
      category_layers: [],
      geo_layers: {
        boundaries: {
          type: 'FeatureCollection',
          features: [
            {
              type: 'Feature',
              id: 'centro',
              geometry: {
                type: 'Polygon',
                coordinates: [[[-61, -34.7], [-60.8, -34.7], [-60.8, -34.5], [-61, -34.5]]],
              },
              properties: { nombre: 'Centro supuesto', poblacion: 999999 },
            },
          ],
        },
      },
      quality: { state: 'ready', visible_points: 12, can_render_heatmap: true },
    } satisfies OperationsHeatmapV1;

    render(<PremiumTerritoryHeatmap points={points} heatmap={heatmap} />);

    expect(screen.getByTestId('territory-zone-analytics-unavailable')).toBeTruthy();
    expect(screen.getAllByText('Sin delimitación territorial oficial').length).toBeGreaterThan(0);
    expect(screen.queryByText('Centro supuesto')).toBeNull();
    expect(screen.queryByText('Tasa cada 1.000')).toBeNull();
  });

  it('renders backend heatmap cells as live map points when raw points are absent', () => {
    const heatmap = {
      contract_version: 'operations.heatmap.v1',
      points: [],
      cells: [
        {
          cell_id: 'cell-centro',
          centroid_lat: -34.61,
          centroid_lon: -60.91,
          count: 9,
          dominant_category: 'alumbrado',
          risk: { level: 'critical', label: 'Critico' },
        },
      ],
      hotspots: [],
      facets: [],
      category_layers: [],
      map_layers: {
        contract_version: 'analytics.geo_layers.v1',
        intensity: { total_cases: 9, total_items: 1 },
        hotspots: {
          focus: {
            category: 'alumbrado',
            count: 9,
            risk: { level: 'critical', label: 'Critico' },
          },
        },
        visual_system: {
          renderer: 'webgl_heatmap',
          animations: { radar_sweep: true },
        },
        operator_metrics: {
          total_cases: 9,
          visible_layers: 1,
          top_category: 'alumbrado',
          critical_hotspots: 1,
        },
      },
    } satisfies OperationsHeatmapV1;

    render(<PremiumTerritoryHeatmap points={[]} heatmap={heatmap} allowDemoFallback />);

    const liveMap = screen.getByTestId('mock-live-map');
    expect(screen.getByTestId('live-territory-map')).toBeTruthy();
    expect(liveMap.getAttribute('data-points')).toBe('1');
    expect(liveMap.getAttribute('data-geo-contract')).toBe('operations.heatmap.geo_layers.v1');
    expect(liveMap.getAttribute('data-geo-features')).toBe('1');
    expect(screen.getAllByText('Procedencia no validada').length).toBeGreaterThan(0);
    expect(document.body.textContent).not.toContain('Zonas agregadas verificadas');
    expect(document.body.textContent).not.toContain('Datos territoriales verificados');
    expect(screen.getAllByText('alumbrado').length).toBeGreaterThan(0);
    expect(screen.queryByRole('img', { name: 'Inteligencia territorial' })).toBeNull();
  });

  it('uses verified wording only when the provenance resolver proves real survey responses', () => {
    const points = buildPoints(2).map((point) => ({ ...point, source: 'survey' }));
    const heatmap = {
      contract_version: 'operations.heatmap.v1',
      points,
      cells: [],
      hotspots: [],
      facets: [],
      category_layers: [],
      quality: { state: 'ready', visible_points: 2, can_render_heatmap: true },
      response_provenance: {
        contract_version: 'surveys.response_provenance.v1',
        mode: 'real',
        server_trusted_classification: true,
        real_responses_included: 2,
        unverified_responses_included: 0,
      },
    } satisfies OperationsHeatmapV1;

    render(<PremiumTerritoryHeatmap points={points} heatmap={heatmap} />);

    expect(screen.getByText('Datos territoriales verificados')).toBeTruthy();
    expect(screen.getByTestId('territory-data-provenance')).toHaveTextContent(
      'Procedencia validada por el sistema',
    );
  });

  it('prefers backend geo_layers FeatureCollection before rebuilding local source', () => {
    const heatmap = {
      contract_version: 'operations.heatmap.v1',
      points: [],
      cells: [],
      hotspots: [],
      facets: [],
      category_layers: [],
      geo_layers: {
        contract_version: 'operations.heatmap_geo_layers.v1',
        provider: 'geojson',
        coordinate_order: 'lng_lat',
        points: {
          type: 'FeatureCollection',
          features: [
            {
              type: 'Feature',
              id: 'tenant_ticket:10',
              geometry: { type: 'Point', coordinates: [-60.94, -34.58] },
              properties: {
                id: 'tenant_ticket:10',
                category: 'alumbrado',
                weight: 3,
                source: 'ticket',
                label: 'Luminaria rota',
              },
            },
            {
              type: 'Feature',
              id: 'survey:7',
              geometry: { type: 'Point', coordinates: [-60.93, -34.57] },
              properties: {
                id: 'survey:7',
                category: 'votacion',
                weight: 1,
                source: 'survey',
                label: 'Sondeo barrial',
              },
            },
          ],
        },
      },
      map_layers: {
        contract_version: 'operations.heatmap_map_layers.v1',
        layers: [
          { id: 'base_heatmap', type: 'heatmap' },
          { id: 'hotspots', type: 'symbol' },
        ],
        telemetry: {
          event_endpoint: '/api/analytics/event',
          events: ['heatmap_bbox_changed'],
        },
      },
      source_quality: {
        contract_version: 'operations.heatmap_source_quality.v1',
      },
    } satisfies OperationsHeatmapV1;

    render(<PremiumTerritoryHeatmap points={[]} heatmap={heatmap} />);

    const liveMap = screen.getByTestId('mock-live-map');
    expect(screen.getByTestId('live-territory-map')).toBeTruthy();
    expect(liveMap.getAttribute('data-points')).toBe('2');
    expect(liveMap.getAttribute('data-geo-contract')).toBe('operations.heatmap_geo_layers.v1');
    expect(liveMap.getAttribute('data-geo-features')).toBe('2');
    expect(liveMap.getAttribute('data-geo-heat-layer')).toBe('base_heatmap');
    expect(liveMap.getAttribute('data-geo-point-layer')).toBe('hotspots');
    expect(liveMap.getAttribute('data-geo-telemetry-endpoint')).toBe('/api/analytics/event');
    expect(liveMap.getAttribute('data-geo-telemetry-events')).toContain('heatmap_bbox_changed');
    expect(screen.queryByRole('img', { name: 'Inteligencia territorial' })).toBeNull();
  });
});
