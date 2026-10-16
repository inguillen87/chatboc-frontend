import { useCallback, useEffect, useId, useMemo, useRef } from "react";
import { useInfiniteQuery, useQueryClient, type InfiniteData } from "@tanstack/react-query";

import { ApiError, apiFetch } from "@/utils/api";

export const CRM_PEOPLE_DIRECTORY_CONTRACT_VERSION = "crm.people.directory.v2";
export const CRM_PEOPLE_DIRECTORY_LIMIT = 50;
export const CRM_PEOPLE_PII_PERMISSION = "crm_contacts_pii_read";

export const CRM_PEOPLE_CHANNEL_FILTERS = [
  "all",
  "whatsapp",
  "email",
  "web",
  "widget",
  "voice",
  "unknown",
] as const;

export type CrmPeopleChannelFilter = (typeof CRM_PEOPLE_CHANNEL_FILTERS)[number];
export type CrmPeopleMarketingFilter = "all" | "true";

export interface CrmPeopleDirectoryItem {
  id: string;
  user_id?: number | null;
  contact_id?: string | null;
  name: string;
  email: string;
  phone: string;
  channel: string;
  marketing: boolean;
  tags: string[];
  last_seen: string | null;
  source: "user_contact" | "contact" | "user" | string;
  pii_masked: boolean;
  possible_duplicate: boolean;
}

export interface CrmPeopleDirectoryPage {
  contractVersion: typeof CRM_PEOPLE_DIRECTORY_CONTRACT_VERSION | "legacy.crm.clientes";
  items: CrmPeopleDirectoryItem[];
  legacyItems: Array<Record<string, unknown>>;
  page: {
    limit: number;
    total: number;
    has_more: boolean;
    next_cursor: string | null;
  };
  pii: {
    requested: boolean;
    masked: boolean;
    granted: boolean;
    permission: string | null;
    reason_code: string | null;
  };
}

export interface CrmPeopleDirectoryFilters {
  q: string;
  marketing: CrmPeopleMarketingFilter;
  channel: CrmPeopleChannelFilter;
}

interface FetchDirectoryPageOptions extends CrmPeopleDirectoryFilters {
  tenantSlug: string;
  cursor?: string | null;
  limit?: number;
}

export class CrmPeopleDirectoryContractError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CrmPeopleDirectoryContractError";
  }
}

const cleanString = (value: unknown): string => typeof value === "string" ? value.trim() : "";

const protectDirectoryItem = (item: CrmPeopleDirectoryItem): CrmPeopleDirectoryItem => {
  const contradictedMask = item.pii_masked !== true;
  return {
    ...item,
    user_id: null,
    contact_id: null,
    name: contradictedMask ? "Contacto protegido" : item.name,
    email: contradictedMask ? "Dato protegido" : item.email,
    phone: contradictedMask ? "" : item.phone,
    tags: [],
    pii_masked: true,
  };
};

const sanitizeLegacyDirectoryItem = (_value: Record<string, unknown>, index: number): Record<string, unknown> => ({
  id: `legacy-protected:${index + 1}`,
  name: "Contacto protegido",
  email: "Dato protegido",
  phone: "",
  channel: "unknown",
  marketing: false,
  tags: [],
  source: "legacy_directory",
  pii_masked: true,
  possible_duplicate: false,
});

const parseDirectoryItem = (value: unknown): CrmPeopleDirectoryItem => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new CrmPeopleDirectoryContractError("Persona 360 recibió un registro inválido.");
  }
  const record = value as Record<string, unknown>;
  const id = cleanString(record.id);
  if (!id) throw new CrmPeopleDirectoryContractError("Persona 360 recibió una persona sin identidad estable.");
  if (typeof record.pii_masked !== "boolean") {
    throw new CrmPeopleDirectoryContractError("Persona 360 no pudo verificar la política de datos personales.");
  }

  return {
    id,
    user_id: typeof record.user_id === "number" ? record.user_id : null,
    contact_id: cleanString(record.contact_id) || null,
    name: cleanString(record.name) || "Contacto protegido",
    email: cleanString(record.email),
    phone: cleanString(record.phone),
    channel: cleanString(record.channel) || "unknown",
    marketing: record.marketing === true,
    tags: Array.isArray(record.tags)
      ? record.tags.map(cleanString).filter(Boolean)
      : [],
    last_seen: cleanString(record.last_seen) || null,
    source: cleanString(record.source) || "unknown",
    pii_masked: record.pii_masked,
    possible_duplicate: record.possible_duplicate === true,
  };
};

