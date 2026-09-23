import {beforeEach,describe,expect,it,vi} from 'vitest';
import fixtures from '../../tests/fixtures/survey-methodology.json';
const api=vi.hoisted(()=>({apiFetch:vi.fn()}));
vi.mock('@/utils/api',()=>api);
import {getSurveyMethodology,saveSurveyMethodology} from './surveyMethodology';
const scope={surveyId:fixtures.empty.scope.survey_id,tenantId:fixtures.empty.scope.tenant_id,tenantSlug:'acceptance-a'};
const payload={contract_version:'surveys.methodology.write.v1' as const,expected_revision:0,expected_instrument_revision:1,
 fields:fixtures.first.profile.fields,change_reason:fixtures.first.profile.change_reason};
beforeEach(()=>{api.apiFetch.mockReset();});
describe('methodology scoped transport',()=>{
 it('uses one canonical route and explicit organization context',async()=>{
  api.apiFetch.mockResolvedValue(fixtures.first);await getSurveyMethodology(scope);
  expect(api.apiFetch).toHaveBeenCalledTimes(1);
  expect(api.apiFetch).toHaveBeenCalledWith(`/api/admin/encuestas/${scope.surveyId}/methodology?tenant_slug=acceptance-a`,expect.objectContaining({tenantSlug:'acceptance-a',persistTenantSlug:false}));
 });
 it('does not request without scope',async()=>{
  await expect(getSurveyMethodology({...scope,tenantSlug:''})).rejects.toThrow('methodology_scope_required');expect(api.apiFetch).not.toHaveBeenCalled();
 });
 it('does not retry an unconfirmed write through other route aliases',async()=>{
  const error=Object.assign(new Error('lost reply'),{status:503});api.apiFetch.mockRejectedValue(error);
  await expect(saveSurveyMethodology(scope,payload)).rejects.toBe(error);expect(api.apiFetch).toHaveBeenCalledTimes(1);
 });
 it('preserves server conflicts instead of claiming a save',async()=>{
  const error=Object.assign(new Error('conflict'),{status:409});api.apiFetch.mockRejectedValue(error);
  await expect(saveSurveyMethodology(scope,payload)).rejects.toBe(error);
 });
 it('checks saved revision and instrument identity',async()=>{
  api.apiFetch.mockResolvedValue(fixtures.first);expect((await saveSurveyMethodology(scope,payload)).profile.revision).toBe(1);
  api.apiFetch.mockResolvedValue(fixtures.second);await expect(saveSurveyMethodology(scope,payload)).rejects.toThrow('methodology_write_confirmation_unverified');
 });
 it('does not acknowledge a different declaration with the expected revision',async()=>{
  api.apiFetch.mockResolvedValue(fixtures.first);
  await expect(saveSurveyMethodology(scope,{...payload,fields:{...payload.fields,purpose:'Different payload'}})).rejects.toThrow('methodology_write_content_unverified');
 });
 it('does not substitute current content for requested history',async()=>{
  api.apiFetch.mockResolvedValue(fixtures.second);await expect(getSurveyMethodology(scope,1)).rejects.toThrow('methodology_history_response_mismatch');
 });
});
