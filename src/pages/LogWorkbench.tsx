import React, { useCallback, useMemo, useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Download, FileUp, Filter, Highlighter, Search, Trash2 } from "lucide-react";

interface ParsedLog {
  raw: string;
  timestamp?: Date;
  level?: string;
  source?: string;
  message: string;
  tokens: string[];
}

const UUID_REGEX = /[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}/g;
const TIMESTAMPED_LINE = /^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2}:\d{2})\s+\[(\w+)\]\s+([^\s]+)\s+-\s+(.*)$/;
const LEVEL_ORDER: Record<string, number> = { ERROR: 3, WARNING: 2, INFO: 1, DEBUG: 0 };

const severityBadges: Record<string, string> = {
  ERROR: "bg-destructive/10 text-destructive border border-destructive/30",
  WARNING: "bg-amber-100 text-amber-900 border border-amber-300",
  INFO: "bg-blue-100 text-blue-900 border border-blue-300",
  DEBUG: "bg-slate-100 text-slate-900 border border-slate-300",
  OTHER: "bg-muted text-muted-foreground",
};

function normalizeLevel(level?: string) {
  if (!level) return "OTHER";
  const upper = level.toUpperCase();
  if (["ERROR", "WARN", "WARNING"].includes(upper)) return "WARNING";
  if (["INFO"].includes(upper)) return "INFO";
  if (["DEBUG"].includes(upper)) return "DEBUG";
  return upper;
}

function escapeRegExp(str: string) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

