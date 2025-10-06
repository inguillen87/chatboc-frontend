/* @vitest-environment jsdom */
import React from 'react';
import { render, fireEvent, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { AgendaPasteForm } from '../src/components/admin/AgendaPasteForm';

const sample = `¡Buenas noches!
AGENDA MUNICIPAL

Domingo 31

🕑9.00 a 16.00 hs.
✅Encuentro Femenino de Vóley
📍Polideportivo Posta El Retamo`;

describe('AgendaPasteForm', () => {
  it('shows preview of parsed agenda', async () => {
    render(<AgendaPasteForm onCancel={() => {}} />);
    const textarea = screen.getByPlaceholderText('Pega aquí el texto completo de la agenda...');
    fireEvent.change(textarea, { target: { value: sample } });

    expect(await screen.findByText('AGENDA MUNICIPAL')).toBeInTheDocument();
    expect(await screen.findByText('Domingo 31')).toBeInTheDocument();
    expect(await screen.findByText('Encuentro Femenino de Vóley')).toBeInTheDocument();
    expect(await screen.findByText('9.00 - 16.00')).toBeInTheDocument();
  });
});
