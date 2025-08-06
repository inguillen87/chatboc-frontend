import React, { useState, useEffect } from "react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { safeLocalStorage } from "@/utils/safeLocalStorage";

const WidgetEmbed = ({ token }: { token: string }) => {
  const [tipoChat, setTipoChat] = useState('pyme');

  useEffect(() => {
    try {
      const storedUser = safeLocalStorage.getItem("user");
      const user = storedUser ? JSON.parse(storedUser) : null;
      if (user && user.tipo_chat === 'municipio') {
        setTipoChat('municipio');
      }
    } catch (e) {
      console.error("Could not determine user type for widget, defaulting to pyme.", e);
    }
  }, []);

  const embedCode = `<script>(function(){var s=document.createElement('script');s.src='https://www.chatboc.ar/widget.js';s.async=true;s.setAttribute('data-token','${token}');s.setAttribute('data-endpoint','${tipoChat}');document.head.appendChild(s);})();</script>`;

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
