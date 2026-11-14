import React from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { apiFetch } from '@/utils/api';
import { advanceChatbocSessionRevision } from '@/utils/chatbocSessionRevision';
import UsuariosPage, { normalizeDirectoryPerson, normalizeUsuario, upsertCrmContactByIdentity } from './UsuariosPage';

type PendingActivity = {
  path: string;
  options: { tenantSlug?: string | null; isCurrent?: () => boolean };
  promise: Promise<unknown>;
  resolve: (value: unknown) => void;
  reject: (error: Error) => void;
};

// The caller and its React state are real. Only HTTP, identity/role, directory,
// socket and the surrounding workspace are explicit synthetic boundaries.
const activityFixture = vi.hoisted(() => ({
  user: { id: 11, rol: 'tenant_admin', tenantSlug: 'org-a' },
  requests: [] as PendingActivity[],
  renders: [] as Array<{ tenant: string; text: string }>,
  noop: vi.fn(),
}));

vi.mock('react-router-dom', async () => await vi.importActual('react-router-dom'));
vi.mock('@/utils/api', () => ({ apiFetch: vi.fn(), getErrorMessage: (_error: unknown, fallback: string) => fallback }));
vi.mock('@/hooks/useUser', () => ({ useUser: () => ({ user: activityFixture.user }) }));
vi.mock('@/hooks/useRequireRole', () => ({ default: () => undefined }));
vi.mock('@/context/SocketContext', () => ({ useSocket: () => ({ socket: null, isConnected: false }) }));
vi.mock('@/utils/tenant', () => ({ getTenant: ({ userTenant }: { userTenant?: string | null }) => userTenant ?? null }));
vi.mock('@/components/admin/CampaignPreparationPanel', () => ({ default: () => null }));
vi.mock('@/features/crm/people/useCrmPeopleDirectory', () => ({
  useCrmPeopleDirectory: () => ({ data: { pages: [] }, isPending: false, error: null,
    refetch: activityFixture.noop, fetchNextPage: activityFixture.noop,
    hasNextPage: false, isFetchingNextPage: false }),
}));
vi.mock('@/features/crm/people/useCrmWorkspaceState', () => ({
  useDebouncedValue: <T,>(value: T) => value,
  useCrmWorkspaceState: () => ({ activeView: 'actividad', selectedContactId: null,
    peopleQueueView: 'all', peopleSort: 'recent', peopleSearch: '',
    peopleMarketingOnly: false, peopleChannel: 'all',
    setActiveView: activityFixture.noop, setSelectedContactId: activityFixture.noop,
    setPeopleQueueView: activityFixture.noop, setPeopleSort: activityFixture.noop,
    setPeopleSearch: activityFixture.noop, setPeopleMarketingOnly: activityFixture.noop,
    setPeopleChannel: activityFixture.noop }),
}));
vi.mock('@/features/crm/people/CrmPeopleWorkspace', () => ({
  default: function ActivityWorkspaceProbe(props: { tenantSlug: string; activityPanel: React.ReactNode; onRefresh: () => void }) {
    const ref = React.useRef<HTMLDivElement>(null);
    React.useLayoutEffect(() => {
      activityFixture.renders.push({ tenant: props.tenantSlug, text: ref.current?.textContent ?? '' });
    });
    return React.createElement('div', { ref },
      React.createElement('button', { onClick: props.onRefresh }, 'Synthetic refresh'), props.activityPanel);
  },
}));

const rawContact = {
  id: 'contact:score-evidence-synthetic', contact_id: 'score-evidence-synthetic',
  name: 'Contacto de prueba', phone: '+15555550101', channel: 'whatsapp',
};

