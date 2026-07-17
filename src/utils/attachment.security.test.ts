import { describe, expect, it } from 'vitest';

import {
  getAttachmentDeliveryUrl,
  getAttachmentPreviewUrl,
  sanitizeAttachmentUrl,
} from './attachment';

describe('attachment URL security', () => {
  it('accepts HTTPS, HTTP and relative delivery paths', () => {
    expect(sanitizeAttachmentUrl('https://cdn.example.test/file.pdf?token=safe')).toBe(
      'https://cdn.example.test/file.pdf?token=safe',
    );
    expect(sanitizeAttachmentUrl('http://localhost:5000/uploads/file.pdf')).toBe(
      'http://localhost:5000/uploads/file.pdf',
    );
    expect(sanitizeAttachmentUrl('/api/attachments/42')).toBe('/api/attachments/42');
    expect(sanitizeAttachmentUrl('//cdn.example.test/file.pdf')).toBe(
      'https://cdn.example.test/file.pdf',
    );
  });

  it.each([
    'javascript:alert(1)',
    'data:text/html,<script>alert(1)</script>',
    'file:///etc/passwd',
    'https://user:password@cdn.example.test/file.pdf',
    '\\\\server\\share\\file.pdf',
  ])('rejects unsafe attachment URL %s', (value) => {
    expect(sanitizeAttachmentUrl(value)).toBeNull();
  });

  it('falls back to a safe signed URL when a preferred field is unsafe', () => {
    const attachment = {
      download_url: 'javascript:alert(1)',
      url: 'https://signed.example.test/evidence.jpg?token=safe',
      thumbUrl: 'data:image/svg+xml,<svg />',
    };

    expect(getAttachmentDeliveryUrl(attachment)).toBe(
      'https://signed.example.test/evidence.jpg?token=safe',
    );
    expect(getAttachmentPreviewUrl(attachment)).toBe(
      'https://signed.example.test/evidence.jpg?token=safe',
    );
  });
});
