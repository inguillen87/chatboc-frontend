import React from 'react';
import {readLogoutNotice,subscribeLogoutNotice} from '@/utils/sessionRetirement';

export function SessionRetirementNotice(){
 const notice=React.useSyncExternalStore(subscribeLogoutNotice,readLogoutNotice,()=>null);
 if(!notice)return null;
 const message=notice.status==='pending'?'Saliste de este dispositivo. Estamos confirmando el cierre de la sesión anterior.'
  :notice.status==='unavailable'||notice.status==='uncertain'?'Saliste de este dispositivo. No pudimos confirmar el cierre de la sesión anterior en el servidor.'
  :notice.providerStatus==='pending'||notice.providerStatus==='failed'?'La sesión de ChatBoc se cerró. El cierre en tu proveedor de acceso todavía no está confirmado.'
  :'La sesión anterior se cerró.';
 return <p role="status" className="rounded-lg border p-3 text-sm leading-relaxed">{message}</p>;
}
