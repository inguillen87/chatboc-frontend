import React, { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  GitBranch,
  RefreshCw,
  Route,
  Save,
  Users,
} from "lucide-react";

import {
  getEmployeeRoutingV2,
  patchEmployeeRoutingScopeV2,
  postEmployeeRoutingAutoAssignV2,
  type EmployeeRoutingEmployee,
  type EmployeeRoutingV2,
} from "@/api/v2/saas";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { getErrorMessage } from "@/utils/api";

type AnyRecord = Record<string, unknown>;

const asString = (value: unknown): string => {
  if (typeof value === "string") return value;
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return "";
};

const first = (record: AnyRecord | undefined, keys: string[]) => {
  if (!record) return undefined;
  for (const key of keys) {
    if (record[key] !== undefined && record[key] !== null) return record[key];
  }
  return undefined;
};

const parseCsv = (value: string) =>
  value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

const Pill = ({ children }: { children: React.ReactNode }) => (
  <span className="inline-flex items-center rounded-full border border-border bg-background px-2.5 py-0.5 text-xs font-semibold">
    {children}
  </span>
);

const ChipList = ({ items, empty = "--" }: { items?: string[]; empty?: string }) => {
  if (!items?.length) return <span className="text-xs text-muted-foreground">{empty}</span>;
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map((item) => (
        <Pill key={item}>
          {item}
        </Pill>
      ))}
    </div>
  );
};

interface EmployeeRoutingMatrixProps {
  tenantSlug?: string | null;
}

