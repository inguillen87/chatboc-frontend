import type {OmnichannelInboxItem} from '@/api/v2/saas';
import type {Ticket} from '@/types/tickets';
const identifier=(value:unknown)=>{const valueText=String(value??'').trim();if(!/^(?:0|[1-9]\d*)$/.test(valueText))return null;const numeric=Number(valueText);return Number.isSafeInteger(numeric)?numeric:null;};
const text=(value:unknown)=>typeof value==='string'&&value.trim()?value.trim():null;
export function inboxAssignmentTicket(item:OmnichannelInboxItem):Ticket|null{
 const id=identifier(item.ticket_id??item.id),sourceModel=text(item.source_model),tenantSlug=text(item.tenant_slug);if(id===null||!sourceModel||!tenantSlug)return null;
 const assignee=item.assignee||{};const assigneeId=assignee.id??assignee.user_id??assignee.assignee_id??assignee.assigned_user_id;
 return {id,tipo:sourceModel.toLowerCase().includes('pyme')?'pyme':'municipio',nro_ticket:text(item.nro_ticket)||String(id),asunto:text(item.title)||('Caso '+id),estado:item.status as Ticket['estado'],fecha:text(item.lastMessageAt)||new Date(0).toISOString(),categoria:text(item.category)||undefined,source_model:sourceModel,tenant_slug:tenantSlug,assignedAgentId:assigneeId as string|number|undefined,assigned_agent_id:assigneeId as string|number|undefined,assigned_user_id:assigneeId as string|number|undefined,channel:(text(item.channel)||undefined) as Ticket['channel']};
}
