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
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Copy, Check, Code, HelpCircle, AlertTriangle, Settings, Info, Eye } from "lucide-react";

interface User {
  id: number;
  name: string;
  email: string;
  token: string;
  plan?: string;
  tipo_chat?: "pyme" | "municipio";
  widget_icon_url?: string;
  widget_animation?: string;
}

const Integracion = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);
  const [copiado, setCopiado] = useState<"iframe" | "script" | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [primaryColor, setPrimaryColor] = useState("#007aff");
  const [accentColor, setAccentColor] = useState("#007aff");
  const [logoUrl, setLogoUrl] = useState("");
  const [logoAnimation, setLogoAnimation] = useState("");
  const [headerLogoUrl, setHeaderLogoUrl] = useState("");
  const [welcomeTitle, setWelcomeTitle] = useState("");
  const [welcomeSubtitle, setWelcomeSubtitle] = useState("");

  const validarAcceso = (currentUser: User | null) => {
    if (!currentUser) {
      navigate("/login");
      return false;
    }
    const plan = (currentUser.plan || "").toLowerCase();
    if (plan !== "pro" && plan !== "full") {
      toast.error("Acceso restringido. Esta función requiere un plan PRO o FULL.", {
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
      safeLocalStorage.removeItem("user"); // Clear corrupted data
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
      widget_icon_url: parsedUser.widget_icon_url,
      widget_animation: parsedUser.widget_animation,
    };
    setUser(fullUser);
    setIsLoading(false);

    if (!validarAcceso(fullUser)) {
      return;
    }

    setLogoUrl(fullUser.widget_icon_url || "");
    setLogoAnimation(fullUser.widget_animation || "");
  }, [navigate]);


  const endpoint = useMemo(() => {
    if (!user?.tipo_chat) return "pyme"; // Default or handle error
    return user.tipo_chat === "municipio" ? "municipio" : "pyme";
  }, [user?.tipo_chat]);

  const ownerToken = useMemo(() => user?.token || "OWNER_TOKEN_DEL_WIDGET", [user?.token]);
  const isFullPlan = (user?.plan || "").toLowerCase() === "full";

  const WIDGET_STD_WIDTH = "460px";
  const WIDGET_STD_HEIGHT = "680px";
  const WIDGET_STD_CLOSED_WIDTH = "112px"; // Increased from 96px
  const WIDGET_STD_CLOSED_HEIGHT = "112px"; // Increased from 96px
  const WIDGET_STD_BOTTOM = "20px";
  const WIDGET_STD_RIGHT = "20px";
  const apiBase = (import.meta.env.VITE_WIDGET_API_BASE || import.meta.env.VITE_API_URL || window.location.origin).replace(/\/+$/, "");
  
  const codeScript = useMemo(() => {
    const customAttrs = [
      primaryColor && `  data-primary-color="${primaryColor}"`,
      accentColor && `  data-accent-color="${accentColor}"`,
      logoUrl && `  data-logo-url="${logoUrl}"`,
      headerLogoUrl && `  data-header-logo-url="${headerLogoUrl}"`,
      logoAnimation && `  data-logo-animation="${logoAnimation}"`,
      welcomeTitle && `  data-welcome-title="${welcomeTitle}"`,
      welcomeSubtitle && `  data-welcome-subtitle="${welcomeSubtitle}"`,
    ]
      .filter(Boolean)
      .join("\n");

    return `<script async src="https://cdn.chatboc.ar/widget.js"
  data-api-base="${apiBase}"
  data-owner-token="${ownerToken}"
  data-default-open="false"
  data-width="${WIDGET_STD_WIDTH}"
  data-height="${WIDGET_STD_HEIGHT}"
  data-closed-width="${WIDGET_STD_CLOSED_WIDTH}"
  data-closed-height="${WIDGET_STD_CLOSED_HEIGHT}"
  data-bottom="${WIDGET_STD_BOTTOM}"
  data-right="${WIDGET_STD_RIGHT}"
  data-endpoint="${endpoint}"
${customAttrs ? customAttrs + "\n" : ""}></script>`;
  }, [apiBase, ownerToken, endpoint, primaryColor, accentColor, logoUrl, headerLogoUrl, logoAnimation, welcomeTitle, welcomeSubtitle]);

  const iframeSrcUrl = useMemo(() => {
    const url = new URL(`${apiBase}/iframe`);
    url.searchParams.set("ownerToken", ownerToken);
    url.searchParams.set("tipo_chat", endpoint);
    if (primaryColor) url.searchParams.set("primaryColor", primaryColor);
    if (accentColor) url.searchParams.set("accentColor", accentColor);
    if (logoUrl) url.searchParams.set("logoUrl", logoUrl);
    if (headerLogoUrl) url.searchParams.set("headerLogoUrl", headerLogoUrl);
    if (logoAnimation) url.searchParams.set("logoAnimation", logoAnimation);
    if (welcomeTitle) url.searchParams.set("welcomeTitle", welcomeTitle);
    if (welcomeSubtitle) url.searchParams.set("welcomeSubtitle", welcomeSubtitle);
    return url.toString();
  }, [apiBase, ownerToken, endpoint, primaryColor, accentColor, logoUrl, headerLogoUrl, logoAnimation, welcomeTitle, welcomeSubtitle]);
  
  const codeIframe = useMemo(() => `<iframe
  id="chatboc-iframe"
  src="${iframeSrcUrl}"
  style="position:fixed; bottom:${WIDGET_STD_BOTTOM}; right:${WIDGET_STD_RIGHT}; border:none; border-radius:50%; z-index:9999; box-shadow:0 4px 32px rgba(0,0,0,0.2); background:transparent; overflow:hidden; width:${WIDGET_STD_CLOSED_WIDTH}; height:${WIDGET_STD_CLOSED_HEIGHT}; display:block; transition: width 0.3s ease, height 0.3s ease, border-radius 0.3s ease;"
  allow="clipboard-write; geolocation; microphone; camera"
  loading="lazy"
  title="Chatboc Widget"
></iframe>
<script>
document.addEventListener('DOMContentLoaded', function () {
  var chatIframe = document.getElementById('chatboc-iframe');

  // Es crucial que si este código de iframe se inserta dentro de OTRO iframe en tu sitio,
  // ese iframe contenedor también debe tener 'allow="clipboard-write; geolocation; microphone; camera"'.
  // Ejemplo: <iframe src="pagina_con_este_codigo.html" allow="clipboard-write; geolocation; microphone; camera"></iframe>

  // Comunicación con el iframe para ajustar tamaño y forma
  window.addEventListener('message', function (event) {
    if (event.origin !== '${apiBase}') return; // Seguridad: aceptar mensajes solo del origen del iframe

    if (event.data && event.data.type === 'chatboc-state-change') {
      if (event.data.dimensions) {
        chatIframe.style.width = event.data.dimensions.width || '${WIDGET_STD_WIDTH}';
        chatIframe.style.height = event.data.dimensions.height || '${WIDGET_STD_HEIGHT}';
      }
      chatIframe.style.borderRadius = event.data.isOpen ? '16px' : '50%'; // Más suave la transición
    }
  });

  // Opcional: Enviar un mensaje al iframe una vez cargado para configuraciones iniciales si es necesario
  // chatIframe.onload = function() {
  //   chatIframe.contentWindow.postMessage({ type: 'chatboc-init', settings: { exampleSetting: true } }, '${apiBase}');
  // };
});
</script>`, [iframeSrcUrl, endpoint]);

  useEffect(() => {
    if (!ownerToken) return;
    let scriptEl: HTMLScriptElement | null = null;
    const inject = () => {
      if (scriptEl) scriptEl.remove();
      (window as any).chatbocDestroyWidget?.(ownerToken);
      const s = document.createElement('script');
      s.src = 'https://cdn.chatboc.ar/widget.js';
      s.async = true;
      s.setAttribute('data-api-base', apiBase);
      s.setAttribute('data-owner-token', ownerToken);
      s.setAttribute('data-default-open', 'false');
      s.setAttribute('data-width', WIDGET_STD_WIDTH);
      s.setAttribute('data-height', WIDGET_STD_HEIGHT);
      s.setAttribute('data-closed-width', WIDGET_STD_CLOSED_WIDTH);
      s.setAttribute('data-closed-height', WIDGET_STD_CLOSED_HEIGHT);
      s.setAttribute('data-bottom', WIDGET_STD_BOTTOM);
      s.setAttribute('data-right', WIDGET_STD_RIGHT);
      s.setAttribute('data-endpoint', endpoint);
      if (primaryColor) s.setAttribute('data-primary-color', primaryColor);
      if (accentColor) s.setAttribute('data-accent-color', accentColor);
      if (logoUrl) s.setAttribute('data-logo-url', logoUrl);
      if (headerLogoUrl) s.setAttribute('data-header-logo-url', headerLogoUrl);
      if (logoAnimation) s.setAttribute('data-logo-animation', logoAnimation);
      if (welcomeTitle) s.setAttribute('data-welcome-title', welcomeTitle);
      if (welcomeSubtitle) s.setAttribute('data-welcome-subtitle', welcomeSubtitle);
      document.body.appendChild(s);
      scriptEl = s;
    };
    inject();
    return () => {
      if (scriptEl) scriptEl.remove();
      (window as any).chatbocDestroyWidget?.(ownerToken);
    };
  }, [apiBase, ownerToken, endpoint, primaryColor, accentColor, logoUrl, headerLogoUrl, logoAnimation, welcomeTitle, welcomeSubtitle]);


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
      // Fallback por si navigator.clipboard no está disponible o falla (e.g. HTTP)
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
     // Esto no debería ocurrir si isLoading es false y el useEffect de auth funciona,
     // pero es una salvaguarda. La navegación a /login ya se gestiona en useEffect.
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
            Esto asegura que tu asistente virtual aparezca correctamente y pueda interactuar con los datos de tu empresa y catálogo.
          </p>
          <p>
            Ambos métodos de integración (Script y Iframe) están diseñados para ser seguros y eficientes. El método de Script es generalmente más flexible y recomendado.
          </p>
          <p>
            <strong>Token del Widget:</strong> Tu token de integración es <code>{ownerToken.substring(0,8)}...</code>. Ya está incluido en los códigos de abajo.
          </p>
        </CardContent>
      </Card>

      {isFullPlan && (
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="text-lg">Personalización del Widget</CardTitle>
            <CardDescription>
              Ajusta el color y el icono del lanzador para adaptarlo a tu sitio.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col space-y-2">
              <Label htmlFor="primaryColor">Color primario</Label>
              <Input
                id="primaryColor"
                type="color"
                value={primaryColor}
                onChange={(e) => setPrimaryColor(e.target.value)}
              />
            </div>
            <div className="flex flex-col space-y-2">
              <Label htmlFor="accentColor">Color de acento</Label>
              <Input
                id="accentColor"
                type="color"
                value={accentColor}
                onChange={(e) => setAccentColor(e.target.value)}
              />
            </div>
            <div className="flex flex-col space-y-2">
              <Label htmlFor="logoUrl">URL del logo</Label>
              <Input
                id="logoUrl"
                placeholder="https://..."
                value={logoUrl}
                onChange={(e) => setLogoUrl(e.target.value)}
              />
            </div>
            <div className="flex flex-col space-y-2">
              <Label htmlFor="headerLogoUrl">URL del logo del encabezado</Label>
              <Input
                id="headerLogoUrl"
                placeholder="https://..."
                value={headerLogoUrl}
                onChange={(e) => setHeaderLogoUrl(e.target.value)}
              />
            </div>
            <div className="flex flex-col space-y-2 sm:col-span-2">
              <Label htmlFor="logoAnimation">Animación del logo</Label>
              <Select value={logoAnimation} onValueChange={setLogoAnimation}>
                <SelectTrigger id="logoAnimation">
                  <SelectValue placeholder="Sin animación" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Sin animación</SelectItem>
                  <SelectItem value="bounce 2s infinite">Bounce</SelectItem>
                  <SelectItem value="spin 2s linear infinite">Spin</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col space-y-2 sm:col-span-2">
              <Label htmlFor="welcomeTitle">Título de bienvenida</Label>
              <Input
                id="welcomeTitle"
                placeholder="¡Hola! Soy tu asistente virtual"
                value={welcomeTitle}
                onChange={(e) => setWelcomeTitle(e.target.value)}
              />
            </div>
            <div className="flex flex-col space-y-2 sm:col-span-2">
              <Label htmlFor="welcomeSubtitle">Subtítulo de bienvenida</Label>
              <Input
                id="welcomeSubtitle"
                placeholder="Estoy aquí para ayudarte"
                value={welcomeSubtitle}
                onChange={(e) => setWelcomeSubtitle(e.target.value)}
              />
            </div>
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="script" className="w-full">
        <TabsList className="grid w-full grid-cols-2 mb-6">
          <TabsTrigger value="script" className="text-base py-2.5">
            <Code size={18} className="mr-2" /> Método &lt;script&gt; (Recomendado)
          </TabsTrigger>
          <TabsTrigger value="iframe" className="text-base py-2.5">
            <Code size={18} className="mr-2" /> Método &lt;iframe&gt; (Alternativo)
          </TabsTrigger>
        </TabsList>

        <TabsContent value="script">
          {renderCodeBlock("Widget con <script>", "script", codeScript, true)}
          <Card className="mt-6">
            <CardHeader>
              <CardTitle className="text-lg flex items-center"><HelpCircle size={20} className="mr-2 text-primary"/>Notas para el método &lt;script&gt;</CardTitle>
            </CardHeader>
            <CardContent className="text-sm space-y-2">
              <p><strong>Ventajas:</strong> Mayor flexibilidad, actualizaciones automáticas del widget, mejor integración con la página anfitriona.</p>
              <p><strong>Geolocalización, micrófono y portapapeles:</strong> Si tu página (donde pegas este script) ya está dentro de un iframe, asegúrate de que ese iframe contenedor tenga el atributo <code>allow="clipboard-write; geolocation; microphone; camera"</code> para que estas funciones del chatbot operen correctamente.</p>
              <p><strong>Personalización:</strong> Puedes modificar los atributos <code>data-*</code> en el script para ajustar la apariencia y comportamiento iniciales del widget. Por ejemplo, <code>data-default-open="true"</code> para que el chat se abra al cargar la página.</p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="iframe">
          {renderCodeBlock("Widget con <iframe>", "iframe", codeIframe)}
           <Card className="mt-6">
            <CardHeader>
              <CardTitle className="text-lg flex items-center"><HelpCircle size={20} className="mr-2 text-primary"/>Notas para el método &lt;iframe&gt;</CardTitle>
            </CardHeader>
            <CardContent className="text-sm space-y-2">
              <p><strong>Ventajas:</strong> Aislamiento completo del contenido del widget, puede ser más simple de implementar en algunas plataformas con restricciones de scripts.</p>
              <p><strong>Geolocalización, micrófono y portapapeles:</strong> Similar al método script, si la página donde insertas este iframe está a su vez dentro de otro iframe, el iframe más externo debe incluir <code>allow="clipboard-write; geolocation; microphone; camera"</code>.</p>
              <p><strong>Limitaciones:</strong> Menos flexibilidad para la comunicación directa con la página anfitriona en comparación con el método script. Las actualizaciones del widget se manejan dentro del iframe.</p>
            </CardContent>
          </Card>
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
                }}
              >
                {user && user.token && user.tipo_chat ? (
                  <iframe
                    src={iframeSrcUrl}
                    width={WIDGET_STD_WIDTH}
                    height={WIDGET_STD_HEIGHT}
                    style={{
                      border: "none",
                      width: "100%",
                      height: "100%",
                      borderRadius: "16px",
                      background: "transparent",
                      display: "block",
                    }}
                    loading="lazy"
                    title="Vista previa del Chatbot Chatboc"
                    allow="clipboard-write; geolocation; microphone; camera"
                  />
                ) : (
                  <div className="p-4 text-center text-muted-foreground">
                    <AlertTriangle size={32} className="mx-auto mb-2" />
                    La vista previa no está disponible. Verifica la configuración del usuario.
                  </div>
                )}
              </div>
            </div>
          </CardContent>
          <CardFooter className="p-4 bg-muted/20 dark:bg-muted/10 flex items-center justify-center">
            <p className="text-xs text-muted-foreground text-center">
              Esta es una simulación de cómo se verá el widget en tu sitio. <br/>
              Las dimensiones y la posición pueden variar según tu implementación.
            </p>
          </CardFooter>
        </Card>
      </section>

      <section className="mt-12">
        <h2 className="text-2xl font-semibold mb-4 flex items-center">
          <HelpCircle size={28} className="mr-3 text-primary" />
          Solución de Problemas y Soporte
        </h2>
        <Card>
          <CardContent className="pt-6 text-sm space-y-3">
            <p>
              <strong>¿No ves el widget?</strong>
              Verifica que el código esté correctamente pegado antes de la etiqueta <code>&lt;/body&gt;</code>.
              Asegúrate de que tu plataforma (Tiendanube, Shopify, etc.) permita la inserción de scripts o iframes de terceros.
              En Tiendanube, por ejemplo, puedes necesitar usar la opción de "Editar Código Avanzado".
            </p>
            <p>
              <strong>Problemas de Geolocalización, micrófono o Portapapeles:</strong>
              Asegúrate de que tu sitio se sirva a través de <strong>HTTPS</strong>, ya que muchas funciones del navegador, incluida la geolocalización y el acceso al micrófono, lo requieren.
              Si tu página está incrustada en otro iframe, el iframe contenedor DEBE tener el atributo <code>allow="clipboard-write; geolocation; microphone; camera"</code>.
            </p>
             <p>
              <strong>Conflictos de Estilos o Scripts:</strong>
              El widget está diseñado para minimizar conflictos. Si experimentas problemas, intenta cargar el script del widget al final del <code>&lt;body&gt;</code>.
              Si usas el método iframe, los estilos están completamente aislados.
            </p>
            <p>
              <strong>¿Aún necesitas ayuda?</strong> No dudes en{" "}
              <a href="mailto:info@chatboc.ar" className="underline text-primary hover:text-primary/80 font-medium">
                contactar a nuestro equipo de soporte
              </a>.
              Estamos aquí para ayudarte a integrar Chatboc exitosamente.
            </p>
          </CardContent>
        </Card>
      </section>

    </div>
  );
};

export default Integracion;
