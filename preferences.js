export function getPreferences(session) {
  if (!session.preferences) {
    session.preferences = [];
  }
  return session.preferences;
}

export function addPreference(session, pref) {
  const prefs = getPreferences(session);
  prefs.push(pref);
}

export function clearPreferences(session) {
  session.preferences = [];
}
