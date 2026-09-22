import {test} from 'node:test';
import assert from 'node:assert/strict';
import {adminDocumentNavigation} from '../src/utils/adminDocumentNavigation.ts';

const document = {accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'sec-fetch-dest': 'document', 'sec-fetch-mode': 'navigate'};
const request = (url = '/admin/encuestas', method = 'GET', headers = document) => ({url, method, headers});

for (const path of ['/admin', '/admin/', '/admin/encuestas', '/admin/encuestas/301',
  '/admin/encuestas/301/analytics?focus=live', '/admin/pedidos?tenant_slug=qa-only']) {
  test(`opens a genuine admin document: ${path}`, () => {
    assert.equal(adminDocumentNavigation(request(path)), '/index.html');
  });
}
test('permits a HEAD navigation without turning it into a mutation', () => {
  assert.equal(adminDocumentNavigation(request('/admin/encuestas', 'HEAD')), '/index.html');
});
for (const method of ['POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS']) {
  test(`never swallows ${method} even with document headers`, () => {
    assert.equal(adminDocumentNavigation(request('/admin/encuestas/301', method)), undefined);
  });
}
for (const path of ['/api/admin/encuestas', '/admin/login', '/admin/login/',
  '/admin/analytics/export.csv', '/admin/report.pdf?download=1', '/administrator',
  '/auth/login', '/admin.js', '//admin/encuestas', '/admin/assets/module.js']) {
  test(`keeps original handling for ${path}`, () => {
    assert.equal(adminDocumentNavigation(request(path)), undefined);
  });
}
for (const headers of [
  {accept: 'application/json'}, {accept: '*/*'}, {},
  {...document, accept: 'text/html;q=0'}, {...document, accept: 'text/html;q=invalid'},
  {...document, accept: 'text/html;q=0;q=1'}, {...document, accept: 'text/html;q=2'},
  {...document, 'sec-fetch-dest': 'empty'}, {...document, 'sec-fetch-mode': 'cors'},
  {...document, 'sec-fetch-dest': 'iframe'}, {accept: 'text/html', 'sec-fetch-mode': 'navigate'},
  {accept: 'text/html', 'sec-fetch-dest': 'document'},
  {accept: 'text/html', 'x-requested-with': 'XMLHttpRequest'},
  {accept: 'text/html,application/json'}, {accept: 'text/html,application/problem+json'},
]) {
  test(`preserves non-document request: ${JSON.stringify(headers)}`, () => {
    assert.equal(adminDocumentNavigation(request('/admin/encuestas', 'GET', headers)), undefined);
  });
}
test('supports older browsers with an explicit HTML accept and no fetch metadata', () => {
  assert.equal(adminDocumentNavigation(request('/admin/encuestas', 'GET', {accept: 'text/html'})), '/index.html');
});
test('handles positive HTML quality and an explicitly unacceptable JSON type', () => {
  assert.equal(adminDocumentNavigation(request('/admin/encuestas', 'GET', {
    accept: 'TEXT/HTML;q=0.5,application/json;q=0',
  })), '/index.html');
});
test('fails closed for oversized or non-string headers and targets', () => {
  for (const value of [request('/admin/' + 'x'.repeat(8192)), request(undefined),
    request('/admin/encuestas', 'GET', {accept: ['text/html']}),
    request('/admin/encuestas', 'GET', {accept: 'text/html,' + 'x'.repeat(8192)})]) {
    // Undefined is set explicitly because the fixture defaults its argument.
    if (value.url === '/admin/encuestas' && value.headers === document) value.url = undefined;
    assert.equal(adminDocumentNavigation(value), undefined);
  }
});
test('does not mutate or strip private request headers or query parameters', () => {
  const original = request('/admin/encuestas?tenant_slug=qa-only', 'GET', {
    accept: 'application/json', cookie: 'qa-only=synthetic', authorization: 'Bearer synthetic',
  });
  const snapshot = structuredClone(original);
  assert.equal(adminDocumentNavigation(original), undefined);
  assert.deepEqual(original, snapshot);
});
