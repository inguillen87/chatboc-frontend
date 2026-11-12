import React from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import SurveyChatMenuCard from './SurveyChatMenuCard';
import type { SurveyChatMenu } from './surveyChatMenu';

const menu: SurveyChatMenu = {
  title: 'Encuestas y votaciones',
  description: 'Elegí una consulta ciudadana.',
  totalAvailable: 6,
  items: Array.from({ length: 5 }, (_, index) => ({
    id: `survey-${index + 1}`,
    title: `Consulta ${index + 1}`,
    description: `Descripción ${index + 1}`,
    type: index === 0 ? 'voting' : 'survey',
    publicUrl: `https://preview.chatboc.ar/e/consulta-${index + 1}`,
    whatsappShareUrl: `https://wa.me/?text=consulta-${index + 1}`,
    responseCount: 100,
    demoResponses: true,
  })),
};

describe('SurveyChatMenuCard', () => {
  it('shows two compact primary actions and keeps the remaining links behind an accessible disclosure', () => {
    render(<SurveyChatMenuCard menu={menu} />);

    expect(screen.getByRole('region', { name: 'Encuestas y votaciones disponibles' })).toBeInTheDocument();
    const featured = screen.getByRole('list', { name: 'Consultas destacadas' });
    expect(within(featured).getAllByRole('link')).toHaveLength(2);
    expect(within(featured).getByRole('link', { name: 'Participar en Consulta 1' })).toHaveAttribute(
      'href',
      'https://preview.chatboc.ar/e/consulta-1',
    );
    expect(screen.queryByText('https://preview.chatboc.ar/e/consulta-1')).not.toBeInTheDocument();

    const disclosure = screen.getByText('Ver 3 encuestas más y opciones para compartir');
    fireEvent.click(disclosure);

    expect(screen.getByRole('list', { name: 'Más encuestas y votaciones' })).toBeVisible();
    expect(screen.getByRole('link', { name: 'Participar en Consulta 5' })).toHaveAttribute(
      'href',
      'https://preview.chatboc.ar/e/consulta-5',
    );
    expect(screen.getByRole('link', { name: 'Compartir Consulta 1 por WhatsApp' })).toHaveAttribute(
      'href',
      'https://wa.me/?text=consulta-1',
    );
    expect(screen.getByText('Mostrando 5 de 6. Usá “Ver más” para continuar.')).toBeInTheDocument();
  });
});
