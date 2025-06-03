import React from "react";

export default function CookiesPolicy() {
  return (
    <main className="min-h-screen flex flex-col bg-white text-gray-900 dark:bg-gray-900 dark:text-white transition-colors">
      <section className="flex-1 flex items-center justify-center px-4">
        <div className="w-full max-w-2xl mx-auto px-4 sm:px-8 py-8 sm:py-12 bg-gray-100 dark:bg-gray-800 rounded-2xl shadow-xl border border-gray-200 dark:border-gray-700 mt-10 mb-10">
          <h1 className="text-2xl sm:text-3xl font-bold mb-6 text-blue-600 dark:text-blue-400">Política de Cookies</h1>
          <p className="mb-4 text-gray-700 dark:text-gray-300">
            Chatboc utiliza cookies propias y de terceros para:
          </p>
          <ul className="list-disc ml-6 mb-4 text-gray-700 dark:text-gray-300">
            <li>Analizar el uso de la plataforma.</li>
            <li>Mejorar la experiencia del usuario.</li>
            <li>Recordar tus preferencias y sesión.</li>
          </ul>
          <p className="mb-4 text-gray-700 dark:text-gray-300">
            Podés bloquear o eliminar cookies desde la configuración de tu navegador, pero algunas funciones pueden verse afectadas.
          </p>
          <p className="mb-4 text-gray-700 dark:text-gray-300">
            Al usar Chatboc, aceptás nuestra política de cookies.
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
}
