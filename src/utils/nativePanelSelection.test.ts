import {beforeEach,describe,expect,it} from 'vitest';
import {safeLocalStorage,safeSessionStorage} from './safeLocalStorage';
import {hasSelectedNativePanelImpersonation,selectNativePanelImpersonation} from './nativePanelSelection';
import {clearLocalChatbocSession} from './sessionLogout';
const token=(patch:Record<string,unknown>={})=>`header.${btoa(JSON.stringify({user_id:7,asid:'synthetic-lineage',auth_provider:'native',impersonated_by:99,exp:4070908800,...patch}))}.signature`;
beforeEach(()=>{safeLocalStorage.clear();safeSessionStorage.clear();clearLocalChatbocSession();});
describe('denial-only native impersonation selection',()=>{
 it('binds SDK suppression to the selected bearer actor, lineage and initiating actor',()=>{
  selectNativePanelImpersonation({actorId:'7',lineageId:'synthetic-lineage',initiatedByActorId:'99'});
  expect(hasSelectedNativePanelImpersonation()).toBe(false);safeLocalStorage.setItem('authToken',token());expect(hasSelectedNativePanelImpersonation()).toBe(true);
  for(const patch of [{user_id:8},{asid:'other'},{impersonated_by:100},{auth_provider:'clerk'},{exp:1}]){
   safeLocalStorage.setItem('authToken',token(patch));expect(hasSelectedNativePanelImpersonation()).toBe(false);
  }
 });
 it('cannot select any API identity by itself and is cleared with the local session',()=>{
  selectNativePanelImpersonation({actorId:'7',lineageId:'synthetic-lineage',initiatedByActorId:'99'});
  expect(safeLocalStorage.getItem('authToken')).toBeNull();expect(safeLocalStorage.getItem('user')).toBeNull();
  safeLocalStorage.setItem('authToken',token());clearLocalChatbocSession();expect(hasSelectedNativePanelImpersonation()).toBe(false);
  expect(safeSessionStorage.getItem('chatbocNativeImpersonationSelection.v1')).toBeNull();
 });
});
