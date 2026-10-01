// A monotonic authority generation survives logout and login as the same actor.
// Keep this independent of request transport and logout side effects.
let sessionRevision = 0;

export const captureChatbocSessionRevision = () => sessionRevision;

export const isChatbocSessionRevisionCurrent = (revision: number) =>
  revision === sessionRevision;

export const advanceChatbocSessionRevision = () => {
  sessionRevision += 1;
  return sessionRevision;
};