export const parseCrmPeopleDirectoryPage = (value: unknown): CrmPeopleDirectoryPage => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new CrmPeopleDirectoryContractError("Persona 360 recibió una respuesta inválida.");
  }
  const payload = value as Record<string, unknown>;
  if (payload.contract_version !== CRM_PEOPLE_DIRECTORY_CONTRACT_VERSION) {
    throw new CrmPeopleDirectoryContractError("El backend no publicó crm.people.directory.v2.");
  }
  if (!Array.isArray(payload.items) || !payload.page || typeof payload.page !== "object" || Array.isArray(payload.page)) {
    throw new CrmPeopleDirectoryContractError("El directorio no publicó items y paginación verificables.");
  }
  const rawPage = payload.page as Record<string, unknown>;
  const limit = rawPage.limit as number;
  const total = rawPage.total as number;
  const hasMore = rawPage.has_more;
  const nextCursor = typeof rawPage.next_cursor === "string" && rawPage.next_cursor.trim() && rawPage.next_cursor === rawPage.next_cursor.trim() ? rawPage.next_cursor : null;
  if (!Number.isSafeInteger(limit) || limit < 1 || !Number.isSafeInteger(total) || total < 0 || typeof hasMore !== "boolean") {
    throw new CrmPeopleDirectoryContractError("El directorio publicó metadatos de paginación inválidos.");
  }
  if ((!hasMore && rawPage.next_cursor != null) || payload.items.length > limit || payload.items.length > total) {
    throw new CrmPeopleDirectoryContractError("El directorio publicó metadatos de paginación inválidos.");
  }
  if (hasMore && (!nextCursor || payload.items.length === 0 || payload.items.length >= total)) {
    throw new CrmPeopleDirectoryContractError("El directorio informó más personas sin publicar un cursor.");
  }
  if (!payload.pii || typeof payload.pii !== "object" || Array.isArray(payload.pii)) {
    throw new CrmPeopleDirectoryContractError("El directorio omitió la política de datos personales.");
  }
  const rawPii = payload.pii as Record<string, unknown>;
  if (
    typeof rawPii.requested !== "boolean"
    || typeof rawPii.masked !== "boolean"
    || typeof rawPii.granted !== "boolean"
  ) {
    throw new CrmPeopleDirectoryContractError("El directorio publicó una política de datos personales inválida.");
  }

  const parsedItems = payload.items.map(parseDirectoryItem);
  if (new Set(parsedItems.map(item=>item.id)).size !== parsedItems.length) {
    throw new CrmPeopleDirectoryContractError("Persona 360 recibió una persona sin identidad estable.");
  }
  const piiRequested = rawPii.requested;
  const pageMasked = rawPii.masked;
  const pageGranted = rawPii.granted;
  const permission = cleanString(rawPii.permission) || null;
  const reasonCode = cleanString(rawPii.reason_code) || null;
  if (permission !== CRM_PEOPLE_PII_PERMISSION) {
    throw new CrmPeopleDirectoryContractError("El directorio no publicó el permiso PII esperado.");
  }
  if (pageMasked === pageGranted) {
    throw new CrmPeopleDirectoryContractError("El directorio publicó una política de datos personales contradictoria.");
  }
  const fullPiiGranted = pageGranted === true && pageMasked === false;
  const maskedByDefault = piiRequested === false
    && pageMasked === true
    && pageGranted === false
    && reasonCode === "pii_masked_by_default";
  const permissionDenied = piiRequested === true
    && pageMasked === true
    && pageGranted === false
    && reasonCode === "pii_permission_required";
  const permissionGranted = piiRequested === true
    && fullPiiGranted
    && reasonCode === null;
  if (!maskedByDefault && !permissionDenied && !permissionGranted) {
    throw new CrmPeopleDirectoryContractError("El directorio publicó una matriz PII incoherente.");
  }
  if (fullPiiGranted && parsedItems.some((item) => item.pii_masked)) {
    throw new CrmPeopleDirectoryContractError("El directorio declaró PII completa con registros todavía enmascarados.");
  }

  return {
    contractVersion: CRM_PEOPLE_DIRECTORY_CONTRACT_VERSION,
    items: fullPiiGranted ? parsedItems : parsedItems.map(protectDirectoryItem),
    legacyItems: [],
    page: { limit, total, has_more: hasMore, next_cursor: nextCursor },
    pii: {
      requested: piiRequested,
      masked: pageMasked,
      granted: pageGranted,
      permission,
      reason_code: reasonCode,
    },
  };
};

