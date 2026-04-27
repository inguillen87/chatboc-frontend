import type { Rubro } from '@/components/chat/RubroSelector';

export type DemoSector = 'gobierno' | 'empresas';

export interface DemoCatalogResponse {
  sectors?: DemoSector[];
  rubros?: Rubro[];
}

export interface DemoSessionResponse {
  session_id?: string;
  demo_session_id?: string;
  tenant_slug?: string | null;
}
