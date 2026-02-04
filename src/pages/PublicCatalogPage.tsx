import React, { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { apiClient } from "@/api/client";
import type { TenantCatalog, CatalogColumn, CatalogRow } from "@/types/catalog";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const normalizeColumns = (catalog: TenantCatalog | null): CatalogColumn[] => {
  return catalog?.columns ?? [];
};

const normalizeRows = (catalog: TenantCatalog | null): CatalogRow[] => {
  return catalog?.rows ?? [];
};

const PublicCatalogPage: React.FC = () => {
  const { tenant } = useParams<{ tenant: string }>();
  const [catalog, setCatalog] = useState<TenantCatalog | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchCatalog = async () => {
      if (!tenant) return;
      setLoading(true);
      setError(null);
      try {
        const data = await apiClient.publicGetCatalog(tenant);
        setCatalog(data);
      } catch (err: any) {
        console.error("Failed to load public catalog", err);
        setError(err?.message ?? null);
      } finally {
        setLoading(false);
      }
    };
    fetchCatalog();
  }, [tenant]);

  const columns = normalizeColumns(catalog);
  const rows = normalizeRows(catalog);
  const metadata = catalog?.metadata ?? null;
  const links = catalog?.links ?? null;

  const filteredRows = useMemo(() => {
    if (!search) return rows;
    const normalized = search.toLowerCase();
    return rows.filter((row) =>
      columns.some((column) => {
        const value = row.cells?.[column.key];
        return String(value ?? "").toLowerCase().includes(normalized);
      }),
    );
  }, [columns, rows, search]);

  if (loading || error) {
    return null;
  }

  return (
    <div className="container mx-auto px-4 py-10 space-y-6">
      <Card>
        <CardContent className="p-6 space-y-4">
          {metadata?.banner_url && (
            <div className="overflow-hidden rounded-lg bg-muted">
              <img src={metadata.banner_url} alt={metadata?.title ?? ""} className="h-48 w-full object-cover" />
            </div>
          )}
          <div className="space-y-1">
            {metadata?.title && <CardTitle className="text-2xl">{metadata.title}</CardTitle>}
            {metadata?.description && (
              <CardDescription className="text-base text-muted-foreground">
                {metadata.description}
              </CardDescription>
            )}
          </div>
          {links?.download_url && links?.download_label && (
            <Button asChild variant="outline">
              <a href={links.download_url} target="_blank" rel="noreferrer">
                {links.download_label}
              </a>
            </Button>
          )}
        </CardContent>
      </Card>

          {(columns.length > 0 || rows.length > 0) && (
            <Card>
              <CardHeader>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  {metadata?.default_message && (
                    <CardTitle className="text-lg">{metadata.default_message}</CardTitle>
                  )}
                  {links?.search_placeholder && (
                    <Input
                      value={search}
                      onChange={(event) => setSearch(event.target.value)}
                      className="sm:max-w-xs"
                      placeholder={links.search_placeholder}
                    />
                  )}
                </div>
              </CardHeader>
          <CardContent>
            <div className="overflow-x-auto rounded-lg border">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr>
                    {columns.map((column) => (
                      <th key={column.key} className="px-3 py-2 text-left font-semibold">
                        <span
                          className="inline-flex items-center gap-2"
                          style={column.color ? { color: column.color } : undefined}
                        >
                          {column.label}
                        </span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredRows.map((row) => (
                    <tr key={row.id} className="border-t">
                      {columns.map((column) => (
                        <td key={`${row.id}-${column.key}`} className="px-3 py-2">
                          {String(row.cells?.[column.key] ?? "")}
                        </td>
                      ))}
                    </tr>
                  ))}
                  {filteredRows.length === 0 && (
                    <tr>
                      <td colSpan={Math.max(columns.length, 1)} className="px-3 py-6 text-center text-muted-foreground">
                        {metadata?.default_message}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default PublicCatalogPage;
