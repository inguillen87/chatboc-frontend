import re

with open('src/pages/EstadisticasPage.tsx', 'r') as f:
    content = f.read()

imports = """import { AIAssistedInsights } from '@/components/analytics/AIAssistedInsights';
"""

content = content.replace("import {\n  Alert,\n  AlertDescription,\n  AlertTitle,\n} from '@/components/ui/alert';", "import {\n  Alert,\n  AlertDescription,\n  AlertTitle,\n} from '@/components/ui/alert';\n" + imports)

# We want to inject AIAssistedInsights at the top of the dashboard, probably near HeatmapDashboard or where the filters are.
# Let's locate the main return wrapper which usually starts with `<div className="w-full h-full flex flex-col...">`
# We'll just put it right after the header/title block.

patch_injection = """
        <div className="flex-1 w-full bg-background overflow-hidden p-6">
           <AIAssistedInsights />
           <div className="mt-6" />
"""

content = re.sub(
    r'<div className="flex-1 w-full bg-background overflow-hidden">',
    patch_injection,
    content
)

with open('src/pages/EstadisticasPage.tsx', 'w') as f:
    f.write(content)
