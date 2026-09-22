import {createServer as httpServer, request as httpRequest} from 'node:http';
import {once} from 'node:events';
import {mkdir, writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {createServer} from 'vite';

// Transport fixture only: actual Vite configuration, no per-test proxy bypass.
const backendCalls = [];
const backend = httpServer(async (req, res) => {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  backendCalls.push({method: req.method, url: req.url,
    body: Buffer.concat(chunks).toString(), headers: req.headers});
  if (req.url?.startsWith('/admin/analytics/export.csv')) {
    res.writeHead(200, {'Content-Type': 'text/csv'}).end('id\nqa-only\n');
    return;
  }
  const status = req.method === 'POST' && req.url === '/admin/encuestas' ? 409 : 401;
  res.writeHead(status, {'Content-Type': 'application/json', 'Cache-Control': 'no-store'});
  res.end(JSON.stringify({source: 'disposable-backend', status}));
});
await new Promise(resolve => backend.listen(0, '127.0.0.1', resolve));
process.env.VITE_PROXY_TARGET = `http://127.0.0.1:${backend.address().port}`;
process.env.VITE_BACKEND_URL = '/api';
let server;
const results = [];
const documentHeaders = {accept: 'text/html,application/xhtml+xml,*/*;q=0.8',
  'sec-fetch-dest': 'document', 'sec-fetch-mode': 'navigate'};
try {
  server = await createServer({cacheDir: '.vercel/admin-document-cache',
    server: {host: '127.0.0.1', port: 0}, logLevel: 'error'});
  await server.listen();
  const origin = `http://127.0.0.1:${server.httpServer.address().port}`;
  const send = (path, {method = 'GET', headers = documentHeaders, body} = {}) =>
    new Promise((resolve, reject) => {
      const req = httpRequest(origin + path, {method, headers}, res => {
        const chunks = [];
        res.on('data', chunk => chunks.push(chunk));
        res.on('end', () => resolve({status: res.statusCode, headers: res.headers,
          body: Buffer.concat(chunks).toString()}));
        res.on('error', reject);
      });
      req.on('error', reject);
      req.setTimeout(15000, () => req.destroy(new Error('Acceptance HTTP timeout')));
      req.end(body);
    });
  for (const path of ['/admin/encuestas?tenant_slug=qa-only', '/admin/encuestas/301', '/admin/pedidos', '/admin']) {
    const before = backendCalls.length;
    for (let load = 0; load < 2; load++) {
      const response = await send(path);
      assert.equal(response.status, 200);
      assert.match(response.headers['content-type'], /text\/html/);
      assert.match(response.body, /\/@vite\/client/);
      assert.doesNotMatch(response.body, /disposable-backend/);
    }
    assert.equal(backendCalls.length, before, 'Document leaked into backend proxy');
    results.push({path, repeatedNavigation: true, documentServed: true});
  }
  for (const method of ['GET', 'HEAD', 'DELETE', 'PATCH', 'PUT']) {
    const path = '/admin/encuestas/301?tenant_slug=qa-only';
    const headers = {accept: 'application/json', 'x-tenant-slug': 'qa-only',
      cookie: 'qa-only=synthetic', authorization: 'Bearer synthetic-not-a-token'};
    const body = ['PATCH', 'PUT'].includes(method) ? '{"fixture":true}' : undefined;
    const response = await send(path, {method, headers, body});
    assert.equal(response.status, 401, 'Authorization denial changed');
    assert.match(response.headers['content-type'], /application\/json/);
    const seen = backendCalls.at(-1);
    assert.equal(seen.method, method);
    assert.equal(seen.url, path);
    assert.equal(seen.headers.cookie, headers.cookie);
    assert.equal(seen.headers.authorization, headers.authorization);
    assert.equal(seen.headers['x-tenant-slug'], 'qa-only');
    if (body) assert.equal(seen.body, body);
    results.push({method, backendDenialPreserved: true, contextUnchanged: true});
  }
  // Vite's existing CORS middleware handles OPTIONS before its proxy. This
  // response is a preflight, not successful API authorization or a SPA document.
  const beforePreflight = backendCalls.length;
  const preflight = await send('/admin/encuestas/301?tenant_slug=qa-only', {
    method: 'OPTIONS', headers: {
      accept: 'application/json', origin,
      'access-control-request-method': 'DELETE',
      'access-control-request-headers': 'authorization,x-tenant-slug',
    },
  });
  assert.equal(preflight.status, 204);
  assert.equal(preflight.body, '');
  assert.equal(preflight.headers['access-control-allow-origin'], origin);
  assert.match(preflight.headers['access-control-allow-methods'], /DELETE/);
  assert.equal(backendCalls.length, beforePreflight);
  results.push({method: 'OPTIONS', originalCorsPreflightPreserved: true, noDocumentOrData: true});
  // Browser-like metadata cannot turn an attempted write into a static page.
  const write = await send('/admin/encuestas', {method: 'POST', headers: documentHeaders, body: 'fixture'});
  assert.equal(write.status, 409);
  assert.equal(backendCalls.at(-1).body, 'fixture');
  results.push({method: 'POST', conflictPreserved: true});
  for (const path of ['/admin/login', '/admin/login/', '/api/admin/encuestas']) {
    const response = await send(path);
    assert.equal(response.status, 401);
    assert.match(response.headers['content-type'], /application\/json/);
    results.push({path, originalBackendHandling: true});
  }
  const csv = await send('/admin/analytics/export.csv');
  assert.equal(csv.status, 200);
  assert.match(csv.headers['content-type'], /text\/csv/);
  assert.equal(csv.body, 'id\nqa-only\n');
  results.push({csvExportPreserved: true});
  const older = await send('/admin/encuestas', {headers: {accept: 'text/html'}});
  assert.equal(older.status, 200);
  assert.match(older.headers['content-type'], /text\/html/);
  results.push({legacyHtmlNavigation: true});
  const report = {actualViteConfig: true, testProxyOverride: false,
    backendIsTransportFixture: true, productionDeploymentTested: false, results};
  await mkdir('test-evidence/survey-card', {recursive: true});
  await writeFile('test-evidence/survey-card/admin-navigation.json', JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report));
} finally {
  await server?.close();
  backend.closeAllConnections();
  backend.close();
  await once(backend, 'close');
}
