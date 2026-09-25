import React,{createContext,useContext} from 'react';
// Synthetic providers only. The page and section recovery component are unmodified imports.
export const scenario={broken:true,mode:'success' as 'success'|'reject',ticketMounts:0};
export const IdentityContext=createContext('org-a');
export const useTenant=()=>({currentSlug:useContext(IdentityContext)});
export const useUser=()=>({user:{id:7,rol:'admin',tenant_slug:useContext(IdentityContext)}});
export const useCapabilities=()=>({capabilities:['tickets.read'],hasAnyCapability:()=>true});
export const resolveTenantSlug=(override:unknown)=>typeof override==='string'?override:null;
export const apiClient={getIdentityCoverage:async()=>({alert_count:0})};
export const trackFrontendEvent=()=>{};
export const TicketProvider=({children}:{children:React.ReactNode})=><>{children}</>;
export default function TicketContent(){
  const slug=useContext(IdentityContext);
  if(scenario.broken)throw new Error('synthetic-section-failure');
  return <section aria-label="Reclamos de prueba"><h2>Reclamos recuperados</h2><p>Organización: {slug}</p></section>;
}
