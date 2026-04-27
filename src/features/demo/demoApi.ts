import { demoApi } from '@/api/v2/client';
import { getRubrosHierarchy } from '@/api/rubros';
import type { DemoCatalogResponse, DemoSessionResponse, DemoSector } from './demoTypes';

export const getDemoCatalog = async (): Promise<DemoCatalogResponse> => {
  try {
    return await demoApi.get<DemoCatalogResponse>('/api/v2/demo/catalog');
  } catch {
    const rubros = await getRubrosHierarchy().catch(() => []);
    return { sectors: ['gobierno', 'empresas'], rubros };
  }
};

export const createDemoSession = (payload: { sector: DemoSector; rubro: string }) =>
  demoApi.post<DemoSessionResponse>('/api/v2/demo/session', payload, {
    legacyFallbackPath: '/api/v1/demo/session',
  });
