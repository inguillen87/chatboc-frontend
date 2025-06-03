import React from "react";

export default function TermsPage() {
  return (
    <main className="min-h-screen flex flex-col bg-white text-gray-900 dark:bg-gray-900 dark:text-white transition-colors">
      <section className="flex-1 flex items-center justify-center px-4">
        <div className="w-full max-w-2xl mx-auto px-4 sm:px-8 py-8 sm:py-12 bg-gray-100 dark:bg-gray-800 rounded-2xl shadow-xl border border-gray-200 dark:border-gray-700 mt-10 mb-10">
          <h1 className="text-2xl sm:text-3xl font-bold mb-6 text-blue-600 dark:text-blue-400">
            Términos y Condiciones de Uso
          </h1>
          <p className="mb-4 text-gray-700 dark:text-gray-300">
            Al registrarte y utilizar <b>Chatboc</b> aceptás estos términos y condiciones, que regulan el uso de nuestros servicios de agente IA, CRM y sistema POS.
          </p>
          
          <h2 className="text-lg font-semibold mb-2 text-primary">Uso del servicio</h2>
          <ul className="list-disc ml-6 mb-4 text-gray-700 dark:text-gray-300">
            <li>El acceso a Chatboc requiere registro de usuario y aceptación de estos términos.</li>
            <li>No se permite el uso para actividades ilícitas, fraudulentas o que afecten a terceros.</li>
            <li>La contratación de planes pagos incluye límites y condiciones detallados en la sección <a href="/#precios" className="underline text-blue-400">Precios</a>.</li>
            <li>Las llamadas a la API y funcionalidades avanzadas están sujetas a los límites de uso establecidos en cada plan.</li>
          </ul>
          
          <h2 className="text-lg font-semibold mb-2 text-primary">Propiedad intelectual</h2>
          <ul className="list-disc ml-6 mb-4 text-gray-700 dark:text-gray-300">
            <li>El software, contenidos y diseños de Chatboc son propiedad exclusiva de sus creadores.</li>
            <li>No se permite copiar, modificar ni distribuir la plataforma sin autorización expresa.</li>
            <li>El usuario es responsable del contenido que cargue en la plataforma (catálogos, datos, respuestas, etc.).</li>
          </ul>
          
          <h2 className="text-lg font-semibold mb-2 text-primary">Responsabilidad y uso aceptable</h2>
          <ul className="list-disc ml-6 mb-4 text-gray-700 dark:text-gray-300">
            <li>Chatboc no se responsabiliza por el uso indebido, daños indirectos o pérdida de datos causada por el usuario.</li>
            <li>El servicio puede suspenderse temporalmente por mantenimiento, actualizaciones o fuerza mayor.</li>
            <li>Nos reservamos el derecho de bloquear o cancelar cuentas que incumplan estos términos.</li>
          </ul>

          <h2 className="text-lg font-semibold mb-2 text-primary">Datos y privacidad</h2>
          <ul className="list-disc ml-6 mb-4 text-gray-700 dark:text-gray-300">
            <li>El tratamiento de tus datos se detalla en nuestra <a href="/legal/privacy" className="underline text-blue-400">Política de Privacidad</a>.</li>
            <li>Puedes solicitar la baja de tu cuenta o el acceso/corrección/eliminación de tus datos en cualquier momento.</li>
          </ul>
          
          <h2 className="text-lg font-semibold mb-2 text-primary">Modificaciones y contacto</h2>
          <ul className="list-disc ml-6 mb-4 text-gray-700 dark:text-gray-300">
            <li>Podemos actualizar estos términos para mejorar el servicio. Te avisaremos en caso de cambios importantes.</li>
            <li>Si tenés dudas o consultas, escribinos a <a href="mailto:soporte@chatboc.ar" className="underline text-blue-400">soporte@chatboc.ar</a>.</li>
          </ul>
          
          <div className="mt-8 flex flex-wrap gap-4">
            <a
              href="/legal/privacy"
              className="text-blue-600 dark:text-blue-400 underline hover:text-blue-800 dark:hover:text-blue-300 transition"
            >
              Política de Privacidad
            </a>
            <a
              href="/legal/cookies"
              className="text-blue-600 dark:text-blue-400 underline hover:text-blue-800 dark:hover:text-blue-300 transition"
            >
              Política de Cookies
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
}
