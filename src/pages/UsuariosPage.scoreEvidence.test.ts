import { describe, expect, it } from 'vitest';
import { normalizeDirectoryPerson, normalizeUsuario, upsertCrmContactByIdentity } from './UsuariosPage';

const rawContact = {
  id: 'contact:score-evidence-synthetic', contact_id: 'score-evidence-synthetic',
  name: 'Contacto de prueba', phone: '+15555550101', channel: 'whatsapp',
};

describe('CRM stored score evidence', () => {
  it('keeps missing, null, blank and invalid evidence unknown instead of assigning zero', () => {
    expect(normalizeUsuario(rawContact, 0).leadScore).toBeUndefined();
    for (const value of [null, undefined, '', '  ', false, true, {}, [], 'not-a-score', NaN, Infinity, -Infinity]) {
      expect(normalizeUsuario({ ...rawContact, lead_score: value }, 0).leadScore).toBeUndefined();
    }
  });

  it('preserves an explicit zero and other finite stored numbers without calculating a new score', () => {
    for (const value of [0, 55, 85, 87.5]) {
      expect(normalizeUsuario({ ...rawContact, lead_score: value }, 0).leadScore).toBe(value);
    }
    expect(normalizeUsuario({ ...rawContact, lead_score: '0' }, 0).leadScore).toBe(0);
    expect(normalizeUsuario({ ...rawContact, lead_score: '85' }, 0).leadScore).toBe(85);
  });

  it('keeps the existing camel-case transport alias and canonical field precedence', () => {
    expect(normalizeUsuario({ ...rawContact, leadScore: 55 }, 0).leadScore).toBe(55);
    expect(normalizeUsuario({ ...rawContact, lead_score: 0, leadScore: 85 }, 0).leadScore).toBe(0);
    for (const canonical of [null, undefined, '', '  ', false, 'invalid']) {
      expect(normalizeUsuario({ ...rawContact, lead_score: canonical, leadScore: 85 }, 0).leadScore).toBeUndefined();
    }
    expect(normalizeUsuario({ ...rawContact, leadTemperature: 'hot' }, 0).leadTemperature).toBe('hot');
    for (const canonical of [null, undefined, '', '  ']) {
      expect(normalizeUsuario({ ...rawContact, lead_temperature: canonical, leadTemperature: 'hot' }, 0).leadTemperature).toBeNull();
    }
    expect(normalizeUsuario({ ...rawContact, marketing: true }, 0).marketing).toBe(true);
    expect(normalizeUsuario({ ...rawContact, opt_in_marketing: true }, 0).marketing).toBe(true);
    for (const canonical of [null, undefined, false]) {
      expect(normalizeUsuario({ ...rawContact, acepta_marketing: canonical, marketing: true, opt_in_marketing: true }, 0).marketing).toBe(false);
    }
    expect(normalizeUsuario({ ...rawContact, marketing: null, opt_in_marketing: true }, 0).marketing).toBe(false);
  });

  it('does not reintroduce zero through the canonical directory adapter or realtime identity upsert', () => {
    const person = normalizeDirectoryPerson({
      id: rawContact.id, contact_id: rawContact.contact_id, user_id: null,
      name: rawContact.name, email: '', phone: rawContact.phone, channel: 'whatsapp',
      marketing: false, tags: [], last_seen: null, source: 'contact', pii_masked: false,
      possible_duplicate: false,
    }, 0);
    expect(person.leadScore).toBeUndefined();
    const updated = upsertCrmContactByIdentity([], normalizeUsuario(rawContact, 0));
    expect(updated).toHaveLength(1);
    expect(updated[0].leadScore).toBeUndefined();
    expect(JSON.parse(JSON.stringify(updated[0]))).not.toHaveProperty('leadScore');
  });

  it('preserves explicit classification and marketing values while missing score remains unknown', () => {
    const person = normalizeUsuario({ ...rawContact, lead_score: null,
      lead_temperature: 'hot', acepta_marketing: true }, 0);
    expect(person.leadScore).toBeUndefined();
    expect(person.leadTemperature).toBe('hot');
    expect(person.marketing).toBe(true);
    expect(normalizeUsuario({ ...rawContact, acepta_marketing: false }, 0).marketing).toBe(false);
    expect(normalizeUsuario({ ...rawContact, lead_temperature: null }, 0).leadTemperature).toBeNull();
  });
});
