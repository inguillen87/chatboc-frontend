import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it } from 'vitest';
import { PrivateWorkspaceBrand } from './PrivateWorkspaceBrand';
import type { PrivateWorkspaceIdentity } from '@/utils/privateWorkspaceIdentity';

const identity = { name: 'Tierra del Fuego', tenantSlug: 'tierra-del-fuego', logoUrl: null } as unknown as PrivateWorkspaceIdentity;
const mount = (value: PrivateWorkspaceIdentity | null) =>
  render(<MemoryRouter><PrivateWorkspaceBrand identity={value} /></MemoryRouter>);

describe('private workspace tab title', () => {
  afterEach(() => { document.title = ''; });

  it('names the browser tab after the organization, not the platform', () => {
    document.title = 'Plataforma';
    const view = mount(identity);
    expect(document.title).toBe('Tierra del Fuego · Panel');
    view.unmount();
    expect(document.title).toBe('Plataforma');
  });

  it('leaves the title alone until the organization is known', () => {
    document.title = 'Plataforma';
    mount(null);
    expect(document.title).toBe('Plataforma');
  });
});
