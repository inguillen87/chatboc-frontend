import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { TransparencyTab } from './TransparencyTab';
import type { SurveySnapshot } from '@/types/encuestas';


const snapshot = (overrides: Partial<SurveySnapshot> = {}): SurveySnapshot => ({
  contract_version: 'surveys.anchor.v2',
  id: 9,
  snapshot_id: 9,
  encuesta_id: 7,
  tenant_id: 3,
  algo: 'sha256',
  root_hash: 'abc123',
  total_respuestas: 2,
  desde_at: '2026-07-01T00:00:00.000Z',
  hasta_at: '2026-07-30T23:59:59.000Z',
  created_at: '2026-07-30T23:59:59.000Z',
  anchor_status: 'draft',
  anchor_at: null,
  tx_id: null,
  chain: null,
  is_simulated: false,
  published: false,
  externally_anchored: false,
  externally_verified: false,
  verification_status: 'unverified',
  integrity_scope: 'local_merkle_snapshot',
  assurance_notice: 'Prueba Merkle local.',
  ...overrides,
});


describe('TransparencyTab containment copy', () => {
  it('states the local-only assurance and labels simulations as not published', () => {
    render(
      <TransparencyTab
        snapshots={[snapshot({
          anchor_status: 'simulated',
          is_simulated: true,
          tx_id: 'SIM-123',
          chain: 'simulation:polygon',
        })]}
        onCreateSnapshot={vi.fn()}
        onSimulateAnchor={vi.fn()}
        onVerifyResponse={vi.fn()}
      />,
    );

    expect(screen.getByText(/Evidencia local, no publicacion blockchain/i)).toBeInTheDocument();
    expect(screen.getByText(/Simulacion local - no publicada/i)).toBeInTheDocument();
    expect(screen.getAllByText(/No se verifico|No verifica publicacion externa/i).length).toBeGreaterThan(0);
    expect(screen.queryByRole('button', { name: /Generar referencia local/i })).not.toBeInTheDocument();
  });

  it('sends an explicit ISO range and exposes only a simulation action', async () => {
    const onCreateSnapshot = vi.fn().mockResolvedValue(undefined);
    const onSimulateAnchor = vi.fn().mockResolvedValue(undefined);
    render(
      <TransparencyTab
        snapshots={[snapshot()]}
        onCreateSnapshot={onCreateSnapshot}
        onSimulateAnchor={onSimulateAnchor}
        onVerifyResponse={vi.fn()}
      />,
    );

    const createButton = screen.getByRole('button', { name: /Crear corte local/i });
    expect(createButton).toBeDisabled();
    fireEvent.change(screen.getByLabelText('Desde'), { target: { value: '2026-07-01T00:00' } });
    fireEvent.change(screen.getByLabelText('Hasta'), { target: { value: '2026-07-30T23:59' } });
    expect(createButton).toBeEnabled();
    fireEvent.click(createButton);

    await waitFor(() => expect(onCreateSnapshot).toHaveBeenCalledTimes(1));
    const range = onCreateSnapshot.mock.calls[0][0];
    expect(range.desde).toBe(new Date('2026-07-01T00:00').toISOString());
    expect(range.hasta).toBe(new Date('2026-07-30T23:59').toISOString());

    fireEvent.click(screen.getByRole('button', { name: /Generar referencia local/i }));
    expect(onSimulateAnchor).toHaveBeenCalledWith(9);
    expect(screen.queryByRole('button', { name: /^Publicar/i })).not.toBeInTheDocument();
  });
});
