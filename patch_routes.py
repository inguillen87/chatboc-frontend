import re

with open('src/routesConfig.tsx', 'r') as f:
    content = f.read()

import_statement = "import { TicketInboxPage } from '@/components/tickets/inbox';"
if import_statement not in content:
    content = content.replace("import { Navigate } from 'react-router-dom';", "import { Navigate } from 'react-router-dom';\n" + import_statement)


# Let's map /inbox to TicketInboxPage for now so it's accessible and tests it,
# while keeping /tickets as TicketsPanel to not break legacy panel flows completely immediately.

new_route = "  ...withTenantPrefixes('/:tenant/inbox', { element: <TicketInboxPage />, roles: ['tenant_admin', 'employee', 'superadmin'] }),"
if "/inbox" not in content:
    content = content.replace("  ...withTenantPrefixes('/:tenant/tickets', { element: <TicketsPanel />, roles: ['tenant_admin', 'employee', 'superadmin'] }),", "  ...withTenantPrefixes('/:tenant/tickets', { element: <TicketsPanel />, roles: ['tenant_admin', 'employee', 'superadmin'] }),\n" + new_route)

with open('src/routesConfig.tsx', 'w') as f:
    f.write(content)
