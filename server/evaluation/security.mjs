import { createHmac, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';

export const COOKIE = '__Host-chatboc-evaluation';
const AUDIENCE = 'chatboc-evaluation-only-v1';
const fixedEqual = (a, b) => {
  const left = Buffer.from(String(a)); const right = Buffer.from(String(b));
  return left.length === right.length && timingSafeEqual(left, right);
};
export const passwordHash = (password, salt = randomBytes(16).toString('hex')) =>
  `scrypt$${salt}$${scryptSync(password, salt, 32).toString('hex')}`;
export function passwordMatches(password, encoded) {
  if (typeof password !== 'string' || password.length > 128) return false;
  const [method, salt, hash] = String(encoded).split('$');
  if (method !== 'scrypt' || !/^[a-f0-9]{32}$/.test(salt) || !/^[a-f0-9]{64}$/.test(hash)) return false;
  return fixedEqual(scryptSync(password, salt, 32).toString('hex'), hash);
}
export function configuration(env = process.env) {
  const until = Number(env.EVAL_EXPIRES_AT); const host = env.EVAL_PUBLIC_HOST || '';
  if (env.EVAL_ENABLED !== 'true' || !env.EVAL_USER || !env.EVAL_PASSWORD_HASH
      || !/^[a-f0-9]{64}$/.test(env.EVAL_SESSION_KEY || '') || !Number.isSafeInteger(until)
      || !/^[a-z0-9.-]+$/.test(host) || /^(www\.|api\.)?chatboc\.ar$/.test(host)) return null;
  return { user: env.EVAL_USER, hash: env.EVAL_PASSWORD_HASH, key: env.EVAL_SESSION_KEY,
    until, hosts: new Set([host, env.VERCEL_URL, env.EVAL_TEST_HOST].filter(Boolean)),
    space: env.EVAL_SPACE || 'evaluation', revision: env.EVAL_RELEASE_SHA || 'development' };
}
export function issueSession(config, host, now = Date.now()) {
  const expires = Math.min(Math.floor(now / 1000) + 7200, config.until);
  const data = { aud: AUDIENCE, sub: 'evaluation-guest', space: config.space, host,
    exp: expires, iat: Math.floor(now / 1000), nonce: randomBytes(16).toString('hex') };
  const payload = Buffer.from(JSON.stringify(data)).toString('base64url');
  const signature = createHmac('sha256', config.key).update(payload).digest('base64url');
  return { token: `${payload}.${signature}`, expires };
}
export function readSession(req, config, now = Date.now()) {
  const cookies = String(req.headers.cookie || '').split(';').map((part) => part.trim());
  const candidates = cookies.filter((part) => part.startsWith(`${COOKIE}=`));
  if (candidates.length !== 1) return null;
  const token = candidates[0].slice(COOKIE.length + 1);
  if (token.length > 2048) return null;
  const [payload, signature, extra] = token.split('.');
  if (extra !== undefined || !payload || !signature) return null;
  const expected = createHmac('sha256', config.key).update(payload).digest('base64url');
  if (!fixedEqual(signature, expected)) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    const time = Math.floor(now / 1000);
    return data.aud === AUDIENCE && data.space === config.space && data.host === req.headers.host
      && Number.isSafeInteger(data.exp) && Number.isSafeInteger(data.iat) && data.exp > time
      && data.exp <= config.until && data.iat <= time && data.exp - data.iat <= 7200 ? data : null;
  } catch { return null; }
}
export const sessionCookie = (token, seconds = 7200) =>
  `${COOKIE}=${token}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${seconds}`;
