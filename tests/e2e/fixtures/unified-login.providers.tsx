import {readPublishedTenantIdentity} from '@/utils/publishedTenantIdentity';
import {useLocation} from 'react-router-dom';
import {usePanelSessionStore} from '@/stores';
export function useUser(){return {user:usePanelSessionStore(state=>state.user),setUser:usePanelSessionStore.getState().setUser,refreshUser:async()=>{},loading:false};}
export function useTenant(){
  const {pathname}=useLocation();const slug=/^\/t\/([^/]+)\/login/.exec(pathname)?.[1]||'previous-public-space';
  const publicRecord={id:1,slug,nombre:`Organización ${slug}`};
  return {currentSlug:slug,tenant:{...publicRecord,publishedIdentity:readPublishedTenantIdentity(publicRecord,slug)},isLoadingTenant:false,tenantError:null};
}
export const useDateSettings=()=>({locale:'es-AR',timezone:'America/Argentina/Buenos_Aires',updateSettings:()=>{}});
export default function OptionalIdentityButtons(){return null;}
export const isPasskeySupported=async()=>false;
export const loginPasskey=async()=>{throw new Error('External credentials are outside this fixture');};
export const getRubrosHierarchy=async()=>({});
export class DemoModeDisabledError extends Error {}
export const enterpriseService={getDemoCatalog:async()=>({enabled:false,rubros:[],entry_points:[],demos:[]})};
export const extractDemoFrontendContract=()=>({});
export const isSupportedDemoFrontendContract=()=>true;
export const createDemoSession=async()=>{throw new Error('No demo provisioning in this fixture');};
