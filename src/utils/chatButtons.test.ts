import { describe, expect, it } from 'vitest';
import { mergeButtons } from './chatButtons';

describe('mergeButtons', () => {
  it('extracts backend action menus from vertical contract objects', () => {
    const buttons = mergeButtons(
      {
        primary_actions: [
          { label: 'Crear reclamo', action_id: 'crear_reclamo' },
          { label: 'Hablar con una persona', action_id: 'derivar_humano' },
        ],
      },
      {
        actions: [
          { label: 'Consultar estado', action_id: 'consultar_estado_reclamo' },
        ],
      },
    );

    expect(buttons).toEqual([
      expect.objectContaining({ texto: 'Crear reclamo', action_id: 'crear_reclamo', action: 'crear_reclamo' }),
      expect.objectContaining({ texto: 'Hablar con una persona', action_id: 'derivar_humano', action: 'derivar_humano' }),
      expect.objectContaining({
        texto: 'Consultar estado',
        action_id: 'consultar_estado_reclamo',
        action: 'consultar_estado_reclamo',
      }),
    ]);
  });

  it('deduplicates actions across generic, school and commerce menu sources', () => {
    const buttons = mergeButtons(
      [{ label: 'Crear caso escolar', action_id: 'create_school_case' }],
      { quick_menu: [{ label: 'Abrir caso escolar', action_id: 'create_school_case' }] },
      { primary_actions: [{ label: 'Crear pedido', action_id: 'crear_pedido' }] },
    );

    expect(buttons.map((button) => button.action_id)).toEqual(['create_school_case', 'crear_pedido']);
  });

  it('skips disabled backend buttons and supports cta label aliases', () => {
    const buttons = mergeButtons({
      actions: [
        { cta_label: 'Hacer reclamo', action_id: 'crear_reclamo', description: 'Dentro del chat' },
        { label: 'Turno viejo', action_id: 'turno_viejo', enabled: false },
      ],
    });

    expect(buttons).toEqual([
      expect.objectContaining({
        texto: 'Hacer reclamo',
        action_id: 'crear_reclamo',
        description: 'Dentro del chat',
      }),
    ]);
  });
});
