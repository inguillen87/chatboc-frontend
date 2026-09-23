import * as React from "react";
import { useSearchParams } from "react-router-dom";

import {
  CRM_PEOPLE_CHANNEL_FILTERS,
  type CrmPeopleChannelFilter,
} from "./useCrmPeopleDirectory";

export const CRM_WORKSPACE_VIEWS = ["personas", "segmentos", "campanas", "actividad"] as const;
export const CRM_PEOPLE_QUEUE_VIEWS = ["all", "review", "whatsapp", "complete"] as const;
export const CRM_PEOPLE_SORTS = ["recent", "name", "score-desc", "score-asc"] as const;

export type CrmWorkspaceView = (typeof CRM_WORKSPACE_VIEWS)[number];
export type CrmPeopleQueueView = (typeof CRM_PEOPLE_QUEUE_VIEWS)[number];
export type CrmPeopleSort = (typeof CRM_PEOPLE_SORTS)[number];

const isWorkspaceView = (value: string | null): value is CrmWorkspaceView =>
  Boolean(value && CRM_WORKSPACE_VIEWS.includes(value as CrmWorkspaceView));
const isPeopleQueueView = (value: string | null): value is CrmPeopleQueueView =>
  Boolean(value && CRM_PEOPLE_QUEUE_VIEWS.includes(value as CrmPeopleQueueView));
const isPeopleSort = (value: string | null): value is CrmPeopleSort =>
  Boolean(value && CRM_PEOPLE_SORTS.includes(value as CrmPeopleSort));
const isPeopleChannelFilter = (value: string | null): value is CrmPeopleChannelFilter =>
  Boolean(value && CRM_PEOPLE_CHANNEL_FILTERS.includes(value as CrmPeopleChannelFilter));

export const useCrmWorkspaceState = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const activeView: CrmWorkspaceView = isWorkspaceView(searchParams.get("view"))
    ? (searchParams.get("view") as CrmWorkspaceView)
    : "personas";
  const selectedContactId = searchParams.get("contact");
  const peopleQueueView: CrmPeopleQueueView = isPeopleQueueView(searchParams.get("queue"))
    ? (searchParams.get("queue") as CrmPeopleQueueView)
    : "all";
  const peopleSort: CrmPeopleSort = isPeopleSort(searchParams.get("sort"))
    ? (searchParams.get("sort") as CrmPeopleSort)
    : "recent";
  const peopleSearch = (searchParams.get("q") || "").slice(0, 120);
  const peopleMarketingOnly = searchParams.get("marketing") === "true";
  const peopleChannel: CrmPeopleChannelFilter = isPeopleChannelFilter(searchParams.get("channel"))
    ? (searchParams.get("channel") as CrmPeopleChannelFilter)
    : "all";

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

  const setPeopleQueueView = React.useCallback(
    (queueView: CrmPeopleQueueView) => updateParams({ queue: queueView === "all" ? null : queueView }),
    [updateParams],
  );

  const setPeopleSort = React.useCallback(
    (sort: CrmPeopleSort) => updateParams({ sort: sort === "recent" ? null : sort }),
    [updateParams],
  );

  const setPeopleSearch = React.useCallback(
    (query: string) => updateParams({ q: query.trimStart().slice(0, 120) || null, contact: null }),
    [updateParams],
  );

  const setPeopleMarketingOnly = React.useCallback(
    (enabled: boolean) => updateParams({ marketing: enabled ? "true" : null, contact: null }),
    [updateParams],
  );

  const setPeopleChannel = React.useCallback(
    (channel: CrmPeopleChannelFilter) => updateParams({ channel: channel === "all" ? null : channel, contact: null }),
    [updateParams],
  );

  return {
    activeView,
    selectedContactId,
    peopleQueueView,
    peopleSort,
    peopleSearch,
    peopleMarketingOnly,
    peopleChannel,
    setActiveView,
    setSelectedContactId,
    setPeopleQueueView,
    setPeopleSort,
    setPeopleSearch,
    setPeopleMarketingOnly,
    setPeopleChannel,
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
