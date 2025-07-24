// src/pages/Integracion.tsx

import React, { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { safeLocalStorage } from "@/utils/safeLocalStorage";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Copy, Check, ExternalLink, Eye, Code, HelpCircle, AlertTriangle, Settings, Info } from "lucide-react";

interface User {
  id: number;
  name: string;
  email: string;
  token: string;
  plan?: string;
  tipo_chat?: "pyme" | "municipio";
}

const Integracion = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);
  const [copiado, setCopiado] = useState<"iframe" | "script" | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // State for customization
  const [primaryColor, setPrimaryColor] = useState("#007bff");
  const [logoUrl, setLogoUrl] = useState("");
  const [widgetPosition, setWidgetPosition] = useState("right");

  const isPremium = useMemo(() => user?.plan === 'full', [user?.plan]);

  const validarAcceso = (currentUser: User | null) => {
    if (!currentUser) {
      navigate("/login");
      return false;
    }
    const plan = (currentUser.plan || "").toLowerCase();
    if (plan !== "full") {
      toast.error("Acceso restringido. Esta función requiere un plan FULL.", {
        icon: <AlertTriangle className="text-destructive" />,
      });
      navigate("/perfil");
      return false;
    }
    return true;
  };

  useEffect(() => {
    const authToken = safeLocalStorage.getItem("authToken");
    const storedUser = safeLocalStorage.getItem("user");
    let parsedUser: Omit<User, 'token'> | null = null;

    try {
      parsedUser = storedUser ? JSON.parse(storedUser) : null;
    } catch (err) {
      console.error("Error parsing user from localStorage:", err);
      safeLocalStorage.removeItem("user");
    }

    if (!authToken || !parsedUser || !parsedUser.id) {
      navigate("/login");
      return;
    }

    const fullUser: User = {
      ...parsedUser,
      token: authToken,
      plan: parsedUser.plan || "free",
      tipo_chat: parsedUser.tipo_chat || undefined,
    };
    setUser(fullUser);
    setIsLoading(false);

    if (!validarAcceso(fullUser)) {
      return;
    }
  }, [navigate]);


  const endpoint = useMemo(() => {
    if (!user?.tipo_chat) return "pyme";
    return user.tipo_chat === "municipio" ? "municipio" : "pyme";
  }, [user?.tipo_chat]);

  const userToken = useMemo(() => user?.token || "TU_TOKEN_DE_USUARIO", [user?.token]);

  const WIDGET_STD_WIDTH = "400px";
  const WIDGET_STD_HEIGHT = "600px";

  const codeScript = useMemo(() => `<div id="chatboc-widget-container"></div>
<script>
  window.chatbocToken = '${userToken}';
  window.chatbocEndpoint = '${endpoint}';
  ${isPremium ? `window.chatbocPrimaryColor = '${primaryColor}';` : ''}
  ${isPremium ? `window.chatbocLogoUrl = '${logoUrl}';` : ''}
  ${isPremium ? `window.chatbocPosition = '${widgetPosition}';` : ''}
  var s = document.createElement('script');
  s.src = 'https://www.chatboc.ar/embed.js';
  s.async = true;
  document.body.appendChild(s);
</script>`, [userToken, endpoint, isPremium, primaryColor, logoUrl, widgetPosition]);

  const iframeSrcUrl = useMemo(() => {
    let url = `https://www.chatboc.ar/embed?token=${userToken}&tipo_chat=${endpoint}`;
    if (isPremium) {
      url += `&primaryColor=${encodeURIComponent(primaryColor)}`;
      url += `&logoUrl=${encodeURIComponent(logoUrl)}`;
      url += `&position=${widgetPosition}`;
    }
    return url;
  }, [userToken, endpoint, isPremium, primaryColor, logoUrl, widgetPosition]);

  const codeIframe = useMemo(() => `<iframe
  src="${iframeSrcUrl}"
  style="border:none; width:${WIDGET_STD_WIDTH}; height:${WIDGET_STD_HEIGHT};"
  allow="clipboard-write; geolocation"
  loading="lazy"
  title="Chatboc Widget"
></iframe>`, [iframeSrcUrl]);


  const copiarCodigo = async (tipo: "iframe" | "script") => {
    const textoACopiar = tipo === "iframe" ? codeIframe : codeScript;
    try {
      await navigator.clipboard.writeText(textoACopiar);
      setCopiado(tipo);
      toast.success("¡Código copiado!", {
        icon: <Check className="text-green-500" />,
        description: `El código de ${tipo} se ha copiado a tu portapapeles.`,
      });
      setTimeout(() => setCopiado(null), 2500);
    } catch (e) {
      console.error("Error al copiar al portapapeles:", e);
      toast.error("Error al copiar", {
        icon: <AlertTriangle className="text-destructive" />,
        description: "No se pudo copiar automáticamente. Intenta copiarlo manualmente.",
      });
      window.prompt(`Copia manualmente (Ctrl+C / Cmd+C):\n${tipo === "iframe" ? "Código Iframe" : "Código Script"}`, textoACopiar);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen text-foreground bg-background p-4">
        <div className="flex flex-col items-center">
          <svg className="animate-spin h-10 w-10 text-primary mb-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <p className="text-lg font-medium">Cargando datos de integración...</p>
          <p className="text-sm text-muted-foreground">Esto tomará solo un momento.</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  if (!user.tipo_chat) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen text-destructive bg-background p-6 text-center">
        <AlertTriangle size={48} className="mb-4" />
        <h1 className="text-2xl font-bold mb-2">Configuración Incompleta</h1>
        <p className="mb-4 text-muted-foreground">
          Tu perfil no tiene un tipo de chat (Pyme o Municipio) definido.
          Por favor, completa esta información en tu perfil para poder integrar el chatbot.
        </p>
        <Button onClick={() => navigate("/perfil")}>Ir a Mi Perfil</Button>
      </div>
    );
  }

  const renderCodeBlock = (title: string, type: "script" | "iframe", code: string, recommended?: boolean) => (
    <Card className="overflow-hidden">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center justify-between text-lg">
          <div className="flex items-center">
            <Code size={20} className="mr-2 text-primary" />
            {title}
            {recommended && <span className="ml-2 text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full dark:bg-green-700 dark:text-green-100">Recomendado</span>}
          </div>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => copiarCodigo(type)}
                  aria-label={`Copiar código ${type}`}
                >
                  {copiado === type ? <Check size={18} className="text-green-500" /> : <Copy size={18} />}
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Copiar código {type}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <pre className="bg-muted/50 dark:bg-muted/30 p-4 text-xs overflow-x-auto max-h-80 relative">
          <code className="language-html" style={{ whiteSpace: "pre-wrap", wordBreak: "break-all" }}>
            {code}
          </code>
        </pre>
      </CardContent>
      <CardFooter className="p-4 bg-muted/20 dark:bg-muted/10">
         <Button
            className="w-full"
            onClick={() => copiarCodigo(type)}
            variant="secondary"
          >
            {copiado === type ? <Check size={18} className="mr-2 text-green-500" /> : <Copy size={18} className="mr-2" />}
            {copiado === type ? `¡Código ${type} Copiado!` : `Copiar Código ${type}`}
          </Button>
      </CardFooter>
    </Card>
  );


  return (
    <div className="container mx-auto max-w-5xl p-4 sm:p-6 md:p-8">
      <header className="mb-8">
        <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-primary flex items-center">
          <Settings size={36} className="mr-3" />
          Integración del Chatbot Chatboc
        </h1>
        <p className="mt-2 text-lg text-muted-foreground">
          Integra fácilmente el chatbot en tu sitio web o plataforma. Elige el método que mejor se adapte a tus necesidades.
        </p>
      </header>

      <Card className="mb-8 bg-blue-50 border-blue-200 dark:bg-blue-900/30 dark:border-blue-700">
        <CardHeader>
          <CardTitle className="flex items-center text-blue-700 dark:text-blue-300">
            <Info size={20} className="mr-2" />
            Información Importante
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-blue-600 dark:text-blue-200 space-y-2">
          <p>
            Pega el código elegido justo antes de la etiqueta de cierre <code>&lt;/body&gt;</code> en tu página web.
          </p>
          <p>
            <strong>Token de Usuario:</strong> Tu token de integración es <code>{userToken.substring(0,8)}...</code>. Ya está incluido en los códigos de abajo.
          </p>
        </CardContent>
      </Card>

      {isPremium && (
        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4 flex items-center">
            <Settings size={28} className="mr-3 text-primary" />
            Personalización (Plan FULL)
          </h2>
          <Card>
            <CardContent className="pt-6 grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label htmlFor="primaryColor" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Color Primario</label>
                <Input
                  id="primaryColor"
                  type="color"
                  value={primaryColor}
                  onChange={(e) => setPrimaryColor(e.target.value)}
                  className="mt-1"
                />
              </div>
              <div>
                <label htmlFor="logoUrl" className="block text-sm font-medium text-gray-700 dark:text-gray-300">URL del Logo</label>
                <Input
                  id="logoUrl"
                  type="text"
                  value={logoUrl}
                  onChange={(e) => setLogoUrl(e.target.value)}
                  placeholder="https://tu-empresa.com/logo.png"
                  className="mt-1"
                />
              </div>
              <div>
                <label htmlFor="widgetPosition" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Posición del Widget</label>
                <select
                  id="widgetPosition"
                  value={widgetPosition}
                  onChange={(e) => setWidgetPosition(e.target.value)}
                  className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400 dark:text-white"
                >
                  <option value="right">Derecha</option>
                  <option value="left">Izquierda</option>
                </select>
              </div>
            </CardContent>
          </Card>
        </section>
      )}

      <Tabs defaultValue="script" className="w-full">
        <TabsList className="grid w-full grid-cols-2 mb-6">
          <TabsTrigger value="script" className="text-base py-2.5">
            <Code size={18} className="mr-2" /> Método &lt;script&gt; (Recomendado)
          </TabsTrigger>
          <TabsTrigger value="iframe" className="text-base py-2.5">
            <Code size={18} className="mr-2" /> Método &lt;iframe&gt;
          </TabsTrigger>
        </TabsList>

        <TabsContent value="script">
          {renderCodeBlock("Widget con <script>", "script", codeScript, true)}
        </TabsContent>

        <TabsContent value="iframe">
          {renderCodeBlock("Widget con <iframe>", "iframe", codeIframe)}
        </TabsContent>
      </Tabs>

      <section className="mt-12">
        <h2 className="text-2xl font-semibold mb-4 flex items-center">
          <Eye size={28} className="mr-3 text-primary" />
          Vista Previa en Vivo
        </h2>
        <Card className="overflow-hidden shadow-xl">
          <CardContent className="p-0">
            <div
              className="bg-slate-100 dark:bg-slate-800 flex items-center justify-center"
              style={{ minHeight: '720px' }}
            >
              <div
                style={{
                  width: WIDGET_STD_WIDTH,
                  height: WIDGET_STD_HEIGHT,
                  border: "1px solid #ccc",
                  borderRadius: "16px",
                  overflow: "hidden",
                  background: "#ffffff",
                  boxShadow: "0 10px 30px rgba(0,0,0,0.15)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  position: 'relative',
                  ['--widget-primary-color' as any]: primaryColor
                }}
              >
                {user && user.token && user.tipo_chat ? (
                  <iframe
                    src={iframeSrcUrl}
                    width="100%"
                    height="100%"
                    style={{
                      border: "none",
                      borderRadius: "16px",
                    }}
                    loading="lazy"
                    title="Vista previa del Chatbot Chatboc"
                    allow="clipboard-write; geolocation"
                  />
                ) : (
                  <div className="p-4 text-center text-muted-foreground">
                    <AlertTriangle size={32} className="mx-auto mb-2" />
                    La vista previa no está disponible.
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </section>
    </div>
  );
};

export default Integracion;