describe('CRM stored score evidence', () => {
  it('keeps missing, null, blank and invalid evidence unknown instead of assigning zero', () => {
    expect(normalizeUsuario(rawContact, 0).leadScore).toBeUndefined();
    for (const value of [null, undefined, '', '  ', false, true, {}, [], 'not-a-score', NaN, Infinity, -Infinity]) {
      expect(normalizeUsuario({ ...rawContact, lead_score: value }, 0).leadScore).toBeUndefined();
    }
  });

  it('preserves an explicit zero and other finite stored numbers without calculating a new score', () => {
    for (const value of [0, 55, 85, 87.5]) {
      expect(normalizeUsuario({ ...rawContact, lead_score: value }, 0).leadScore).toBe(value);
    }
    expect(normalizeUsuario({ ...rawContact, lead_score: '0' }, 0).leadScore).toBe(0);
    expect(normalizeUsuario({ ...rawContact, lead_score: '85' }, 0).leadScore).toBe(85);
  });

  it('keeps the existing camel-case transport alias and canonical field precedence', () => {
    expect(normalizeUsuario({ ...rawContact, leadScore: 55 }, 0).leadScore).toBe(55);
    expect(normalizeUsuario({ ...rawContact, lead_score: 0, leadScore: 85 }, 0).leadScore).toBe(0);
    for (const canonical of [null, undefined, '', '  ', false, 'invalid']) {
      expect(normalizeUsuario({ ...rawContact, lead_score: canonical, leadScore: 85 }, 0).leadScore).toBeUndefined();
    }
    expect(normalizeUsuario({ ...rawContact, leadTemperature: 'hot' }, 0).leadTemperature).toBe('hot');
    for (const canonical of [null, undefined, '', '  ']) {
      expect(normalizeUsuario({ ...rawContact, lead_temperature: canonical, leadTemperature: 'hot' }, 0).leadTemperature).toBeNull();
    }
    expect(normalizeUsuario({ ...rawContact, marketing: true }, 0).marketing).toBe(true);
    expect(normalizeUsuario({ ...rawContact, opt_in_marketing: true }, 0).marketing).toBe(true);
    for (const canonical of [null, undefined, false]) {
      expect(normalizeUsuario({ ...rawContact, acepta_marketing: canonical, marketing: true, opt_in_marketing: true }, 0).marketing).toBe(false);
    }
    expect(normalizeUsuario({ ...rawContact, marketing: null, opt_in_marketing: true }, 0).marketing).toBe(false);
  });

  it('does not reintroduce zero through the canonical directory adapter or realtime identity upsert', () => {
    const person = normalizeDirectoryPerson({
      id: rawContact.id, contact_id: rawContact.contact_id, user_id: null,
      name: rawContact.name, email: '', phone: rawContact.phone, channel: 'whatsapp',
      marketing: false, tags: [], last_seen: null, source: 'contact', pii_masked: false,
      possible_duplicate: false,
    }, 0);
    expect(person.leadScore).toBeUndefined();
    const updated = upsertCrmContactByIdentity([], normalizeUsuario(rawContact, 0));
    expect(updated).toHaveLength(1);
    expect(updated[0].leadScore).toBeUndefined();
    expect(JSON.parse(JSON.stringify(updated[0]))).not.toHaveProperty('leadScore');
  });

  it('preserves explicit classification and marketing values while missing score remains unknown', () => {
    const person = normalizeUsuario({ ...rawContact, lead_score: null,
      lead_temperature: 'hot', acepta_marketing: true }, 0);
    expect(person.leadScore).toBeUndefined();
    expect(person.leadTemperature).toBe('hot');
    expect(person.marketing).toBe(true);
    expect(normalizeUsuario({ ...rawContact, acepta_marketing: false }, 0).marketing).toBe(false);
    expect(normalizeUsuario({ ...rawContact, lead_temperature: null }, 0).leadTemperature).toBeNull();
  });
});

