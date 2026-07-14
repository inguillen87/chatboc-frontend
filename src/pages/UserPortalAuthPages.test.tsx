import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import UserLogin from './UserLogin';
import UserRegister from './UserRegister';

const mocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  location: {
    pathname: '/t/junin/user/login',
    search: '',
    state: null as { redirectTo?: string } | null,
  },
  loginProps: null as Record<string, unknown> | null,
  registerProps: null as Record<string, unknown> | null,
  tenant: {
    widgetToken: 'entity-real' as string | null,
    currentSlug: 'junin' as string | null,
  },
}));

vi.mock('react-router-dom', () => ({
  useNavigate: () => mocks.navigate,
  useLocation: () => mocks.location,
}));

vi.mock('@/context/TenantContext', () => ({
  useTenant: () => mocks.tenant,
}));

vi.mock('@/components/chat/ChatUserLoginPanel', () => ({
  default: (props: Record<string, unknown>) => {
    mocks.loginProps = props;
    return (
      <button type="button" onClick={props.onShowRegister as () => void}>
        Abrir registro
      </button>
    );
  },
}));

vi.mock('@/components/chat/ChatUserRegisterPanel', () => ({
  default: (props: Record<string, unknown>) => {
    mocks.registerProps = props;
    return (
      <button type="button" onClick={props.onShowLogin as () => void}>
        Abrir ingreso
      </button>
    );
  },
}));

vi.mock('@/components/ErrorBoundary', () => ({
  default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

describe('páginas de acceso del portal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.loginProps = null;
    mocks.registerProps = null;
    mocks.tenant = { widgetToken: 'entity-real', currentSlug: 'junin' };
    window.localStorage.clear();
  });

  it('conserva un next interno y alterna hacia /user/register del mismo tenant', () => {
    mocks.location = {
      pathname: '/t/junin/user/login',
      search: '?next=%2Ft%2Fjunin%2Fmarket%2Fcart',
      state: { redirectTo: 'https://evil.example/robo' },
    };

    render(<UserLogin />);

    expect(mocks.loginProps).toMatchObject({
      tenantSlug: 'junin',
      returnTo: '/t/junin/market/cart',
      entityToken: 'entity-real',
    });

    fireEvent.click(screen.getByRole('button', { name: 'Abrir registro' }));
    expect(mocks.navigate).toHaveBeenCalledWith(
      '/t/junin/user/register?next=%2Ft%2Fjunin%2Fmarket%2Fcart',
      { state: { redirectTo: '/t/junin/market/cart' } },
    );
  });

  it('conserva el destino seguro de state y alterna hacia /user/login', () => {
    mocks.location = {
      pathname: '/t/junin/user/register',
      search: '?next=https%3A%2F%2Fevil.example',
      state: { redirectTo: '/t/junin/portal/pedidos/42' },
    };

    render(<UserRegister />);

    expect(mocks.registerProps).toMatchObject({
      tenantSlug: 'junin',
      returnTo: '/t/junin/portal/pedidos/42',
      entityToken: 'entity-real',
    });

    fireEvent.click(screen.getByRole('button', { name: 'Abrir ingreso' }));
    expect(mocks.navigate).toHaveBeenCalledWith(
      '/t/junin/user/login?next=%2Ft%2Fjunin%2Fportal%2Fpedidos%2F42',
      { state: { redirectTo: '/t/junin/portal/pedidos/42' } },
    );
  });

  it('descarta un next que vuelve a autenticación y usa el dashboard del tenant', () => {
    mocks.location = {
      pathname: '/t/junin/user/login',
      search: '?next=%2Ft%2Fjunin%2Fuser%2Fregister',
      state: null,
    };

    render(<UserLogin />);

    expect(mocks.loginProps).toMatchObject({
      tenantSlug: 'junin',
      returnTo: '/t/junin/portal/dashboard',
    });
  });

  it('no reutiliza un tenant persistido al abrir el acceso generico', () => {
    window.localStorage.setItem('tenantSlug', 'tenant-viejo');
    mocks.tenant = { widgetToken: null, currentSlug: 'tenant-viejo' };
    mocks.location = {
      pathname: '/user/login',
      search: '',
      state: null,
    };

    render(<UserLogin />);

    expect(mocks.loginProps).toMatchObject({
      tenantSlug: null,
      entityToken: undefined,
    });
  });
});
