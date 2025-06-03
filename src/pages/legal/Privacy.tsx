import React from "react";

export default function PrivacyPolicy() {
  return (
    <main className="min-h-screen flex flex-col bg-white text-gray-900 dark:bg-gray-900 dark:text-white transition-colors">
      <section className="flex-1 flex items-center justify-center px-4">
        <div className="w-full max-w-2xl mx-auto px-4 sm:px-8 py-8 sm:py-12 bg-gray-100 dark:bg-gray-800 rounded-2xl shadow-xl border border-gray-200 dark:border-gray-700 mt-10 mb-10">
          <h1 className="text-2xl sm:text-3xl font-bold mb-6 text-blue-600 dark:text-blue-400">
            Política de Privacidad
          </h1>
          <p className="mb-4 text-gray-700 dark:text-gray-300">
            En <b>Chatboc</b> priorizamos la privacidad y la protección de tus datos personales y comerciales. Esta política explica cómo recolectamos, usamos y protegemos tu información cuando usás nuestros servicios de agente virtual, CRM y sistema POS.
          </p>
          
          <h2 className="text-lg font-semibold mb-2 text-primary">¿Qué datos recolectamos?</h2>
          <ul className="list-disc ml-6 mb-4 text-gray-700 dark:text-gray-300">
            <li>Datos de registro y perfil (nombre, email, empresa, teléfono, dirección, etc.).</li>
            <li>Datos de catálogo de productos, consultas y conversaciones con el agente virtual.</li>
            <li>Información de uso de la plataforma para mejorar nuestros servicios.</li>
            <li>En caso de usar integraciones externas (CRM, POS, APIs), datos necesarios para el funcionamiento.</li>
          </ul>

          <h2 className="text-lg font-semibold mb-2 text-primary">¿Cómo usamos tus datos?</h2>
          <ul className="list-disc ml-6 mb-4 text-gray-700 dark:text-gray-300">
            <li>Para operar el sistema de agente IA, gestión comercial y soporte automatizado.</li>
            <li>Para personalizar tu experiencia y sugerencias en la plataforma.</li>
            <li>Para enviar notificaciones relevantes sobre el uso de Chatboc.</li>
            <li>Nunca vendemos ni compartimos tus datos con terceros sin tu consentimiento expreso.</li>
          </ul>

          <h2 className="text-lg font-semibold mb-2 text-primary">¿Cómo protegemos tus datos?</h2>
          <ul className="list-disc ml-6 mb-4 text-gray-700 dark:text-gray-300">
            <li>Almacenamos tu información en servidores seguros, protegidos con estándares de seguridad actualizados.</li>
            <li>Ciframos contraseñas y aplicamos buenas prácticas para resguardar tus datos.</li>
            <li>Respetamos la legislación argentina (Ley 25.326) y estándares internacionales de privacidad.</li>
          </ul>

          <h2 className="text-lg font-semibold mb-2 text-primary">Tus derechos como usuario</h2>
          <ul className="list-disc ml-6 mb-4 text-gray-700 dark:text-gray-300">
            <li>Podés acceder, modificar o eliminar tu información en cualquier momento desde tu perfil o escribiéndonos a <a href="mailto:info@chatboc.ar" className="underline text-blue-400">info@chatboc.ar</a>.</li>
            <li>Podés solicitar la baja definitiva de tu cuenta y la eliminación total de tus datos.</li>
            <li>Podés consultar, en cualquier momento, cómo se usan y resguardan tus datos.</li>
          </ul>

          <h2 className="text-lg font-semibold mb-2 text-primary">Consultas y contacto</h2>
          <p className="mb-4 text-gray-700 dark:text-gray-300">
            Si tenés dudas o necesitás ayuda sobre privacidad, podés escribirnos directo por WhatsApp, email o desde nuestro centro de ayuda. Respondemos siempre en el día.
          </p>
          
          <div className="mt-8 flex flex-wrap gap-4">
            <a
              href="/legal/terms"
              className="text-blue-600 dark:text-blue-400 underline hover:text-blue-800 dark:hover:text-blue-300 transition"
            >
              Términos y Condiciones
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
