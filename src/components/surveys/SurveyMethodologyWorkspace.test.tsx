import {act,cleanup,fireEvent,render,screen,waitFor} from '@testing-library/react';
import {QueryClient,QueryClientProvider} from '@tanstack/react-query';
import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
import fixtures from '../../../tests/fixtures/survey-methodology.json';
const api=vi.hoisted(()=>({getSurveyMethodology:vi.fn(),saveSurveyMethodology:vi.fn()}));
vi.mock('@/api/surveyMethodology',()=>api);
import {SurveyMethodologyWorkspace} from './SurveyMethodologyWorkspace';
const scope={surveyId:fixtures.empty.scope.survey_id,tenantId:fixtures.empty.scope.tenant_id,tenantSlug:'acceptance-a'};
const copy=fixtures.empty.ui;
const clients:QueryClient[]=[];
function setup(){
 const client=new QueryClient({defaultOptions:{queries:{retry:false,refetchOnWindowFocus:false},mutations:{retry:false}}});clients.push(client);
 const page=(s=scope)=><QueryClientProvider client={client}><SurveyMethodologyWorkspace {...s}/></QueryClientProvider>;
 const view=render(page());return {...view,page,client};
}
async function edit(){
 await screen.findByRole('button',{name:copy.edit});fireEvent.click(screen.getByRole('button',{name:copy.edit}));
 fireEvent.change(screen.getByLabelText(fixtures.empty.schema[0].fields[0].label),{target:{value:fixtures.first.profile.fields.purpose}});
 fireEvent.change(screen.getByLabelText(copy.change_reason),{target:{value:fixtures.first.profile.change_reason}});
}
beforeEach(()=>{api.getSurveyMethodology.mockReset().mockResolvedValue(fixtures.empty);api.saveSurveyMethodology.mockReset().mockResolvedValue(fixtures.first);});
afterEach(()=>{cleanup();clients.splice(0).forEach(client=>client.clear());});
describe('methodology administration workspace',()=>{
 it('shows missing fields rather than generating a methodology',async()=>{
  setup();await screen.findByRole('heading',{name:copy.title});
  expect(screen.getByRole('progressbar')).toHaveAttribute('value','0');
  expect(screen.getAllByText(copy.missing).length).toBeGreaterThan(0);expect(api.saveSurveyMethodology).not.toHaveBeenCalled();
 });
 it('saves a scoped, versioned declaration and displays the acknowledged version',async()=>{
  setup();await edit();fireEvent.click(screen.getByRole('button',{name:copy.save}));
  await screen.findByText(copy.saved);
  expect(api.saveSurveyMethodology).toHaveBeenCalledWith(scope,expect.objectContaining({expected_revision:0,expected_instrument_revision:1,fields:fixtures.first.profile.fields}));
  expect(api.saveSurveyMethodology).toHaveBeenCalledTimes(1);expect(screen.queryByLabelText(copy.change_reason)).toBeNull();
 });
 it('synchronously prevents double submission while saving',async()=>{
  let resolve!:(v:unknown)=>void;api.saveSurveyMethodology.mockImplementation(()=>new Promise(r=>{resolve=r;}));
  setup();await edit();const button=screen.getByRole('button',{name:copy.save});fireEvent.click(button);fireEvent.click(button);
  expect(api.saveSurveyMethodology).toHaveBeenCalledTimes(1);expect(screen.getByRole('button',{name:copy.saving})).toBeDisabled();
  await act(async()=>resolve(fixtures.first));await screen.findByText(copy.saved);
 });
 it('preserves the local declaration when the server reports a version conflict',async()=>{
  api.saveSurveyMethodology.mockRejectedValue(Object.assign(new Error(copy.conflict),{status:409}));setup();await edit();
  fireEvent.click(screen.getByRole('button',{name:copy.save}));await screen.findByText(copy.conflict);
  expect(screen.getByLabelText(fixtures.empty.schema[0].fields[0].label)).toHaveValue(fixtures.first.profile.fields.purpose);
  expect(screen.getByRole('button',{name:copy.save})).toBeDisabled();expect(screen.queryByText(copy.saved)).toBeNull();
 });
 it('requires explicit discard before replacing edited fields with a newer read',async()=>{
  setup();await edit();api.getSurveyMethodology.mockResolvedValue(fixtures.second);
  fireEvent.click(screen.getByRole('button',{name:copy.discard}));
  expect(screen.getByRole('alertdialog')).toBeInTheDocument();expect(api.getSurveyMethodology).toHaveBeenCalledTimes(1);
  fireEvent.click(screen.getByRole('button',{name:copy.confirm_discard}));
  await screen.findByText(fixtures.second.profile.fields.purpose);expect(api.saveSurveyMethodology).not.toHaveBeenCalled();
 });
 it('drops private fields immediately after an authorization failure',async()=>{
  api.saveSurveyMethodology.mockRejectedValue(Object.assign(new Error('forbidden'),{status:403}));setup();await edit();
  fireEvent.click(screen.getByRole('button',{name:copy.save}));await waitFor(()=>expect(screen.queryByTestId('survey-methodology')).toBeNull());
  expect(screen.queryByDisplayValue(fixtures.first.profile.fields.purpose)).toBeNull();
 });
 it.each([[401,'toolbar'],[403,'toolbar'],[401,'cache'],[403,'cache']] as const)('evicts private cache after %s read denial via %s',async(status,source)=>{
  api.getSurveyMethodology.mockResolvedValue(fixtures.first);
  const view=setup();await screen.findByText(fixtures.first.profile.fields.purpose);
  const prefix=['surveys','methodology',scope.tenantSlug,scope.tenantId,scope.surveyId];
  view.client.setQueryData([...prefix,1],fixtures.first);
  api.getSurveyMethodology.mockRejectedValue(Object.assign(new Error('access revoked'),{status}));
  if(source==='toolbar')fireEvent.click(screen.getByRole('button',{name:copy.refresh}));
  else await act(async()=>{await view.client.refetchQueries({queryKey:[...prefix,'current']});});
  await waitFor(()=>expect(screen.queryByTestId('survey-methodology')).toBeNull());
  await waitFor(()=>expect(view.client.getQueriesData({queryKey:prefix}).filter(([,value])=>value!==undefined)).toEqual([]));
  const calls=api.getSurveyMethodology.mock.calls.length;
  await act(async()=>{await view.client.invalidateQueries({queryKey:prefix});});
  expect(api.getSurveyMethodology).toHaveBeenCalledTimes(calls);
  expect(screen.queryByText(fixtures.first.profile.fields.purpose)).toBeNull();
 });
 it('does not carry a local draft or late success across organizations A-B-A',async()=>{
  let resolve!:(v:unknown)=>void;api.saveSurveyMethodology.mockImplementation(()=>new Promise(r=>{resolve=r;}));
  const view=setup();await edit();fireEvent.click(screen.getByRole('button',{name:copy.save}));
  view.rerender(view.page({...scope,tenantSlug:'acceptance-b'}));await screen.findByRole('heading',{name:copy.title});
  view.rerender(view.page());await screen.findByRole('heading',{name:copy.title});
  await act(async()=>resolve(fixtures.first));
  expect(screen.queryByText(copy.saved)).toBeNull();expect(screen.queryByDisplayValue(fixtures.first.profile.fields.purpose)).toBeNull();
 });
 it('shows unavailable rollout state without offering a write',async()=>{
  api.getSurveyMethodology.mockResolvedValue(fixtures.disabled);setup();await screen.findByText(copy.disabled);
  expect(screen.queryByRole('button',{name:copy.edit})).toBeNull();expect(api.saveSurveyMethodology).not.toHaveBeenCalled();
 });
 it('presents a prior revision as read-only and supports returning to current',async()=>{
  api.getSurveyMethodology.mockResolvedValue(fixtures.history);setup();await screen.findByText(copy.viewing_history);
  expect(screen.queryByRole('button',{name:copy.edit})).toBeNull();expect(screen.getByRole('button',{name:copy.current})).toBeEnabled();
 });
});
