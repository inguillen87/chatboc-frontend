import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { SessionAuthorityProvider } from '@/components/access/SessionAuthorityContext';
import UserPortalLayout from '@/components/user-portal/layout/UserPortalLayout';
import { UserProvider } from '@/hooks/useUser';
import { usePanelSessionStore } from '@/stores';
import type { PortalNotification } from '@/types/unified';
import UserAccountPage from './UserAccountPage';
import UserDashboardPage from './UserDashboardPage';

const surfaceMocks = vi.hoisted(() => ({
  refetch: vi.fn(),
  registerWidgetProfile: vi.fn(),
  notifications: [] as PortalNotification[],
}));

vi.mock('react-router-dom', async (importOriginal) =>
  importOriginal<typeof import('react-router-dom')>(),
);

vi.mock('@/context/TenantContext', () => ({
  useTenant: () => ({
    currentSlug: 'junin',
    widgetToken: null,
    tenant: { slug: 'junin', nombre: 'Municipalidad de Junin' },
  }),
}));

vi.mock('@/hooks/usePortalContent', () => ({
  usePortalContent: () => ({
    content: {
      notifications: surfaceMocks.notifications,
      events: [],
      news: [],
      catalog: [],
      activities: [],
      surveys: [],
      loyaltySummary: null,
    },
    bundle: null,
    commerceSession: null,
    publicProfile: { name: '', phone: '', email: '', canRegister: false },
    publicClaims: [],
    publicOrders: [],
    registrationResult: null,
    registrationError: null,
    registerWidgetProfile: surfaceMocks.registerWidgetProfile,
    isLoading: false,
    refetch: surfaceMocks.refetch,
  }),
}));

vi.mock('@/hooks/usePortalTheme', () => ({
  usePortalTheme: () => ({
    toggle: vi.fn(),
    active: 'light',
    setTheme: vi.fn(),
  }),
}));

vi.mock('@/components/auth/ClerkRuntimeContext', () => ({
  useClerkRuntime: () => ({ enabled: false }),
}));

vi.mock('@/components/user-portal/notifications/NotificationCenter', () => ({
  default: () => <div>Centro de notificaciones público</div>,
}));

vi.mock('@/components/user-portal/navigation/SideNavigationBar', () => ({
  default: () => <nav>Navegación lateral pública</nav>,
}));

vi.mock('@/components/user-portal/navigation/BottomNavigationBar', () => ({
  default: () => <nav>Navegación inferior pública</nav>,
}));

const STALE_NAME = 'Persona Stale Privada';
const STALE_EMAIL = 'stale-surface@example.test';

const renderSurface = (
  ui: React.ReactElement,
  clerkStatus: 'loading' | 'signed_out',
) => {
  usePanelSessionStore.setState({
    authToken: null,
    user: {
      id: 'stale-user',
      name: STALE_NAME,
      email: STALE_EMAIL,
      rol: 'chat_user',
      tipo_chat: 'municipio',
    } as any,
  });

  return render(
    <UserProvider>
      <SessionAuthorityProvider
        value={{
          clerkStatus,
          hasBearerSession: clerkStatus === 'loading',
          hasVerifiedSession: false,
        }}
      >
        <MemoryRouter
          initialEntries={['/t/junin/portal/dashboard']}
          future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
        >
          {ui}
        </MemoryRouter>
      </SessionAuthorityProvider>
    </UserProvider>,
  );
};

const expectNoStalePii = () => {
  expect(screen.queryByText(STALE_NAME)).not.toBeInTheDocument();
  expect(screen.queryByText(STALE_EMAIL)).not.toBeInTheDocument();
  expect(document.body).not.toHaveTextContent(STALE_NAME);
  expect(document.body).not.toHaveTextContent(STALE_EMAIL);
};

describe('portal private surface session isolation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    surfaceMocks.notifications = [];
    usePanelSessionStore.setState({ authToken: null, user: null });
  });

  it('keeps notice headings below Avisos and follows the notice within the tenant', async () => {
    const notification: PortalNotification = {
      id: 'notice-fixture',
      title: 'Actualización de tu solicitud',
      message: 'Hay novedades disponibles en el seguimiento.',
      severity: 'info',
      actionLabel: 'Abrir seguimiento',
      actionHref: '/portal/reclamos',
    };
    surfaceMocks.notifications = [notification];
    const user = userEvent.setup();
    renderSurface(
      <Routes>
        <Route path="/t/junin/portal/dashboard" element={<UserDashboardPage />} />
        <Route path="/t/junin/portal/reclamos" element={<h1>Destino del aviso de prueba</h1>} />
      </Routes>,
      'signed_out',
    );

    expect.soft(screen.queryByRole('heading', { name: 'Avisos', level: 2 })).toBeInTheDocument();
    expect.soft(screen.queryByRole('heading', { name: notification.title, level: 3 })).toBeInTheDocument();
    expect(screen.getByText(notification.message)).toBeInTheDocument();
    const action = screen.getByRole('link', { name: /Abrir seguimiento/ });
    expect(action).toHaveAttribute('href', '/t/junin/portal/reclamos');
    await user.click(action);
    expect(screen.getByRole('heading', { name: 'Destino del aviso de prueba', level: 1 })).toBeInTheDocument();
    expectNoStalePii();
  });

  it.each(['loading', 'signed_out'] as const)(
    'hides stale PII across layout, account, and dashboard while Clerk is %s',
    (clerkStatus) => {
      const layout = renderSurface(<UserPortalLayout />, clerkStatus);
      expect(screen.getByRole('link', { name: 'Vincular sesión' })).toBeInTheDocument();
      expectNoStalePii();
      layout.unmount();

      const account = renderSurface(<UserAccountPage />, clerkStatus);
      expect(screen.getAllByText('Iniciar sesión').length).toBeGreaterThan(0);
      expect(screen.getByText('Usuario')).toBeInTheDocument();
      expectNoStalePii();
      account.unmount();

      const dashboard = renderSurface(<UserDashboardPage />, clerkStatus);
      expect(screen.getByRole('heading', { name: 'Hola, bienvenido' })).toBeInTheDocument();
      expectNoStalePii();
      dashboard.unmount();
    },
  );
});