export const buildLegacyCrmPeoplePath = ({
  tenantSlug,
  q,
  marketing,
}: Pick<FetchDirectoryPageOptions, "tenantSlug" | "q" | "marketing">): string => {
  const params = new URLSearchParams({ tenant_slug: tenantSlug, tenant: tenantSlug });
  if (q) params.set("q", q);
  if (marketing === "true") params.set("marketing", "true");
  return `/api/crm/clientes?${params.toString()}`;
};

const isRecord = (value:unknown):value is Record<string,unknown> => Boolean(value) && typeof value==='object' && !Array.isArray(value);
const validTenant = (value:string)=>/^[a-z0-9][a-z0-9_-]{0,127}$/.test(value);

function assertDirectoryScope(payload:unknown, expected:FetchDirectoryPageOptions) {
  if(!isRecord(payload)) throw new CrmPeopleDirectoryContractError("");
  const check=(row:Record<string,unknown>)=>{
    const slugs=[row.tenant_slug,row.tenantSlug];
    if(row.tenant!==undefined && row.tenant!==null){
      if(!isRecord(row.tenant))throw new CrmPeopleDirectoryContractError("");
      slugs.push(row.tenant.slug);
    }
    if(slugs.some(value=>value!==undefined && (typeof value!=='string'||value!==value.trim()||value.toLowerCase()!==expected.tenantSlug)))throw new CrmPeopleDirectoryContractError("");
  };
  check(payload);
  if(Array.isArray(payload.items))payload.items.forEach(row=>{if(isRecord(row))check(row);});
  // Optional echoes are checked, never fabricated or required from legacy servers.
  if(payload.filters!==undefined){
    if(!isRecord(payload.filters))throw new CrmPeopleDirectoryContractError("");
    for(const [key,value] of Object.entries({q:expected.q,marketing:expected.marketing,channel:expected.channel,sort:'recent_desc'})){
      if(payload.filters[key]!==undefined && payload.filters[key]!==value)throw new CrmPeopleDirectoryContractError("");
    }
  }
}

export function assertDirectoryContinuation(previous:readonly CrmPeopleDirectoryPage[], next:CrmPeopleDirectoryPage, cursor:string|null) {
  if(!cursor)return;
  const last=previous[previous.length-1];
  if(!last || !last.page.has_more || last.page.next_cursor!==cursor ||
    next.contractVersion!==last.contractVersion || next.page.limit!==last.page.limit ||
    JSON.stringify(next.pii)!==JSON.stringify(last.pii))throw new CrmPeopleDirectoryContractError("");
  const ids=new Set(previous.flatMap(page=>page.items.map(item=>item.id)));
  const cursors=new Set(previous.map(page=>page.page.next_cursor).filter(Boolean));
  if(next.items.some(item=>ids.has(item.id)) || (next.page.next_cursor&&cursors.has(next.page.next_cursor)) ||
    next.page.total<ids.size+next.items.length)throw new CrmPeopleDirectoryContractError("");
}

export const fetchCrmPeopleDirectoryPage = async ({
  tenantSlug,
  q,
  marketing,
  channel,
  cursor = null,
  limit = CRM_PEOPLE_DIRECTORY_LIMIT,
}: FetchDirectoryPageOptions): Promise<CrmPeopleDirectoryPage> => {
  if(!validTenant(tenantSlug)||!Number.isSafeInteger(limit)||limit<1||(cursor!==null && (typeof cursor!=='string'||!cursor||cursor!==cursor.trim())))throw new CrmPeopleDirectoryContractError("");
  const params = new URLSearchParams({
    limit: String(limit),
    marketing,
    channel,
    sort: "recent_desc",
  });
  if (q) params.set("q", q);
  if (cursor) params.set("cursor", cursor);

  try {
    const response = await apiFetch<unknown>(`/api/v2/crm/people?${params.toString()}`, { tenantSlug });
    assertDirectoryScope(response,{tenantSlug,q,marketing,channel,cursor,limit});
    const parsed=parseCrmPeopleDirectoryPage(response);
    if(parsed.page.limit!==limit || (cursor && parsed.page.next_cursor===cursor))throw new CrmPeopleDirectoryContractError("");
    return parsed;
  } catch (error) {
    if (!(error instanceof ApiError) || error.status !== 404 || cursor) throw error;
    const legacyItems = await apiFetch<Array<Record<string, unknown>>>(
      buildLegacyCrmPeoplePath({ tenantSlug, q, marketing }),
      { tenantSlug },
    );
    if (!Array.isArray(legacyItems)) {
      throw new CrmPeopleDirectoryContractError("El directorio heredado publicó una respuesta inválida.");
    }
    return {
      contractVersion: "legacy.crm.clientes",
      items: [],
      legacyItems: legacyItems.map(sanitizeLegacyDirectoryItem),
      page: {
        limit: legacyItems.length || limit,
        total: legacyItems.length,
        has_more: false,
        next_cursor: null,
      },
      pii: {
        requested: false,
        masked: true,
        granted: false,
        permission: null,
        reason_code: "legacy_directory_fallback",
      },
    };
  }
};

