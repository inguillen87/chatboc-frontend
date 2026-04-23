import re

with open('src/routesConfig.tsx', 'r') as f:
    content = f.read()

imports = """
import { TicketRoutingAdminPage } from '@/pages/admin/tickets/TicketRoutingAdminPage';
"""

if "import { TicketRoutingAdminPage" not in content:
    content = content.replace("import { Navigate } from 'react-router-dom';", "import { Navigate } from 'react-router-dom';\n" + imports)

routes = """
  ...withTenantPrefixes('/:tenant/admin/tickets/routing', { element: <TicketRoutingAdminPage />, roles: ['tenant_admin', 'superadmin'] }),
"""

if "/:tenant/admin/tickets/routing" not in content:
    content = content.replace("  ...withTenantPrefixes('/:tenant/admin/policies', { element: <PoliciesAdminPage />, roles: ['tenant_admin', 'superadmin'] }),", "  ...withTenantPrefixes('/:tenant/admin/policies', { element: <PoliciesAdminPage />, roles: ['tenant_admin', 'superadmin'] }),\n" + routes)


with open('src/routesConfig.tsx', 'w') as f:
    f.write(content)
