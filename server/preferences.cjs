function getPreferences(session) {
  if (!session.preferences) {
    session.preferences = [];
  }
  return session.preferences;
}

function addPreference(session, pref) {
  const prefs = getPreferences(session);
  prefs.push(pref);
}

function clearPreferences(session) {
  session.preferences = [];
}

export {
  getPreferences,
  addPreference,
  clearPreferences,
};
