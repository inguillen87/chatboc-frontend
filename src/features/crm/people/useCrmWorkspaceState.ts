import * as React from "react";
import { useSearchParams } from "react-router-dom";

export const CRM_WORKSPACE_VIEWS = ["personas", "segmentos", "campanas", "actividad"] as const;

export type CrmWorkspaceView = (typeof CRM_WORKSPACE_VIEWS)[number];

const isWorkspaceView = (value: string | null): value is CrmWorkspaceView =>
  Boolean(value && CRM_WORKSPACE_VIEWS.includes(value as CrmWorkspaceView));

export const useCrmWorkspaceState = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const activeView: CrmWorkspaceView = isWorkspaceView(searchParams.get("view"))
    ? (searchParams.get("view") as CrmWorkspaceView)
    : "personas";
  const selectedContactId = searchParams.get("contact");

  const updateParams = React.useCallback(
    (updates: Record<string, string | null>) => {
      setSearchParams(
        (current) => {
          const next = new URLSearchParams(current);
          Object.entries(updates).forEach(([key, value]) => {
            if (value) next.set(key, value);
            else next.delete(key);
          });
          return next;
        },
        { replace: true },
      );
    },
    [setSearchParams],
  );

  const setActiveView = React.useCallback(
    (view: CrmWorkspaceView) => updateParams({ view: view === "personas" ? null : view }),
    [updateParams],
  );

  const setSelectedContactId = React.useCallback(
    (contactId: string | null) => updateParams({ contact: contactId }),
    [updateParams],
  );

  return {
    activeView,
    selectedContactId,
    setActiveView,
    setSelectedContactId,
  };
};

export const useDebouncedValue = <T,>(value: T, delay = 350): T => {
  const [debouncedValue, setDebouncedValue] = React.useState(value);

  React.useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedValue(value), delay);
    return () => window.clearTimeout(timer);
  }, [delay, value]);

  return debouncedValue;
};
