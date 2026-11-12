import type {SessionRetirementProof} from '@/utils/sessionRetirement';
export const retirementProof=(overrides:Partial<SessionRetirementProof>={}):SessionRetirementProof=>({
 contract_version:'chatboc.session_retirement.v1',actor_id:'7',provider:'native',lineage_id:'synthetic-lineage-a',clerk_session_id:null,
 expires_at:'2099-01-01T00:00:00Z',proof:'synthetic-proof-a',...overrides,
});
export const retirementReceipt=(overrides:Record<string,unknown>={})=>({
 contract_version:'chatboc.session_retirement_receipt.v1',status:'retired',lineage_id:'synthetic-lineage-a',local_revoked:true,
 provider_revocation:{status:'not_applicable'},...overrides,
});
