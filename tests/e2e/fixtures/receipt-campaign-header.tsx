import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import ReceiptCampaignHeader, { receiptHeaderUrlValid, type ReceiptHeader } from '@/components/profile/ReceiptCampaignHeader';
import { Button } from '@/components/ui/button';
import '@/index.css';

// Controlled component fixture, not Perfil/UserProvider or production persistence.
function ReceiptCampaignFixture() {
  const [header, setHeader] = useState<ReceiptHeader>(null);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(''); setStatus('');
    if (header?.enabled && !receiptHeaderUrlValid(header.image_url)) {
      setError('Ingresá una URL pública HTTPS válida para la imagen.');
      return;
    }
    setSaving(true);
    try {
      const response = await fetch('/__fixture/receipt-profile', {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ organization_profile: { whatsapp_receipt_header: header } }),
      });
      const ack = await response.json();
      if (!response.ok || ack.ok !== true) throw new Error('Synthetic unconfirmed save');
      setStatus('Configuración guardada.');
    } catch {
      setError('Guardado sin confirmar. Conservamos la edición para que revises y reintentes.');
    } finally { setSaving(false); }
  }
  return <main id="fixture" style={{ margin: '0 auto', maxWidth: 900, padding: 16, minHeight: '100vh' }}>
    <h1 className="text-xl font-semibold">Configuración de una organización de prueba</h1>
    <p className="my-4 text-sm text-muted-foreground">Prueba local del componente. Identidad y guardado simulados.</p>
    <h2 className="text-lg font-semibold">Perfil de la organización</h2>
    <h3 className="my-4 font-semibold">Identidad visual</h3>
    <form onSubmit={submit} style={{ display: 'grid', gap: 16 }}>
      <ReceiptCampaignHeader value={header} onChange={next => { setHeader(next); setError(''); setStatus(''); }} />
      <Button type="submit" disabled={saving} style={{ width: 'fit-content', minHeight: 44 }}>
        {saving ? 'Guardando…' : 'Guardar configuración'}
      </Button>
      {status ? <p role="status">{status}</p> : null}
      {error ? <p role="alert">{error}</p> : null}
    </form>
  </main>;
}

createRoot(document.getElementById('root')!).render(<ReceiptCampaignFixture />);
