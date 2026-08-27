import { describe, expect, it } from 'vitest';

import {
  crmProfileTone,
  getCrmProfileScore,
  normalizeUsuario,
  resolveCrmNextAction,
} from './UsuariosPage';
import { CRM_SENSITIVE_CONTENT_PLACEHOLDER } from '@/features/crm/people/sensitiveContent';

const baseContact = {
  nombre: 'Marcelo Guill',
  email: 'marcelo@example.com',
  telefono: '+5492610000000',
  marketing: true,
  resumen: 'Quiere recibir seguimiento comercial.',
  motivo: 'pedido_catalogo',
  lastIntent: 'pedido_catalogo',
  interactionCount: 4,
  lastSeen: '2026-07-03T10:00:00Z',
  avatarUrl: 'https://cdn.example.com/profile/marcelo.webp',
  avatarSource: 'profile_upload',
  avatarConsent: true,
  leadTemperature: 'warm',
};

describe('UsuariosPage CRM profile intelligence', () => {
  it('scores complete consented profiles as ready for CRM follow-up', () => {
    expect(getCrmProfileScore(baseContact)).toBe(100);
    expect(crmProfileTone(100).label).toBe('Perfil completo');
    expect(resolveCrmNextAction(baseContact)).toBe('Listo para seguimiento');
  });

  it('prioritizes missing contact data before campaigns or profile polish', () => {
    const contact = {
      ...baseContact,
      email: 'sin-email@whatsapp.chatboc.com',
      telefono: null,
      marketing: false,
      avatarUrl: null,
      avatarSource: null,
      avatarConsent: false,
    };

    expect(getCrmProfileScore(contact)).toBeLessThan(50);
    expect(resolveCrmNextAction(contact)).toBe('Pedir dato de contacto');
  });

  it('keeps hot commercial leads ahead of avatar or opt-in suggestions', () => {
    const contact = {
      ...baseContact,
      marketing: false,
      avatarUrl: null,
      avatarSource: null,
      avatarConsent: false,
      leadTemperature: 'hot',
    };

    expect(resolveCrmNextAction(contact)).toBe('Priorizar respuesta comercial');
  });

  it('does not treat untrusted profile images as real identity coverage', () => {
    const contact = {
      ...baseContact,
      avatarUrl: 'https://cdn.example.com/profile/scraped.webp',
      avatarSource: 'whatsapp_scraped',
      avatarConsent: true,
    };

    expect(getCrmProfileScore(contact)).toBe(90);
    expect(resolveCrmNextAction(contact)).toBe('Invitar a completar perfil');
  });

  it('redacts verification credentials that arrived in legacy CRM text fields', () => {
    const contact = normalizeUsuario({
      id: 42,
      channel: 'whatsapp',
      name: '123456 es tu código de verificación. No lo compartas.',
      conversation_summary: 'Your verification code is 654321. Do not share it.',
      last_message_excerpt: 'PIN: 8432',
    }, 0);

    expect(contact.nombre).toBe('Contacto WhatsApp');
    expect(contact.profileExcerpt).toBe(CRM_SENSITIVE_CONTENT_PLACEHOLDER);
    expect(contact.resumen).toBe(CRM_SENSITIVE_CONTENT_PLACEHOLDER);
    expect(contact.lastMessageExcerpt).toBe(CRM_SENSITIVE_CONTENT_PLACEHOLDER);
  });
});
