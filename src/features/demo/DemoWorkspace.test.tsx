import React from 'react';
import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import DemoWorkspace from './DemoWorkspace';
import type { DemoWorkspaceConfig } from './demoTypes';

vi.mock('@/features/chat/ChatPanel', () => ({
  default: () => <div data-testid="chat-panel">chat</div>,
}));

describe('DemoWorkspace rubro tools', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders repeated backend tool ids without React duplicate-key warnings', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const workspace = {
      rubro_tools: [
        {
          id: 'catalog',
          kind: 'catalog',
          label: 'Catalogo principal',
          enabled: true,
        },
        {
          id: 'catalog',
          kind: 'catalog',
          label: 'Catalogo mayorista',
          enabled: true,
        },
      ],
    } as DemoWorkspaceConfig;

    render(<DemoWorkspace workspace={workspace} sector="empresas" rubro="ferreteria" />);

    expect(screen.getByText('Catalogo principal')).toBeInTheDocument();
    expect(screen.getByText('Catalogo mayorista')).toBeInTheDocument();
    expect(
      consoleError.mock.calls.some((call) =>
        call.some((item) => String(item).includes('Encountered two children with the same key')),
      ),
    ).toBe(false);
  });
});
