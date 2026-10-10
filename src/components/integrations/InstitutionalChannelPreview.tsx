import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { buildVerifiedSessionScopeKey } from '@/components/access/SessionAuthorityContext';
import InstitutionalChatMessage from '@/components/chat/InstitutionalChatMessage';
import { askWorkspace, loadWorkspace, type KnowledgeAnswer, type KnowledgeWorkspace } from '@/components/knowledge/institutionalAssistantContract';
import { institutionalChatActions, institutionalChatBootstrapPayload, isInstitutionalWorkspaceUnavailable, parseInstitutionalChatMessage, type InstitutionalChatMessage as InstitutionalMessage } from '@/features/chat/institutionalChatMessage';
import { useTenant } from '@/context/TenantContext';
import { useUser } from '@/hooks/useUser';
import { usePanelSessionStore } from '@/stores';
import type { SendPayload } from '@/types/chat';
import { normalizeProfileTenantSlug, readExplicitTenantRequest } from '@/utils/profileTenantAuthority';
import { captureChatbocSessionRevision, isChatbocSessionRevisionCurrent, subscribeChatbocSessionRevision } from '@/utils/chatbocSessionRevision';

type RequestContext = { slug: string; scopeKey: string; sessionRevision: number; panelGeneration: number; tenantId?: number };
type PreviewRead = { context: RequestContext; status: 'ready'; workspace: KnowledgeWorkspace; answer: InstitutionalMessage } |
  { context: RequestContext; status: 'loading' | 'legacy' | 'error' };

const actorAuthority = (value: unknown) => {
  const actor = value && typeof value === 'object' ? value as Record<string, unknown> : {};
  return JSON.stringify([actor.id, actor.user_id, actor.clerk_user_id, actor.sub, actor.email,
    actor.role, actor.rol, actor.permissions, actor.capabilities, actor.scopes, actor.tenantSlug, actor.tenant_slug]);
};

function readAnswer(answer: KnowledgeAnswer, slug: string): InstitutionalMessage {
  const message = parseInstitutionalChatMessage({
    fuente: 'institutional_knowledge', context_revision: answer.revision, knowledge_tenant: answer.tenant,
    knowledge_nodes: answer.nodes, knowledge_sources: answer.nodes.flatMap(node => node.sources),
    botones: institutionalChatActions(answer.nodes).map(action => ({ texto: action.label,
      action_id: `knowledge:${answer.revision.slice(0, 16)}:${action.target}` })),
  }, slug);
  if (!message) throw new Error('knowledge_preview_answer_invalid');
  return message;
}

