import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const config = JSON.parse(
  readFileSync(`${process.cwd()}/vercel.json`, 'utf8'),
);

const headersForSource = (source) => {
  const rule = config.headers.find((candidate) => candidate.source === source);
  return new Map((rule?.headers ?? []).map(({ key, value }) => [key, value]));
};

describe('Vercel security headers', () => {
  it('blocks framing for panel and authentication HTML', () => {
    const protectedRule = config.headers.find((rule) =>
      String(rule.source).startsWith('/((?!iframe'),
    );
    const headers = new Map(
      (protectedRule?.headers ?? []).map(({ key, value }) => [key, value]),
    );

    expect(protectedRule?.has).toEqual([
      { type: 'header', key: 'accept', value: '.*text/html.*' },
    ]);
    expect(headers.get('X-Frame-Options')).toBe('DENY');
    expect(headers.get('Content-Security-Policy')).toContain("frame-ancestors 'none'");
    expect(headers.get('X-Content-Type-Options')).toBe('nosniff');
    expect(headers.get('Referrer-Policy')).toBe('strict-origin-when-cross-origin');

    const matcher = new RegExp(`^${protectedRule.source}$`);
    expect(matcher.test('/login')).toBe(true);
    expect(matcher.test('/perfil')).toBe(true);
    expect(matcher.test('/iframe')).toBe(false);
    expect(matcher.test('/iframe.html')).toBe(false);
    expect(matcher.test('/iframe/tenant')).toBe(false);
  });

  it.each(['/iframe', '/iframe/(.*)', '/iframe.html'])(
    'keeps %s deliberately embeddable without X-Frame-Options',
    (source) => {
      const headers = headersForSource(source);
      expect(headers.get('Content-Security-Policy')).toContain('frame-ancestors *');
      expect(headers.has('X-Frame-Options')).toBe(false);
      expect(headers.get('Permissions-Policy')).toContain('microphone=*');
    },
  );

  it('does not retain the ineffective ALLOWALL directive', () => {
    expect(JSON.stringify(config)).not.toContain('ALLOWALL');
    expect(config.rewrites).toEqual(
      expect.arrayContaining([
        { source: '/iframe', destination: '/iframe.html' },
        { source: '/iframe/(.*)', destination: '/iframe.html' },
      ]),
    );
  });
});
