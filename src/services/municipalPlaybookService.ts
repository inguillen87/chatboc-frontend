import { apiFetch, ApiError } from '@/utils/api';
import {
  municipalPlaybookFallback,
  MunicipalPlaybookContent,
  StackComponent,
  StackOption,
  ReusableModule,
  GovernanceChecklist,
} from '@/config/municipalBiPlaybook';

const generateId = (): string => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `playbook-${Math.random().toString(36).slice(2, 10)}`;
};

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === 'string' && value.trim().length > 0;

const normalizeComponent = (component: unknown): StackComponent | null => {
  if (!component || typeof component !== 'object') return null;
  const candidate = component as Partial<StackComponent> & Record<string, unknown>;
  const labelCandidate = candidate.label ?? candidate['name'];
  if (!isNonEmptyString(labelCandidate)) {
    return null;
  }
  const descriptionCandidate = candidate.description;
  return {
    label: labelCandidate.trim(),
    description: isNonEmptyString(descriptionCandidate) ? descriptionCandidate.trim() : undefined,
  };
};

const normalizeComponentList = (value: unknown): StackComponent[] | undefined => {
  if (!Array.isArray(value)) return undefined;
  const normalized = value
    .map(normalizeComponent)
    .filter((item): item is StackComponent => Boolean(item));
  return normalized.length > 0 ? normalized : undefined;
};

const normalizeStack = (stack: unknown): StackOption | null => {
  if (!stack || typeof stack !== 'object') return null;
  const candidate = stack as Partial<StackOption> & Record<string, unknown>;
  const id = isNonEmptyString(candidate.id) ? candidate.id.trim() : generateId();
  const title = isNonEmptyString(candidate.title)
    ? candidate.title.trim()
    : isNonEmptyString(candidate['name'])
      ? candidate['name'].trim()
      : '';
  if (!title) return null;
  const scenario = isNonEmptyString(candidate.scenario)
    ? candidate.scenario.trim()
    : isNonEmptyString(candidate['useCase'])
      ? candidate['useCase'].trim()
      : '';
  const summary = isNonEmptyString(candidate.summary)
    ? candidate.summary.trim()
    : isNonEmptyString(candidate['description'])
      ? candidate['description'].trim()
      : '';

  const backend = normalizeComponentList(candidate.backend) ?? [];
  const frontend = normalizeComponentList(candidate.frontend) ?? [];
  const analytics = normalizeComponentList(candidate.analytics) ?? [];
  if (!backend.length && !frontend.length && !analytics.length) {
    return null;
  }

  const stackOption: StackOption = {
    id,
    title,
    scenario,
    summary,
    backend,
    frontend,
    analytics,
  };

  const optionalKeys: (keyof StackOption)[] = ['dataLayer', 'observability', 'mlops'];
  optionalKeys.forEach((key) => {
    const normalized = normalizeComponentList(candidate[key]);
    if (normalized && normalized.length) {
      stackOption[key] = normalized;
    }
  });

  const notesSource = candidate.notes;
  if (Array.isArray(notesSource)) {
    const notes = notesSource.filter(isNonEmptyString).map((note) => note.trim());
    if (notes.length) {
      stackOption.notes = notes;
    }
  }

  return stackOption;
};

const normalizeModule = (value: unknown): ReusableModule | null => {
  if (!value || typeof value !== 'object') return null;
  const candidate = value as Partial<ReusableModule> & Record<string, unknown>;
  const nameCandidate = candidate.name ?? candidate['title'];
  if (!isNonEmptyString(nameCandidate)) return null;
  const descriptionCandidate = candidate.description ?? candidate['summary'];
  const outcomesCandidate = candidate.outcomes ?? candidate['benefits'];
  const tagsCandidate = candidate.tags ?? candidate['categories'];

  const module: ReusableModule = {
    id: isNonEmptyString(candidate.id) ? candidate.id.trim() : generateId(),
    name: nameCandidate.trim(),
    description: isNonEmptyString(descriptionCandidate) ? descriptionCandidate.trim() : '',
    outcomes: Array.isArray(outcomesCandidate)
      ? outcomesCandidate.filter(isNonEmptyString).map((item) => item.trim())
      : [],
    tags: Array.isArray(tagsCandidate)
      ? tagsCandidate.filter(isNonEmptyString).map((item) => item.trim())
      : [],
  };

  return module.description ? module : null;
};

