import { describe, expect, it } from 'vitest';

import {
  buildCrmDirectoryPath,
  canDeepLinkCrmPerson,
  crmProfileTone,
  getCrmTransportPresentation,
  getCrmOperationalDataQualityScore,
  normalizeDirectoryPerson,
  normalizeUsuario,
  resolveCrmNextAction,
  upsertCrmContactByIdentity,
} from './UsuariosPage';
import { CRM_SENSITIVE_CONTENT_PLACEHOLDER } from '@/features/crm/people/sensitiveContent';

const baseContact = {
  nombre: 'Marcelo Guill',
  email: 'marcelo@example.com',
  telefono: '+5492610000000',
  contactId: 'contact-42',
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
  it('scores operational data quality without rewarding marketing or avatars', () => {
    expect(getCrmOperationalDataQualityScore(baseContact)).toBe(100);
    expect(canDeepLinkCrmPerson(baseContact)).toBe(true);
    expect(crmProfileTone(100).label).toBe('Calidad alta');
    expect(resolveCrmNextAction(baseContact)).toBe('Registro operativo disponible');

    const withoutCommercialProfile = {
      ...baseContact,
      marketing: false,
      avatarUrl: null,
      avatarSource: null,
      avatarConsent: false,
    };

    expect(getCrmOperationalDataQualityScore(withoutCommercialProfile)).toBe(100);
    expect(resolveCrmNextAction(withoutCommercialProfile)).toBe('Registro operativo disponible');
  });

  it('prioritizes an exact CRM identity before contact data polish', () => {
    const contact = {
      ...baseContact,
      contactId: null,
      email: 'sin-email@whatsapp.chatboc.com',
      telefono: null,
      marketing: false,
      avatarUrl: null,
      avatarSource: null,
      avatarConsent: false,
    };

    expect(getCrmOperationalDataQualityScore(contact)).toBeLessThan(50);
    expect(resolveCrmNextAction(contact)).toBe('Vincular identidad CRM');
  });

  it('builds only explicitly tenant-scoped CRM directory requests', () => {
    expect(buildCrmDirectoryPath({ tenantSlug: null })).toBeNull();
    const path = buildCrmDirectoryPath({
      tenantSlug: ' JUNIN ',
      search: ' luminaria ',
      marketingOnly: true,
    });
    const url = new URL(path || '', 'https://chatboc.ar');

    expect(url.pathname).toBe('/api/crm/clientes');
    expect(url.searchParams.get('tenant_slug')).toBe('junin');
    expect(url.searchParams.get('tenant')).toBe('junin');
    expect(url.searchParams.get('q')).toBe('luminaria');
    expect(url.searchParams.get('marketing')).toBe('true');
  });

  it('never merges two persistent identities that share a phone number', () => {
    const current = [normalizeUsuario({
      id: 'contact:a',
      contact_id: 'a',
      name: 'Persona A',
      phone: '+5492611111111',
    }, 0)];
    const incoming = normalizeUsuario({
      id: 'contact:b',
      contact_id: 'b',
      name: 'Persona B',
      phone: '+5492611111111',
    }, 1);

    const result = upsertCrmContactByIdentity(current, incoming);

    expect(result).toHaveLength(2);
    expect(result.map((person) => person.contactId)).toEqual(['b', 'a']);
    expect(result[1].nombre).toBe('Persona A');
  });

  it('normalizes numeric persistent ids before exact identity matching', () => {
    const current = [normalizeUsuario({
      id: 'contact:42',
      contact_id: 42,
      name: 'Nombre anterior',
      phone: '+5492611111111',
    }, 0)];
    const incoming = normalizeUsuario({
      id: 'contact:42',
      contact_id: '42',
      name: 'Nombre vigente',
      phone: '+5492619999999',
    }, 1);

    const result = upsertCrmContactByIdentity(current, incoming);

    expect(result).toHaveLength(1);
    expect(result[0].contactId).toBe('42');
    expect(result[0].nombre).toBe('Nombre vigente');
  });

  it('keeps phone fallback only for two legacy records without contact ids', () => {
    const current = [normalizeUsuario({
      id: 'legacy-a',
      name: 'Sin actualizar',
      phone: '+5492612222222',
    }, 0)];
    const incoming = normalizeUsuario({
      id: 'legacy-b',
      name: 'Nombre vigente',
      phone: '+5492612222222',
    }, 1);

    const result = upsertCrmContactByIdentity(current, incoming);

    expect(result).toHaveLength(1);
    expect(result[0].nombre).toBe('Nombre vigente');
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

  it('preserves masked display values without turning them into actionable identity data', () => {
    const contact = normalizeDirectoryPerson({
      id: 'person_opaque_42',
      contact_id: null,
      user_id: null,
      name: 'M*** A***',
      email: 'm***@example.com',
      phone: '***8608',
      channel: 'whatsapp',
      marketing: true,
      tags: [],
      last_seen: '2026-08-31T12:00:00Z',
      source: 'contact',
      pii_masked: true,
      possible_duplicate: true,
    }, 0);

    expect(contact.telefono).toBe('***8608');
    expect(contact.contactId).toBeNull();
    expect(contact.whatsappExplicit).toBe(false);
    expect(contact.possibleDuplicate).toBe(true);
    expect(canDeepLinkCrmPerson(contact)).toBe(false);
    expect(getCrmOperationalDataQualityScore(contact)).toBe(0);
    expect(resolveCrmNextAction(contact)).toBe('Datos protegidos — requiere permiso');
  });

  it('labels socket state as transport evidence, never as user presence or delivery', () => {
    expect(getCrmTransportPresentation(true, 3)).toEqual({
      statusLabel: 'Transporte conectado',
      signalLabel: '3 señales recibidas',
    });
    expect(getCrmTransportPresentation(false, -1)).toEqual({
      statusLabel: 'Actualización manual',
      signalLabel: '0 señales recibidas',
    });
  });
});
