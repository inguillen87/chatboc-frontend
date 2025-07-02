const crypto = require('crypto');

const sessions = new Map();

function parseCookies(header) {
  const result = {};
  if (!header) return result;
  const parts = header.split(';');
  for (const part of parts) {
    const [key, ...val] = part.trim().split('=');
    result[key] = decodeURIComponent(val.join('='));
  }
  return result;
}

function sessionMiddleware(req, res, next) {
  const cookies = parseCookies(req.headers.cookie || '');
  let sid = cookies.sid;
  if (!sid || !sessions.has(sid)) {
    sid = crypto.randomBytes(8).toString('hex');
    sessions.set(sid, {});
    res.setHeader('Set-Cookie', `sid=${sid}; Path=/; HttpOnly`);
  }
  req.session = sessions.get(sid);
  next();
}

module.exports = sessionMiddleware;
