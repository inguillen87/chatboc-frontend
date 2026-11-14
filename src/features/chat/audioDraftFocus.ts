import { useCallback, useLayoutEffect, useRef } from 'react';
import { subscribeChatbocSessionRevision } from '@/utils/chatbocSessionRevision';

type FocusTarget = () => HTMLElement | null | undefined;

/**
 * Keyboard exit for the in-memory audio draft panel.
 *
 * When the person explicitly discards the retained recording, or explicitly checks the send and it
 * is confirmed, the panel that held their focus disappears. Without help the browser drops focus on
 * the document, and keyboard and screen-reader users lose their place in the composer.
 *
 * Focus is returned only for that explicit action on that same recording. A draft retired by a
 * scope, session or capability change never moves focus: the next identity must not inherit a
 * focused control from the previous one, and focus the person moved elsewhere is never taken.
 */
export function useAudioDraftFocusExit(draft: Blob | null, scopeKey: string, targets: FocusTarget[]) {
  const explicit = useRef<Blob | null>(null);
  const previous = useRef<Blob | null>(null);
  const scope = useRef(scopeKey);
  const targetList = useRef(targets);
  targetList.current = targets;
  // Invalidate at render so an exit requested for the previous scope cannot act on the next one.
  if (scope.current !== scopeKey) { scope.current = scopeKey; explicit.current = null; }
  useLayoutEffect(() => subscribeChatbocSessionRevision(() => { explicit.current = null; }), []);
  useLayoutEffect(() => {
    const retired = previous.current;
    previous.current = draft;
    if (!retired || draft) return;
    const owned = explicit.current === retired;
    explicit.current = null;
    if (!owned || typeof document === 'undefined') return;
    const active = document.activeElement;
    if (active && active !== document.body && active.isConnected) return;
    for (const resolve of targetList.current) {
      const element = resolve();
      if (!element || !element.isConnected || element.matches(':disabled')) continue;
      element.focus({ preventScroll: true });
      return;
    }
  }, [draft]);
  /** Call from the explicit Discard or Retry action of this recording, before it is retired. */
  return useCallback((recording: Blob) => { explicit.current = recording; }, []);
}
