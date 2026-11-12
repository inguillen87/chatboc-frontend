export type CatalogImportPhase = 'upload' | 'save' | 'commit';
export interface CatalogImportUserError { title:string; message:string; action:string; retryable:boolean }
const record=(value:unknown):Record<string,unknown>=>value&&typeof value==='object'&&!Array.isArray(value)?value as Record<string,unknown>:{};
const statusOf=(error:unknown)=>{const row=record(error),body=record(row.body);const raw=row.status??body.status;const status=Number(raw);return Number.isFinite(status)?status:null;};
const reasonOf=(error:unknown)=>{const row=record(error),body=record(row.body);const raw=body.reason_code??row.reason_code;return typeof raw==='string'?raw.trim().toLowerCase():'';};
export function safeCatalogImportDetail(value:unknown,fallback:string):string {
  const text=typeof value==='string'?value.trim():'';
  if(!text||text.length>280||/[\p{Cc}\p{Cf}]/u.test(text))return fallback;
  if(/https?:\/\/|(?:stack|traceback|sql|select\s+|insert\s+|update\s+|delete\s+|exception|undefined|errno|econn|timeout\s*at)/i.test(text))return fallback;
  return text;
}
export function catalogImportUserError(error:unknown,phase:CatalogImportPhase):CatalogImportUserError {
  const status=statusOf(error),reason=reasonOf(error);
  if(status===401)return{title:'Sesión no válida',message:'No pudimos validar tu sesión para importar el catálogo.',action:'Volvé a ingresar y retomá la importación.',retryable:false};
  if(status===403)return{title:'Acceso no habilitado',message:'Tu cuenta no tiene permisos para modificar este catálogo.',action:'Pedile acceso a un administrador de la organización.',retryable:false};
  if(status===413)return{title:'Archivo demasiado grande',message:'El archivo supera el tamaño admitido para esta importación.',action:'Reducí el archivo o dividilo en partes y volvé a intentarlo.',retryable:true};
  if(status===415||reason.includes('format'))return{title:'Formato no compatible',message:'No pudimos interpretar el formato del archivo.',action:'Usá uno de los formatos admitidos y verificá que el archivo no esté dañado.',retryable:true};
  if(status===422||reason.includes('validation'))return{title:'El archivo necesita correcciones',message:'Encontramos datos que no se pueden confirmar todavía.',action:'Revisá la vista previa, las columnas obligatorias y los valores marcados.',retryable:true};
  if(status===429)return{title:'Demasiadas solicitudes',message:'La importación está temporalmente limitada.',action:'Esperá un momento antes de volver a intentarlo.',retryable:true};
  if(status!==null&&status>=500)return{title:'Importación temporalmente no disponible',message:'El servicio no pudo completar esta operación.',action:'Conservá el archivo y volvé a intentarlo más tarde.',retryable:true};
  if(phase==='commit')return{title:'No pudimos confirmar la importación',message:'No damos el catálogo por actualizado porque la confirmación no fue verificable.',action:'Revisá el catálogo antes de reintentar para evitar una importación duplicada.',retryable:false};
  if(phase==='save')return{title:'No pudimos guardar los cambios',message:'La vista previa no quedó confirmada como guardada.',action:'Revisá la conexión y volvé a guardar antes de confirmar la importación.',retryable:true};
  return{title:'No pudimos procesar el catálogo',message:'La importación no llegó a una vista previa verificable.',action:'Revisá el archivo e intentá nuevamente.',retryable:true};
}
