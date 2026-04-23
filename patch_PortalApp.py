import re

with open('src/PortalApp.tsx', 'r') as f:
    content = f.read()

# Add PortalLandingPage import and route
imports = """import { PortalLandingPage } from '@/pages/user-portal/PortalLandingPage';
"""

if "import { PortalLandingPage" not in content:
    content = content.replace("import NotFound from '@/pages/NotFound';", "import NotFound from '@/pages/NotFound';\n" + imports)

route = """          <Route path="/:tenant/welcome" element={<PortalLandingPage />} />
          <Route path="/welcome" element={<PortalLandingPage />} />"""

if "/welcome" not in content:
    content = content.replace('<Route path="*" element={<NotFound />} />', route + '\n          <Route path="*" element={<NotFound />} />')

with open('src/PortalApp.tsx', 'w') as f:
    f.write(content)
