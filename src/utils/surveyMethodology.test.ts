import {describe,expect,it} from 'vitest';
import fixtures from '../../tests/fixtures/survey-methodology.json';
import {readMethodology} from './surveyMethodology';
const scope={surveyId:fixtures.empty.scope.survey_id,tenantId:fixtures.empty.scope.tenant_id,tenantSlug:'acceptance-a'};
const read=(value:unknown)=>readMethodology(value,scope);
describe('methodology response contract',()=>{
 it.each(Object.keys(fixtures) as Array<keyof typeof fixtures>)('accepts backend-generated %s response',key=>{
  expect(read(fixtures[key])).toEqual(fixtures[key]);
 });
 it('rejects another organization or instrument',()=>{
  expect(readMethodology(fixtures.first,{...scope,tenantId:scope.tenantId+1})).toBeNull();
  expect(readMethodology(fixtures.first,{...scope,surveyId:scope.surveyId+1})).toBeNull();
  expect(readMethodology(fixtures.first,{...scope,tenantSlug:''})).toBeNull();
 });
 it.each([null,undefined,[],{}, {...fixtures.first,contract_version:'unknown'}])('does not synthesize missing or unknown response %#',value=>{
  expect(read(value)).toBeNull();
 });
 it('does not treat a declaration as certification or results change',()=>{
  expect(read({...fixtures.second,inference_authorized:true})).toBeNull();
  expect(read({...fixtures.second,result_changes_applied:true})).toBeNull();
  expect(read({...fixtures.second,coverage:{...fixtures.second.coverage,assessment:'certified'}})).toBeNull();
 });
 it('does not accept invented completeness',()=>{
  expect(read({...fixtures.first,coverage:{...fixtures.first.coverage,documented:16}})).toBeNull();
  expect(read({...fixtures.first,coverage:{...fixtures.first.coverage,missing:[]}})).toBeNull();
 });
 it('does not accept editable history or disabled writes',()=>{
  expect(read({...fixtures.history,capabilities:{can_edit:true}})).toBeNull();
  expect(read({...fixtures.disabled,capabilities:{can_edit:true}})).toBeNull();
 });
 it('rejects questionnaire binding mismatch',()=>{
  expect(read({...fixtures.first,linked_instrument_changed:true})).toBeNull();
  expect(read({...fixtures.stale,linked_instrument_changed:false})).toBeNull();
 });
 it('requires explicit schema, field keys and valid options',()=>{
  const value=structuredClone(fixtures.first);value.schema[0].fields[0].key='unknown';expect(read(value)).toBeNull();
  expect(read({...fixtures.first,profile:{...fixtures.first.profile,fields:{...fixtures.first.profile.fields,extra:'ignored?'}}})).toBeNull();
  expect(read({...fixtures.first,profile:{...fixtures.first.profile,fields:{...fixtures.first.profile.fields,design:'certified'}}})).toBeNull();
 });
 it('does not preload invented details into an unrecorded profile',()=>{
  const value=structuredClone(fixtures.empty);value.profile.fields.purpose='Invented default';expect(read(value)).toBeNull();
 });
 it('rejects malformed versions, history ordering and digests',()=>{
  expect(read({...fixtures.first,profile:{...fixtures.first.profile,revision:99}})).toBeNull();
  expect(read({...fixtures.first,profile:{...fixtures.first.profile,digest:'sha'}})).toBeNull();
  expect(read({...fixtures.second,history:[...fixtures.second.history].reverse()})).toBeNull();
 });
 it('drops extra transport properties without changing the input',()=>{
  const source={...fixtures.first,raw_database_secret:'not-for-ui'};
  expect(read(source)).toEqual(fixtures.first);expect(source.raw_database_secret).toBe('not-for-ui');
 });
 it('rejects a date that JavaScript silently rolls into the next month',()=>{
  const value=structuredClone(fixtures.second);value.profile.fields.fieldwork_start='2026-02-29';expect(read(value)).toBeNull();
 });
 it('requires all server-owned interface labels',()=>{
  const value=structuredClone(fixtures.first);delete (value.ui as Record<string,unknown>).save;
  expect(read(value)).toBeNull();
 });
});