const LogWorkbench: React.FC = () => {
  const [rawLogs, setRawLogs] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [tokenFilter, setTokenFilter] = useState<string | null>(null);
  const [levelFilters, setLevelFilters] = useState<Record<string, boolean>>({
    ERROR: true,
    WARNING: true,
    INFO: true,
    DEBUG: false,
    OTHER: true,
  });

  const parseLine = useCallback((line: string): ParsedLog => {
    const match = line.match(TIMESTAMPED_LINE);
    const tokens = Array.from(new Set(line.match(UUID_REGEX) || []));

    if (!match) {
      return {
        raw: line,
        message: line,
        tokens,
      };
    }

    const [_, date, time, level, source, message] = match;
    const normalizedLevel = normalizeLevel(level);
    const timestamp = new Date(`${date}T${time}`);

    return {
      raw: line,
      timestamp: Number.isNaN(timestamp.getTime()) ? undefined : timestamp,
      level: normalizedLevel,
      source,
      message,
      tokens,
    };
  }, []);

  const parsedLogs = useMemo(() => {
    return rawLogs
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .map(parseLine);
  }, [parseLine, rawLogs]);

  const availableTokens = useMemo(() => {
    const counts = new Map<string, number>();
    parsedLogs.forEach((log) => {
      log.tokens.forEach((token) => counts.set(token, (counts.get(token) || 0) + 1));
    });
    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 12);
  }, [parsedLogs]);

  const stats = useMemo(() => {
    return parsedLogs.reduce(
      (acc, log) => {
        const lvl = log.level || "OTHER";
        acc[lvl] = (acc[lvl] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>,
    );
  }, [parsedLogs]);

  const filteredLogs = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    return parsedLogs.filter((log) => {
      const level = log.level || "OTHER";
      const levelEnabled = levelFilters[level] ?? levelFilters.OTHER;
      if (!levelEnabled) return false;
      if (tokenFilter && !log.tokens.includes(tokenFilter)) return false;
      if (!term) return true;
      return (
        log.raw.toLowerCase().includes(term) ||
        log.message.toLowerCase().includes(term) ||
        log.source?.toLowerCase().includes(term)
      );
    });
  }, [levelFilters, parsedLogs, searchTerm, tokenFilter]);

  const highlightedText = useCallback(
    (text: string) => {
      const term = searchTerm.trim();
      if (!term && !tokenFilter) return text;

      const tokensToHighlight = [term, tokenFilter].filter(Boolean) as string[];
      if (!tokensToHighlight.length) return text;

      const pattern = tokensToHighlight.map((t) => escapeRegExp(t)).join("|");
      const regex = new RegExp(`(${pattern})`, "gi");
      return text.split(regex).map((part, idx) => {
        const isHighlighted = regex.test(part);
        regex.lastIndex = 0;
        if (isHighlighted) {
          return (
            <mark key={`${part}-${idx}`} className="rounded bg-amber-200 px-1 py-0.5">
              {part}
            </mark>
          );
        }
        return <span key={`${part}-${idx}`}>{part}</span>;
      });
    },
    [searchTerm, tokenFilter],
  );

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      setRawLogs((prev) => `${prev}${prev ? "\n" : ""}${text}`);
    };
    reader.readAsText(file);
  };

  const handleCopy = async () => {
    if (!navigator?.clipboard) return;
    await navigator.clipboard.writeText(filteredLogs.map((log) => log.raw).join("\n"));
  };

  const handlePaste = async () => {
    if (!navigator?.clipboard?.readText) return;
    const text = await navigator.clipboard.readText();
    setRawLogs((prev) => `${prev}${prev ? "\n" : ""}${text}`);
  };

  return (
    <div className="container max-w-6xl space-y-6 py-10">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold">Analizador rápido de logs</h1>
          <p className="text-muted-foreground">
            Pega trazas de backend o sube un archivo .log para filtrarlas por severidad, IDs de sesión y texto.
            Ideal para reproducir casos como los reportados cuando el bot mezcla respuestas o pierde contexto.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={handlePaste} title="Pegar desde portapapeles">
            <Highlighter className="mr-2 h-4 w-4" />
            Pegar
          </Button>
          <Button variant="secondary" onClick={handleCopy} disabled={!filteredLogs.length}>
            <Download className="mr-2 h-4 w-4" />
            Copiar filtrado
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Ingesta</CardTitle>
          <CardDescription>Sube un archivo .log o pega texto plano. Las líneas vacías se descartan.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:gap-3">
            <div className="flex items-center gap-2">
              <FileUp className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Archivo</span>
            </div>
            <Input type="file" accept=".log,.txt" className="md:max-w-xs" onChange={handleFileUpload} />
            <Button variant="ghost" size="sm" onClick={() => setRawLogs("")} className="mt-2 md:mt-0">
              <Trash2 className="mr-2 h-4 w-4" />
              Vaciar
            </Button>
          </div>
          <Textarea
            value={rawLogs}
            onChange={(e) => setRawLogs(e.target.value)}
            rows={8}
            placeholder="Pega aquí logs de Flask, FastAPI o nginx para analizarlos rápidamente"
            className="font-mono"
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Filtros y extracción</CardTitle>
          <CardDescription>Activa solo las severidades relevantes, busca texto libre o fija un ID específico.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Buscar texto</label>
              <div className="flex items-center gap-2">
                <Search className="h-4 w-4 text-muted-foreground" />
                <Input
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="IP, endpoint, error, etc."
                />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Filtrar por UUID o token</label>
              <div className="flex items-center gap-2">
                <Filter className="h-4 w-4 text-muted-foreground" />
                <Input
                  value={tokenFilter || ""}
                  onChange={(e) => setTokenFilter(e.target.value || null)}
                  placeholder="Ej: id de sesión o request"
                />
              </div>
              {availableTokens.length > 0 && (
                <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                  {availableTokens.map(([token, count]) => (
                    <Badge
                      key={token}
                      variant={tokenFilter === token ? "default" : "secondary"}
                      className="cursor-pointer"
                      onClick={() => setTokenFilter((prev) => (prev === token ? null : token))}
                    >
                      {token}
                      <span className="ml-1 text-[10px] text-muted-foreground">({count})</span>
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5">
            {Object.keys(levelFilters).map((level) => (
              <label key={level} className="flex items-center gap-2 rounded-md border p-2">
                <Checkbox
                  checked={levelFilters[level]}
                  onCheckedChange={(checked) =>
                    setLevelFilters((prev) => ({ ...prev, [level]: Boolean(checked) }))
                  }
                />
                <span className="text-sm font-medium">{level}</span>
              </label>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Resumen</CardTitle>
          <CardDescription>Cuenta rápida por severidad para medir dónde concentrar la lectura.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5">
          {Object.entries(stats)
            .sort(([a], [b]) => (LEVEL_ORDER[normalizeLevel(b)] ?? 0) - (LEVEL_ORDER[normalizeLevel(a)] ?? 0))
            .map(([level, count]) => (
              <div key={level} className="rounded-md border p-3">
                <div className="flex items-center gap-2">
                  <Badge className={severityBadges[level] || severityBadges.OTHER}>{level}</Badge>
                  <span className="text-2xl font-semibold">{count}</span>
                </div>
                <p className="text-sm text-muted-foreground">Líneas detectadas</p>
              </div>
            ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Vista filtrada</CardTitle>
          <CardDescription>
            {filteredLogs.length} líneas coinciden con los filtros. Haz clic en un token para fijarlo y copia solo las entradas
            relevantes.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <ScrollArea className="h-[420px]">
              <div className="divide-y">
                {filteredLogs.map((log, index) => (
                  <div key={`${log.raw}-${index}`} className="grid grid-cols-[auto_auto_1fr] gap-3 p-3 text-sm">
                    <div className="min-w-[140px] text-xs text-muted-foreground">
                      {log.timestamp ? log.timestamp.toLocaleString() : "(sin hora)"}
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge className={severityBadges[log.level || "OTHER"] || severityBadges.OTHER}>
                        {log.level || "OTHER"}
                      </Badge>
                      {log.source && <span className="text-xs text-muted-foreground">{log.source}</span>}
                    </div>
                    <div className="space-y-1">
                      <div className="font-mono text-xs leading-5">{highlightedText(log.message)}</div>
                      {log.tokens.length > 0 && (
                        <div className="flex flex-wrap gap-1 text-[11px] text-muted-foreground">
                          {log.tokens.map((token) => (
                            <Badge
                              key={`${log.raw}-${token}`}
                              variant={tokenFilter === token ? "default" : "outline"}
                              className="cursor-pointer"
                              onClick={() => setTokenFilter((prev) => (prev === token ? null : token))}
                            >
                              {token}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
                {filteredLogs.length === 0 && (
                  <div className="p-6 text-center text-sm text-muted-foreground">No hay líneas con los filtros actuales.</div>
                )}
              </div>
            </ScrollArea>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default LogWorkbench;
