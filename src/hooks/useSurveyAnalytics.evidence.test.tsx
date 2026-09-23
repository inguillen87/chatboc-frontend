import { type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import fixtures from '../../tests/fixtures/analytics-evidence.json';
const api=vi.hoisted(()=>({getSurveyDashboardBundle:vi.fn(),getSummary:vi.fn(),getHeatmap:vi.fn(),getTimeseries:vi.fn(),downloadExportCsv:vi.fn()}));
vi.mock('@/api/encuestas',()=>api);
vi.mock('@/config',()=>({ENABLE_SURVEY_ANALYTICS_FALLBACK:false}));
vi.mock('@/context/TenantContext',()=>({useTenant:()=>({currentSlug:'tenant-a'})}));
import {useSurveyAnalytics} from './useSurveyAnalytics';
const clients:QueryClient[]=[];
const wrapper=()=>{
 const client=new QueryClient({defaultOptions:{queries:{retry:false,refetchOnWindowFocus:false},mutations:{retry:false}}});clients.push(client);
 return ({children}:{children:ReactNode})=><QueryClientProvider client={client}>{children}</QueryClientProvider>;
};
beforeEach(()=>{
 Object.values(api).forEach(mock=>mock.mockReset());
 api.getSurveyDashboardBundle.mockResolvedValue({modules:{summary:fixtures.low,timeseries:[],heatmap:{points:[]}}});
 api.getSummary.mockResolvedValue(fixtures.low);api.getTimeseries.mockResolvedValue([]);api.getHeatmap.mockResolvedValue({points:[]});
});
afterEach(()=>{cleanup();clients.splice(0).forEach(client=>client.clear());});
describe('evidence freshness follows its actual source',()=>{
 it('marks evidence current only after the source finishes loading',async()=>{
  const {result}=renderHook(()=>useSurveyAnalytics(301),{wrapper:wrapper()});
  expect(result.current.evidenceCurrent).toBe(false);
  await waitFor(()=>expect(result.current.evidenceCurrent).toBe(true));
 });
 it('does not present cached dashboard evidence as current after a failed refresh',async()=>{
  const {result}=renderHook(()=>useSurveyAnalytics(301),{wrapper:wrapper()});
  await waitFor(()=>expect(result.current.evidenceCurrent).toBe(true));
  api.getSurveyDashboardBundle.mockRejectedValue(new Error('unavailable'));
  await act(async()=>{await result.current.refresh();});
  await waitFor(()=>expect(result.current.evidenceCurrent).toBe(false));
  // A successful separate fallback cannot verify an older summary still selected from dashboard cache.
  expect(api.getSummary).toHaveBeenCalled();
 });
 it('does not attribute a pending background read to a current verification',async()=>{
  const {result}=renderHook(()=>useSurveyAnalytics(301),{wrapper:wrapper()});
  await waitFor(()=>expect(result.current.evidenceCurrent).toBe(true));
  let resolve!:(value:unknown)=>void;
  api.getSurveyDashboardBundle.mockImplementation(()=>new Promise(r=>{resolve=r;}));
  let operation!:Promise<void>;
  act(()=>{operation=result.current.refresh();});
  await waitFor(()=>expect(result.current.evidenceCurrent).toBe(false));
  await act(async()=>{resolve({modules:{summary:fixtures.low,timeseries:[],heatmap:{points:[]}}});await operation;});
  await waitFor(()=>expect(result.current.evidenceCurrent).toBe(true));
 });
});
