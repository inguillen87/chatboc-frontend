import { describe, it, expect, beforeEach } from 'vitest';
import * as prefs from 'server/preferences.js';

describe('preferences', () => {
  let session;

  beforeEach(() => {
    session = {};
  });

  it('should record preferences', () => {
    prefs.addPreference(session, 'busqueda:camisa');
    prefs.addPreference(session, 'Camisa Oxford');
    expect(prefs.getPreferences(session)).toEqual(['busqueda:camisa', 'Camisa Oxford']);
  });

  it('should clear preferences', () => {
    prefs.addPreference(session, 'busqueda:camisa');
    prefs.clearPreferences(session);
    expect(prefs.getPreferences(session)).toEqual([]);
  });
});
