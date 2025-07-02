import React from "react";

const CookiesPolicy = () => (
  <main className="min-h-screen flex flex-col bg-white text-gray-900 dark:bg-gray-900 dark:text-white transition-colors">
    <section className="flex-1 flex items-center justify-center px-4">
      <div className="w-full max-w-2xl mx-auto px-4 sm:px-8 py-8 sm:py-12 bg-gray-100 dark:bg-gray-800 rounded-2xl shadow-xl border border-gray-200 dark:border-gray-700 mt-10 mb-10">
        <h1 className="text-3xl font-bold mb-6 text-blue-600 dark:text-blue-400">Política de Cookies y Tecnologías Similares</h1>

        <p className="mb-4 text-gray-700 dark:text-gray-300">
          En <b>Chatboc</b> utilizamos tecnologías como cookies, localStorage y sessionStorage para brindarte una mejor experiencia y mejorar nuestro servicio.
        </p>

        <h2 className="text-lg font-semibold mb-3 text-primary">¿Qué son las cookies y tecnologías similares?</h2>
        <p className="mb-4 text-gray-700 dark:text-gray-300">
          Las cookies son pequeños archivos que se guardan en tu dispositivo al navegar por nuestro sitio. <b>LocalStorage</b> y <b>sessionStorage</b> son formas de almacenar información directamente en tu navegador para recordar preferencias o tu sesión, y no se envían al servidor en cada solicitud.
        </p>

        <h2 className="text-lg font-semibold mb-3 text-primary">¿Qué datos guardamos?</h2>
        <ul className="list-disc ml-6 mb-4 text-gray-700 dark:text-gray-300">
          <li>Preferencias de modo oscuro/claro (dark mode).</li>
          <li>Tu sesión y estado de autenticación (usuario logueado).</li>
          <li>Datos temporales para mejorar la experiencia (por ejemplo, notificaciones, formularios, preferencias de idioma, etc.).</li>
          <li>En algunos casos, podemos usar cookies de terceros para analizar el uso del sitio (Google Analytics, etc.).</li>
        </ul>

        <h2 className="text-lg font-semibold mb-3 text-primary">¿Para qué usamos esta información?</h2>
        <ul className="list-disc ml-6 mb-4 text-gray-700 dark:text-gray-300">
          <li>Analizar cómo se usa la plataforma para seguir mejorando.</li>
          <li>Personalizar tu experiencia y recordar tu configuración.</li>
          <li>Mantenerte autenticado mientras navegás.</li>
        </ul>

        <h2 className="text-lg font-semibold mb-3 text-primary">¿Cómo podés gestionar o eliminar cookies y datos guardados?</h2>
        <p className="mb-4 text-gray-700 dark:text-gray-300">
          Podés borrar o bloquear cookies y datos de almacenamiento local desde la configuración de tu navegador. Tené en cuenta que algunas funciones pueden dejar de funcionar si lo hacés.
        </p>

        <h2 className="text-lg font-semibold mb-3 text-primary">Cookies de terceros</h2>
        <p className="mb-4 text-gray-700 dark:text-gray-300">
          Podemos utilizar servicios externos como Google Analytics, Facebook Pixel o WhatsApp, que pueden instalar cookies propias. Te recomendamos revisar sus políticas si querés más detalles.
        </p>

        <p className="mb-6 text-gray-700 dark:text-gray-300">
          Al usar Chatboc, aceptás el uso de estas tecnologías según esta política.
        </p>
        <div className="mt-8 flex flex-wrap gap-4">
          <a
            href="/legal/privacy"
            className="text-blue-600 dark:text-blue-400 underline hover:text-blue-800 dark:hover:text-blue-300 transition"
          >
            Política de Privacidad
          </a>
          <a
            href="/legal/terms"
            className="text-blue-600 dark:text-blue-400 underline hover:text-blue-800 dark:hover:text-blue-300 transition"
          >
            Términos y Condiciones
          </a>
          <a
            href="/"
            className="text-gray-500 dark:text-gray-400 underline hover:text-gray-900 dark:hover:text-white transition"
          >
            Volver al inicio
          </a>
        </div>
      </div>
    </section>
    <footer className="bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-800 text-gray-500 dark:text-gray-400 text-xs sm:text-sm text-center py-6 transition-colors">
      © 2025 Chatboc · Todos los derechos reservados.
    </footer>
  </main>
);

export default CookiesPolicy;
