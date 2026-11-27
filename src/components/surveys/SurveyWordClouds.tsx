import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import type { SurveySummary } from '@/types/encuestas';

interface WordCloudTerm {
  term: string;
  count: number;
}

interface QuestionWordCloud {
  key: string;
  question: string;
  terms: WordCloudTerm[];
  responsesConsidered: number;
  minCount: number;
  truncated: boolean;
}

const MAX_TERMS = 60;
const MIN_REM = 0.95;
const MAX_REM = 2.5;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value);

const count = (value: unknown): number | null =>
  typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 ? value : null;

/**
 * Reads the per-question term aggregate of the administration summary.
 * Questions without the aggregate (older servers, other question types, or a
 * cohort the server withheld for privacy) are left out.
 */
export function readSurveyWordClouds(summary?: SurveySummary | null): QuestionWordCloud[] {
  const questions = isRecord(summary) && Array.isArray(summary.preguntas) ? (summary.preguntas as unknown[]) : [];
  return questions.flatMap((question, index) => {
    if (!isRecord(question) || !isRecord(question.word_cloud)) return [];
    const cloud = question.word_cloud;
    const responsesConsidered = count(cloud.responses_considered);
    const minCount = count(cloud.min_count);
    if (!Array.isArray(cloud.terms) || responsesConsidered === null || minCount === null || minCount < 1) return [];
    const terms = cloud.terms
      .filter(
        (item): item is WordCloudTerm =>
          isRecord(item) &&
          typeof item.term === 'string' &&
          item.term.trim().length > 0 &&
          item.term.length <= 40 &&
          count(item.count) !== null &&
          (item.count as number) >= minCount,
      )
      .slice(0, MAX_TERMS);
    return [{
      key: String(question.pregunta_id ?? index),
      question: typeof question.texto === 'string' && question.texto.trim() ? question.texto.trim() : `Pregunta ${index + 1}`,
      terms,
      responsesConsidered,
      minCount,
      truncated: cloud.truncated === true,
    }];
  });
}

const sizeFor = (value: number, lowest: number, highest: number) => {
  if (highest <= lowest) return (MIN_REM + MAX_REM) / 2;
  const position = (Math.log(value) - Math.log(lowest)) / (Math.log(highest) - Math.log(lowest));
  return MIN_REM + position * (MAX_REM - MIN_REM);
};

const NUMBER = new Intl.NumberFormat('es-AR');

export function SurveyWordClouds({ summary }: { summary?: SurveySummary | null }) {
  const clouds = readSurveyWordClouds(summary);
  if (!clouds.length) return null;

  return (
    <Card data-survey-word-clouds>
      <CardHeader>
        <CardTitle>Palabras que más se repiten</CardTitle>
        <CardDescription>
          En las preguntas abiertas. Cuanto más grande la palabra, más personas la escribieron. No se muestra el texto de ninguna respuesta.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-8">
        {clouds.map((cloud) => {
          const counts = cloud.terms.map((item) => item.count);
          const highest = Math.max(...counts, 1);
          const lowest = Math.min(...counts, highest);
          return (
            <section key={cloud.key} aria-label={cloud.question} className="space-y-3">
              <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                <h3 className="text-base font-semibold text-foreground">{cloud.question}</h3>
                <p className="text-sm text-muted-foreground">
                  {NUMBER.format(cloud.responsesConsidered)} {cloud.responsesConsidered === 1 ? 'respuesta escrita' : 'respuestas escritas'}
                </p>
              </div>
              {cloud.terms.length ? (
                <ul className="flex flex-wrap items-baseline gap-x-4 gap-y-1 rounded-[12px] border border-border bg-muted/20 px-5 py-4">
                  {cloud.terms.map((item) => (
                    <li
                      key={item.term}
                      className="leading-tight text-foreground"
                      style={{
                        fontSize: `${sizeFor(item.count, lowest, highest).toFixed(2)}rem`,
                        fontWeight: item.count === highest ? 700 : 500,
                      }}
                    >
                      {item.term}
                      <span className="ml-1 align-middle text-xs font-normal tabular-nums text-muted-foreground">
                        {NUMBER.format(item.count)}
                        <span className="sr-only"> respuestas</span>
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="rounded-[12px] border border-dashed border-border px-5 py-4 text-sm text-muted-foreground">
                  Todavía no hay palabras que se repitan en al menos {NUMBER.format(cloud.minCount)} respuestas.
                </p>
              )}
              <p className="text-xs text-muted-foreground">
                Se muestran las palabras que aparecen en {NUMBER.format(cloud.minCount)} respuestas o más.
                {cloud.truncated ? ' Se usaron las respuestas más recientes.' : ''}
              </p>
            </section>
          );
        })}
      </CardContent>
    </Card>
  );
}

export default SurveyWordClouds;
