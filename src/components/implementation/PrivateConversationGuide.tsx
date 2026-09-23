import React from 'react';
import { BookOpen, ChevronRight } from 'lucide-react';
import { apiFetch } from '@/utils/api';
import { readGuideAccess, readPrivateGuide, type GuideAccess, type PrivateGuide } from '@/utils/privateConversationGuide';
import ConversationMenu from '@/features/evaluation/ConversationMenu';
import '@/features/evaluation/evaluation.css';
import styles from './PrivateConversationGuide.module.css';

export default function PrivateConversationGuide({ value, tenant, disabled = false }: {
  value: unknown; tenant: { id: number; slug: string }; disabled?: boolean;
}) {
  const access = readGuideAccess(value, tenant);
  return access && !disabled ? <Guide key={`${tenant.id}:${tenant.slug}:${access.guide_id}`} access={access} /> : null;
}

function Guide({ access }: { access: GuideAccess }) {
  const [open, setOpen] = React.useState(false);
  const [guide, setGuide] = React.useState<PrivateGuide | null>(null);
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState(false);
  const active = React.useRef(false);
  const generation = React.useRef(0);
  const heading = React.useRef<HTMLHeadingElement>(null);
  React.useEffect(() => () => { ++generation.current; }, []);
  React.useEffect(() => { if (guide) heading.current?.focus(); }, [guide]);
  const choose = async (node = 'start', selection?: string) => {
    if (active.current) return;
    active.current = true;
    const current = ++generation.current;
    setOpen(true); setPending(true); setError(false); setGuide(null);
    const query = new URLSearchParams({ node });
    if (selection !== undefined) query.set('selection', selection);
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      const raw = await Promise.race([
        apiFetch<unknown>(`${access.endpoint}?${query}`, { tenantSlug: access.tenant.slug, persistTenantSlug: false,
          cache: 'no-store' }),
        new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error('guide_timeout')), 15000); }),
      ]);
      if (current !== generation.current) return;
      const result = readPrivateGuide(raw, access);
      if (!result) throw new Error('guide_invalid');
      setGuide(result);
    } catch {
      if (current === generation.current) { setGuide(null); setError(true); }
    } finally {
      clearTimeout(timer);
      if (current === generation.current) { active.current = false; setPending(false); }
    }
  };
  const ui = guide?.ui || access.ui;
  return <section className={styles.guide} aria-label={access.ui.heading} data-testid="private-conversation-guide">
    <header className={styles.intro}><BookOpen size={22} aria-hidden="true" /><div><h3>{access.ui.heading}</h3><p>{access.ui.description}</p></div></header>
    {!open ? <button type="button" className={styles.open} onClick={() => void choose()}>{ui.open}<ChevronRight size={18} aria-hidden="true" /></button> : <>
      <div className={styles.toolbar}>
        <button type="button" onClick={() => void choose('start')} disabled={pending}>{ui.start}</button>
        <button type="button" onClick={() => void choose('main')} disabled={pending}>{ui.back_to_menu}</button>
      </div>
      {pending ? <p role="status">{ui.loading}</p> : null}
      {error ? <p role="alert">{ui.error}</p> : null}
      {guide ? <ConversationMenu menu={guide.menu} busy={pending} headingRef={heading} onChoose={(node, choice) => void choose(node, choice)} /> : null}
    </>}
  </section>;
}
