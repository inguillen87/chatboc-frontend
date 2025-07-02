import React, { useEffect, useState } from 'react';
import { apiFetch, getErrorMessage } from '@/utils/api';
import { Button } from '@/components/ui/button';

interface Survey {
  id: number;
  pregunta: string;
  opciones: string[];
}

export default function SatisfactionSurveys() {
  const [surveys, setSurveys] = useState<Survey[]>([]);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<Survey[]>('/municipal/surveys')
      .then((data) => setSurveys(data))
      .catch(() => setSurveys([]));
  }, []);

  const handleSubmit = async (id: number) => {
    if (!answers[id]) return;
    setSaving(true);
    setError(null);
    try {
      await apiFetch(`/municipal/surveys/${id}/response`, {
        method: 'POST',
        body: { respuesta: answers[id] },
      });
    } catch (e: any) {
      setError(getErrorMessage(e, 'Error'));
    } finally {
      setSaving(false);
    }
  };

  if (surveys.length === 0) return <p className="p-4">Sin encuestas disponibles</p>;

  return (
    <div className="p-4 max-w-2xl mx-auto space-y-4">
      <h1 className="text-2xl font-bold">Encuestas</h1>
      {error && <p className="text-destructive text-sm">{error}</p>}
      {surveys.map((s) => (
        <div key={s.id} className="border-b pb-4 space-y-2">
          <p className="font-medium">{s.pregunta}</p>
          <div className="space-y-1">
            {s.opciones.map((o) => (
              <label key={o} className="flex items-center gap-2">
                <input
                  type="radio"
                  name={`survey-${s.id}`}
                  value={o}
                  checked={answers[s.id] === o}
                  onChange={() => setAnswers({ ...answers, [s.id]: o })}
                />
                <span>{o}</span>
              </label>
            ))}
          </div>
          <Button onClick={() => handleSubmit(s.id)} disabled={saving || !answers[s.id]}>
            Enviar
          </Button>
        </div>
      ))}
    </div>
  );
}
