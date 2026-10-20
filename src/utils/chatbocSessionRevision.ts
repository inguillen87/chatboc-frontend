// A monotonic authority generation survives logout and login as the same actor.
// Keep this independent of request transport and logout side effects.
let sessionRevision = 0;
const revisionListeners = new Set<() => void>();

export const subscribeChatbocSessionRevision = (listener: () => void) => {
  revisionListeners.add(listener);
  return () => { revisionListeners.delete(listener); };
};

export const captureChatbocSessionRevision = () => sessionRevision;

export const isChatbocSessionRevisionCurrent = (revision: number) =>
  revision === sessionRevision;

export const advanceChatbocSessionRevision = () => {
  sessionRevision += 1;
  // An observer must never interrupt the existing synchronous logout cleanup.
  revisionListeners.forEach((listener) => { try { listener(); } catch {} });
  return sessionRevision;
};