describe('CRM activity belongs to its current organization and session', () => {
  let warning: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    activityFixture.user = { id: 11, rol: 'tenant_admin', tenantSlug: 'org-a' };
    activityFixture.requests = [];
    activityFixture.renders = [];
    warning = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    vi.mocked(apiFetch).mockReset();
    vi.mocked(apiFetch).mockImplementation(<T,>(path: string, options = {}) => {
      let resolve!: (value: unknown) => void;
      let reject!: (error: Error) => void;
      const promise = new Promise<T>((accept, fail) => { resolve = (value) => accept(value as T); reject = fail; });
      activityFixture.requests.push({ path, options, promise, resolve, reject });
      return promise;
    });
  });

  afterEach(() => { cleanup(); warning.mockRestore(); });

  const page = (tenant: string) => React.createElement(MemoryRouter,
    { future: { v7_startTransition: true, v7_relativeSplatPath: true } },
    React.createElement(UsuariosPage, { tenantSlugOverride: tenant, embedded: true }));
  const batch = (offset: number) => activityFixture.requests.slice(offset, offset + 3);
  const settled = async (requests: PendingActivity[], label: string, rejected = false) => {
    expect(requests).toHaveLength(3);
    await act(async () => {
      for (const request of requests) {
        if (rejected) request.reject(new Error(`synthetic-${label}`));
        else request.resolve({ items: request.path.includes('/history')
          ? [{ campaign_id: label, message_preview: `${label}-history`, channel: 'whatsapp', contacts_count: 1 }]
          : request.path.includes('/ledger')
            ? [{ id: label, contact: { name: `${label}-ledger` }, status: 'sent' }]
            : [{ id: label, recipient: `${label}-notification`, status: 'sent' }] });
      }
      await Promise.allSettled(requests.map((request) => request.promise));
    });
  };
  const expectNoLabelInRenders = (tenant: string, label: string, after = 0) => {
    const renders = activityFixture.renders.slice(after).filter((value) => value.tenant === tenant);
    expect(renders.length).toBeGreaterThan(0);
    expect(renders.every((value) => !value.text.includes(label))).toBe(true);
  };

  it('hides loaded A data in the first B commit and keeps it hidden when B fails', async () => {
    const view = render(page('org-a'));
    await waitFor(() => expect(activityFixture.requests).toHaveLength(3));
    await settled(batch(0), 'A-private');
    expect(screen.getByText('A-private-ledger')).toBeInTheDocument();
    view.rerender(page('org-b'));
    expectNoLabelInRenders('org-b', 'A-private');
    await waitFor(() => expect(activityFixture.requests).toHaveLength(6));
    await settled(batch(3), 'B-rejected', true);
    expect(screen.queryByText('A-private-ledger')).not.toBeInTheDocument();
    expect(screen.queryByText('A-private-notification')).not.toBeInTheDocument();
    expect(screen.queryByText('A-private-history')).not.toBeInTheDocument();
    expectNoLabelInRenders('org-b', 'A-private');
  });

  it.each(['resolve', 'reject'])('retires late A %s including its finally while B is loading', async (outcome) => {
    const view = render(page('org-a'));
    await waitFor(() => expect(activityFixture.requests).toHaveLength(3));
    const old = batch(0);
    view.rerender(page('org-b'));
    await waitFor(() => expect(activityFixture.requests).toHaveLength(6));
    expect(screen.getByText('Cargando actividad operativa...')).toBeInTheDocument();
    await settled(old, 'A-retired', outcome === 'reject');
    expect(screen.getByText('Cargando actividad operativa...')).toBeInTheDocument();
    expectNoLabelInRenders('org-b', 'A-retired');
    expect(warning.mock.calls.filter(([message]) => String(message).startsWith('No se pudo cargar actividad'))).toHaveLength(0);
    await settled(batch(3), 'B-current');
    expect(screen.getByText('B-current-ledger')).toBeInTheDocument();
    expect(old.every((request) => request.options.isCurrent?.() === false)).toBe(true);
  });

  it('keeps the newer refresh when an older request for the same organization finishes later', async () => {
    render(page('org-a'));
    await waitFor(() => expect(activityFixture.requests).toHaveLength(3));
    const old = batch(0);
    fireEvent.click(screen.getByRole('button', { name: 'Synthetic refresh' }));
    await waitFor(() => expect(activityFixture.requests).toHaveLength(6));
    await settled(batch(3), 'A-new');
    await settled(old, 'A-old');
    expect(screen.getByText('A-new-ledger')).toBeInTheDocument();
    expect(screen.queryByText('A-old-ledger')).not.toBeInTheDocument();
  });

  it('does not readmit a pending old A request after committed A to B to A navigation', async () => {
    const view = render(page('org-a'));
    await waitFor(() => expect(activityFixture.requests).toHaveLength(3));
    const old = batch(0);
    view.rerender(page('org-b'));
    await waitFor(() => expect(activityFixture.requests).toHaveLength(6));
    view.rerender(page('org-a'));
    await waitFor(() => expect(activityFixture.requests).toHaveLength(9));
    const returnRender = activityFixture.renders.length;
    await settled(old, 'A-old-generation');
    expect(screen.getByText('Cargando actividad operativa...')).toBeInTheDocument();
    expect(screen.queryByText('A-old-generation-ledger')).not.toBeInTheDocument();
    await settled(batch(6), 'A-current-generation');
    expect(screen.getByText('A-current-generation-ledger')).toBeInTheDocument();
    expectNoLabelInRenders('org-a', 'A-old-generation', returnRender);
  });

  it.each(['actor', 'session'])('retires loaded activity when the %s changes within the same organization', async (change) => {
    const view = render(page('org-a'));
    await waitFor(() => expect(activityFixture.requests).toHaveLength(3));
    await settled(batch(0), 'previous-identity');
    expect(screen.getByText('previous-identity-ledger')).toBeInTheDocument();
    const previousRender = activityFixture.renders.length;
    if (change === 'actor') {
      activityFixture.user = { ...activityFixture.user, id: 22 };
      view.rerender(page('org-a'));
    } else act(() => { advanceChatbocSessionRevision(); });
    expectNoLabelInRenders('org-a', 'previous-identity', previousRender);
    await waitFor(() => expect(activityFixture.requests).toHaveLength(6));
    await settled(batch(3), 'current-identity');
    expect(screen.getByText('current-identity-ledger')).toBeInTheDocument();
  });
});
