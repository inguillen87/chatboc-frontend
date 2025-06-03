import React from "react";

export default function TermsAndConditions() {
  return (
    <main className="min-h-screen flex flex-col bg-white text-gray-900 dark:bg-gray-900 dark:text-white transition-colors">
      <section className="flex-1 flex items-center justify-center px-4">
        <div className="w-full max-w-2xl mx-auto px-4 sm:px-8 py-8 sm:py-12 bg-gray-100 dark:bg-gray-800 rounded-2xl shadow-xl border border-gray-200 dark:border-gray-700 mt-10 mb-10">
          <h1 className="text-2xl sm:text-3xl font-bold mb-6 text-blue-600 dark:text-blue-400">
            Términos y Condiciones
          </h1>
          <p className="mb-4 text-gray-700 dark:text-gray-300">
            Al utilizar Chatboc aceptás estos términos:
          </p>
          <ul className="list-disc ml-6 mb-4 text-gray-700 dark:text-gray-300">
            <li>El servicio se brinda tal cual está, sujeto a cambios y mejoras constantes.</li>
            <li>No nos responsabilizamos por decisiones comerciales tomadas a partir de las respuestas del agente virtual.</li>
            <li>El usuario es responsable de la información y archivos que carga en la plataforma.</li>
            <li>Nos reservamos el derecho de suspender cuentas que realicen usos indebidos o fraudulentos.</li>
          </ul>
          <p className="mb-4 text-gray-700 dark:text-gray-300">
            Recomendamos leer también nuestra <a href="/legal/privacy" className="underline text-blue-600 dark:text-blue-400">Política de Privacidad</a> y <a href="/legal/cookies" className="underline text-blue-600 dark:text-blue-400">Política de Cookies</a>.
          </p>
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
