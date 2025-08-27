import React from "react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Lightbulb } from "lucide-react";

const WidgetEmbed = ({ token }: { token: string }) => {
  const embedCode = `<script src="https://www.chatboc.ar/widget.js" data-token="${token}" async defer></script>`;

  const copyToClipboard = () => {
    navigator.clipboard.writeText(embedCode)
      .then(() => toast.success("✅ ¡Copiado! Ahora pegalo en tu web."))
      .catch(() => toast.error("❌ Ocurrió un error al copiar el código."));
  };

  if (!token) {
    return (
      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Tu código de Widget personalizado</CardTitle>
          <CardDescription>Inicia sesión para obtener el código y agregar Chatboc a tu sitio web.</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card className="mt-6">
      <CardHeader>
        <CardTitle>Integra Chatboc en tu sitio web</CardTitle>
        <CardDescription>
          Copia el siguiente código y pégalo en el HTML de tu página, justo antes de la etiqueta de cierre <code>&lt;/body&gt;</code>.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Textarea
          readOnly
          className="mb-4 font-mono bg-slate-100 dark:bg-slate-800 border-dashed"
          rows={3}
          value={embedCode}
          onClick={(e) => (e.target as HTMLTextAreaElement).select()}
        />
        <div className="flex flex-col sm:flex-row gap-4">
          <Button onClick={copyToClipboard} className="w-full sm:w-auto">
            📋 Copiar código
          </Button>
          <div className="flex items-center gap-2 text-sm text-muted-foreground p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
            <Lightbulb className="w-5 h-5 text-yellow-500" />
            <span>El widget aparecerá en la esquina inferior derecha.</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default WidgetEmbed;
