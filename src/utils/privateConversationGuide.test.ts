import { describe, expect, it } from 'vitest';
import fixture from '../../tests/fixtures/private-conversation-guide.json';
import { readGuideAccess, readPrivateGuide } from './privateConversationGuide';
const access = readGuideAccess(fixture.access, fixture.access.tenant)!;
const clone = () => JSON.parse(JSON.stringify(fixture.guide));
describe('private source guide contract from real HTTP', () => {
  it('reads the server response and reconstructs only presentation fields', () => {
    expect(access).not.toBeNull();
    const raw = { ...clone(), credential: 'never-render', menu: { ...fixture.guide.menu, private_value: 'never-render' } };
    const result = readPrivateGuide(raw, access)!;
    expect(result.menu.title).toBe(fixture.guide.menu.title);
    expect(result.menu.source.label).toBe(fixture.guide.source.label);
    expect(JSON.stringify(result)).not.toContain('never-render');
  });
  it('rejects a descriptor for another tenant or an external endpoint', () => {
    expect(readGuideAccess(fixture.access, { id: 2, slug: 'acceptance-b' })).toBeNull();
    expect(readGuideAccess({ ...fixture.access, endpoint: 'https://external.invalid' }, fixture.access.tenant)).toBeNull();
  });
  it.each(['tenant', 'guide_id', 'evaluation_only', 'guide_sha256', 'source', 'policy', 'writes_performed', 'provider_calls_performed', 'ui'])(
    'fails closed without %s', key => { const raw = clone(); delete raw[key]; expect(readPrivateGuide(raw, access)).toBeNull(); });
  it.each(['accepts_personal_data', 'creates_real_cases', 'queries_official_records', 'sends_notifications', 'stores_feedback'])(
    'rejects a response that claims %s is operational', key => { const raw = clone(); raw.policy[key] = true; expect(readPrivateGuide(raw, access)).toBeNull(); });
  it('rejects mismatched tenant, repeated codes and references outside the source', () => {
    const foreign = clone(); foreign.tenant.slug = 'acceptance-b'; expect(readPrivateGuide(foreign, access)).toBeNull();
    const codes = clone(); codes.menu.actions.push(codes.menu.actions[0]); expect(readPrivateGuide(codes, access)).toBeNull();
    const page = clone(); page.menu.source_pages = [15]; expect(readPrivateGuide(page, access)).toBeNull();
  });
});
