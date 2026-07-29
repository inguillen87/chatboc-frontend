import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import type {
  SurveyConditionalGroupV2,
  SurveyConditionalNodeV2,
  SurveyDraftPayload,
} from '@/types/encuestas';

import { SurveyLogicMap } from './SurveyLogicMap';

type DraftQuestion = SurveyDraftPayload['preguntas'][number];

const leaf = (questionRef: string, optionRef: string) => ({
  kind: 'option_selected' as const,
  question_ref: questionRef,
  option_ref: optionRef,
});

const group = (
  operator: 'and' | 'or',
  children: SurveyConditionalNodeV2[],
): SurveyConditionalGroupV2 => ({ kind: 'group', operator, children });

const question = (partial: Partial<DraftQuestion> & Pick<DraftQuestion, 'orden' | 'texto'>): DraftQuestion => ({
  tipo: 'opcion_unica',
  obligatoria: true,
  opciones: [
    { orden: 1, texto: 'Web', option_ref: `option:${partial.orden}:web` },
    { orden: 2, texto: 'WhatsApp', option_ref: `option:${partial.orden}:whatsapp` },
  ],
  ...partial,
});

describe('SurveyLogicMap', () => {
  it('orders every question node and resolves an unconditional root plus a v1 edge', () => {
    const questions: SurveyDraftPayload['preguntas'] = [
      question({
        orden: 2,
        texto: 'Detalle del canal',
        tipo: 'abierta',
        opciones: undefined,
        conditional_logic: { version: 1, show_if: { question_order: 1, option_order: 2 } },
      }),
      question({ orden: 1, texto: 'Canal utilizado' }),
    ];

    const { container } = render(<SurveyLogicMap className="logic-map-test" questions={questions} />);

    const region = screen.getByRole('region', { name: 'Mapa de lógica' });
    expect(region).toHaveClass('logic-map-test');
    expect(screen.getByRole('heading', { level: 2, name: 'Mapa de lógica' })).toBeInTheDocument();
    expect(screen.getByRole('list', { name: 'Preguntas y reglas de visibilidad' })).toBeInTheDocument();

    const nodes = [...container.querySelectorAll<HTMLElement>('[data-logic-status]')];
    expect(nodes).toHaveLength(2);
    expect(nodes[0]).toHaveTextContent(/pregunta 1.*canal utilizado.*siempre visible/i);
    expect(nodes[0]).toHaveAttribute('data-logic-status', 'root');
    expect(nodes[1]).toHaveTextContent(/pregunta 2.*detalle del canal.*arista v1 por orden/i);
    expect(nodes[1]).toHaveTextContent('P1 · Canal utilizado');
    expect(nodes[1]).toHaveTextContent('O2 · WhatsApp');
    expect(nodes[1]).toHaveAttribute('data-logic-status', 'valid');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('renders the nested v2 AND/OR tree and resolves source refs to readable labels', () => {
    const questions: SurveyDraftPayload['preguntas'] = [
      question({ orden: 1, texto: 'Canal', question_ref: 'question:channel' }),
      question({ orden: 2, texto: 'Dispositivo', question_ref: 'question:device' }),
      question({
        orden: 3,
        texto: 'Seguimiento',
        tipo: 'abierta',
        opciones: undefined,
        question_ref: 'question:follow-up',
        conditional_logic: {
          version: 2,
          show_if: group('and', [
            leaf('question:channel', 'option:1:whatsapp'),
            group('or', [
              leaf('question:device', 'option:2:web'),
              leaf('question:device', 'option:2:whatsapp'),
            ]),
          ]),
        },
      }),
    ];

    const { container } = render(<SurveyLogicMap questions={questions} />);

    expect(screen.getByText('Todas (AND)')).toBeInTheDocument();
    expect(screen.getByText('Cualquiera (OR)')).toBeInTheDocument();
    expect(screen.getByText('P1 · Canal')).toBeInTheDocument();
    expect(screen.getAllByText('P2 · Dispositivo')).toHaveLength(2);
    expect(screen.getAllByText(/O2 · WhatsApp/)).toHaveLength(2);
    expect(screen.getByText('O1 · Web')).toBeInTheDocument();
    expect(screen.getByText(/árbol v2 por referencias/i)).toBeInTheDocument();
    expect(container.querySelector('[data-logic-status="invalid"]')).not.toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('flags dangling, ambiguous, forward and non-selectable v2 sources fail-closed', () => {
    const selectable = question({
      orden: 1,
      texto: 'Fuente válida',
      question_ref: 'question:valid',
      opciones: [
        { orden: 1, texto: 'Duplicada A', option_ref: 'option:ambiguous' },
        { orden: 2, texto: 'Duplicada B', option_ref: 'option:ambiguous' },
      ],
    });
    const nonSelectable = question({
      orden: 2,
      texto: 'Fuente abierta',
      tipo: 'abierta',
      opciones: undefined,
      question_ref: 'question:text',
    });
    const duplicateRefA = question({ orden: 3, texto: 'Duplicada A', question_ref: 'question:duplicate' });
    const duplicateRefB = question({ orden: 4, texto: 'Duplicada B', question_ref: 'question:duplicate' });
    const forwardTarget = question({
      orden: 5,
      texto: 'Destino adelantado',
      tipo: 'abierta',
      opciones: undefined,
      conditional_logic: {
        version: 2,
        show_if: group('and', [leaf('question:future', 'option:future')]),
      },
    });
    const futureSource = question({
      orden: 6,
      texto: 'Fuente futura',
      question_ref: 'question:future',
      opciones: [{ orden: 1, texto: 'Futura', option_ref: 'option:future' }],
    });
    const targets: DraftQuestion[] = [
      question({
        orden: 7,
        texto: 'Destino colgante',
        tipo: 'abierta',
        opciones: undefined,
        conditional_logic: {
          version: 2,
          show_if: group('and', [leaf('question:missing', 'option:missing')]),
        },
      }),
      question({
        orden: 8,
        texto: 'Destino ambiguo',
        tipo: 'abierta',
        opciones: undefined,
        conditional_logic: {
          version: 2,
          show_if: group('and', [leaf('question:duplicate', 'option:3:web')]),
        },
      }),
      question({
        orden: 9,
        texto: 'Destino no seleccionable',
        tipo: 'abierta',
        opciones: undefined,
        conditional_logic: {
          version: 2,
          show_if: group('and', [leaf('question:text', 'option:text')]),
        },
      }),
      question({
        orden: 10,
        texto: 'Destino opción ambigua',
        tipo: 'abierta',
        opciones: undefined,
        conditional_logic: {
          version: 2,
          show_if: group('and', [leaf('question:valid', 'option:ambiguous')]),
        },
      }),
    ];

    render(
      <SurveyLogicMap
        questions={[
          selectable,
          nonSelectable,
          duplicateRefA,
          duplicateRefB,
          forwardTarget,
          futureSource,
          ...targets,
        ]}
      />,
    );

    const alerts = screen.getAllByRole('alert');
    expect(alerts).toHaveLength(5);
    expect(screen.getAllByText(/no existe la pregunta fuente con ref question:missing/i)).toHaveLength(2);
    expect(screen.getAllByText(/ref question:duplicate es ambigua/i)).toHaveLength(2);
    expect(screen.getAllByText(/fuente P6 no es anterior a la pregunta P5/i)).toHaveLength(2);
    expect(screen.getAllByText(/fuente P2 es abierta y no admite opciones seleccionables/i)).toHaveLength(2);
    expect(screen.getAllByText(/ref de opción option:ambiguous es ambigua/i)).toHaveLength(2);
    alerts.forEach((alert) => {
      expect(alert).toHaveTextContent(/regla bloqueada \(fail-closed\)/i);
      expect(alert).toHaveTextContent(/se mantendrá oculta/i);
    });
  });

  it('flags malformed logic and an ambiguous v1 order instead of presenting them as roots', () => {
    const questions: SurveyDraftPayload['preguntas'] = [
      question({ orden: 1, texto: 'Fuente A' }),
      question({ orden: 1, texto: 'Fuente B' }),
      question({
        orden: 2,
        texto: 'Destino v1 ambiguo',
        tipo: 'abierta',
        opciones: undefined,
        conditional_logic: { version: 1, show_if: { question_order: 1, option_order: 1 } },
      }),
      question({
        orden: 3,
        texto: 'Destino malformado',
        tipo: 'abierta',
        opciones: undefined,
        conditional_logic: {
          version: 2,
          show_if: { kind: 'group', operator: 'xor', children: [] },
        } as never,
      }),
    ];

    const { container } = render(<SurveyLogicMap questions={questions} />);

    expect(screen.getAllByText(/orden 1 es ambiguo: coincide con 2 preguntas/i)).toHaveLength(2);
    expect(screen.getByText(/estructura de conditional_logic es inválida/i)).toBeInTheDocument();
    expect(screen.getAllByRole('alert')).toHaveLength(2);
    expect(container.querySelectorAll('[data-logic-status="invalid"]')).toHaveLength(2);
    const malformedNode = screen.getByText('Destino malformado').closest('[data-logic-status]');
    expect(malformedNode).toHaveTextContent(/regla inválida/i);
    expect(within(malformedNode as HTMLElement).getByRole('alert')).toBeInTheDocument();
  });
});
