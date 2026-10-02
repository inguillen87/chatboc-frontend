import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ChatWidgetInner from './ChatWidgetInner';
import { tenantService } from '@/services/tenantService';
import { useWidgetSessionStore } from '@/stores';

vi.mock('@/context/TenantContext', () => ({
  useTenant: () => ({ tenant: { slug: 'private-account' }, currentSlug: 'private-account' }),
}));
vi.mock('@/hooks/useUser', () => ({
  useUser: () => ({ user: { rol: 'superadmin', nombre: 'Private account operator' } }),
}));
vi.mock('@/hooks/useDarkMode', () => ({ useDarkMode: () => false }));
vi.mock('@/hooks/useCartCount', () => ({ useCartCount: () => 0 }));
vi.mock('@/hooks/use-mobile', () => ({ useIsMobile: () => false }));
vi.mock('./ChatPanel', async () => {
  const { default: ChatHeader } = await import('./ChatHeader');
  return {
    default: ({ welcomeTitle, welcomeSubtitle }: { welcomeTitle?: string; welcomeSubtitle?: string }) => (
      <ChatHeader onClose={() => {}} title={welcomeTitle} subtitle={welcomeSubtitle} />
    ),
  };
});
vi.mock('./AccessibilityToggle', () => ({
  default: () => <button>Accesibilidad</button>,
  ACCESSIBILITY_EVENT: 'test-accessibility-change',
  readAccessibilityPrefs: () => ({}),
}));
vi.mock('./ChatbocLogoAnimated', () => ({ default: () => <span aria-hidden="true">logo</span> }));

const appDefaults = { welcomeTitle: 'Asistente Virtual', welcomeSubtitle: 'Consultas, ventas y soporte con Chatboc' };
const originalFetch = global.fetch;
const renderWidget = (children: React.ReactNode) => render(<React.Suspense fallback={null}>{children}</React.Suspense>);
const publicConfig = (slug: string, assistant: string) => ({
  contract_version: 'public.widget_config.v1',
  slug,
  tenant_name: 'Nombre institucional',
  tipo_chat: 'municipio',
  welcome_subtitle: assistant,
  welcome_title: 'Hola, consultá la información pública de esta organización.',
});

beforeEach(() => {
  localStorage.clear();
  useWidgetSessionStore.setState({ status: 'ready', entityToken: null, chatAuthToken: null });
  global.fetch = vi.fn().mockResolvedValue(new Response('{}', { headers: { 'Content-Type': 'application/json' } }));
  vi.spyOn(tenantService, 'getPlatformWidgetConfig').mockResolvedValue(null);
});

afterEach(() => {
  cleanup();
  global.fetch = originalFetch;
  vi.restoreAllMocks();
  localStorage.clear();
  window.history.replaceState({}, '', '/');
});

describe('shared widget public assistant appearance', () => {
  it.each([
    ['tierra-del-fuego', 'Conversa TDF'],
    ['another-city', 'Asistente de otra organización'],
  ])('uses %s public assistant identity for the canonical launcher and open header', async (slug, assistant) => {
    window.history.replaceState({}, '', '/t/' + slug);
    const config = publicConfig(slug, assistant);
    const publicRead = vi.spyOn(tenantService, 'getPublicWidgetConfig').mockResolvedValue(config);
    renderWidget(
      <MemoryRouter initialEntries={['/t/' + slug]}>
        <ChatWidgetInner mode="standalone" defaultOpen={false} {...appDefaults} />
      </MemoryRouter>,
    );

    const launcher = await screen.findByRole('button', { name: 'Abrir el asistente ' + assistant });
    expect(publicRead).toHaveBeenCalledWith(slug);
    fireEvent.click(launcher);
    expect(await screen.findByTitle(assistant)).toHaveTextContent(assistant);
    await waitFor(() => expect(screen.getByText(config.welcome_title)).toBeVisible());
    expect(screen.queryByTitle(appDefaults.welcomeTitle)).not.toBeInTheDocument();
    expect(screen.queryByText('Private account operator')).not.toBeInTheDocument();
  });

  it.each(['iframe', 'preview'] as const)('preserves explicit %s display overrides', async (mode) => {
    window.history.replaceState({}, '', '/iframe');
    vi.spyOn(tenantService, 'getPublicWidgetConfig').mockResolvedValue(publicConfig('another-city', 'Asistente persistido'));
    renderWidget(
      <MemoryRouter initialEntries={['/iframe']}>
        <ChatWidgetInner mode={mode} defaultOpen tenantSlug="another-city" welcomeTitle="Nombre explícito" welcomeSubtitle="Saludo explícito" />
      </MemoryRouter>,
    );
    await waitFor(() => expect(screen.getByTitle('Nombre explícito')).toBeVisible());
    expect(screen.getByText('Saludo explícito')).toBeVisible();
    expect(screen.queryByTitle('Asistente persistido')).not.toBeInTheDocument();
  });

  it('retains global defaults on the unscoped public landing page despite a private account tenant', async () => {
    window.history.replaceState({}, '', '/');
    const publicRead = vi.spyOn(tenantService, 'getPublicWidgetConfig');
    renderWidget(
      <MemoryRouter initialEntries={['/']}>
        <ChatWidgetInner mode="standalone" defaultOpen {...appDefaults} />
      </MemoryRouter>,
    );
    await waitFor(() => expect(screen.getByTitle(appDefaults.welcomeTitle)).toBeVisible());
    expect(screen.getByText(appDefaults.welcomeSubtitle)).toBeVisible();
    expect(publicRead).not.toHaveBeenCalled();
  });
});
