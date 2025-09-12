/* @vitest-environment jsdom */
import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import TicketAttachments from '@/components/tickets/TicketAttachments';
import type { Attachment } from '@/types/tickets';

describe('TicketAttachments', () => {
  it('renders only allowed attachments and warns about disallowed ones', () => {
    const attachments: Attachment[] = [
      {
        id: 1,
        filename: 'image.jpg',
        url: 'https://example.com/image.jpg',
        size: 123,
        mime_type: 'image/jpeg'
      },
      {
        id: 2,
        filename: 'script.js',
        url: 'https://example.com/script.js',
        size: 10,
        mime_type: 'text/javascript'
      }
    ];

    render(<TicketAttachments attachments={attachments} />);

    // allowed image is displayed
    expect(screen.getByAltText('image.jpg')).toBeInTheDocument();
    // disallowed file not displayed
    expect(screen.queryByText('script.js')).not.toBeInTheDocument();
    // warning message displayed
    expect(
      screen.getByText(/archivos no se muestran por tipo no permitido/i)
    ).toBeInTheDocument();
  });
});
