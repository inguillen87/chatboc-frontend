import {beforeEach,describe,expect,it,vi} from 'vitest';
const login=vi.hoisted(()=>vi.fn());
vi.mock('@/api/panelLogin',()=>({loginPanelWithCredentials:login}));
import {completePanelCredentialLogin} from './completePanelCredentialLogin';
import {safeLocalStorage} from './safeLocalStorage';
import {usePanelSessionStore} from '@/stores';
import {advanceChatbocSessionRevision} from './sessionLogout';
import {captureSessionRetirement} from './sessionRetirement';
import {retirementProof} from '../../tests/fixtures/session-retirement.synthetic';
import {persistChatbocSession} from './clerkSession';
const account=()=>({token:'synthetic-new-token',user:{id:7,email:'qa@example.invalid',rol:'admin',tenant_slug:'organization-a'}});
const input=()=>({email:'qa@example.invalid',password:'fixture-only',pathname:'/login',search:'',isCurrent:()=>true,setUser:vi.fn()});
beforeEach(()=>{safeLocalStorage.clear();usePanelSessionStore.setState({authToken:null,user:null});login.mockReset().mockResolvedValue(account());});
describe('credential session commitment',()=>{
  it('replaces the old account instead of inheriting its role or organization details',async()=>{
    safeLocalStorage.setItem('user',JSON.stringify({id:9,tenant_slug:'previous',role:'superadmin',organization_profile:{name:'Old'}}));
    safeLocalStorage.setItem('entityToken','old-widget');safeLocalStorage.setItem('tenantSlug','previous');
    const request=input();const result=await completePanelCredentialLogin(request);
    expect(result.destination).toBe('/perfil');expect(result.user).toMatchObject({id:7,tenant_slug:'organization-a',role:'admin'});
    expect(result.user).not.toHaveProperty('organization_profile');expect(safeLocalStorage.getItem('entityToken')).toBeNull();
    expect(usePanelSessionStore.getState().authToken).toBe('synthetic-new-token');expect(request.setUser).toHaveBeenCalledOnce();
  });
  it('leaves the current account unchanged when the server rejects login',async()=>{
    safeLocalStorage.setItem('authToken','previous');login.mockRejectedValue({status:401});
    await expect(completePanelCredentialLogin(input())).rejects.toMatchObject({status:401});
    expect(safeLocalStorage.getItem('authToken')).toBe('previous');
  });
  it('registers native authority in memory without persisting the server proof in the profile',async()=>{
    login.mockResolvedValue({...account(),session_retirement:retirementProof()});
    await completePanelCredentialLogin({...input(),setUser:user=>usePanelSessionStore.getState().setUser(user as any)});
    expect(captureSessionRetirement('7')?.lineage_id).toBe('synthetic-lineage-a');
    expect(safeLocalStorage.getItem('user')).not.toContain('synthetic-proof-a');
  });
  it('cannot restore A when its successful login response finishes after B changes the generation',async()=>{
    let resolve!:(value:any)=>void;login.mockReturnValue(new Promise(r=>{resolve=r;}));const operation=completePanelCredentialLogin(input());
    advanceChatbocSessionRevision();usePanelSessionStore.getState().setAuthToken('synthetic-b');usePanelSessionStore.getState().setUser({id:'8'} as any);
    resolve({...account(),session_retirement:retirementProof()});await expect(operation).rejects.toMatchObject({name:'ObsoletePanelLogin'});
    expect(usePanelSessionStore.getState()).toMatchObject({authToken:'synthetic-b',user:{id:'8'}});
  });
  it('cannot overwrite a newly committed Clerk B with an older native A login response',async()=>{
    let resolve!:(value:any)=>void;login.mockReturnValue(new Promise(r=>{resolve=r;}));const operation=completePanelCredentialLogin(input());
    persistChatbocSession({contract_version:'auth.clerk.v1',token:'synthetic-clerk-b',auth_provider:'clerk',user:{id:8},
      session_retirement:retirementProof({actor_id:'8',provider:'clerk',clerk_session_id:'synthetic-sid-b',lineage_id:'synthetic-lineage-b'})} as any,'synthetic-clerk-b','tenant_owner','synthetic-sid-b');
    resolve({...account(),session_retirement:retirementProof()});await expect(operation).rejects.toMatchObject({name:'ObsoletePanelLogin'});
    expect(usePanelSessionStore.getState()).toMatchObject({authToken:'synthetic-clerk-b',user:{id:8}});
    expect(captureSessionRetirement('8')?.lineage_id).toBe('synthetic-lineage-b');
  });
});
