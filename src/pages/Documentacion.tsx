import React from "react";

const Documentacion = () => (
  <div className="min-h-screen bg-background text-foreground py-16 px-4 md:px-0 flex flex-col items-center">
    <div className="max-w-2xl w-full bg-card rounded-2xl shadow-lg p-8 mt-6">

      <h1 className="text-3xl font-bold mb-6 text-primary">Documentación técnica</h1>

      {/* ===================== USUARIOS COMUNES ===================== */}
      <h2 className="text-2xl font-semibold mt-6 mb-4 text-primary">Para empresas, comercios y usuarios</h2>
      <p className="mb-4 text-base">
        <b>¿Qué podés hacer con Chatboc?</b> Usar el asistente para responder consultas de tus clientes, automatizar ventas y soporte, y tener tu propio chat listo para usar <b>sin programar nada</b>.
      </p>
      <ul className="list-disc ml-6 mb-4">
        <li>Ingresá a tu panel con usuario y contraseña.</li>
        <li>Personalizá tu empresa y rubro desde el perfil.</li>
        <li>Cargá el catálogo de productos en PDF o Excel para que el bot lo use en respuestas.</li>
        <li>Integrá Chatboc en tu web copiando el código del <b>iframe/widget</b> (disponible en tu panel).</li>
        <li>Gestioná las respuestas, consultas y cambios de plan desde la web.</li>
      </ul>

      <div className="bg-yellow-50 dark:bg-gray-900 border-l-4 border-yellow-500 p-3 rounded text-sm text-yellow-800 dark:text-yellow-200 mb-4">
        <b>Importante:</b> el rubro y el <code>tipo_chat</code> deben coincidir en todas las consultas. Si tu rubro pertenece a los públicos, usá siempre el endpoint y la estética de municipio. Para el resto de los rubros, usá pyme.
      </div>
      <p className="mb-4 text-base">
        Si tenés dudas frecuentes, visitá el <a href="/faqs" className="text-blue-500 underline">Centro de ayuda</a> o escribinos por WhatsApp.
      </p>

      {/* ===================== DESARROLLADORES ===================== */}
      <h2 className="text-2xl font-semibold mt-10 mb-4 text-primary">Para desarrolladores e integradores (API REST)</h2>
      <div className="bg-yellow-50 dark:bg-gray-800 border-l-4 border-yellow-500 p-4 rounded mb-4 text-yellow-700 dark:text-yellow-200">
        <b>¡Importante!</b><br />
        <span>
          El <b>acceso a la API es exclusivo para empresas con plan activo o integradores autorizados</b>.
          <br />
          <b>No es gratuita ni libre</b>. Necesitás un <b>token de acceso</b> para todas las llamadas.
        </span>
      </div>
      <p className="mb-4">
        Si tu empresa o proyecto requiere integración con otros sistemas (CRM, ecommerce, WhatsApp, etc.), podés acceder a los endpoints de Chatboc para consultar, enviar preguntas y automatizar todo el flujo.
      </p>

      {/* ENDPOINTS */}
      <h3 className="text-lg font-semibold mt-4 mb-2 text-primary">Principales endpoints</h3>
      <ul className="list-disc ml-6 mb-4">
        <li>
          <strong>POST /ask/municipio</strong> o <strong>/ask/pyme</strong>
          <br />
          <span className="text-sm text-muted-foreground">
            Elegí el endpoint según tu rubro para consultar al agente IA.
          </span>
        </li>
        <li>
          <strong>GET /perfil</strong> — Info de la empresa.<br />
          <span className="text-sm text-muted-foreground">
            Obtené tus datos de empresa y rubro (requiere token).
          </span>
        </li>
        <li>
          <strong>POST /catalogo/cargar</strong> — Subir catálogo.<br />
          <span className="text-sm text-muted-foreground">
            Subí tu catálogo de productos o tus formularios y trámites, según tu tipo de usuario.
          </span>
        </li>
        <li>
          <strong>GET /productos</strong> — Obtener productos normalizados.<br />
          <span className="text-sm text-muted-foreground">
            Devuelve el catálogo con cada producto y sus campos separados.
          </span>
        </li>
      </ul>

      <h3 className="text-lg font-semibold mt-4 mb-2 text-primary">Ejemplo: consulta al bot vía API (Python)</h3>
      <div className="bg-black rounded-lg text-green-300 text-sm p-4 font-mono mb-4 overflow-auto">
{`import requests

url = "https://api.chatboc.ar/ask/municipio"  # o "/ask/pyme" según corresponda
headers = {
    "Authorization": "Bearer TU_TOKEN_AQUI",
    "Content-Type": "application/json"
}
data = {
    "pregunta": "¿Cuáles son los horarios de atención?",
    "rubro_frontend": "",   # opcional, según integración
    "tipo_chat": "municipio",  # o "pyme" según el caso
}

response = requests.post(url, json=data, headers=headers)
print(response.json())  # Respuesta del bot
`}
      </div>
      <p className="text-xs text-muted-foreground mb-4">
        Usá tu token personal y siempre protegé esta clave. Cada plan tiene un límite de consultas por mes según contrato.
      </p>

      <h3 className="text-lg font-semibold mt-6 mb-2 text-primary">Ejemplo: subir catálogo por API (Python)</h3>
      <div className="bg-black rounded-lg text-yellow-200 text-sm p-4 font-mono mb-4 overflow-auto">
{`import requests

url = "https://api.chatboc.ar/catalogo/cargar"
headers = {"Authorization": "Bearer TU_TOKEN_AQUI"}
files = {"archivo": open("catalogo.xlsx", "rb")}

response = requests.post(url, files=files, headers=headers)
print(response.json())
`}
      </div>

      <h3 className="text-lg font-semibold mt-6 mb-2 text-primary">Ejemplo de respuesta de producto</h3>
      <div className="bg-black rounded-lg text-green-300 text-sm p-4 font-mono mb-4 overflow-auto">
{`{
  "nombre": "Taladro Percutor Black+Decker 500W",
  "categoria": "Herramientas eléctricas",
  "descripcion": "Taladro percutor 500W con maletín y accesorios",
  "sku": "BD500W",
  "presentacion": "Unidad",
  "precio_unitario": 58900,
  "stock": 7,
  "marca": "Black+Decker",
  "imagen_url": "https://miferreteria.com/img/taladro_bd500w.jpg"
}`}
      </div>

      {/* ACLARACIÓN SEGURIDAD */}
      <div className="bg-red-50 dark:bg-gray-900 border-l-4 border-red-500 p-4 rounded mb-4 text-red-700 dark:text-red-200">
        <b>Seguridad y buenas prácticas:</b>
        <ul className="list-disc ml-4 text-sm">
          <li>No compartas tu token. Cada empresa tiene uno único e intransferible.</li>
          <li>Si sospechás uso indebido, solicitá el cambio de token inmediato.</li>
          <li>El abuso o uso fraudulento será bloqueado automáticamente por el sistema.</li>
        </ul>
      </div>

      {/* INFO FINAL */}
      <h2 className="text-xl font-semibold mb-2 mt-10 text-primary">Soporte y consultas</h2>
      <p className="mb-2">
        ¿Dudas técnicas, problemas de integración o querés acceso a la API? <br />
        Escribinos a <a href="mailto:info@chatboc.ar" className="text-blue-500 underline">info@chatboc.ar</a> o consultá el{" "}
        <a href="/faqs" className="text-blue-500 underline">Centro de ayuda</a>.
      </p>
      <p className="text-xs text-muted-foreground mt-8">
        *Todos los endpoints requieren autenticación y plan activo. El acceso a la API REST está sujeto a condiciones comerciales y límites según plan.
      </p>
    </div>
  </div>
);

export default Documentacion;
