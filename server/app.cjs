const http = require('node:http');
const { URL } = require('node:url');
const { dispatch, buildContextFromHeaders, cache, getHealth } = require('./analytics');

function toQueryObject(searchParams) {
  const query = {};
  for (const [key, value] of searchParams.entries()) {
    query[key] = value;
  }
  return query;
}

function applyCors(res, origin) {
  res.setHeader('Access-Control-Allow-Origin', origin || '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization,X-Analytics-Role,X-Analytics-Tenant-Ids,X-Tenant-Ids,X-Allowed-Tenants,X-Default-Tenant');
}

function sendJson(res, status, body, origin) {
  applyCors(res, origin);
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(body));
}

function createServer() {
  const server = http.createServer(async (req, res) => {
    const origin = req.headers.origin || '*';
    if (req.method === 'OPTIONS') {
      applyCors(res, origin);
      res.statusCode = 204;
      res.end();
      return;
    }

    const parsedUrl = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
    const pathname = parsedUrl.pathname;

    if (pathname === '/healthz') {
      try {
        const payload = getHealth();
        sendJson(res, 200, { status: 'ok', ...payload, cache: cache.stats() }, origin);
      } catch (error) {
        sendJson(res, 500, { status: 'error', message: error.message }, origin);
      }
      return;
    }

    if (!pathname.startsWith('/analytics')) {
      sendJson(res, 200, { status: 'ok', message: 'Analytics module activo' }, origin);
      return;
    }

    const context = buildContextFromHeaders(req.headers);
    const query = toQueryObject(parsedUrl.searchParams);
    const path = pathname.slice('/analytics'.length) || '/';
    const request = {
      method: req.method,
      path,
      query,
      headers: req.headers,
      analyticsRole: context.analyticsRole,
      allowedTenants: context.allowedTenants,
      defaultTenant: context.defaultTenant,
    };

    try {
      const result = await dispatch(request);
      sendJson(res, result.status, result.body, origin);
    } catch (error) {
      console.error('[analytics] Error inesperado', error);
      sendJson(res, 500, { message: 'Error inesperado en el servidor de analítica' }, origin);
    }
  });

  return server;
}

if (require.main === module) {
  const port = Number(process.env.PORT || 4000);
  createServer().listen(port, () => {
    console.log(`[analytics] Servidor escuchando en el puerto ${port}`);
  });
}

module.exports = createServer;
