import React, { useEffect, useMemo, useState } from 'react';
import useRequireRole from '@/hooks/useRequireRole';
import type { Role } from '@/utils/roles';
import { fetchMunicipalPlaybook } from '@/services/municipalPlaybookService';
import type {
  MunicipalPlaybookContent,
  StackOption,
  ReusableModule,
  GovernanceChecklist,
} from '@/config/municipalBiPlaybook';
import { municipalPlaybookFallback } from '@/config/municipalBiPlaybook';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { Download, RefreshCcw, Sparkles, Target } from 'lucide-react';

const renderComponentList = (title: string, components?: StackOption['backend']) => {
  if (!components || !components.length) return null;
  return (
    <div>
      <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">{title}</h4>
      <ul className="mt-2 space-y-1 text-sm">
        {components.map((item) => (
          <li key={`${title}-${item.label}`} className="flex items-start gap-2">
            <span className="mt-1 h-1.5 w-1.5 flex-none rounded-full bg-primary" aria-hidden />
            <div>
              <p className="font-medium text-foreground">{item.label}</p>
              {item.description && (
                <p className="text-muted-foreground">{item.description}</p>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
};

const groupModules = (modules: ReusableModule[]): Record<string, ReusableModule[]> => {
  return modules.reduce<Record<string, ReusableModule[]>>((acc, module) => {
    const category = module.tags[0] ?? 'General';
    if (!acc[category]) {
      acc[category] = [];
    }
    acc[category].push(module);
    return acc;
  }, {});
};

const groupGovernance = (items: GovernanceChecklist[]): Record<GovernanceChecklist['category'], GovernanceChecklist[]> => {
  return items.reduce<Record<GovernanceChecklist['category'], GovernanceChecklist[]>>((acc, item) => {
    const key = item.category;
    if (!acc[key]) {
      acc[key] = [];
    }
    acc[key].push(item);
    return acc;
  }, { privacy: [], accessibility: [], data: [] });
};

const downloadFile = (filename: string, content: string, type = 'application/json') => {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
};

const toMarkdown = (data: MunicipalPlaybookContent): string => {
  const lines: string[] = [];
  lines.push(`# Playbook analítico municipal`);
  lines.push(`_Actualizado: ${data.updatedAt}_`);
  lines.push('');
  lines.push(data.intro);
  lines.push('');
  lines.push(`## Plataformas BI/no-code`);
  data.platforms.forEach((platform) => {
    lines.push(`### ${platform.name}`);
    lines.push(`**Foco:** ${platform.focus}`);
    if (platform.highlights.length) {
      lines.push('**Highlights:**');
      platform.highlights.forEach((item) => lines.push(`- ${item}`));
    }
    if (platform.integrationNotes) {
      lines.push(`**Integración:** ${platform.integrationNotes}`);
    }
    lines.push('');
  });
  lines.push('## Stacks sugeridos');
  data.stacks.forEach((stack) => {
    lines.push(`### ${stack.title}`);
    if (stack.summary) lines.push(stack.summary);
    if (stack.backend.length) {
      lines.push('- **Backend:**');
      stack.backend.forEach((item) => lines.push(`  - ${item.label}${item.description ? ` — ${item.description}` : ''}`));
    }
    if (stack.dataLayer?.length) {
      lines.push('- **Datos:**');
      stack.dataLayer.forEach((item) => lines.push(`  - ${item.label}${item.description ? ` — ${item.description}` : ''}`));
    }
    if (stack.frontend.length) {
      lines.push('- **Frontend:**');
      stack.frontend.forEach((item) => lines.push(`  - ${item.label}${item.description ? ` — ${item.description}` : ''}`));
    }
    if (stack.analytics.length) {
      lines.push('- **Analytics:**');
      stack.analytics.forEach((item) => lines.push(`  - ${item.label}${item.description ? ` — ${item.description}` : ''}`));
    }
    if (stack.observability?.length) {
      lines.push('- **Observabilidad:**');
      stack.observability.forEach((item) => lines.push(`  - ${item.label}${item.description ? ` — ${item.description}` : ''}`));
    }
    if (stack.mlops?.length) {
      lines.push('- **MLOps / Workflow:**');
      stack.mlops.forEach((item) => lines.push(`  - ${item.label}${item.description ? ` — ${item.description}` : ''}`));
    }
    if (stack.notes?.length) {
      lines.push('- **Notas:**');
      stack.notes.forEach((note) => lines.push(`  - ${note}`));
    }
    lines.push('');
  });
  if (data.reusableModules.length) {
    lines.push('## Módulos reutilizables');
    data.reusableModules.forEach((module) => {
      lines.push(`### ${module.name}`);
      lines.push(module.description);
      if (module.outcomes.length) {
        lines.push('Beneficios:');
        module.outcomes.forEach((outcome) => lines.push(`- ${outcome}`));
      }
      lines.push('');
    });
  }
  if (data.governance.length) {
    lines.push('## Checklists de gobernanza');
    data.governance.forEach((item) => {
      lines.push(`### ${item.title}`);
      item.items.forEach((check) => lines.push(`- [ ] ${check}`));
      lines.push('');
    });
  }
  return lines.join('\n');
};

const MunicipalPlaybookPage: React.FC = () => {
  useRequireRole(['admin', 'super_admin'] as Role[]);
  const [playbook, setPlaybook] = useState<MunicipalPlaybookContent | null>(null);
  const [selectedStackId, setSelectedStackId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    let isMounted = true;
    setLoading(true);
    fetchMunicipalPlaybook()
      .then((data) => {
        if (!isMounted) return;
        setPlaybook(data);
        setSelectedStackId((prev) => prev ?? data.stacks[0]?.id ?? null);
        setError(null);
      })
      .catch((err) => {
        console.error('No se pudo obtener el playbook municipal', err);
        if (!isMounted) return;
        setError('No pudimos recuperar la guía desde el backend. Se muestra el fallback local.');
        setPlaybook(municipalPlaybookFallback);
        setSelectedStackId((prev) => prev ?? municipalPlaybookFallback.stacks[0]?.id ?? null);
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });
    return () => {
      isMounted = false;
    };
  }, []);

  const selectedStack = useMemo<StackOption | null>(() => {
    if (!playbook || !selectedStackId) return null;
    return playbook.stacks.find((stack) => stack.id === selectedStackId) ?? playbook.stacks[0] ?? null;
  }, [playbook, selectedStackId]);

  const moduleGroups = useMemo(() => (playbook ? groupModules(playbook.reusableModules) : {}), [playbook]);
  const governanceGroups = useMemo(
    () => (playbook ? groupGovernance(playbook.governance) : { privacy: [], accessibility: [], data: [] }),
    [playbook],
  );

  const handleExport = async (format: 'json' | 'markdown') => {
    if (!playbook) return;
    try {
      setExporting(true);
      if (format === 'json') {
        downloadFile('municipal-playbook.json', JSON.stringify(playbook, null, 2));
      } else {
        const markdown = toMarkdown(playbook);
        downloadFile('municipal-playbook.md', markdown, 'text/markdown');
      }
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="mx-auto max-w-6xl space-y-10 px-4 py-10">
      <header className="space-y-4">
        <div className="flex items-center gap-3 text-primary">
          <Sparkles className="h-6 w-6" />
          <p className="text-sm font-medium uppercase tracking-wider">Playbook analítico municipal</p>
        </div>
        <h1 className="text-3xl font-bold tracking-tight">Guía para desplegar analítica y BI en gobiernos locales</h1>
        {playbook && (
          <p className="text-lg text-muted-foreground max-w-3xl">{playbook.intro}</p>
        )}
        {playbook && (
          <Alert>
            <Target className="h-5 w-5" />
            <AlertTitle>¿Por dónde empezar?</AlertTitle>
            <AlertDescription>{playbook.callToAction}</AlertDescription>
          </Alert>
        )}
        <div className="flex flex-wrap gap-3">
          <Button onClick={() => handleExport('json')} disabled={!playbook || exporting}>
            <Download className="mr-2 h-4 w-4" /> Exportar JSON
          </Button>
          <Button onClick={() => handleExport('markdown')} variant="outline" disabled={!playbook || exporting}>
            <Download className="mr-2 h-4 w-4" /> Exportar Markdown
          </Button>
          <Button onClick={() => setSelectedStackId(playbook?.stacks[0]?.id ?? null)} variant="ghost" disabled={!playbook || loading}>
            <RefreshCcw className="mr-2 h-4 w-4" /> Reiniciar selección
          </Button>
        </div>
        {playbook && (
          <p className="text-xs text-muted-foreground">Última actualización: {playbook.updatedAt}</p>
        )}
      </header>

      {error && (
        <Alert variant="destructive">
          <AlertTitle>Se cargó la versión offline</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <section className="space-y-4">
        <h2 className="text-2xl font-semibold">Plataformas BI y dashboards</h2>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {(playbook?.platforms ?? municipalPlaybookFallback.platforms).map((platform) => (
            <Card key={platform.id} className="h-full">
              <CardHeader>
                <CardTitle className="flex items-center justify-between gap-3">
                  <span>{platform.name}</span>
                  <Badge variant="secondary">{platform.focus}</Badge>
                </CardTitle>
                <CardDescription>{platform.integrationNotes}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {platform.highlights.length > 0 && (
                  <ul className="list-disc space-y-1 pl-4 text-sm text-muted-foreground">
                    {platform.highlights.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                )}
                {platform.connectors && platform.connectors.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold uppercase text-muted-foreground">Conectores soportados</p>
                    <div className="mt-1 flex flex-wrap gap-2">
                      {platform.connectors.map((connector) => (
                        <Badge key={connector} variant="outline">
                          {connector}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
                {platform.embedding && (
                  <p className="text-xs text-muted-foreground">
                    Embebido: {platform.embedding.supportsEmbedding ? 'sí' : 'no'}
                    {platform.embedding.notes ? ` — ${platform.embedding.notes}` : ''}
                  </p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <Separator />

      <section className="space-y-4">
        <h2 className="text-2xl font-semibold">Stacks recomendados</h2>
        {loading && !playbook ? (
          <p className="text-sm text-muted-foreground">Cargando stacks sugeridos...</p>
        ) : playbook ? (
          <Tabs value={selectedStack?.id ?? playbook.stacks[0]?.id ?? ''} onValueChange={setSelectedStackId}>
            <TabsList className="flex flex-wrap gap-2">
              {playbook.stacks.map((stack) => (
                <TabsTrigger key={stack.id} value={stack.id} className="capitalize">
                  {stack.title}
                </TabsTrigger>
              ))}
            </TabsList>
            {playbook.stacks.map((stack) => (
              <TabsContent key={stack.id} value={stack.id}>
                <Card>
                  <CardHeader>
                    <CardTitle>{stack.title}</CardTitle>
                    {stack.scenario && <CardDescription>{stack.scenario}</CardDescription>}
                  </CardHeader>
                  <CardContent className="space-y-6">
                    {stack.summary && <p className="text-sm text-muted-foreground">{stack.summary}</p>}
                    <div className="grid gap-6 md:grid-cols-2">
                      {renderComponentList('Backend', stack.backend)}
                      {renderComponentList('Frontend', stack.frontend)}
                      {renderComponentList('Capa de datos', stack.dataLayer)}
                      {renderComponentList('Analytics / BI', stack.analytics)}
                      {renderComponentList('Observabilidad', stack.observability)}
                      {renderComponentList('MLOps / Workflow', stack.mlops)}
                    </div>
                    {stack.notes && stack.notes.length > 0 && (
                      <div className="rounded-lg border border-dashed border-muted-foreground/40 bg-muted/40 p-4 text-sm text-muted-foreground">
                        <h4 className="font-semibold text-foreground">Notas tácticas</h4>
                        <ul className="mt-2 list-disc space-y-1 pl-4">
                          {stack.notes.map((note) => (
                            <li key={note}>{note}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
            ))}
          </Tabs>
        ) : (
          <p className="text-sm text-muted-foreground">No hay stacks disponibles en este momento.</p>
        )}
      </section>

      <Separator />

      <section className="space-y-4">
        <h2 className="text-2xl font-semibold">Módulos reutilizables</h2>
        {playbook ? (
          (() => {
            const moduleEntries = Object.entries(moduleGroups).filter(([, modules]) => modules.length > 0);
            if (!moduleEntries.length) {
              return <p className="text-sm text-muted-foreground">Aún no hay módulos definidos para este playbook.</p>;
            }
            return (
              <div className="grid gap-5 md:grid-cols-2">
                {moduleEntries.map(([category, modules]) => (
                  <Card key={category} className="h-full">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <span>{category}</span>
                        <Badge variant="secondary">{modules.length} módulos</Badge>
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {modules.map((module) => (
                        <div key={module.id} className="rounded-lg border border-border p-4">
                          <div className="flex flex-wrap items-center gap-2">
                            {module.tags.map((tag) => (
                              <Badge key={`${module.id}-${tag}`} variant="outline" className="uppercase tracking-wide">
                                {tag}
                              </Badge>
                            ))}
                          </div>
                          <h3 className="mt-2 text-lg font-semibold">{module.name}</h3>
                          <p className="text-sm text-muted-foreground">{module.description}</p>
                          {module.outcomes.length > 0 && (
                            <ul className="mt-3 list-disc space-y-1 pl-4 text-sm text-muted-foreground">
                              {module.outcomes.map((outcome) => (
                                <li key={outcome}>{outcome}</li>
                              ))}
                            </ul>
                          )}
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                ))}
              </div>
            );
          })()
        ) : (
          <p className="text-sm text-muted-foreground">Cargando módulos reutilizables...</p>
        )}
      </section>

      <Separator />

      <section className="space-y-4">
        <h2 className="text-2xl font-semibold">Checklists de gobernanza</h2>
        {playbook ? (
          <div className="grid gap-5 md:grid-cols-3">
            {(['privacy', 'accessibility', 'data'] as const).map((category) => {
              const entries = governanceGroups[category] ?? [];
              return (
                <Card key={category} className="h-full">
                  <CardHeader>
                    <CardTitle className="capitalize">
                      {category === 'privacy' && 'Privacidad'}
                      {category === 'accessibility' && 'Accesibilidad'}
                      {category === 'data' && 'Gobierno de datos'}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {entries.length > 0 ? (
                      entries.map((checklist) => (
                        <div key={checklist.id}>
                          <h3 className="text-sm font-semibold text-muted-foreground">{checklist.title}</h3>
                          <ul className="mt-2 list-disc space-y-1 pl-4 text-sm text-muted-foreground">
                            {checklist.items.map((item) => (
                              <li key={item}>{item}</li>
                            ))}
                          </ul>
                        </div>
                      ))
                    ) : (
                      <p className="text-sm text-muted-foreground">Sin items configurados.</p>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Cargando checklist de gobernanza...</p>
        )}
      </section>
    </div>
  );
};

export default MunicipalPlaybookPage;
