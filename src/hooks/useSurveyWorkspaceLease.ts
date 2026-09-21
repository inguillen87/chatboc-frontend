import { useCallback, useLayoutEffect, useRef } from 'react';

/** A UI lifetime, not an authorization grant or a server-side cancellation.
 * The workspace must be keyed by tenant. Each mount/effect lifetime receives a
 * distinct token, so an A -> B -> A transition cannot revive an old completion.
 */
export function useSurveyWorkspaceLease() {
  const current = useRef<symbol | null>(null);
  useLayoutEffect(() => {
    const token = Symbol('survey-workspace');
    current.current = token;
    return () => {
      if (current.current === token) current.current = null;
    };
  }, []);

  return useCallback(() => {
    const token = current.current;
    if (token === null) throw new Error('survey_workspace_unmounted');
    return () => current.current === token;
  }, []);
}
