import { describe, expect, it } from 'vitest';

import {
  extractDemoExperienceSources,
  normalizeExperienceBlueprint,
} from '@/utils/demoExperienceBlueprint';

describe('demo experience blueprint normalization', () => {
  it('normalizes component pack and channel playbooks', () => {
    const blueprint = normalizeExperienceBlueprint({
      component_pack: [
        { id: 'welcome', title: 'Bienvenida', description: 'Primer bloque' },
      ],
      channel_playbooks: {
        whatsapp: [{ id: 'wa-start', label: 'Inicio WA' }],
      },
    });

    expect(blueprint?.component_pack[0]).toMatchObject({
      id: 'welcome',
      label: 'Bienvenida',
      description: 'Primer bloque',
    });
    expect(blueprint?.channel_playbooks.whatsapp[0]?.label).toBe('Inicio WA');
  });

  it('extracts onboarding + widget blueprints and quick menu from both payloads', () => {
    const result = extractDemoExperienceSources(
      {
        demoOnboarding: {
          experience_blueprint: {
            component_pack: [{ label: 'Onboarding block' }],
          },
        },
      },
      {
        widget: {
          experience_blueprint: {
            channel_playbooks: {
              widget_chat: [{ label: 'Playbook widget' }],
            },
          },
          builder_config: {
            quick_menu: [{ id: 'faq', label: 'FAQ' }],
          },
        },
      },
    );

    expect(result.demoOnboarding?.component_pack[0]?.label).toBe('Onboarding block');
    expect(result.widget?.channel_playbooks.widget_chat[0]?.label).toBe('Playbook widget');
    expect(result.quickMenu[0]?.id).toBe('faq');
  });
});
