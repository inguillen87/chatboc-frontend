import { useCallback, useEffect, useState } from "react";

import {
  getLandingExperience,
  type LandingExperience,
  type LandingExperienceQuery,
} from "@/api/landingExperience";

export interface UseLandingExperienceOptions extends LandingExperienceQuery {
  enabled?: boolean;
}

export function useLandingExperience(options: UseLandingExperienceOptions = {}) {
  const { enabled = true, tenant, tenantSlug, slug, widgetToken } = options;
  const [experience, setExperience] = useState<LandingExperience | null>(null);
  const [loading, setLoading] = useState(Boolean(enabled));
  const [refresh, setRefresh] = useState(0);
  const reload = useCallback(() => setRefresh((value) => value + 1), []);

  useEffect(() => {
    let alive = true;

    if (!enabled) {
      setLoading(false);
      return () => {
        alive = false;
      };
    }

    setLoading(true);
    getLandingExperience({ tenant, tenantSlug, slug, widgetToken })
      .then((payload) => {
        if (alive) setExperience(payload);
      })
      .catch(() => {
        if (alive) setExperience(null);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });

    return () => {
      alive = false;
    };
  }, [enabled, tenant, tenantSlug, slug, widgetToken, refresh]);

  return { experience, loading, reload };
}

