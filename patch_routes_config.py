import re

with open('src/routesConfig.tsx', 'r') as f:
    content = f.read()

# Make the roles consistent with the new unified roles
replacements = {
    "'admin', 'empleado', 'super_admin'": "'tenant_admin', 'employee', 'superadmin'",
    "'admin', 'super_admin'": "'tenant_admin', 'superadmin'",
    "'admin'": "'tenant_admin'",
    "'admin', 'super_admin', 'empleado'": "'tenant_admin', 'superadmin', 'employee'",
    "'admin', 'super_admin', 'tenant_admin'": "'tenant_admin', 'superadmin'",
    "'admin', 'tenant_admin', 'super_admin'": "'tenant_admin', 'superadmin'",
    "'super_admin'": "'superadmin'"
}

# Apply some specific granular roles
# /admin/catalog and /catalogo related: add catalog_manager
replacements["{ element: <CatalogManagementPage />, roles: ['tenant_admin', 'superadmin', 'employee'] }"] = "{ element: <CatalogManagementPage />, roles: ['tenant_admin', 'superadmin', 'catalog_manager', 'employee'] }"
replacements["{ element: <CatalogMappingPage />, roles: ['tenant_admin', 'superadmin'] }"] = "{ element: <CatalogMappingPage />, roles: ['tenant_admin', 'superadmin', 'catalog_manager'] }"
replacements["{ element: <ProductCatalog />, roles: ['tenant_admin', 'superadmin'] }"] = "{ element: <ProductCatalog />, roles: ['tenant_admin', 'superadmin', 'catalog_manager'] }"
replacements["{ element: <CategoryManagementPage />, roles: ['tenant_admin', 'superadmin'] }"] = "{ element: <CategoryManagementPage />, roles: ['tenant_admin', 'superadmin', 'catalog_manager'] }"

# /analytics and stats related: add analytics_viewer
replacements["{ element: <EstadisticasPage />, roles: ['tenant_admin', 'superadmin'] }"] = "{ element: <EstadisticasPage />, roles: ['tenant_admin', 'superadmin', 'analytics_viewer'] }"
replacements["{ element: <AnalyticsPage />, roles: ['tenant_admin', 'employee', 'superadmin'] }"] = "{ element: <AnalyticsPage />, roles: ['tenant_admin', 'employee', 'superadmin', 'analytics_viewer'] }"
replacements["{ element: <MunicipalMessageMetrics />, roles: ['tenant_admin', 'superadmin'] }"] = "{ element: <MunicipalMessageMetrics />, roles: ['tenant_admin', 'superadmin', 'analytics_viewer'] }"

for old, new in replacements.items():
    content = content.replace(old, new)

# One more pass using regex to catch arrays formatting differences
content = re.sub(r"roles:\s*\[\s*'admin',\s*'empleado',\s*'super_admin'\s*\]", "roles: ['tenant_admin', 'employee', 'superadmin']", content)
content = re.sub(r"roles:\s*\[\s*'admin',\s*'super_admin'\s*\]", "roles: ['tenant_admin', 'superadmin']", content)
content = re.sub(r"roles:\s*\[\s*'super_admin'\s*\]", "roles: ['superadmin']", content)
content = re.sub(r"roles:\s*\[\s*'admin'\s*\]", "roles: ['tenant_admin']", content)

with open('src/routesConfig.tsx', 'w') as f:
    f.write(content)
