import type { CrmPeopleRecord } from "./CrmPeopleWorkspace";
import type {
  CrmContactCase,
  CrmContactHistory,
} from "./useCrmContactHistory";

export interface CrmOperationalSummary {
  identityLabel: string;
  casesLabel: string;
  latestEventAt: string | null;
  latestEventChannel: string | null;
  latestEventVerified: boolean;
  latestEventSourceLabel: string;
  ownerLabel: string;
  slaLabel: string;
  slaDueAt: string | null;
  consentLabel: string;
  consentDeclared: boolean;
}

interface BuildCrmOperationalSummaryOptions {
  person: CrmPeopleRecord;
  history: CrmContactHistory | null;
  isLoading: boolean;
  error: string | null;
}

const parseTimestamp = (value?: string | null): number => {
  if (!value) return Number.NEGATIVE_INFINITY;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : Number.NEGATIVE_INFINITY;
};

const latestCase = (cases: CrmContactCase[]): CrmContactCase | null => {
  if (cases.length === 0) return null;
  return cases.reduce((latest, candidate) => {
    const latestTime = parseTimestamp(latest.updatedAt || latest.createdAt);
    const candidateTime = parseTimestamp(candidate.updatedAt || candidate.createdAt);
    return candidateTime > latestTime ? candidate : latest;
  });
};

const latestInteraction = (history: CrmContactHistory | null) => {
  const interactions = history?.interactions || [];
  if (interactions.length === 0) return null;
  return interactions.reduce((latest, candidate) => (
    parseTimestamp(candidate.timestamp) > parseTimestamp(latest.timestamp)
      ? candidate
      : latest
  ));
};

const humanizeStatus = (value?: string | null): string | null => {
  const normalized = value?.trim();
  return normalized
    ? normalized.replace(/[_-]+/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase())
    : null;
};

export const buildCrmOperationalSummary = ({
  person,
  history,
  isLoading,
  error,
}: BuildCrmOperationalSummaryOptions): CrmOperationalSummary => {
  const hasIdentity = Boolean(person.contactId?.trim());
  const casesVerified = history?.casesContractStatus === "verified";
  const authoritativeCase = casesVerified ? latestCase(history.cases) : null;
  const interaction = latestInteraction(history);

  let casesLabel = "No disponible";
  if (!hasIdentity) {
    casesLabel = "Sin identidad vinculada";
  } else if (isLoading && !history) {
    casesLabel = "Verificando";
  } else if (!error && casesVerified) {
    if (history.casesTotalIsExact && history.casesRejected === 0 && !history.casesTruncated) {
      casesLabel = `${history.casesTotal} ${history.casesTotal === 1 ? "exacto" : "exactos"}`;
    } else {
      casesLabel = `${history.cases.length} ${history.cases.length === 1 ? "verificable" : "verificables"}`;
    }
  }

  const noCaseLabel = casesVerified && history.casesTotalIsExact && history.casesTotal === 0
    ? "Sin caso"
    : "No disponible";

  return {
    identityLabel: hasIdentity ? "Identidad vinculada" : "Identidad pendiente",
    casesLabel,
    latestEventAt: interaction?.timestamp || person.lastSeen || null,
    latestEventChannel: interaction?.channel || person.canal || null,
    latestEventVerified: Boolean(interaction?.timestamp),
    latestEventSourceLabel: interaction?.timestamp
      ? "Historial exacto"
      : person.lastSeen
        ? "Directorio CRM · No verificado"
        : "Sin actividad publicada",
    ownerLabel: authoritativeCase?.assigneeName || (
      casesVerified && history.cases.length > 0 ? "No informado" : noCaseLabel
    ),
    slaLabel: humanizeStatus(authoritativeCase?.slaStatus) || (
      authoritativeCase?.slaDueAt
        ? "Vencimiento informado"
        : casesVerified && history.cases.length > 0
          ? "No informado"
          : noCaseLabel
    ),
    slaDueAt: authoritativeCase?.slaDueAt || null,
    consentLabel: person.marketing ? "Declarado sin trazabilidad" : "Sin evidencia publicada",
    consentDeclared: person.marketing === true,
  };
};
