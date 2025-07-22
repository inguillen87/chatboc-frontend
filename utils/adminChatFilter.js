const loginActions = new Set([
  'login',
  'loginpanel',
  'chatuserloginpanel',
  'register',
  'registerpanel',
  'chatuserregisterpanel'
]);

function filterLoginPrompt(text, buttons = [], role) {
  const isAdmin = role && role !== 'usuario';
  if (!isAdmin) {
    return { text, buttons };
  }

  let finalText = text;
  if (typeof text === 'string') {
    const low = text.toLowerCase();
    if (low.includes('inici') && low.includes('ses')) {
      finalText = '';
    }
  }

  const finalButtons = Array.isArray(buttons)
    ? buttons.filter((b) => {
        const act = (b.action || b.accion_interna || '')
          .toLowerCase()
          .replace(/[_\s-]+/g, '');
        return !loginActions.has(act);
      })
    : [];

  return { text: finalText, buttons: finalButtons };
}

export default filterLoginPrompt;
export { filterLoginPrompt };
