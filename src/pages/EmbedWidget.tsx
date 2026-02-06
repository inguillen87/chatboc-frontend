import React, { useState, useEffect } from "react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { safeLocalStorage } from "@/utils/safeLocalStorage";
import { apiClient } from "@/api/client";

const WidgetEmbed = ({ token }: { token?: string }) => {
  const [tenantSlug, setTenantSlug] = useState<string | null>(null);
  const [embedSnippet, setEmbedSnippet] = useState<string>("");

  const slugify = (value?: string | null) => {
    if (!value) return null;
    const normalized = value
      .toString()
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/gi, "-")
      .replace(/^-+|-+$/g, "");
    return normalized || null;
  };

  const resolveTenantSlug = () => {
    try {
      const storedUser = safeLocalStorage.getItem("user");
      const parsedUser = storedUser ? JSON.parse(storedUser) : null;
      const fromUser =
        slugify(parsedUser?.tenant_slug) ||
        slugify(parsedUser?.tenantSlug) ||
        slugify(parsedUser?.slug) ||
        slugify(parsedUser?.endpoint);

      if (fromUser) return fromUser;

      const fromStorage = slugify(safeLocalStorage.getItem("tenantSlug"));
      if (fromStorage) return fromStorage;

      if (typeof window !== "undefined") {
        const segments = window.location.pathname.split("/").filter(Boolean);
        if (segments[0] === "t" && segments[1]) {
          return slugify(segments[1]);
        }
      }
    } catch (error) {
      console.warn("No se pudo determinar el tenant para el embed del widget", error);
    }
    return null;
  };

  useEffect(() => {
    setTenantSlug(resolveTenantSlug());
  }, []);

  useEffect(() => {
    const loadEmbedSnippet = async () => {
      if (!tenantSlug) return;
      try {
        const data = await apiClient.get<any>(`/api/public/tenants/${tenantSlug}/widget-config`, { tenantSlug });
        const builderConfig = data?.builder_config || data?.widget?.builder_config || {};
        const snippet = builderConfig?.embed_snippet || data?.embed_snippet || "";
        setEmbedSnippet(snippet);
      } catch (error) {
        console.error("No se pudo cargar el snippet de embed", error);
        setEmbedSnippet("");
      }
    };

    loadEmbedSnippet();
  }, [tenantSlug]);

  const embedCode = embedSnippet || "";

  const copiar = () => {
    navigator.clipboard.writeText(embedCode)
      .then(() => toast.success("✅ Código copiado al portapapeles"))
      .catch(() => toast.error("❌ No se pudo copiar"));
  };

  if (!token) {
    return (
      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Integración con tu sitio web</CardTitle>
          <CardDescription>Necesitás iniciar sesión para ver tu código de integración personalizado.</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card className="mt-6">
      <CardHeader>
        <CardTitle>Integrá Chatboc en tu web</CardTitle>
        <CardDescription>Copiá este fragmento y pegalo donde quieras que aparezca el chat.</CardDescription>
      </CardHeader>
      <CardContent>
        <Textarea
          readOnly
          className="mb-2 font-mono"
          rows={4}
          value={embedCode}
        />
        <Button onClick={copiar} disabled={!embedCode}>📋 Copiar código</Button>
      </CardContent>
    </Card>
  );
};

export default WidgetEmbed;
