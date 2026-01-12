import React, { useState, useEffect } from "react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { safeLocalStorage } from "@/utils/safeLocalStorage";

const WidgetEmbed = ({ token }: { token: string }) => {
  const [tipoChat, setTipoChat] = useState('pyme');
  const [tenantSlug, setTenantSlug] = useState<string | null>(null);

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
    try {
      const storedUser = safeLocalStorage.getItem("user");
      const user = storedUser ? JSON.parse(storedUser) : null;
      if (user && user.tipo_chat === 'municipio') {
        setTipoChat('municipio');
      }
      setTenantSlug(resolveTenantSlug());
    } catch (e) {
      console.error("Could not determine user type for widget, defaulting to pyme.", e);
    }
  }, []);

  const apiBase = (import.meta.env.VITE_WIDGET_API_BASE || "https://chatboc.ar").replace(/\/+$/, "");
  const defaultWidgetScriptUrl = `${apiBase}/widget.js`;
  const widgetScriptUrl = import.meta.env.VITE_WIDGET_SCRIPT_URL || defaultWidgetScriptUrl;
  const tenantAttrs = tenantSlug
    ? ` data-tenant="${tenantSlug}" data-tenant-slug="${tenantSlug}"`
    : "";
  const embedCode = `<script async src="${widgetScriptUrl}" data-api-base="${apiBase}" data-owner-token="${token}" data-endpoint="${tipoChat}" data-default-open="false" data-width="460px" data-height="680px" data-closed-width="112px" data-closed-height="112px" data-bottom="20px" data-right="20px" data-shadow-dom="true"${tenantAttrs}></script>`;

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
        <Button onClick={copiar}>📋 Copiar código</Button>
      </CardContent>
    </Card>
  );
};

export default WidgetEmbed;