/** Public, read-only knowledge is separate from the channel's draft and delivery state. */
export default function InstitutionalChannelPreview() {
  const { tenant: routeTenant } = useParams();
  const [searchParams] = useSearchParams();
  const { currentSlug, tenant: publicTenant, isLoadingTenant, tenantError } = useTenant();
  const { user, loading: userLoading, hasVerifiedSession, organizationProfileVerified } = useUser();
  const sessionRevision = useSyncExternalStore(subscribeChatbocSessionRevision, captureChatbocSessionRevision, captureChatbocSessionRevision);
  const headingId = useId();
  const [attempt, setAttempt] = useState(0);
  const [read, setRead] = useState<PreviewRead | null>(null);
  const [panelGeneration, setPanelGeneration] = useState(0);
  const panelGenerationRef = useRef(0);
  // Retire synchronous panel authority changes before React renders, including A→B→A in one batch.
  // Tokens are compared only in memory; they are never included in a scope key or rendered.
  useLayoutEffect(() => usePanelSessionStore.subscribe((next, previous) => {
    if (next.authToken !== previous.authToken || actorAuthority(next.user) !== actorAuthority(previous.user)) {
      panelGenerationRef.current += 1;
      setPanelGeneration(panelGenerationRef.current);
    }
  }), []);
  const explicit = readExplicitTenantRequest(searchParams);
  const routeSlug = normalizeProfileTenantSlug(routeTenant);
  const conflict = !explicit.valid || Boolean(routeTenant && !routeSlug) ||
    Boolean(routeSlug && explicit.slug && routeSlug !== explicit.slug);
  const slug = conflict ? null : routeSlug || explicit.slug || normalizeProfileTenantSlug(currentSlug);
  const identity = publicTenant?.publishedIdentity;
  const coherent = slug && currentSlug === slug && publicTenant?.slug === slug &&
    (!identity || identity.tenantSlug === slug) && !isLoadingTenant && !tenantError;
  const verified = !userLoading && organizationProfileVerified && coherent
    ? buildVerifiedSessionScopeKey({ hasVerifiedSession, tenantSlug: slug, user }) : null;
  const scopeKey = verified ? JSON.stringify([verified, actorAuthority(user), organizationProfileVerified, sessionRevision, panelGeneration, identity?.tenantId]) : null;
  const context = useMemo<RequestContext | null>(() => scopeKey && slug
    ? { slug, scopeKey, sessionRevision, panelGeneration, tenantId: identity?.tenantId } : null,
  [scopeKey, slug, sessionRevision, panelGeneration, identity?.tenantId, attempt]);
  const activeContext = useRef<RequestContext | null>(null);
  const activeNavigation = useRef<object | null>(null);
  const focusContext = useRef<RequestContext | null>(null);
  const responseContainer = useRef<HTMLDivElement>(null);
  const loadingMessage = useRef<HTMLParagraphElement>(null);
  const failureMessage = useRef<HTMLDivElement>(null);
  const isCurrent = (candidate: RequestContext) => activeContext.current === candidate &&
    candidate.panelGeneration === panelGenerationRef.current && isChatbocSessionRevisionCurrent(candidate.sessionRevision);

  useLayoutEffect(() => {
    activeContext.current = context;
    activeNavigation.current = null;
    return () => { activeContext.current = null; activeNavigation.current = null; focusContext.current = null; };
  }, [context]);

  useEffect(() => {
    if (!context) return;
    const request = new AbortController();
    let retired = false;
    const current = () => !retired && isCurrent(context);
    void loadWorkspace(context.slug, 'public', { signal: request.signal, isCurrent: current }).then(workspace => {
      if (!current()) return;
      if (context.tenantId !== undefined && workspace.tenant.id !== context.tenantId) throw new Error('knowledge_preview_identity_invalid');
      const answer = parseInstitutionalChatMessage(institutionalChatBootstrapPayload(workspace, context.slug), context.slug);
      if (!answer) throw new Error('knowledge_preview_initial_invalid');
      setRead({ context, status: 'ready', workspace, answer });
    }).catch(error => {
      if (current()) setRead({ context, status: isInstitutionalWorkspaceUnavailable(error) ? 'legacy' : 'error' });
    });
    return () => { retired = true; request.abort(); };
  }, [context]);

  const matching = context && read?.context === context ? read : null;
  useLayoutEffect(() => {
    if (!context || focusContext.current !== context || !matching || !isCurrent(context)) return;
    if (document.activeElement !== document.body && document.activeElement !== loadingMessage.current) {
      focusContext.current = null;
      return;
    }
    if (matching.status === 'loading') loadingMessage.current?.focus({ preventScroll: true });
    else {
      if (matching.status === 'ready') responseContainer.current?.querySelector<HTMLHeadingElement>('h3')?.focus({ preventScroll: true });
      else if (matching.status === 'error') failureMessage.current?.focus({ preventScroll: true });
      focusContext.current = null;
    }
  }, [context, matching]);
  const navigate = async (nodeId: string) => {
    if (!context || matching?.status !== 'ready' || !isCurrent(context) || activeNavigation.current) return;
    const navigation = {};
    activeNavigation.current = navigation;
    focusContext.current = document.activeElement?.hasAttribute('data-institutional-choice') ? context : null;
    const current = () => isCurrent(context) && activeNavigation.current === navigation;
    const workspace = matching.workspace;
    // Retire the preceding response, including its sources and options, while the read is pending.
    setRead({ context, status: 'loading' });
    try {
      const response = await askWorkspace(workspace, 'public', { node_id: nodeId });
      if (!current()) return;
      setRead({ context, status: 'ready', workspace, answer: readAnswer(response, context.slug) });
    } catch {
      if (current()) setRead({ context, status: 'error' });
    } finally {
      if (activeNavigation.current === navigation) activeNavigation.current = null;
    }
  };
  const select = (payload: SendPayload) => {
    if (matching?.status !== 'ready') return;
    const action = institutionalChatActions(matching.answer.nodes).find(choice =>
      payload.action_id === `knowledge:${matching.answer.revision.slice(0, 16)}:${choice.target}` && payload.text === choice.label);
    if (action) void navigate(action.target);
  };

  return <section aria-labelledby={headingId} className="min-w-0 rounded-xl border bg-card p-3 text-card-foreground sm:p-4">
    <h4 id={headingId} className="text-base font-semibold">Contenido del agente público</h4>
    <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
      Esta lectura muestra el contenido público de la organización; no verifica la entrega por el canal seleccionado.
    </p>
    {!context ? <p role={userLoading || isLoadingTenant ? 'status' : 'alert'} className="mt-4 text-sm leading-relaxed">
      {conflict ? 'La organización de la dirección no coincide. Revisá la URL para consultar su contenido público.'
        : userLoading || isLoadingTenant ? 'Verificando la organización y la sesión.'
          : 'Necesitamos una organización y una sesión verificadas para mostrar esta vista previa.'}
    </p> : !matching || matching.status === 'loading' ? <p ref={loadingMessage} tabIndex={-1} role="status" className="mt-4 text-sm">Consultando el contenido público de esta organización…</p>
      : matching.status === 'error' ? <div ref={failureMessage} tabIndex={-1} role="alert" className="mt-4 space-y-3 text-sm leading-relaxed">
        <p>No pudimos verificar el contenido público de esta organización. La respuesta, sus opciones y sus fuentes se retiraron.</p>
        <Button type="button" variant="outline" className="min-h-11" onClick={() => setAttempt(value => value + 1)}>Reintentar contenido público</Button>
      </div> : matching.status === 'legacy' ? <div role="status" className="mt-4 space-y-3 text-sm leading-relaxed">
        <p>No hay un menú institucional público disponible para esta organización.</p>
        <p>La simulación del canal muestra únicamente el borrador de prueba.</p>
        <Button type="button" variant="outline" className="min-h-11" onClick={() => setAttempt(value => value + 1)}>Volver a consultar contenido público</Button>
      </div> : <div ref={responseContainer} className="mt-4 min-w-0">
        <p className="break-words font-medium">{matching.workspace.tenant.name}</p>
        <p className="mt-1 text-sm text-muted-foreground">
          {matching.workspace.knowledge!.node_count} nodos · {matching.workspace.knowledge!.sources.length} fuentes
        </p>
        <InstitutionalChatMessage answer={matching.answer} onButtonClick={select} />
        {matching.answer.nodes[0].id !== matching.workspace.knowledge!.initial.id ?
          <Button type="button" data-institutional-choice variant="outline" className="min-h-11 h-auto whitespace-normal" onClick={() => void navigate(matching.workspace.knowledge!.initial.id)}>{matching.workspace.ui.home}</Button> : null}
      </div>}
  </section>;
}
