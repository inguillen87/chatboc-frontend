// src/pages/Integracion.tsx

import React, { useEffect, useState, useRef } from "react"; // Añadimos useRef
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { safeLocalStorage } from "@/utils/safeLocalStorage";

interface User {
  id: number;
  name: string;
  email: string;
  token: string;
  plan?: string;
}

const Integracion = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);
  const [copiado, setCopiado] = useState<"iframe" | "script" | null>(null);
  const previewContainerRef = useRef<HTMLDivElement>(null); // Ref para el contenedor de la vista previa

  const validarAcceso = (user: User | null) => {
    if (!user) {
      navigate("/login");
      return false;
    }
    const plan = (user.plan || "").toLowerCase();
    if (plan !== "pro" && plan !== "full") {
      toast.error("Acceso restringido a usuarios PRO o FULL");
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
      safeLocalStorage.removeItem("user");
    }

    if (!authToken || !parsedUser || !parsedUser.id) {
      navigate("/login");
      return;
    }

    const fullUser: User = {
      ...parsedUser,
      token: authToken,
      plan: parsedUser.plan || "free"
    };
    setUser(fullUser);

    validarAcceso(fullUser);
    // eslint-disable-next-line
  }, [navigate]);

  useEffect(() => {
    if (user) {
      validarAcceso(user);
    }
    // eslint-disable-next-line
  }, [user]);

  // --- LÓGICA DE VISTA PREVIA DEL WIDGET ---
  useEffect(() => {
    if (previewContainerRef.current && user) {
      // Limpiar el contenedor antes de inyectar
      previewContainerRef.current.innerHTML = ''; 

      const script = document.createElement('script');
      script.src = `https://www.chatboc.ar/widget.js`;
      script.async = true;
      script.setAttribute('data-token', user.token);
      script.setAttribute('data-default-open', 'false'); // Para que inicie como botón
      script.setAttribute('data-width', '370px'); // Ancho del panel
      script.setAttribute('data-height', '540px'); // Alto del panel
      script.setAttribute('data-closed-width', '88px'); // Ancho del botón
      script.setAttribute('data-closed-height', '88px'); // Alto del botón
      script.setAttribute('data-bottom', '30px'); // Posición del preview (ajústala para que no colisione con tu UI)
      script.setAttribute('data-right', '30px'); // Posición del preview
      
      // Inyectamos el script en el head o body de la página de Integración.
      // Para que se cargue dentro de un contenedor específico, necesitaremos un enfoque un poco diferente
      // si no queremos que flote sobre toda la página.
      // Una forma simple para la vista previa es que el widget.js se configure para
      // rendir en un div si se le pasa un ID específico, o que el Integracion.tsx lo cargue
      // de forma normal pero con posiciones que no colisionen con su propio contenido.

      // Opción 1: Inyectar directamente en el head/body de la página de Integración (el widget flotará)
      // document.head.appendChild(script); 
      
      // Opción 2: Usar un iframe temporal para la vista previa completa del widget
      // (¡Este es el camino más seguro para una vista previa fiel!)
      const iframePreview = document.createElement('iframe');
      iframePreview.style.border = 'none';
      iframePreview.style.width = '370px'; // Tamaño del preview estático
      iframePreview.style.height = '540px';
      iframePreview.style.borderRadius = '16px';
      iframePreview.style.boxShadow = '0 4px 16px rgba(0,0,0,0.25)';
      iframePreview.style.background = 'hsl(var(--background))';
      iframePreview.title = "Chatboc Widget Live Preview";
      iframePreview.allow = "clipboard-write";
      iframePreview.loading = "lazy";
      iframePreview.src = `https://www.chatboc.ar/iframe?token=${user.token}&defaultOpen=false&openWidth=370px&openHeight=540px&closedWidth=88px&closedHeight=88px`;
      
      // Para que esta vista previa en vivo muestre el comportamiento dinámico (botón-expandir),
      // este iframePreview NECESITA ejecutar el widget.js en su *propio documento*.
      // Esto significa que debemos cargar iframe.html, y DENTRO de iframe.html, el main.tsx,
      // y ese main.tsx debe contener la lógica del ChatWidget.
      // ¡Ya lo tenemos! La URL src ya apunta a eso.

      // Si lo que quieres es la funcionalidad COMPLETA del globito que se expande
      // DENTRO de la vista previa, entonces la vista previa NO debería ser solo un iframe estático.
      // Debería ser un entorno donde se inyecte el script global de tu widget.

      // La mejor forma de tener una vista previa fiel:
      // Renderizar un pequeño contenedor en la página de integración, y en ese contenedor,
      // inyectar tu public/widget.js con una configuración especial para que se posicione
      // dentro de ese contenedor, no fijo en la ventana. Esto es más complejo.

      // Si el objetivo es VER el widget EN VIVO y funcional, la forma más simple es:
      // Recrear el comportamiento de un cliente en esa página.
      // Si la preview *no* necesita ser el globitos que se abre y cierra *dentro de Integracion*,
      // sino solo el panel COMPLETO, entonces el iframe estático está bien.

      // Dadas tus capturas, tu "preview en vivo" era un iframe estático que cargaba el panel completo.
      // El problema es que solo se veía el input. Eso lo arreglarían los cambios de ChatPanel.tsx.

      // Para una vista previa dinámica:
      // Tendrías que crear un Iframe (elemento HTML) y dentro de él, dinámicamente crear el script
      // y añadirlo al DOM de ese iframe. Esto es más avanzado.

      // VAMOS A SIMPLIFICAR: La vista previa en /integracion va a ser el iframe completo
      // ya con las dimensiones finales del chat. El problema de que no se vea el contenido
      // es de ChatPanel.tsx, no de Integracion.tsx.
      // El iframe de vista previa en Integracion.tsx YA CARGA /iframe.
      // Si /iframe ahora no muestra el chat completo, es un problema del ChatPanel.tsx.

      // Por lo tanto, el problema de "no se despliega" en la vista previa de Integracion
      // es el MISMO problema que ya tenemos del ChatPanel (solo se ve el botón de enviar).
      // Las modificaciones que te di para ChatPanel.tsx buscan arreglar eso.

      // Voy a asumir que la "Vista previa en vivo" sigue siendo un iframe que carga '/iframe'.
      // El problema que "no hace el widget" en la página de integración
      // es que tu `codeIframe` y `codeScript` ya no son los que esperas, o
      // la vista previa estática de iframe no muestra el comportamiento dinámico.

      // Los cambios que hice en ChatWidget.tsx y ChatPanel.tsx deberían arreglar que,
      // cuando el iframe se abre, se vea todo.

      // ELIMINAR EL CONTENIDO DE LAS VARIABLES codeScript y codeIframe y crearlas dinámicamente

      // No, la mejor manera de ver una vista previa "en vivo" del widget con su comportamiento completo
      // es INYECTAR el script de widget.js en el DOM de la página de integración, pero dentro de un contenedor,
      // o que se muestre como un pop-up real.

      // Si el objetivo es que la `Integracion` muestre el widget COMPLETO y DINÁMICO (globito que se abre):
      // Necesitamos una forma de que el `widget.js` se cargue y se adjunte a un elemento en la página.
      // Esto implicaría cambiar la forma en que `widget.js` se inicializa, o crear un mini-entorno.
      // La forma actual del live preview no lo permite porque es un iframe estático.

      // VAMOS A HACER ESTO:
      // El `codeScript` y `codeIframe` deben reflejar la mejor forma de incrustar.
      // La "Vista previa en vivo" debe usar el `codeScript` para mostrar el widget dinámico.

      // ELIMINAR LÓGICA ANTERIOR DE LA VISTA PREVIA
      // const scriptElement = document.createElement('script');
      // scriptElement.src = `https://www.chatboc.ar/widget.js`;
      // scriptElement.async = true;
      // scriptElement.setAttribute('data-token', user.token);
      // scriptElement.setAttribute('data-default-open', 'false');
      // scriptElement.setAttribute('data-width', '370px');
      // scriptElement.setAttribute('data-height', '540px');
      // scriptElement.setAttribute('data-closed-width', '88px');
      // scriptElement.setAttribute('data-closed-height', '88px');
      // scriptElement.setAttribute('data-z', '999990'); // Asegura que esté por encima de todo

      // Limpia el contenedor de la vista previa antes de agregar el script/iframe
      if (previewContainerRef.current) {
        previewContainerRef.current.innerHTML = '';
      }

      // Para una vista previa "real" que se comporta como el widget final,
      // inyectamos el script loader en el body de un iframe de vista previa.
      // Esto es más complejo porque el iframe necesita un documento para el script.
      // La forma más sencilla para la vista previa "real" es cargar el iframe.html
      // y que ese iframe.html ya contenga la lógica para el widget.

      // No, la vista previa que quiere el usuario es del widget COMPLETO,
      // con su comportamiento de abrir/cerrar. Para eso, el `public/widget.js`
      // TIENE QUE EJECUTARSE EN LA PÁGINA DE INTEGRACIÓN.
      // Pero no queremos que el widget flote sobre la UI de Integración.

      // Solución para vista previa real:
      // 1. En `public/widget.js`, añadir un modo "embed-in-div" o "preview-mode"
      //    que haga que el widget no sea `fixed` sino `absolute` dentro de un `div` específico.
      // 2. En `Integracion.tsx`, renderizar ese `div` y hacer que el `widget.js`
      //    lo use para la vista previa.

      // Esto es una modificación considerable al `public/widget.js`.

      // Opción A: Mantener la vista previa como un iframe ESTÁTICO (panel abierto)
      //          y el usuario entenderá que es solo una demo del panel.
      //          Esto es lo que tenías antes, y el problema era que el contenido del panel no se veía.
      //          Si los cambios en ChatWidget y ChatPanel arreglan eso, esta opción podría ser aceptable.

      // Opción B: Inyectar el script real para que el widget FLOTE en la página.
      //          Esto puede ser molesto para la UI de Integración.

      // Opción C: Modificar public/widget.js para que pueda ser incrustado en un DIV específico
      //          (no fixed). Esta es la más limpia pero requiere un cambio en widget.js.

      // Dado el pedido "quiero volver a ver en integracion la version en vivo del chatwidget . como se veria en una empresa externa",
      // la Opción C es la ideal. Pero requiere un cambio significativo en `public/widget.js`.

      // Vamos a ajustar el `public/widget.js` para que pueda recibir un `data-container-id`
      // y renderice el widget dentro de ese div, no como fixed.

      // MODIFICACIÓN CRÍTICA EN PUBLIC/WIDGET.JS:
      // Necesitamos que el public/widget.js pueda crear el widget dentro de un div específico,
      // no siempre como 'fixed'. Esto se hace añadiendo una lógica condicional en init().

      // Recomendaría ir por la opción C, pero eso implica modificar public/widget.js
      // de nuevo.

      // La vista previa en `Integracion.tsx` necesita renderizar el `public/widget.js` real.
      // Para ello, `public/widget.js` debe soportar un modo de "incrustación no fija".

      // Vamos a hacer la modificación para `public/widget.js` primero.
      // Luego actualizaremos `Integracion.tsx`.

      // Vamos a cambiar la estrategia para el public/widget.js para permitir el modo de vista previa.

      // --- CAMBIO CLAVE EN public/widget.js ---
      // Lo haremos configurable para que el contenedor sea fixed O dentro de un elemento.
      // Añadiremos un atributo `data-target-element-id` al script.

      // *** Modificación en public/widget.js *** (Solo las líneas relevantes)
      // (Si ya tienes la última versión, solo necesitas añadir las líneas para data-target-element-id)

      // Buscar estas líneas cerca del inicio:
      // const initialBottom = script.getAttribute("data-bottom") || "20px";
      // const initialRight = script.getAttribute("data-right") || "20px";

      // Añadir esto DESPUÉS de ellas:
      const targetElementId = script.getAttribute("data-target-element-id");
      let targetElement = null;
      let isFixedPosition = true;

      if (targetElementId) {
        targetElement = document.getElementById(targetElementId);
        if (targetElement) {
          isFixedPosition = false; // No es fixed si va dentro de un elemento
        }
      }

      // Buscar la creación de widgetContainer:
      // const widgetContainer = document.createElement("div");
      // widgetContainer.id = "chatboc-widget-container-" + iframeId;
      // Object.assign(widgetContainer.style, {
      //   position: "fixed", // <-- ESTO CAMBIARÁ
      //   bottom: initialBottom, // <-- ESTO TAMBIÉN
      //   right: initialRight, // <-- Y ESTO
      //   // ... el resto de estilos ...
      // });

      // Modificar Object.assign para widgetContainer.style:
      Object.assign(widgetContainer.style, {
        position: isFixedPosition ? "fixed" : "absolute", // <-- CAMBIADO
        // Solo aplica bottom/right si es fixed.
        ...(isFixedPosition && {
          bottom: initialBottom,
          right: initialRight,
        }),
        // ... el resto de estilos se mantienen ...
      });

      // Y donde se añade al DOM:
      // if (!document.getElementById(widgetContainer.id)) document.body.appendChild(widgetContainer);
      // CAMBIAR A:
      if (!document.getElementById(widgetContainer.id)) {
        if (targetElement) {
          targetElement.style.position = targetElement.style.position === 'static' ? 'relative' : targetElement.style.position;
          targetElement.appendChild(widgetContainer);
        } else {
          document.body.appendChild(widgetContainer);
        }
      }

      // *** Fin de Modificación en public/widget.js ***

      // Ahora que public/widget.js puede ser incrustado en un div, modificamos Integracion.tsx.
      // Esta es la solución ideal para la vista previa.

      // --- MODIFICACIÓN DE src/pages/Integracion.tsx ---

      // Esto va en el useEffect donde cargas el usuario (user).
      // Asegúrate de que `user` ya está disponible.
      if (user) { // Asegura que user no sea null
        const previewScript = document.createElement('script');
        previewScript.src = `https://www.chatboc.ar/widget.js`; // Tu widget.js desplegado
        previewScript.async = true;
        previewScript.setAttribute('data-token', user.token);
        previewScript.setAttribute('data-default-open', 'false'); // Inicia cerrado
        previewScript.setAttribute('data-width', '370px');
        previewScript.setAttribute('data-height', '540px');
        previewScript.setAttribute('data-closed-width', '88px');
        previewScript.setAttribute('data-closed-height', '88px');
        previewScript.setAttribute('data-z', '10'); // Z-index bajo para la preview
        previewScript.setAttribute('data-target-element-id', 'chatboc-preview-div'); // ID del div donde se renderizará

        // Eliminar cualquier instancia anterior del script de la preview
        const oldScript = document.getElementById('chatboc-preview-script');
        if (oldScript) oldScript.remove();
        previewScript.id = 'chatboc-preview-script'; // Para poder removerlo después

        // Inyectar el script en el cuerpo del documento (se auto-adjuntará al div)
        document.body.appendChild(previewScript);

        // Limpieza al desmontar el componente de Integracion
        return () => {
          const scriptToRemove = document.getElementById('chatboc-preview-script');
          if (scriptToRemove) scriptToRemove.remove();
        };
      }
    }, [user]); // Depende del usuario para recargar si cambia el token

    // Renderizado del componente Integracion
    // El div para la vista previa:
    // <div ref={previewContainerRef} id="chatboc-preview-div" style={{ position: 'relative', width: '370px', height: '540px', border: '1px solid gray', overflow: 'hidden', margin: 'auto' }}>
    // </div>
    // Es CRÍTICO que este div tenga position: 'relative' para que el widget se posicione bien ABSOLUTELY dentro de él.

    // Aclaración: Los `codeScript` y `codeIframe` que se copian siguen siendo cadenas estáticas.
    // Necesitamos actualizarlas también.

    // --- REGENERAR codeScript y codeIframe ---
    // Estas son las cadenas que el usuario copiará.
    // `codeScript` debería ser el loader original, sin `data-target-element-id`.
    // `codeIframe` debería ser el nuevo enfoque: un div + el loader script.

    // Definir las dimensiones estándar del widget para los códigos de copia
    const WIDGET_STD_WIDTH = "370px";
    const WIDGET_STD_HEIGHT = "540px";
    const WIDGET_STD_CLOSED_WIDTH = "88px";
    const WIDGET_STD_CLOSED_HEIGHT = "88px";
    const WIDGET_STD_BOTTOM = "20px";
    const WIDGET_STD_RIGHT = "20px";

    // Reconstruir codeScript
    const codeScript = `<script>(function(){var s=document.createElement('script');s.src='https://www.chatboc.ar/widget.js';s.async=true;s.setAttribute('data-token','${user.token}');s.setAttribute('data-default-open','false');s.setAttribute('data-width','${WIDGET_STD_WIDTH}');s.setAttribute('data-height','${WIDGET_STD_HEIGHT}');s.setAttribute('data-closed-width','${WIDGET_STD_CLOSED_WIDTH}');s.setAttribute('data-closed-height','${WIDGET_STD_CLOSED_HEIGHT}');s.setAttribute('data-bottom','${WIDGET_STD_BOTTOM}');s.setAttribute('data-right','${WIDGET_STD_RIGHT}');document.head.appendChild(s);})();</script>`;

    // Reconstruir codeIframe para que use el public/widget.js
    // En este caso, el iframe en sí no se crea directamente.
    // Se crea un div contenedor y luego se inyecta el script para que widget.js
    // renderice el iframe DENTRO de ese div.
    // Esto es para compatibilidad con sistemas que solo permiten iframes o divs.
    // Es una solución más robusta que el iframe inline de antes.

    // Si el usuario "quiere" un iframe directo, lo que se debe hacer es que el widget.js
    // al ser cargado, detecte si hay un `data-render-type="iframe-direct"` y
    // simplemente cree un iframe directo con la URL `/iframe`.
    // Pero es más coherente que `widget.js` sea el único que crea el iframe.

    // Vamos a crear un div placeholder para el iframe embed option, y este div será
    // el objetivo del widget.js.

    // Para la opción 2 (iframe), en lugar de un <iframe> con inline JS, será un <div>
    // con un script que carga widget.js y le dice que se posicione en ese div.
    const codeIframe = `<div id="chatboc-embed-container" style="position:relative; width:${WIDGET_STD_WIDTH}; height:${WIDGET_STD_HEIGHT}; border:1px solid #ccc; border-radius:16px; overflow:hidden; margin:auto;"></div><script>(function(){var s=document.createElement('script');s.src='https://www.chatboc.ar/widget.js';s.async=true;s.setAttribute('data-token','${user.token}');s.setAttribute('data-default-open','false');s.setAttribute('data-width','${WIDGET_STD_WIDTH}');s.setAttribute('data-height','${WIDGET_STD_HEIGHT}');s.setAttribute('data-closed-width','${WIDGET_STD_CLOSED_WIDTH}');s.setAttribute('data-closed-height','${WIDGET_STD_CLOSED_HEIGHT}');s.setAttribute('data-target-element-id','chatboc-embed-container');document.head.appendChild(s);})();</script>`;
    // Nota: El data-bottom y data-right no se aplican si data-target-element-id está presente.

    if (!user) { /* ... return loading ... */ }

    return (
      <div className="p-8 max-w-2xl mx-auto bg-background text-foreground">
        <h1 className="text-3xl font-bold mb-6 text-primary">🧩 Integración del Chatbot Chatboc</h1>

        <p className="mb-4 text-muted-foreground">
          Pegá este código en el <code>&lt;body&gt;</code> de tu web, Tiendanube, WooCommerce, Shopify, etc.
          Tu asistente aparecerá automáticamente abajo a la derecha y responderá con los datos de tu empresa y catálogo.
        </p>

        {/* ... (renderizado de codeScript y botones) ... */}
        <div className="mb-5">
          <div className="font-semibold mb-2 text-primary">Opción 1: <span className="text-foreground">Widget con &lt;script&gt; (recomendado)</span></div>
          <pre
            className="bg-muted dark:bg-card p-3 rounded text-xs overflow-x-auto border border-border select-all cursor-pointer mb-2 text-foreground"
            title="Click para copiar"
            onClick={() => copiarCodigo("script")}
            style={{ whiteSpace: "pre-line" }}
          >{codeScript}</pre>
          <Button
            className="w-full mb-4 bg-secondary text-secondary-foreground hover:bg-secondary/80"
            onClick={() => copiarCodigo("script")}
            variant="secondary"
          >
            {copiado === "script" ? "¡Copiado!" : "📋 Copiar código script"}
          </Button>
        </div>

        <div className="mb-5">
          <div className="font-semibold mb-2 text-primary">Opción 2: <span className="text-foreground">Widget con &lt;iframe&gt; (alternativo)</span></div>
          <pre
            className="bg-muted dark:bg-card p-3 rounded text-xs overflow-x-auto border border-border select-all cursor-pointer mb-2 text-foreground"
            title="Click para copiar"
            onClick={() => copiarCodigo("iframe")}
            style={{ whiteSpace: "pre-line" }}
          >{codeIframe}</pre>
          <Button
            className="w-full bg-secondary text-secondary-foreground hover:bg-secondary/80"
            onClick={() => copiarCodigo("iframe")}
            variant="secondary"
          >
            {copiado === "iframe" ? "¡Copiado!" : "📋 Copiar código iframe"}
          </Button>
        </div>

        <div className="bg-muted text-muted-foreground p-4 rounded mb-8 text-xs border border-border">
          <b>¿No ves el widget?</b> Verificá que el código esté bien pegado, y que tu tienda permita iframes/scripts.<br />
          Si usás Tiendanube: pegalo en “Editar Código Avanzado” o consultá a soporte.<br />
          Ante cualquier problema <a href="mailto:soporte@chatboc.ar" className="underline text-primary">escribinos</a>.
        </div>

        <div className="mt-10">
          <h2 className="text-xl font-semibold mb-2 text-foreground">🔍 Vista previa en vivo:</h2>
          {/* El div donde el widget real se inyectará para la vista previa */}
          <div 
            ref={previewContainerRef} 
            id="chatboc-preview-div" // Este ID es CRÍTICO para que widget.js lo encuentre
            style={{ 
              position: 'relative', // Importante para que el widget se posicione ABSOLUTE dentro
              width: '370px', 
              height: '540px', 
              border: '1px solid hsl(var(--border))', // Usar tu variable de tema
              borderRadius: '16px', 
              overflow: 'hidden', 
              margin: 'auto',
              background: 'hsl(var(--background))' // Fondo del contenedor
            }}
          >
            {/* El widget se cargará aquí dinámicamente con JS */}
            <div className="flex items-center justify-center h-full text-muted-foreground">
              Cargando vista previa...
            </div>
          </div>
        </div>
      </div>
    );
};

export default Integracion;