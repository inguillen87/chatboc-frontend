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
          twilio_trial: {
            display_number: '+1 (415) 523-8886',
            join_phrase: 'join brief-yesterday',
            wa_deeplink: 'https://wa.me/14155238886?text=join%20brief-yesterday',
            security_limits: { messages_per_session: 10, upgrade_required_for: ['qdrant_catalog'] },
          },
          activation_state: {
            activated: false,
            max_activations: 1,
            activations_used: 0,
          },
          activation_endpoint: '/api/v1/portal/demo/integration/demo/activate-whatsapp',
          quick_menu: [{ id: 'reclamos', label: 'Reclamos' }],
          feature_flags: { heatmap: true, upload_xlsx: false },
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
    expect(result.twilioTrial?.display_number).toBe('+1 (415) 523-8886');
    expect(result.activationState?.max_activations).toBe(1);
    expect(result.activationEndpoint).toContain('activate-whatsapp');
    expect(result.onboardingQuickMenu[0]?.id).toBe('reclamos');
    expect(result.featureFlags?.heatmap).toBe(true);
  });
});