export default function EmployeeRoutingMatrix({ tenantSlug }: EmployeeRoutingMatrixProps) {
  const [routing, setRouting] = useState<EmployeeRoutingV2 | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedEmployee, setSelectedEmployee] = useState<EmployeeRoutingEmployee | null>(null);
  const [scopeForm, setScopeForm] = useState({
    categorias: "",
    zonas: "",
    channels: "",
    permisos: "",
  });
  const [savingScope, setSavingScope] = useState(false);
  const [scopeMessage, setScopeMessage] = useState<string | null>(null);
  const [assignLoading, setAssignLoading] = useState(false);
  const [assignResult, setAssignResult] = useState<AnyRecord | null>(null);

  const loadRouting = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await getEmployeeRoutingV2(tenantSlug);
      setRouting(response);
    } catch (err) {
      setError(getErrorMessage(err, "No se pudo cargar la matriz de asignacion."));
      setRouting(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRouting();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantSlug]);

  useEffect(() => {
    if (!selectedEmployee) return;
    setScopeMessage(null);
    setScopeForm({
      categorias: selectedEmployee.scope.categorias.join(", "),
      zonas: selectedEmployee.scope.zonas.join(", "),
      channels: selectedEmployee.scope.channels.join(", "),
      permisos: selectedEmployee.scope.permisos.join(", "),
    });
  }, [selectedEmployee]);

  const dimensionKeys = useMemo(() => Object.keys(routing?.dimensions ?? {}), [routing]);

  const handleSaveScope = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedEmployee) return;
    setSavingScope(true);
    setScopeMessage(null);
    try {
      await patchEmployeeRoutingScopeV2(
        selectedEmployee.id,
        {
          categorias: parseCsv(scopeForm.categorias),
          zonas: parseCsv(scopeForm.zonas),
          channels: parseCsv(scopeForm.channels),
          permisos: parseCsv(scopeForm.permisos),
        },
        tenantSlug,
      );
      setScopeMessage("Scope actualizado. Refrescando matriz...");
      await loadRouting();
    } catch (err) {
      setScopeMessage(getErrorMessage(err, "No se pudo actualizar el scope."));
    } finally {
      setSavingScope(false);
    }
  };

  const handleAutoAssign = async (dryRun: boolean) => {
    setAssignLoading(true);
    setAssignResult(null);
    try {
      const response = await postEmployeeRoutingAutoAssignV2({ dry_run: dryRun }, tenantSlug);
      setAssignResult(response && typeof response === "object" ? (response as AnyRecord) : { response });
      if (!dryRun) await loadRouting();
    } catch (err) {
      setAssignResult({ error: getErrorMessage(err, "No se pudo ejecutar la asignacion.") });
    } finally {
      setAssignLoading(false);
    }
  };

  return (
    <Card className="border-border/60">
      <CardHeader className="gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <CardTitle className="text-base">Employee routing</CardTitle>
          <CardDescription>
            Matriz `employee.routing.v1` para categorias, zonas, canales, permisos y carga.
          </CardDescription>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={loadRouting} disabled={loading}>
          <RefreshCw className="mr-2 h-4 w-4" />
          Actualizar
        </Button>
      </CardHeader>
      <CardContent className="space-y-5">
        {error ? (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
            <div className="flex items-center gap-2 font-semibold">
              <AlertTriangle className="h-4 w-4" />
              {error}
            </div>
          </div>
        ) : null}

        <div className="grid gap-3 lg:grid-cols-3">
          <div className="rounded-2xl border border-border/60 p-4">
            <div className="mb-3 flex items-center gap-2 font-semibold">
              <Users className="h-4 w-4 text-primary" />
              Equipo
            </div>
            <p className="text-2xl font-black">{routing?.employees.length ?? (loading ? "--" : 0)}</p>
            <p className="mt-1 text-xs text-muted-foreground">Empleados publicados por backend.</p>
          </div>
          <div className="rounded-2xl border border-border/60 p-4">
            <div className="mb-3 flex items-center gap-2 font-semibold">
              <Route className="h-4 w-4 text-primary" />
              Sin asignar
            </div>
            <p className="text-2xl font-black">{routing?.queues.unassigned_count ?? "--"}</p>
            <p className="mt-1 text-xs text-muted-foreground">Cola operativa actual.</p>
          </div>
          <div className="rounded-2xl border border-border/60 p-4">
            <div className="mb-3 flex items-center gap-2 font-semibold">
              <GitBranch className="h-4 w-4 text-primary" />
              Recomendaciones
            </div>
            <p className="text-2xl font-black">{routing?.recommendations.length ?? "--"}</p>
            <p className="mt-1 text-xs text-muted-foreground">Con score y razones visibles.</p>
          </div>
        </div>

        <div className="rounded-2xl border border-border/60 p-4">
          <div className="mb-3 font-semibold">Dimensiones</div>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {dimensionKeys.map((key) => (
              <div key={key} className="rounded-xl border bg-muted/20 p-3">
                <p className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">{key}</p>
                <ChipList items={routing?.dimensions[key]} />
              </div>
            ))}
            {!dimensionKeys.length ? (
              <p className="text-sm text-muted-foreground">{loading ? "Cargando dimensiones..." : "Sin dimensiones publicadas."}</p>
            ) : null}
          </div>
        </div>

        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
          <div className="overflow-hidden rounded-2xl border border-border/60">
            <div className="grid grid-cols-[minmax(160px,1fr)_1fr_1fr_1fr_96px] gap-3 border-b px-4 py-3 text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              <span>Empleado</span>
              <span>Categorias</span>
              <span>Zonas</span>
              <span>Canales</span>
              <span>Carga</span>
            </div>
            <div className="divide-y">
              {(routing?.employees ?? []).map((employee) => (
                <button
                  key={employee.id}
                  type="button"
                  onClick={() => setSelectedEmployee(employee)}
                  className="grid w-full grid-cols-[minmax(160px,1fr)_1fr_1fr_1fr_96px] items-start gap-3 px-4 py-3 text-left text-sm transition hover:bg-muted/40"
                >
                  <span>
                    <span className="block font-semibold">{employee.name}</span>
                    <span className="text-xs text-muted-foreground">#{employee.id}</span>
                  </span>
                  <ChipList items={employee.scope.categorias} />
                  <ChipList items={employee.scope.zonas} />
                  <ChipList items={employee.scope.channels} />
                  <span className="font-semibold">{employee.workload_open ?? "--"}</span>
                </button>
              ))}
              {!routing?.employees.length ? (
                <div className="px-4 py-8 text-sm text-muted-foreground">
                  {loading ? "Cargando equipo..." : "Sin empleados publicados para routing."}
                </div>
              ) : null}
            </div>
          </div>

          <div className="rounded-2xl border border-border/60 p-4">
            <h3 className="font-semibold">Editor de scope</h3>
            <p className="mt-1 text-xs text-muted-foreground">
              {"Guarda en PATCH /api/v2/employees/{employee_id}/routing-scope."}
            </p>
            {selectedEmployee ? (
              <form className="mt-4 space-y-3" onSubmit={handleSaveScope}>
                <Input
                  value={scopeForm.categorias}
                  onChange={(event) => setScopeForm((prev) => ({ ...prev, categorias: event.target.value }))}
                  placeholder="categorias separadas por coma"
                />
                <Input
                  value={scopeForm.zonas}
                  onChange={(event) => setScopeForm((prev) => ({ ...prev, zonas: event.target.value }))}
                  placeholder="zonas separadas por coma"
                />
                <Input
                  value={scopeForm.channels}
                  onChange={(event) => setScopeForm((prev) => ({ ...prev, channels: event.target.value }))}
                  placeholder="channels separados por coma"
                />
                <Input
                  value={scopeForm.permisos}
                  onChange={(event) => setScopeForm((prev) => ({ ...prev, permisos: event.target.value }))}
                  placeholder="permisos separados por coma"
                />
                <Button type="submit" className="w-full" disabled={savingScope}>
                  <Save className="mr-2 h-4 w-4" />
                  {savingScope ? "Guardando..." : "Guardar scope"}
                </Button>
                {scopeMessage ? <p className="text-xs text-muted-foreground">{scopeMessage}</p> : null}
              </form>
            ) : (
              <div className="mt-4 rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
                Selecciona un empleado de la matriz.
              </div>
            )}
          </div>
        </div>

        <div className="grid gap-4 xl:grid-cols-2">
          <div className="rounded-2xl border border-border/60 p-4">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <div className="font-semibold">Auto-asignacion</div>
                <p className="text-xs text-muted-foreground">Primero previsualiza con dry_run.</p>
              </div>
              <div className="flex gap-2">
                <Button type="button" variant="outline" size="sm" disabled={assignLoading} onClick={() => handleAutoAssign(true)}>
                  Preview
                </Button>
                <Button type="button" size="sm" disabled={assignLoading} onClick={() => handleAutoAssign(false)}>
                  Aplicar
                </Button>
              </div>
            </div>
            {assignResult ? (
              <pre className="max-h-48 overflow-auto rounded-xl bg-muted p-3 text-xs">
                {JSON.stringify(assignResult, null, 2)}
              </pre>
            ) : (
              <p className="text-sm text-muted-foreground">Sin ejecucion reciente.</p>
            )}
          </div>

          <div className="rounded-2xl border border-border/60 p-4">
            <div className="mb-3 font-semibold">Mejor empleado sugerido</div>
            <div className="space-y-3">
              {(routing?.recommendations ?? []).slice(0, 4).map((item) => (
                <div key={item.id} className="rounded-xl border bg-background p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-semibold">
                        {asString(first(item.ticket, ["source_model", "type"])) || "ticket"} #
                        {asString(first(item.ticket, ["id", "ticket_id"])) || "--"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {asString(first(item.suggested_assignee, ["name", "nombre", "display_name"])) || "sin sugerencia"}
                      </p>
                    </div>
                    <Pill>{item.score ?? "--"}</Pill>
                  </div>
                  <div className="mt-2">
                    <ChipList items={item.reasons} empty="sin razones publicadas" />
                  </div>
                </div>
              ))}
              {!routing?.recommendations.length ? (
                <p className="text-sm text-muted-foreground">Sin recomendaciones publicadas.</p>
              ) : null}
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-border/60 p-4">
          <div className="mb-3 flex items-center gap-2 font-semibold">
            <CheckCircle2 className="h-4 w-4 text-primary" />
            Cola sin asignar
          </div>
          <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
            {(routing?.queues.unassigned ?? []).slice(0, 6).map((item, index) => (
              <div key={`${asString(first(item, ["id", "ticket_id"])) || index}`} className="rounded-xl border p-3 text-sm">
                <div className="font-semibold">
                  {asString(first(item, ["title", "label", "categoria", "category"])) || `Item ${index + 1}`}
                </div>
                <div className="mt-1 text-xs text-muted-foreground">
                  {asString(first(item, ["channel", "canal", "status", "estado"])) || "sin metadata"}
                </div>
              </div>
            ))}
            {!routing?.queues.unassigned.length ? (
              <p className="text-sm text-muted-foreground">No hay cola sin asignar publicada.</p>
            ) : null}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
