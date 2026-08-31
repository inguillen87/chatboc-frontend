import {
  Activity,
  Clock3,
  FileText,
  PanelRightOpen,
  Shield,
  UserCheck,
} from "lucide-react";
import type { ComponentType } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import type { CrmOperationalSummary } from "./crmOperationalSummary";

interface CrmPersonRecordRibbonProps {
  qualityScore: number;
  summary: CrmOperationalSummary;
  caseActionLabel: string;
  caseActionDisabled: boolean;
  caseActionLoading: boolean;
  onCaseAction: () => void;
  onOpenDetails: () => void;
  formatDate: (value?: string | null) => string;
  formatChannel: (value?: string | null) => string;
}

interface RibbonValueProps {
  label: string;
  value: string;
  helper?: string;
  icon: ComponentType<{ className?: string }>;
  className?: string;
}

const RibbonValue = ({ label, value, helper, icon: Icon, className }: RibbonValueProps) => (
  <div className={cn("min-w-[136px] border-r border-border/70 px-3 py-2", className)}>
    <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
      <Icon className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
      {label}
    </div>
    <div className="mt-1 max-w-[190px] truncate text-xs font-semibold" title={value}>{value}</div>
    {helper ? <div className="mt-0.5 max-w-[190px] truncate text-[10px] text-muted-foreground" title={helper}>{helper}</div> : null}
  </div>
);

export default function CrmPersonRecordRibbon({
  qualityScore,
  summary,
  caseActionLabel,
  caseActionDisabled,
  caseActionLoading,
  onCaseAction,
  onOpenDetails,
  formatDate,
  formatChannel,
}: CrmPersonRecordRibbonProps) {
  return (
    <section
      className="shrink-0 border-b border-border/70 bg-card"
      aria-label="Estado operacional de la persona"
      data-testid="crm-person-record-ribbon"
    >
      <div className="overflow-x-auto">
        <div className="flex min-w-max items-stretch">
          <RibbonValue
            label="Calidad de datos"
            value={`${qualityScore}%`}
            helper={summary.identityLabel}
            icon={UserCheck}
          />
          <RibbonValue
            label="Casos exactos"
            value={summary.casesLabel}
            icon={FileText}
          />
          <RibbonValue
            label="Último evento"
            value={formatDate(summary.latestEventAt)}
            helper={summary.latestEventVerified
              ? `${formatChannel(summary.latestEventChannel)} · ${summary.latestEventSourceLabel}`
              : summary.latestEventSourceLabel}
            icon={Activity}
            className="min-w-[170px]"
          />
          <RibbonValue
            label="Responsable"
            value={summary.ownerLabel}
            icon={UserCheck}
          />
          <RibbonValue
            label="SLA"
            value={summary.slaLabel}
            helper={summary.slaDueAt ? formatDate(summary.slaDueAt) : undefined}
            icon={Clock3}
          />
          <RibbonValue
            label="Consentimiento"
            value={summary.consentLabel}
            icon={Shield}
            className="text-muted-foreground"
          />
          <div className="flex min-w-[220px] items-center gap-2 px-3 py-2">
            <Button
              type="button"
              size="sm"
              className="h-8 gap-1.5"
              disabled={caseActionDisabled}
              onClick={onCaseAction}
            >
              <FileText className={cn("h-3.5 w-3.5", caseActionLoading && "animate-pulse")} aria-hidden="true" />
              {caseActionLabel}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-8 gap-1.5"
              onClick={onOpenDetails}
            >
              <PanelRightOpen className="h-3.5 w-3.5" aria-hidden="true" />
              Detalle 360
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}
