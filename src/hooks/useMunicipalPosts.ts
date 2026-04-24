import { useCallback, useEffect, useRef, useState } from "react";

import { Post } from "@/types/chat";
import { apiFetch, getErrorMessage } from "@/utils/api";

type MunicipalPostType = "evento" | "noticia";

export interface MunicipalPostFilters {
  limit?: number;
  offset?: number;
  month?: string;
  date?: string;
  fromDate?: string;
  toDate?: string;
  tipoPost?: MunicipalPostType;
  enabled?: boolean;
}

export interface MunicipalPostsPagination {
  totalCount: number;
  limit: number;
  offset: number;
  hasMore: boolean;
}

interface NormalizedFilters extends Required<Pick<MunicipalPostFilters, "limit" | "offset">> {
  month?: string;
  date?: string;
  fromDate?: string;
  toDate?: string;
  tipoPost?: MunicipalPostType;
}

const parseBooleanHeader = (value: string | null): boolean | null => {
  if (!value) return null;
  const normalized = value.trim().toLowerCase();
  if (["1", "true", "yes", "si", "sí"].includes(normalized)) return true;
  if (["0", "false", "no"].includes(normalized)) return false;
  return null;
};

const parseNumericHeader = (value: string | null, fallback: number): number => {
  if (!value) return fallback;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const buildQueryString = (filters: NormalizedFilters) => {
  const params = new URLSearchParams();

  params.set("limit", String(filters.limit));
  params.set("offset", String(filters.offset));

  if (filters.tipoPost) params.set("tipo_post", filters.tipoPost);
  if (filters.month) params.set("month", filters.month);
  if (filters.date) params.set("date", filters.date);
  if (filters.fromDate) params.set("from_date", filters.fromDate);
  if (filters.toDate) params.set("to_date", filters.toDate);

  const query = params.toString();
  return query ? `?${query}` : "";
};

interface HeaderMetadata {
  totalCount?: number;
  limit?: number;
  offset?: number;
  hasMore?: boolean | null;
}

const readPaginationHeaders = (
  headers: Headers,
  fallback: NormalizedFilters,
): HeaderMetadata => {
  const limit = parseNumericHeader(headers.get("X-Limit"), fallback.limit);
  const offset = parseNumericHeader(headers.get("X-Offset"), fallback.offset);
  const totalCountHeader = headers.get("X-Total-Count");
  const totalCount =
    totalCountHeader === null ? undefined : parseNumericHeader(totalCountHeader, offset);
  const hasMore = parseBooleanHeader(headers.get("X-Has-More"));

  return { limit, offset, totalCount, hasMore };
};

const finalizePagination = (
  headerMeta: HeaderMetadata,
  dataLength: number,
  filters: NormalizedFilters,
  previousMeta: MunicipalPostsPagination,
  append: boolean,
): MunicipalPostsPagination => {
  const limit = headerMeta.limit ?? filters.limit;
  const offset = headerMeta.offset ?? filters.offset;

  const inferredTotalFromHeader = headerMeta.totalCount;
  const baseTotal = inferredTotalFromHeader ?? (append ? previousMeta.totalCount : 0);
  const computedTotal = baseTotal
    ? Math.max(baseTotal, offset + dataLength)
    : offset + dataLength;

  const totalCount = inferredTotalFromHeader ?? computedTotal;

  const hasMore = (() => {
    if (typeof headerMeta.hasMore === "boolean") return headerMeta.hasMore;
    if (typeof inferredTotalFromHeader === "number") {
      return offset + dataLength < inferredTotalFromHeader;
    }
    return dataLength >= limit && dataLength > 0;
  })();

  return { totalCount, limit, offset, hasMore };
};

interface UseMunicipalPostsResult {
  posts: Post[];
  isLoading: boolean;
  error: string | null;
  filters: NormalizedFilters;
  meta: MunicipalPostsPagination;
  setFilters: (
    partial: Partial<MunicipalPostFilters>,
    options?: { append?: boolean; resetOffset?: boolean },
  ) => Promise<void>;
  loadMore: () => Promise<void>;
  refresh: () => Promise<void>;
}

const normalizeFilters = (
  filters: MunicipalPostFilters | undefined,
  defaultLimit: number,
): NormalizedFilters => ({
  limit: filters?.limit && Number.isFinite(filters.limit) ? Number(filters.limit) : defaultLimit,
  offset: filters?.offset && Number.isFinite(filters.offset) ? Number(filters.offset) : 0,
  month: filters?.month || undefined,
  date: filters?.date || undefined,
  fromDate: filters?.fromDate || undefined,
  toDate: filters?.toDate || undefined,
  tipoPost: filters?.tipoPost,
});

export function useMunicipalPosts(
  initialFilters?: MunicipalPostFilters,
): UseMunicipalPostsResult {
  const enabled = initialFilters?.enabled ?? true;
  const initial = normalizeFilters(initialFilters, initialFilters?.limit ?? 20);
  const [filters, setFiltersState] = useState<NormalizedFilters>(initial);
  const [posts, setPosts] = useState<Post[]>([]);
  const [meta, setMeta] = useState<MunicipalPostsPagination>({
    totalCount: 0,
    limit: initial.limit,
    offset: initial.offset,
    hasMore: false,
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isMountedRef = useRef(true);
  const latestRequestRef = useRef(0);
  const metaRef = useRef(meta);

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    metaRef.current = meta;
  }, [meta]);

  const fetchPosts = useCallback(
    async (nextFilters: NormalizedFilters, { append }: { append: boolean }) => {
      latestRequestRef.current += 1;
      const requestId = latestRequestRef.current;

      setIsLoading(true);
      setError(null);
      setFiltersState(nextFilters);

      let headerMeta: HeaderMetadata = {};

      try {
        const query = buildQueryString(nextFilters);
        const data = await apiFetch<Post[]>(`/municipal/posts${query}`, {
          omitEntityToken: true,
          onResponse: (response) => {
            headerMeta = readPaginationHeaders(response.headers, nextFilters);
          },
        });

        if (!isMountedRef.current || requestId !== latestRequestRef.current) {
          return;
        }

        const pagination = finalizePagination(
          headerMeta,
          Array.isArray(data) ? data.length : 0,
          nextFilters,
          metaRef.current,
          append,
        );

        setMeta(pagination);

        setPosts((prev) => {
          if (!append) return Array.isArray(data) ? data : [];

          if (!Array.isArray(data) || data.length === 0) return prev;

          const map = new Map<Post["id"], Post>();
          prev.forEach((item) => {
            map.set(item.id, item);
          });
          data.forEach((item) => {
            map.set(item.id, item);
          });
          return Array.from(map.values());
        });
      } catch (err) {
        if (!isMountedRef.current || requestId !== latestRequestRef.current) {
          return;
        }
        setPosts((prev) => (append ? prev : []));
        setMeta((prev) => ({
          totalCount: append ? prev.totalCount : 0,
          limit: nextFilters.limit,
          offset: nextFilters.offset,
          hasMore: append ? prev.hasMore : false,
        }));
        setError(getErrorMessage(err, "No se pudieron cargar las publicaciones."));
      } finally {
        if (isMountedRef.current && requestId === latestRequestRef.current) {
          setIsLoading(false);
        }
      }
    },
    [],
  );

  const setFilters = useCallback<UseMunicipalPostsResult["setFilters"]>(
    async (partial, options) => {
      const { append = false, resetOffset = !("offset" in partial) } = options ?? {};

      const normalizedPartial: Partial<NormalizedFilters> = {
        month: partial.month ?? undefined,
        date: partial.date ?? undefined,
        fromDate: partial.fromDate ?? undefined,
        toDate: partial.toDate ?? undefined,
        tipoPost: partial.tipoPost ?? undefined,
      };

      let limit = filters.limit;
      if (partial.limit && Number.isFinite(partial.limit)) {
        limit = Number(partial.limit);
        normalizedPartial.limit = limit;
      }

      let offset = filters.offset;
      if (partial.offset !== undefined && Number.isFinite(partial.offset)) {
        offset = Number(partial.offset);
        normalizedPartial.offset = offset;
      } else if (resetOffset) {
        offset = 0;
        normalizedPartial.offset = 0;
      }

      const nextFilters: NormalizedFilters = {
        ...filters,
        ...normalizedPartial,
        limit,
        offset,
      };

      await fetchPosts(nextFilters, { append });
    },
    [fetchPosts, filters],
  );

  const loadMore = useCallback(async () => {
    if (!meta.hasMore) return;
    const nextOffset = meta.offset + meta.limit;
    await setFilters({ offset: nextOffset }, { append: true, resetOffset: false });
  }, [meta, setFilters]);

  const refresh = useCallback(async () => {
    await fetchPosts(filters, { append: false });
  }, [fetchPosts, filters]);

  useEffect(() => {
    if (enabled) {
      void fetchPosts(initial, { append: false });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled]);

  return {
    posts,
    isLoading,
    error,
    filters,
    meta,
    setFilters,
    loadMore,
    refresh,
  };
}

