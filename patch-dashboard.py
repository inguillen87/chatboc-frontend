import re

with open('src/pages/admin/SuperAdminDashboard.tsx', 'r') as f:
    content = f.read()

# 1. Inject import
import_stmt = "import { TenantPipelineKanban } from '@/components/admin/superadmin/TenantPipelineKanban';\n"
if "TenantPipelineKanban" not in content:
    content = content.replace("import { WhatsappInventoryPanel } from '@/components/admin/WhatsappInventoryPanel';",
                              "import { WhatsappInventoryPanel } from '@/components/admin/WhatsappInventoryPanel';\n" + import_stmt)

# 2. Inject handleKanbanStatusChange
kanban_handler = """
  const handleKanbanStatusChange = async (tenantId: string, newStage: string) => {
     try {
      await apiFetch(`/api/admin/superadmin/tenants/${tenantId}/pipeline`, {
        method: 'PUT',
        body: { pipeline_stage: newStage },
      });
      toast.success(`Tenant movido a ${newStage}`);
      fetchTenants(); // Re-fetch to sync
    } catch (err: any) {
      toast.error(err.message || 'Error al actualizar etapa en el pipeline');
      fetchTenants(); // Revert on error
    }
  };
"""
if "handleKanbanStatusChange" not in content:
    content = content.replace("const handlePurge = (tenantId: string) => {", kanban_handler + "\n  const handlePurge = (tenantId: string) => {")

# 3. Inject Tabs structure
tabs_imports = "import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';\n"
if "TabsContent" not in content:
    content = content.replace("import { Badge } from '@/components/ui/badge';", "import { Badge } from '@/components/ui/badge';\n" + tabs_imports)

old_card = """<Card className="border-muted/60 shadow-sm">
        <CardHeader>
          <CardTitle>Tenants ({total})</CardTitle>
          <CardDescription>
            Listado completo de municipios y pymes registrados en la plataforma.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {error ? (
            <div className="text-center text-red-500 py-8">{error}</div>
          ) : (
            <TenantTable
              tenants={tenants}
              loading={loading}
              onEdit={handleEdit}
              onImpersonate={handleImpersonate}
              onToggleStatus={handleToggleStatus}
              onPurge={handlePurge}
            />
          )}
        </CardContent>
      </Card>"""

new_tabs = """<Tabs defaultValue="pipeline" className="w-full">
         <TabsList className="mb-4">
            <TabsTrigger value="pipeline">Pipeline Kanban</TabsTrigger>
            <TabsTrigger value="list">Directorio</TabsTrigger>
         </TabsList>

         <TabsContent value="pipeline" className="mt-0">
            <TenantPipelineKanban tenants={tenants as any} onStatusChange={handleKanbanStatusChange} />
         </TabsContent>

         <TabsContent value="list" className="mt-0 space-y-6">
            <Card className="border-muted/60 shadow-sm">
              <CardHeader>
                <CardTitle>Tenants ({total})</CardTitle>
                <CardDescription>
                  Listado completo de municipios y pymes registrados en la plataforma.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {error ? (
                  <div className="text-center text-red-500 py-8">{error}</div>
                ) : (
                  <TenantTable
                    tenants={tenants}
                    loading={loading}
                    onEdit={handleEdit}
                    onImpersonate={handleImpersonate}
                    onToggleStatus={handleToggleStatus}
                    onPurge={handlePurge}
                  />
                )}
              </CardContent>
            </Card>
         </TabsContent>
      </Tabs>"""

content = content.replace(old_card, new_tabs)

with open('src/pages/admin/SuperAdminDashboard.tsx', 'w') as f:
    f.write(content)
