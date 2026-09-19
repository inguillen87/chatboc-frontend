import { configuration, passwordMatches, issueSession, readSession, sessionCookie } from './security.mjs';
import { loadGuide, responseFor } from './guide.mjs';

// A bounded per-worker throttle for this non-production demonstration.
// It is not a distributed account lockout or a production authentication service.
const attempts = new Map();
function permitAttempt(key, now) {
  for (const [id, item] of attempts) if (item.until <= now) attempts.delete(id);
  if (!attempts.has(key)) {
    if (attempts.size >= 300) return false;
    attempts.set(key, { count: 0, until: now + 60000 });
  }
  const item = attempts.get(key);
  item.count += 1;
  return item.count <= 6;
}
function send(res, status, body) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store, max-age=0');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Vary', 'Cookie, Origin');
  res.end(JSON.stringify(body));
}
async function jsonBody(req) {
  if (!String(req.headers['content-type'] || '').startsWith('application/json')) throw new Error('json_required');
  let body = '';
  for await (const chunk of req) {
    body += chunk;
    if (Buffer.byteLength(body) > 4096) throw new Error('body_too_large');
  }
  const parsed = JSON.parse(body || '{}');
  if (!parsed || Array.isArray(parsed) || typeof parsed !== 'object') throw new Error('json_required');
  return parsed;
}
export function createHandler({ env = process.env, guideLoader = loadGuide, clock = Date.now } = {}) {
  return async (req, res) => {
    const now = clock(); const config = configuration(env);
    const host = req.headers.host;
    if (!config || !config.hosts.has(host)) return send(res, 404, { error: 'evaluation_unavailable' });
    if (Math.floor(now / 1000) >= config.until) return send(res, 410, { error: 'evaluation_expired' });
    const url = new URL(req.url, `https://${host}`);
    const action = url.searchParams.get('action') || 'session';
    const isPost = req.method === 'POST';
    if (!['GET','POST'].includes(req.method)) return send(res, 405, { error: 'method_not_allowed' });
    if (isPost && req.headers.origin !== `https://${host}`) return send(res, 403, { error: 'origin_not_allowed' });
    const session = readSession(req, config, now);
    const publicState = { evaluation_only: true, email_verified: false, mfa_verified: false,
      provider_connected: false, production_access: false, release_sha: config.revision,
      title: env.EVAL_DISPLAY_NAME || 'Agente conversacional accesible',
      institution: env.EVAL_INSTITUTION || 'Espacio de evaluación', evaluation_expires_at: config.until,
      presentation_url: /^https:\/\/[a-z0-9-]+\.vercel\.app\/?$/.test(env.EVAL_PRESENTATION_URL || '') ? env.EVAL_PRESENTATION_URL : null };
    if (action === 'session' && !isPost) return send(res, 200, { ...publicState, authenticated: Boolean(session), session_expires_at: session?.exp || null });
    if (action === 'login' && isPost) {
      const ip = String(req.headers['x-vercel-forwarded-for'] || req.socket?.remoteAddress || 'unknown').slice(0,128);
      if (!permitAttempt(`${config.space}:${ip}`, now)) {
        res.setHeader('Retry-After', '60'); return send(res, 429, { error: 'try_again_later' });
      }
      let input; try { input = await jsonBody(req); } catch { return send(res, 400, { error: 'invalid_request' }); }
      const validPassword = passwordMatches(input.password, config.hash);
      if (typeof input.username !== 'string' || input.username.trim().toLowerCase() !== config.user.toLowerCase() || !validPassword)
        return send(res, 401, { error: 'invalid_demo_credentials' });
      const issued = issueSession(config, host, now);
      res.setHeader('Set-Cookie', sessionCookie(issued.token, issued.expires - Math.floor(now/1000)));
      return send(res, 200, { ...publicState, authenticated: true, session_expires_at: issued.expires });
    }
    if (action === 'logout' && isPost) {
      res.setHeader('Set-Cookie', sessionCookie('', 0));
      return send(res, 200, { ...publicState, authenticated: false });
    }
    if (!session) return send(res, 401, { error: 'evaluation_login_required' });
    if (action !== 'menu' || !isPost) return send(res, 404, { error: 'evaluation_action_unknown' });
    try {
      const input = await jsonBody(req);
      if (Object.keys(input).some((key) => !['node','selection'].includes(key))) return send(res, 400, { error: 'invalid_request' });
      const guide = guideLoader(); const answer = responseFor(guide, input.node || 'start', input.selection ?? null);
      if (!answer) return send(res, 400, { error: 'choose_a_listed_option' });
      return send(res, 200, { ...answer, source: guide.source, policy: guide.policy });
    } catch { return send(res, 400, { error: 'evaluation_request_unavailable' }); }
  };
}
export default createHandler();
