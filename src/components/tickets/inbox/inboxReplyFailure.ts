import {ApiError} from '@/utils/api';

export interface InboxReplyFailure {
  kind:'ambiguous'|'rejected';
  title:string;
  message:string;
  action:string;
}
export function inboxReplyFailure(error:unknown):InboxReplyFailure {
  const status=error instanceof ApiError?error.status:Number((error as {status?:unknown})?.status);
  const ambiguous=!(Number.isFinite(status))||status>=500||[408,425,429].includes(status);
  if(ambiguous)return{
    kind:'ambiguous',
    title:'Entrega por confirmar',
    message:'No pudimos confirmar si el proveedor recibió esta respuesta. El borrador se conserva.',
    action:'Revisá el historial antes de reintentar. Si repetís el mismo texto, ChatBoc reutiliza el identificador del intento para evitar duplicados.',
  };
  return{
    kind:'rejected',
    title:'Respuesta no enviada',
    message:'El servidor rechazó este intento y el borrador se conserva.',
    action:status===403?'Verificá tus permisos antes de volver a intentar.':'Corregí el problema indicado por el caso y volvé a intentar cuando corresponda.',
  };
}
