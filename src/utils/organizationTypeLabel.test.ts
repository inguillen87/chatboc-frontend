import { describe, expect, it } from 'vitest';
import { organizationTypeLabel } from './organizationTypeLabel';

describe('descriptive organization type contract', () => {
  it.each([['municipio', 'Gobierno'], [' government ', 'Gobierno'], ['colegio', 'Educación'], ['EDUCACIÓN', 'Educación'], ['pyme', 'Empresa']])
    ('keeps the legacy technical type %s separate from its label', (type, expected) => expect(organizationTypeLabel(type)).toBe(expected));
  it('accepts a recognized versioned server label without inferring permissions from it', () => {
    expect(organizationTypeLabel('future-server-type', { organization_type_label_contract: 'organization.type_label.v1', organization_type_label: 'Educación' })).toBe('Educación');
  });
  it.each([
    { organization_type_label_contract: 'organization.type_label.v2', organization_type_label: 'Empresa' },
    { organization_type_label_contract: 'organization.type_label.v1', organization_type_label: 'Empresa' },
    { organization_type_label_contract: 'organization.type_label.v1', organization_type_label: '<b>Gobierno</b>' },
    { organization_type_label_contract: 'organization.type_label.v1', organization_type_label: null },
  ])('uses the known legacy label for incompatible metadata %j', (presentation) => {
    expect(organizationTypeLabel('municipio', presentation)).toBe('Gobierno');
  });
  it.each([null, '', '__proto__', 'constructor', 'unrecognized'])('never classifies missing or unknown type %j as a company', (type) => {
    expect(organizationTypeLabel(type, { organization_type_label_contract: 'organization.type_label.v1', organization_type_label: null })).toBe('Organización');
  });
});
