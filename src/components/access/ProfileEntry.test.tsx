import React, { Suspense } from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import ProfileEntry from './ProfileEntry';

const state = vi.hoisted(() => ({ role: 'super_admin', verified: true }));
vi.mock('@/hooks/useUser', () => ({ useUser: () => ({ user: { rol: state.role } }) }));
vi.mock('./SessionAuthorityContext', () => ({ useSessionAuthority: () => ({ hasVerifiedSession: state.verified }) }));
vi.mock('@/pages/Perfil', () => ({ default: () => <div>Organización explícita</div> }));

function open(entry: string) {
  render(<MemoryRouter initialEntries={[entry]}><Suspense fallback={null}><Routes>
    <Route path="/perfil" element={<ProfileEntry />} />
    <Route path="/t/:slug/perfil" element={<ProfileEntry />} />
    <Route path="/superadmin" element={<div>Administración global</div>} />
  </Routes></Suspense></MemoryRouter>);
}

describe('ProfileEntry platform identity', () => {
  beforeEach(() => { state.role = 'super_admin'; state.verified = true; });
  it('lands a verified platform administrator at the global workspace', async () => {
    open('/perfil');
    expect(await screen.findByText('Administración global')).toBeInTheDocument();
    expect(screen.queryByText('Organización explícita')).not.toBeInTheDocument();
  });
  it.each(['/perfil?tab=tickets', '/t/junin/perfil', '/perfil?tenant=junin'])('retains explicit tenant work at %s', async (path) => {
    open(path);
    expect(await screen.findByText('Organización explícita')).toBeInTheDocument();
  });
  it('does not promote an unverified cached role', async () => {
    state.verified = false;
    open('/perfil');
    expect(await screen.findByText('Organización explícita')).toBeInTheDocument();
  });
  it('retains the organization workspace for tenant administrators', async () => {
    state.role = 'admin';
    open('/perfil');
    expect(await screen.findByText('Organización explícita')).toBeInTheDocument();
  });
});
