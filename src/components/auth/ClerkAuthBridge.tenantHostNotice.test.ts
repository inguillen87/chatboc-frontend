import {describe,expect,it,vi} from 'vitest';
vi.mock('@clerk/clerk-react',()=>({useAuth:()=>({}),useUser:()=>({}),useClerk:()=>({})}));
import {isForeignPlatformSessionOnTenantHost} from './ClerkAuthBridge';

describe('platform session refused on an organization address',()=>{
  const refused='Clerk session authorized party is not allowed';
  it('is not announced to someone reading the organization portal',()=>{
    expect(isForeignPlatformSessionOnTenantHost(refused,'tdf.chatboc.ar')).toBe(true);
  });
  it('is still announced on the platform and for any other failure',()=>{
    expect(isForeignPlatformSessionOnTenantHost(refused,'www.chatboc.ar')).toBe(false);
    expect(isForeignPlatformSessionOnTenantHost('No pudimos validar la sesión.','tdf.chatboc.ar')).toBe(false);
  });
});
