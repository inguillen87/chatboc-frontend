import { describe, expect, it } from 'vitest';

import { DISABILITY_AI_AGENT_DEMO_PATH } from '@/config/publicPresentationRoutes';
import routes from './routesConfig';

describe('institutional disability demo route', () => {
  it('is guest-only, exact and registered before the generic demo slug', () => {
    const routeIndex = routes.findIndex((route) => route.path === DISABILITY_AI_AGENT_DEMO_PATH);
    const genericDemoIndex = routes.findIndex((route) => route.path === '/demo/:slug');

    expect(routeIndex).toBeGreaterThanOrEqual(0);
    expect(routes[routeIndex]?.allowGuest).toBe(true);
    expect(routeIndex).toBeLessThan(genericDemoIndex);
    expect(routes.filter((route) => route.path === DISABILITY_AI_AGENT_DEMO_PATH)).toHaveLength(1);
  });
});
