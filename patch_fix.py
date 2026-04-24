import re

with open('src/pages/admin/CatalogManagementPage.tsx', 'r') as f:
    content = f.read()

# Fix the syntax error from my regex replacement
content = content.replace("import React,\nimport { CatalogStorefrontPreview } from '@/components/admin/catalog/CatalogStorefrontPreview';\n { useState, useEffect, useMemo } from 'react';", "import React, { useState, useEffect, useMemo } from 'react';\nimport { CatalogStorefrontPreview } from '@/components/admin/catalog/CatalogStorefrontPreview';")

with open('src/pages/admin/CatalogManagementPage.tsx', 'w') as f:
    f.write(content)
