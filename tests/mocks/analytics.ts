const defaultSummary = {
  totals: { tickets: 42, conversations: 128 },
  sla: { ack: { p50: 1.2, p90: 2.5 } },
};

const defaultOperations = {
  abiertos: 7,
  derivados: 3,
};

const dataset = {
  summary: { ...defaultSummary },
  operations: { ...defaultOperations },
};

function refreshDataset() {
  dataset.summary = { ...defaultSummary };
  dataset.operations = { ...defaultOperations };
}

function isTenantAllowed(request) {
  const tenantId = request.query?.tenant_id;
  const allowedTenants = request.allowedTenants ?? [];
  const defaultTenant = request.defaultTenant ?? null;

  if (!tenantId) {
    return false;
  }

  if (allowedTenants.length === 0 && defaultTenant) {
    return tenantId === defaultTenant;
  }

  if (allowedTenants.length === 0) {
    return true;
  }

  return allowedTenants.includes(tenantId);
}

async function dispatch(request) {
  const tenantOk = isTenantAllowed(request);
  if (!tenantOk) {
    return { status: 403, body: { message: 'tenant no autorizado' } };
  }

  if (request.path === '/operations' && !['operador', 'admin'].includes(request.analyticsRole ?? '')) {
    return { status: 403, body: { message: 'rol no autorizado' } };
  }

  if (request.path === '/operations') {
    return { status: 200, body: { ...dataset.operations } };
  }

  return { status: 200, body: { ...dataset.summary } };
}

export { dispatch, refreshDataset };
