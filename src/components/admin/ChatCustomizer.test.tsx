import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  buildTenantRuntimeWidgetUpdate,
  readChatCustomizerDraft,
  type ChatCustomizerConfig,
  type TenantRuntimeWidgetUpdate,
} from '@/utils/chatCustomizerPersistence';

const mocks = vi.hoisted(() => ({
  currentSlug: 'junin',
  getRuntimeWidgetConfig: vi.fn(),
  updateRuntimeWidgetConfig: vi.fn(),
  getPublicRuntimeWidgetConfig: vi.fn(),
  apiGet: vi.fn(),
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
  toastInfo: vi.fn(),
}));

vi.mock('@/context/TenantContext', () => ({
  useTenant: () => ({ currentSlug: mocks.currentSlug }),
}));

vi.mock('@/services/tenantService', () => ({
  tenantService: {
    getRuntimeWidgetConfig: (...args: unknown[]) => mocks.getRuntimeWidgetConfig(...args),
    updateRuntimeWidgetConfig: (...args: unknown[]) => mocks.updateRuntimeWidgetConfig(...args),
    getPublicRuntimeWidgetConfig: (...args: unknown[]) => mocks.getPublicRuntimeWidgetConfig(...args),
  },
}));

vi.mock('@/api/client', () => ({
  apiClient: {
    get: (...args: unknown[]) => mocks.apiGet(...args),
  },
}));

vi.mock('sonner', () => ({
  toast: {
    success: (...args: unknown[]) => mocks.toastSuccess(...args),
    error: (...args: unknown[]) => mocks.toastError(...args),
    info: (...args: unknown[]) => mocks.toastInfo(...args),
  },
}));

vi.mock('@/components/chat/WidgetPreview', () => ({
  default: ({ botName }: { botName?: string }) => (
    <div data-testid="widget-preview">{botName}</div>
  ),
}));

import ChatCustomizer from './ChatCustomizer';

const baseConfig: ChatCustomizerConfig = {
  primaryColor: '#007aff',
  accentColor: '#005bb5',
  fontFamily: 'Inter',
  animation: 'pulse',
  borderRadius: 16,
  userMsgColor: '#005bb5',
  chatBackground: '#ffffff',
  showLogo: true,
  logoUrl: '',
  mode: 'light',
  botName: 'Asistente Virtual',
  welcomeMessage: '¡Hola! ¿En qué puedo ayudarte hoy?',
  ctaMessage: '¿Tenés alguna duda?',
  faqSuggestions: [],
  soundEnabled: true,
  autoOpen: false,
  autoOpenDelay: 5,
  position: 'right',
  sideOffset: 20,
  bottomOffset: 20,
  allowedDomains: '',
  privacyMode: 'public',
  zIndex: 9999,
  mobileHidden: false,
  showBranding: true,
};

