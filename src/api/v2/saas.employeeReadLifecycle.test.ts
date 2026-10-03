import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
const mocks=vi.hoisted(()=>({get:vi.fn()}));
vi.mock('@/api/v2/client',()=>({panelApi:{get:(...args:unknown[])=>mocks.get(...args)},publicApi:{},widgetApi:{},demoApi:{}}));
import {getEmployeeCoverageV2,getEmployeeRoutingV2} from './saas';
import {ApiError} from '@/utils/api';
beforeEach(()=>{mocks.get.mockReset();});afterEach(()=>{vi.clearAllMocks();});
describe('existing employee reads preserve optional lifecycle',()=>{
 it.each([['coverage',getEmployeeCoverageV2],['routing',getEmployeeRoutingV2]] as const)('forwards current-scope predicate on %s and its existing fallback',async (kind,read)=>{
  const isCurrent=()=>false;mocks.get.mockRejectedValueOnce(new ApiError('Missing route',404)).mockResolvedValue({contract_version:`employee.${kind}.v1`,tenant:{slug:'selected-org'},employees:[],dimensions:{},queues:{},coverage:{}});
  await read('selected-org',{isCurrent});expect(mocks.get).toHaveBeenNthCalledWith(1,`/api/v2/tenants/selected-org/employee-${kind}`,{tenantSlug:'selected-org',isCurrent});expect(mocks.get).toHaveBeenNthCalledWith(2,`/api/v2/employee-${kind}`,{tenantSlug:'selected-org',isCurrent});
 });
 it.each([['coverage',getEmployeeCoverageV2],['routing',getEmployeeRoutingV2]] as const)('keeps %s compatible with existing callers that provide no lifecycle',async (kind,read)=>{mocks.get.mockResolvedValue({employees:[],dimensions:{},queues:{},coverage:{}});await read('selected-org');expect(mocks.get).toHaveBeenCalledExactlyOnceWith(`/api/v2/tenants/selected-org/employee-${kind}`,{tenantSlug:'selected-org'});});
 it.each([['coverage',getEmployeeCoverageV2],['routing',getEmployeeRoutingV2]] as const)('does not take a %s endpoint fallback after scope retirement',async (_kind,read)=>{const error=new DOMException('Retired','AbortError');mocks.get.mockRejectedValue(error);await expect(read('selected-org',{isCurrent:()=>false})).rejects.toBe(error);expect(mocks.get).toHaveBeenCalledOnce();});
});