export const useCrmPeopleDirectory = ({tenantSlug,q,marketing,channel}:CrmPeopleDirectoryFilters & {tenantSlug?:string|null}) => {
  const tenant=cleanString(tenantSlug).toLowerCase(),search=q.trim();
  const canLoad=validTenant(tenant);
  const client=useQueryClient(),viewId=useId();
  const queryKey=useMemo(()=>['crm-people-directory-v2',tenant||'missing-tenant',search,marketing,channel,CRM_PEOPLE_DIRECTORY_LIMIT,viewId],[tenant,search,marketing,channel,viewId]);
  const scope=JSON.stringify(queryKey),active=useRef({scope,canLoad});
  active.current={scope,canLoad};
  const current=()=>active.current.scope===scope&&active.current.canLoad;
  // Each infinite fetch has its own signal and sequential page proof. A new
  // load-more chain starts from the currently accepted pages, not another view.
  const sequences=useRef(new WeakMap<AbortSignal,CrmPeopleDirectoryPage[]>());
  const empty=():InfiniteData<CrmPeopleDirectoryPage,string|null>=>({pages:[],pageParams:[]});
  useEffect(()=>{
    active.current={scope,canLoad};
    return ()=>{if(active.current.scope===scope)active.current={scope:'unmounted',canLoad:false};};
  },[scope,canLoad]);
  useEffect(()=>{
    if(!canLoad){void client.cancelQueries({queryKey,exact:true});client.removeQueries({queryKey,exact:true});}
    return ()=>{void client.cancelQueries({queryKey,exact:true});client.removeQueries({queryKey,exact:true});};
  },[client,queryKey,canLoad]);
  const query=useInfiniteQuery({
    queryKey,initialPageParam:null as string|null,enabled:canLoad,retry:0,gcTime:0,staleTime:30_000,
    refetchOnMount:'always',refetchOnWindowFocus:true,refetchInterval:false,
    queryFn:async({pageParam,signal})=>{
      if(!current())throw new Error();
      let preceding=sequences.current.get(signal);
      if(pageParam===null){
        preceding=[];client.setQueryData(queryKey,empty());
      }else if(!preceding){
        preceding=client.getQueryData<InfiniteData<CrmPeopleDirectoryPage>>(queryKey)?.pages??[];
      }
      try{
        const page=await fetchCrmPeopleDirectoryPage({tenantSlug:tenant,q:search,marketing,channel,cursor:pageParam,limit:CRM_PEOPLE_DIRECTORY_LIMIT});
        if(signal.aborted||!current())throw new Error();
        assertDirectoryContinuation(preceding??[],page,pageParam);
        sequences.current.set(signal,[...(preceding??[]),page]);
        return page;
      }catch(error){
        if(!signal.aborted&&current())client.setQueryData(queryKey,empty());
        const status=Number((error as {status?:unknown})?.status);
        throw Object.assign(new Error(),Number.isInteger(status)?{status}:{});
      }
    },
    getNextPageParam:(last)=>last.page.has_more?last.page.next_cursor??undefined:undefined,
  });
  const data=canLoad&&!query.isError?query.data:undefined;
  const sanitize=(result:Awaited<ReturnType<typeof query.refetch>>)=>({...result,data:current()&&result.isSuccess?result.data:undefined,hasNextPage:current()&&result.isSuccess&&Boolean(result.data?.pages.at(-1)?.page.has_more && result.data.pages.at(-1)?.page.next_cursor)});
  const refetch=useCallback(async()=>{
    if(!current())return {data:undefined,hasNextPage:false};
    return sanitize(await query.refetch({cancelRefetch:false}));
  },[scope,canLoad,query.refetch]);
  const fetchNextPage=useCallback(async()=>{
    if(!current()||!query.hasNextPage||query.isError)return {data:undefined,hasNextPage:false};
    return sanitize(await query.fetchNextPage({cancelRefetch:false}));
  },[scope,canLoad,query.fetchNextPage,query.hasNextPage,query.isError]);
  return {...query,data,refetch,fetchNextPage,isSuccess:canLoad&&!query.isError&&Boolean(data?.pages.length),hasNextPage:canLoad&&!query.isError&&Boolean(query.hasNextPage),
    isPending:canLoad&&(query.isPending||(query.isFetching&&!data?.pages.length)),
    error:canLoad?query.error:null};
};
