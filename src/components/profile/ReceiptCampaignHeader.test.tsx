import { useState } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import ReceiptCampaignHeader, { receiptHeaderUrlValid, type ReceiptHeader } from './ReceiptCampaignHeader';

describe('ReceiptCampaignHeader', () => {
  it.each(['http://cdn.example.test/a.png', 'https://localhost/a.png', 'https://127.0.0.1/a.png',
    'https://127.1/a.png', 'https://0x7f.0.0.1/a.png', 'https://localhost./a.png',
    'https://user:pass@cdn.example.test/a.png', 'https://cdn.example.test/a.svg',
    'https://cdn.example.test/%2e%2e/a.png', 'https://cdn.example.test/%00/a.png', 'https://cdn.example.test/%5c/a.png',
    'https://cdn.example.test/a.png?token=synthetic', 'https://cdn.example.test/a.png#synthetic'])('does not preview unsafe URL %s', url => {
    expect(receiptHeaderUrlValid(url)).toBe(false);
    render(<ReceiptCampaignHeader value={{ enabled: true, image_url: url }} onChange={() => undefined} />);
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });
  it('separates explicit disabled, inheritance, and custom image, with a recoverable preview error', () => {
    function Harness() { const [value, setValue] = useState<ReceiptHeader>(null);
      return <><ReceiptCampaignHeader value={value} onChange={setValue} /><output>{JSON.stringify(value)}</output></>; }
    render(<Harness />);
    const mode = screen.getByRole('combobox', { name: 'Imagen en los comprobantes' });
    fireEvent.change(mode, { target: { value: 'image' } });
    const url = screen.getByRole('textbox', { name: 'URL pública de la imagen' });
    fireEvent.change(url, { target: { value: 'https://cdn.example.test/campaign.png' } });
    const img = screen.getByRole('img', { name: 'Vista previa de la cabecera del comprobante' });
    expect(img).toHaveAttribute('referrerpolicy', 'no-referrer');
    fireEvent.error(img);
    expect(screen.getByText('No pudimos cargar la vista previa. Revisá que la imagen sea pública.')).toHaveAttribute('role', 'status');
    fireEvent.change(url, { target: { value: 'https://cdn.example.test/next.webp' } });
    expect(screen.getByRole('img')).toHaveAttribute('src', 'https://cdn.example.test/next.webp');
    fireEvent.change(mode, { target: { value: 'disabled' } });
    expect(screen.getByText('{"enabled":false,"image_url":""}')).toBeInTheDocument();
    fireEvent.change(mode, { target: { value: 'inherit' } });
    expect(screen.getByText('null')).toBeInTheDocument();
  });
});
