import re

with open('src/routesConfig.tsx', 'r') as f:
    content = f.read()

imports = """
import { PoliciesAdminPage } from '@/pages/admin/policies/PoliciesAdminPage';
import { KnowledgeSourcesPage } from '@/pages/admin/knowledge/KnowledgeSourcesPage';
import { PromptVersionsPage } from '@/pages/admin/knowledge/PromptVersionsPage';
import { AuditExplorerPage } from '@/pages/admin/audit/AuditExplorerPage';
import { AnalyticsCostsPage } from '@/pages/admin/costs/AnalyticsCostsPage';
"""

if "import { PoliciesAdminPage" not in content:
    content = content.replace("import { Navigate } from 'react-router-dom';", "import { Navigate } from 'react-router-dom';\n" + imports)

routes = """
  // Epic FE-J Admin Routes
  ...withTenantPrefixes('/:tenant/admin/policies', { element: <PoliciesAdminPage />, roles: ['tenant_admin', 'superadmin'] }),
  ...withTenantPrefixes('/:tenant/admin/knowledge', { element: <KnowledgeSourcesPage />, roles: ['tenant_admin', 'superadmin'] }),
  ...withTenantPrefixes('/:tenant/admin/prompts', { element: <PromptVersionsPage />, roles: ['tenant_admin', 'superadmin'] }),
  ...withTenantPrefixes('/:tenant/admin/audit', { element: <AuditExplorerPage />, roles: ['tenant_admin', 'superadmin', 'analytics_viewer'] }),
  ...withTenantPrefixes('/:tenant/admin/costs', { element: <AnalyticsCostsPage />, roles: ['tenant_admin', 'superadmin', 'analytics_viewer'] }),
"""

if "/:tenant/admin/policies" not in content:
    content = content.replace("  ...withTenantPrefixes('/:tenant/admin/catalog', { element: <CatalogManagementPage />, roles: ['tenant_admin', 'superadmin', 'catalog_manager', 'employee'] }),", "  ...withTenantPrefixes('/:tenant/admin/catalog', { element: <CatalogManagementPage />, roles: ['tenant_admin', 'superadmin', 'catalog_manager', 'employee'] }),\n" + routes)


with open('src/routesConfig.tsx', 'w') as f:
    f.write(content)
