import {beforeEach,describe,expect,it,vi} from 'vitest';
const login=vi.hoisted(()=>vi.fn());
vi.mock('@/api/panelLogin',()=>({loginPanelWithCredentials:login}));
import {completePanelCredentialLogin} from './completePanelCredentialLogin';
import {safeLocalStorage} from './safeLocalStorage';
import {usePanelSessionStore} from '@/stores';
import {advanceChatbocSessionRevision} from './sessionLogout';
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
});
