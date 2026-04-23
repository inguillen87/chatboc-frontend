import re

with open('src/pages/admin/CatalogManagementPage.tsx', 'r') as f:
    content = f.read()

# Make sure it uses the new Storefront preview when testing
imports = """import { CatalogStorefrontPreview } from '@/components/admin/catalog/CatalogStorefrontPreview';
"""
if "import { CatalogStorefrontPreview }" not in content:
    content = content.replace("import React,", "import React,\n" + imports)

# We want to inject it inside a Tab or simply inside the page
patch = """
          <TabsContent value="preview" className="mt-4">
             <div className="bg-card border rounded-md p-4 flex flex-col gap-4">
                <div className="flex gap-2">
                   <Badge variant="outline" className="cursor-pointer">WhatsApp</Badge>
                   <Badge variant="outline" className="cursor-pointer bg-primary text-primary-foreground">Widget</Badge>
                   <Badge variant="outline" className="cursor-pointer">Portal Web</Badge>
                </div>
                <CatalogStorefrontPreview
                   mode="widget"
                   tenantName="Mi Catálogo"
                   products={currentCatalog.slice(0, 8).map(p => ({
                      id: p.id, name: p.nombre, category: p.categoria || 'General', price: p.precio_unitario || 0, imageUrl: p.imagen_url
                   }))}
                />
             </div>
          </TabsContent>
"""
if "value=\"preview\"" not in content:
    # Inject after the mapping or configuration tabs
    content = re.sub(r'(<TabsList className="mb-4">.*?)</TabsList>', r'\1<TabsTrigger value="preview">Vista Previa</TabsTrigger></TabsList>', content, flags=re.DOTALL)
    content = re.sub(r'(</Tabs>)', patch.strip() + '\n\1', content)

with open('src/pages/admin/CatalogManagementPage.tsx', 'w') as f:
    f.write(content)
