// Session and unrelated-panel test boundary. apiFetch resolves to the real module.
import React from 'react';
export const useTenant=()=>({currentSlug:'qa-knowledge',tenant:{id:701,slug:'qa-knowledge',nombre:'Institución de prueba'}});
export const useUser=()=>({loading:false,hasVerifiedSession:true,user:{id:701,rol:'tenant_admin',tenant_slug:'qa-knowledge'}});
export default function UnrelatedProvisioningPanel(){return null;}
// Other lazy routes are scanned but not mounted; preserve their original exports.
export {TenantProvider,useTenantContextPresence} from '../../../src/context/TenantContext';
