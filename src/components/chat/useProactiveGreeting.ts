import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type RefObject } from 'react';

export type ProactiveGreetingMessage = { text: string; action?: string; payload?: unknown };

const isExternalEditor = (target: EventTarget | null, container: HTMLElement | null) =>
  target instanceof HTMLElement && !container?.contains(target) && Boolean(
    target.matches('textarea,select,input:not([type="hidden"]):not([type="button"]):not([type="submit"]):not([type="reset"]):not([type="image"])') ||
    target.closest('[contenteditable]:not([contenteditable="false"])'),
  );

export function useProactiveGreeting({
  scopeKey, bindingKey, messages, ready, isOpen, isMobile, containerRef, initialDelay,
}: {
  scopeKey: string;
  bindingKey: string;
  messages: ProactiveGreetingMessage[];
  ready: boolean;
  isOpen: boolean;
  isMobile: boolean;
  containerRef: RefObject<HTMLElement>;
  initialDelay: number;
}) {
  // Dismissal lasts for this widget mount, organization and published messages.
  // It never writes a shared browser flag or dismisses another organization.
  const contentKey = JSON.stringify(messages);
  const dismissalKey = JSON.stringify([scopeKey, contentKey]);
  const [dismissed, setDismissed] = useState(() => new Set<string>());
  const [externalEditorFocused, setExternalEditorFocused] = useState(false);
  useEffect(() => {
    if (!isMobile) { setExternalEditorFocused(false); return; }
    const update = (target: EventTarget | null) => setExternalEditorFocused(isExternalEditor(target, containerRef.current));
    const onFocus = (event: FocusEvent) => update(event.target);
    const onBlur = (event: FocusEvent) => update(event.relatedTarget);
    update(document.activeElement);
    document.addEventListener('focusin', onFocus);
    document.addEventListener('focusout', onBlur);
    return () => {
      document.removeEventListener('focusin', onFocus);
      document.removeEventListener('focusout', onBlur);
    };
  }, [isMobile, containerRef]);

  const eligible = ready && !isOpen && messages.length > 0 && !externalEditorFocused && !dismissed.has(dismissalKey);
  const owner = useMemo(() => ({ dismissalKey, bindingKey, eligible }), [dismissalKey, bindingKey, eligible]);
  const activeOwner = useRef<typeof owner | null>(null);
  const interacting = useRef(false);
  const [shown, setShown] = useState<{ owner: typeof owner; message: ProactiveGreetingMessage } | null>(null);
  useLayoutEffect(() => {
    activeOwner.current = owner;
    interacting.current = false;
    return () => { if (activeOwner.current === owner) activeOwner.current = null; };
  }, [owner]);

  useEffect(() => {
    if (!eligible) { setShown(null); return; }
    let timer: ReturnType<typeof setTimeout>;
    let index = 0;
    let retired = false;
    const isCurrent = () => !retired && activeOwner.current === owner;
    const showNext = () => {
      if (!isCurrent()) return;
      setShown({ owner, message: messages[index] });
      const hide = () => {
        if (!isCurrent()) return;
        // Do not remove a native control while it owns focus or pointer hover.
        if (interacting.current) { timer = setTimeout(hide, 250); return; }
        setShown(null);
        index = (index + 1) % messages.length;
        timer = setTimeout(showNext, 6000);
      };
      timer = setTimeout(hide, 7000);
    };
    timer = setTimeout(showNext, initialDelay);
    return () => { retired = true; clearTimeout(timer); };
  }, [owner, eligible, messages, initialDelay]);

  const dismiss = useCallback(() => {
    if (activeOwner.current !== owner) return;
    activeOwner.current = null;
    setShown(null);
    setDismissed(current => new Set(current).add(dismissalKey));
  }, [owner, dismissalKey]);
  const setInteracting = useCallback((value: boolean) => {
    if (activeOwner.current === owner) interacting.current = value;
  }, [owner]);

  return { message: eligible && shown?.owner === owner ? shown.message : null, dismiss, externalEditorFocused, setInteracting };
}
