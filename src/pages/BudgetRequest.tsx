import React, { useState } from 'react';
import { apiFetch, getErrorMessage } from '@/utils/api';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';

export default function BudgetRequest() {
  const [detail, setDetail] = useState('');
  const [loading, setLoading] = useState(false);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setPdfUrl(null);
    try {
      const data = await apiFetch<{ pdf_url: string }>('/presupuestos', {
        method: 'POST',
        body: { detalle: detail },
      });
      setPdfUrl(data.pdf_url);
    } catch (err: any) {
      setError(getErrorMessage(err, 'Error'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-4 max-w-xl mx-auto space-y-4">
      <h1 className="text-2xl font-bold">Solicitar Presupuesto</h1>
      <form onSubmit={handleSubmit} className="space-y-3">
        <Textarea
          value={detail}
          onChange={(e) => setDetail(e.target.value)}
          placeholder="Detalle de productos o servicios..."
          required
        />
        {error && <p className="text-destructive text-sm">{error}</p>}
        <Button type="submit" disabled={loading} className="w-full">
          {loading ? 'Enviando...' : 'Generar PDF'}
        </Button>
      </form>
      {pdfUrl && (
        <div className="bg-muted p-4 rounded">
          <a
            href={pdfUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 underline"
          >
            Descargar presupuesto
          </a>
        </div>
      )}
    </div>
  );
}
