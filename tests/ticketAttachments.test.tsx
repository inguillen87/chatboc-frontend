/* @vitest-environment jsdom */
import React from 'react';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import TicketAttachments from '../src/components/tickets/TicketAttachments';
import type { Attachment } from '../src/types/tickets';

describe('TicketAttachments', () => {
  const attachments: Attachment[] = [
    {
      id: 1,
      filename: 'photo.jpg',
      url: 'https://example.com/photo.jpg',
      size: 1234,
      mime_type: 'image/jpeg',
      thumbnail_url: 'https://example.com/thumb-photo.jpg',
    },
    {
      id: 2,
      filename: 'report.pdf',
      url: 'https://example.com/report.pdf',
      size: 2345,
      mime_type: 'application/pdf',
    },
  ];

  it('renders image thumbnail and non-image link', () => {
    render(<TicketAttachments attachments={attachments} />);

    // Thumbnail image rendered for the photo attachment
    expect(screen.getByAltText('photo.jpg')).toBeInTheDocument();

    // Non-image attachment renders as a link with filename
    const link = screen.getByRole('link', { name: 'report.pdf' });
    expect(link).toHaveAttribute('href', 'https://example.com/report.pdf');
  });

  it('opens and closes modal when clicking an image thumbnail', () => {
    render(<TicketAttachments attachments={attachments} />);

    // Open modal by clicking the image button
    const button = screen.getByRole('button', { name: /abrir imagen adjunta/i });
    fireEvent.click(button);

    const dialog = screen.getByRole('dialog');
    const modalImage = within(dialog).getByAltText('Adjunto ampliado');
    expect(modalImage).toHaveAttribute('src', 'https://example.com/photo.jpg');

    // Close modal by clicking the overlay
    fireEvent.click(dialog);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});