const normalizeGovernance = (value: unknown): GovernanceChecklist | null => {
  if (!value || typeof value !== 'object') return null;
  const candidate = value as Partial<GovernanceChecklist> & Record<string, unknown>;
  const titleCandidate = candidate.title ?? candidate['name'];
  if (!isNonEmptyString(titleCandidate)) return null;
  const categoryCandidate = candidate.category ?? candidate['type'];
  const normalizedCategory = isNonEmptyString(categoryCandidate)
    ? (categoryCandidate.trim().toLowerCase() as GovernanceChecklist['category'])
    : 'data';
  const itemsSource = candidate.items ?? candidate['checklist'];
  const items = Array.isArray(itemsSource)
    ? itemsSource.filter(isNonEmptyString).map((item) => item.trim())
    : [];
  if (!items.length) return null;

  return {
    id: isNonEmptyString(candidate.id) ? candidate.id.trim() : generateId(),
    title: titleCandidate.trim(),
    category: normalizedCategory,
    items,
  };
};

const withFallback = (data: Partial<MunicipalPlaybookContent> | null | undefined): MunicipalPlaybookContent => {
  if (!data || typeof data !== 'object') {
    return municipalPlaybookFallback;
  }

  const normalizedPlatforms = Array.isArray(data.platforms)
    ? data.platforms
        .map((platform) => {
          if (!platform || typeof platform !== 'object') return null;
          const candidate = platform as any;
          const name = isNonEmptyString(candidate.name) ? candidate.name.trim() : '';
          const focus = isNonEmptyString(candidate.focus)
            ? candidate.focus.trim()
            : isNonEmptyString(candidate.description)
              ? candidate.description.trim()
              : '';
          if (!name) return null;
          return {
            id: isNonEmptyString(candidate.id) ? candidate.id.trim() : name.toLowerCase().replace(/[^a-z0-9]+/gi, '-'),
            name,
            focus,
            highlights: Array.isArray(candidate.highlights)
              ? candidate.highlights.filter(isNonEmptyString).map((item: string) => item.trim())
              : [],
            integrationNotes: isNonEmptyString(candidate.integrationNotes)
              ? candidate.integrationNotes.trim()
              : '',
            connectors: Array.isArray(candidate.connectors)
              ? candidate.connectors.filter(isNonEmptyString).map((item: string) => item.trim())
              : undefined,
            embedding: candidate.embedding && typeof candidate.embedding === 'object'
              ? {
                  supportsEmbedding: Boolean((candidate.embedding as any).supportsEmbedding ?? true),
                  notes: isNonEmptyString((candidate.embedding as any).notes)
                    ? (candidate.embedding as any).notes.trim()
                    : undefined,
                }
              : undefined,
          };
        })
        .filter((item): item is MunicipalPlaybookContent['platforms'][number] => Boolean(item))
    : municipalPlaybookFallback.platforms;

  const normalizedStacks = Array.isArray(data.stacks)
    ? data.stacks.map(normalizeStack).filter((item): item is StackOption => Boolean(item))
    : municipalPlaybookFallback.stacks;

  const normalizedModules = Array.isArray(data.reusableModules)
    ? data.reusableModules.map(normalizeModule).filter((item): item is ReusableModule => Boolean(item))
    : municipalPlaybookFallback.reusableModules;

  const normalizedGovernance = Array.isArray(data.governance)
    ? data.governance
        .map(normalizeGovernance)
        .filter((item): item is GovernanceChecklist => Boolean(item))
    : municipalPlaybookFallback.governance;

  return {
    updatedAt: isNonEmptyString(data.updatedAt) ? data.updatedAt.trim() : municipalPlaybookFallback.updatedAt,
    intro: isNonEmptyString(data.intro) ? data.intro.trim() : municipalPlaybookFallback.intro,
    callToAction: isNonEmptyString(data.callToAction)
      ? data.callToAction.trim()
      : municipalPlaybookFallback.callToAction,
    platforms: normalizedPlatforms.length ? normalizedPlatforms : municipalPlaybookFallback.platforms,
    stacks: normalizedStacks.length ? normalizedStacks : municipalPlaybookFallback.stacks,
    reusableModules: normalizedModules.length ? normalizedModules : municipalPlaybookFallback.reusableModules,
    governance: normalizedGovernance.length ? normalizedGovernance : municipalPlaybookFallback.governance,
  };
};

export const fetchMunicipalPlaybook = async (): Promise<MunicipalPlaybookContent> => {
  try {
    const response = await apiFetch<Partial<MunicipalPlaybookContent>>('/municipal/bi-playbook');
    return withFallback(response);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) {
      return municipalPlaybookFallback;
    }
    console.warn('[municipalPlaybook] using fallback due to error', error);
    return municipalPlaybookFallback;
  }
};

export default fetchMunicipalPlaybook;