describe('ChatCustomizer runtime persistence', () => {
  beforeAll(() => {
    vi.stubGlobal(
      'ResizeObserver',
      class ResizeObserver {
        observe() {}
        unobserve() {}
        disconnect() {}
      },
    );
  });

  beforeEach(() => {
    mocks.currentSlug = 'junin';
    mocks.getRuntimeWidgetConfig.mockReset();
    mocks.updateRuntimeWidgetConfig.mockReset();
    mocks.getPublicRuntimeWidgetConfig.mockReset();
    mocks.apiGet.mockReset();
    mocks.toastSuccess.mockReset();
    mocks.toastError.mockReset();
    mocks.toastInfo.mockReset();
    mocks.apiGet.mockResolvedValue({ access: { enabled: true } });
    window.sessionStorage.clear();
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('shows a blocking error when the backend acknowledges but ignores the brand update', async () => {
    const stalePayload = buildTenantRuntimeWidgetUpdate(baseConfig);
    mocks.getRuntimeWidgetConfig.mockResolvedValue(stalePayload);
    mocks.updateRuntimeWidgetConfig.mockResolvedValue({ status: 'updated' });

    render(<ChatCustomizer />);
    await waitFor(() => expect(mocks.getRuntimeWidgetConfig).toHaveBeenCalledTimes(1));

    fireEvent.click(screen.getByTitle('WhatsApp Style'));
    fireEvent.click(screen.getByRole('button', { name: 'Guardar y aplicar cambios' }));

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Cambios pendientes, sin aplicar');
    expect(alert).toHaveTextContent('El servidor respondió pero no conservó');
    expect(mocks.getRuntimeWidgetConfig).toHaveBeenCalledTimes(2);
    expect(mocks.toastSuccess).not.toHaveBeenCalled();
  });

  it('keeps edits pending and visible when the runtime endpoint rejects the request', async () => {
    mocks.getRuntimeWidgetConfig.mockResolvedValue(buildTenantRuntimeWidgetUpdate(baseConfig));
    mocks.updateRuntimeWidgetConfig.mockRejectedValue(new Error('Unauthorized'));

    render(<ChatCustomizer />);
    await waitFor(() => expect(mocks.getRuntimeWidgetConfig).toHaveBeenCalledTimes(1));

    fireEvent.click(screen.getByTitle('Warm'));
    fireEvent.click(screen.getByRole('button', { name: 'Guardar y aplicar cambios' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Unauthorized');
    expect(screen.getByRole('button', { name: 'Guardar y aplicar cambios' })).toBeEnabled();
    expect(mocks.toastError).toHaveBeenCalledTimes(1);
  });

  it('marks the save verified only after re-reading the same runtime values', async () => {
    let submitted: TenantRuntimeWidgetUpdate | null = null;
    mocks.getRuntimeWidgetConfig
      .mockResolvedValueOnce(buildTenantRuntimeWidgetUpdate(baseConfig))
      .mockImplementation(async () => submitted);
    mocks.updateRuntimeWidgetConfig.mockImplementation(async (_slug, payload) => {
      submitted = payload;
      return { status: 'updated' };
    });
    mocks.getPublicRuntimeWidgetConfig.mockImplementation(async () => {
      const payload = submitted!;
      const theme = payload.theme_json as Record<string, any>;
      const behavior = theme.behavior as Record<string, any>;
      return {
        primary_color: payload.primary_color,
        secondary_color: payload.secondary_color,
        welcome_title: payload.welcome_message,
        welcome_subtitle: payload.welcome_subtitle,
        logo_url: payload.avatar_url,
        font_family: payload.font_family,
        default_open: payload.default_open,
        position: payload.position,
        bottom: payload.bottom,
        side_offset: payload.side_offset,
        border_radius: theme.border_radius,
        cta_messages: payload.cta_messages,
        widget: {
          attributes: {
            'data-position': payload.position,
            'data-bottom': payload.bottom,
            [payload.position === 'left' ? 'data-left' : 'data-right']: payload.side_offset,
            'data-border-radius': String(theme.border_radius),
            'data-logo-url': payload.avatar_url,
            'data-font-family': payload.font_family,
          },
        },
        theme_config: { light: theme.light },
        behavior,
      };
    });

    render(<ChatCustomizer />);
    await waitFor(() => expect(mocks.getRuntimeWidgetConfig).toHaveBeenCalledTimes(1));

    fireEvent.click(screen.getByTitle('Elegant'));
    await waitFor(() =>
      expect(readChatCustomizerDraft(window.sessionStorage, 'junin', baseConfig)?.config.primaryColor).toBe(
        '#18181b',
      ),
    );
    fireEvent.click(screen.getByRole('button', { name: 'Guardar y aplicar cambios' }));

    await waitFor(() => expect(mocks.updateRuntimeWidgetConfig).toHaveBeenCalledTimes(1));
    expect(await screen.findByText(/Guardado verificado a las/)).toBeInTheDocument();
    expect(mocks.updateRuntimeWidgetConfig).toHaveBeenCalledWith(
      'junin',
      expect.objectContaining({
        primary_color: '#18181b',
        secondary_color: '#27272a',
      }),
    );
    expect(mocks.toastSuccess).toHaveBeenCalledTimes(1);
    expect(readChatCustomizerDraft(window.sessionStorage, 'junin', baseConfig)).toBeNull();
  });

  it('keeps the editor locked after an initial load failure', async () => {
    mocks.getRuntimeWidgetConfig.mockRejectedValue(new Error('Backend unavailable'));

    render(<ChatCustomizer />);

    expect(await screen.findByText('No se cargó la configuración vigente')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Guardar y aplicar cambios' })).toBeDisabled();
  });

  it('ignores a late response from the previously selected tenant', async () => {
    let resolveJunin: (value: unknown) => void = () => undefined;
    const juninRequest = new Promise((resolve) => {
      resolveJunin = resolve;
    });
    mocks.getRuntimeWidgetConfig.mockImplementation((slug: string) => {
      if (slug === 'junin') return juninRequest;
      return Promise.resolve(buildTenantRuntimeWidgetUpdate({ ...baseConfig, botName: 'Asistente Chivilcoy' }));
    });

    const { rerender } = render(<ChatCustomizer />);
    await waitFor(() => expect(mocks.getRuntimeWidgetConfig).toHaveBeenCalledWith('junin'));
    mocks.currentSlug = 'chivilcoy';
    rerender(<ChatCustomizer />);
    await waitFor(() => expect(mocks.getRuntimeWidgetConfig).toHaveBeenCalledWith('chivilcoy'));
    expect(await screen.findByTestId('widget-preview')).toHaveTextContent('Asistente Chivilcoy');

    resolveJunin(buildTenantRuntimeWidgetUpdate({ ...baseConfig, botName: 'Asistente Junín' }));
    await Promise.resolve();

    expect(screen.getByTestId('widget-preview')).toHaveTextContent('Asistente Chivilcoy');
    expect(screen.getByTestId('widget-preview')).not.toHaveTextContent('Asistente Junín');
  });

  it('restores the tenant draft after a tab unmount and remount without autosaving it', async () => {
    mocks.getRuntimeWidgetConfig.mockResolvedValue(buildTenantRuntimeWidgetUpdate(baseConfig));

    const firstMount = render(<ChatCustomizer />);
    expect(await screen.findByTestId('widget-preview')).toHaveTextContent(baseConfig.botName);
    const contentTab = screen.getByRole('tab', { name: 'Contenido' });
    fireEvent.mouseDown(contentTab, { button: 0, ctrlKey: false });
    await waitFor(() => expect(contentTab).toHaveAttribute('aria-selected', 'true'));
    fireEvent.change(await screen.findByDisplayValue(baseConfig.botName), {
      target: { value: 'Borrador institucional Junín' },
    });

    expect(screen.getByTestId('widget-preview')).toHaveTextContent('Borrador institucional Junín');
    await waitFor(() =>
      expect(readChatCustomizerDraft(window.sessionStorage, 'junin', baseConfig)?.config.botName).toBe(
        'Borrador institucional Junín',
      ),
    );
    firstMount.unmount();

    render(<ChatCustomizer />);
    await waitFor(() => expect(mocks.getRuntimeWidgetConfig).toHaveBeenCalledTimes(2));

    expect(await screen.findByText('Borrador sin guardar recuperado')).toBeInTheDocument();
    expect(screen.getByTestId('widget-preview')).toHaveTextContent('Borrador institucional Junín');
    expect(mocks.updateRuntimeWidgetConfig).not.toHaveBeenCalled();
  });

  it('keeps unsaved drafts isolated when the active tenant changes', async () => {
    mocks.getRuntimeWidgetConfig.mockImplementation(async (slug: string) =>
      buildTenantRuntimeWidgetUpdate({
        ...baseConfig,
        botName: slug === 'junin' ? 'Asistente Junín' : 'Asistente Chivilcoy',
      }),
    );

    const { rerender } = render(<ChatCustomizer />);
    expect(await screen.findByTestId('widget-preview')).toHaveTextContent('Asistente Junín');
    const contentTab = screen.getByRole('tab', { name: 'Contenido' });
    fireEvent.mouseDown(contentTab, { button: 0, ctrlKey: false });
    await waitFor(() => expect(contentTab).toHaveAttribute('aria-selected', 'true'));
    fireEvent.change(await screen.findByDisplayValue('Asistente Junín'), {
      target: { value: 'Borrador exclusivo de Junín' },
    });
    await waitFor(() =>
      expect(readChatCustomizerDraft(window.sessionStorage, 'junin', baseConfig)?.config.botName).toBe(
        'Borrador exclusivo de Junín',
      ),
    );

    mocks.currentSlug = 'chivilcoy';
    rerender(<ChatCustomizer />);
    await waitFor(() => expect(mocks.getRuntimeWidgetConfig).toHaveBeenCalledWith('chivilcoy'));
    expect(screen.getByTestId('widget-preview')).toHaveTextContent('Asistente Chivilcoy');
    expect(screen.getByTestId('widget-preview')).not.toHaveTextContent('Borrador exclusivo de Junín');
    expect(readChatCustomizerDraft(window.sessionStorage, 'chivilcoy', baseConfig)).toBeNull();

    mocks.currentSlug = 'junin';
    rerender(<ChatCustomizer />);
    await waitFor(() => expect(mocks.getRuntimeWidgetConfig).toHaveBeenCalledTimes(3));

    expect(await screen.findByText('Borrador sin guardar recuperado')).toBeInTheDocument();
    expect(screen.getByTestId('widget-preview')).toHaveTextContent('Borrador exclusivo de Junín');
    expect(mocks.updateRuntimeWidgetConfig).not.toHaveBeenCalled();
  });

  it('ignores a late save rejection from the previous tenant', async () => {
    let rejectJuninSave: (error: Error) => void = () => undefined;
    const juninSave = new Promise((_resolve, reject) => {
      rejectJuninSave = reject;
    });
    mocks.getRuntimeWidgetConfig.mockImplementation(async (slug: string) =>
      buildTenantRuntimeWidgetUpdate({
        ...baseConfig,
        botName: slug === 'junin' ? 'Asistente Junín' : 'Asistente Chivilcoy',
      }),
    );
    mocks.updateRuntimeWidgetConfig.mockImplementation((slug: string) =>
      slug === 'junin' ? juninSave : Promise.resolve({ status: 'updated' }),
    );

    const { rerender } = render(<ChatCustomizer />);
    expect(await screen.findByTestId('widget-preview')).toHaveTextContent('Asistente Junín');
    fireEvent.click(screen.getByTitle('Elegant'));
    await waitFor(() =>
      expect(readChatCustomizerDraft(window.sessionStorage, 'junin', baseConfig)).not.toBeNull(),
    );
    fireEvent.click(screen.getByRole('button', { name: 'Guardar y aplicar cambios' }));
    await waitFor(() => expect(mocks.updateRuntimeWidgetConfig).toHaveBeenCalledWith('junin', expect.anything()));

    mocks.currentSlug = 'chivilcoy';
    rerender(<ChatCustomizer />);
    expect(await screen.findByTestId('widget-preview')).toHaveTextContent('Asistente Chivilcoy');

    await act(async () => {
      rejectJuninSave(new Error('Late failure for Junín'));
      await juninSave.catch(() => undefined);
    });

    expect(screen.queryByText('Cambios pendientes, sin aplicar')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Guardar y aplicar cambios' })).toBeDisabled();
    expect(readChatCustomizerDraft(window.sessionStorage, 'chivilcoy', baseConfig)).toBeNull();
    expect(readChatCustomizerDraft(window.sessionStorage, 'junin', baseConfig)).not.toBeNull();
    expect(mocks.toastError).not.toHaveBeenCalled();
  });
});
