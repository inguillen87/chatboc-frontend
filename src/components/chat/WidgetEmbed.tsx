import React from "react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

const WidgetEmbed = ({ token }: { token: string }) => {
  const embedCode = `<iframe src="https://chatboc.ar/iframe?token=${token}" width="100%" height="540" frameborder="0"></iframe>`;

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
