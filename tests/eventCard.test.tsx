/* @vitest-environment jsdom */
import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import EventCard from '../src/components/chat/EventCard';
import type { Post } from '../src/types/chat';

describe('EventCard', () => {
  it('shows image, main link, and social links when provided', () => {
    const post: Post = {
      id: 1,
      titulo: 'Expo Educativa',
      contenido: 'Detalles del evento',
      tipo_post: 'evento',
      imagen_url: 'https://example.com/image.jpg',
      url: 'https://example.com',
      facebook: 'https://facebook.com/municipio',
    };
    render(<EventCard post={post} />);
    expect(screen.getByAltText('Expo Educativa')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /ver más detalles/i })).toHaveAttribute('href', 'https://example.com');
    expect(screen.getByRole('link', { name: /facebook/i })).toHaveAttribute('href', 'https://facebook.com/municipio');
  });
});
