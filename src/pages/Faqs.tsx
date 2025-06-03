import React from "react";

const HelpPage = () => (
  <div className="min-h-screen bg-background text-foreground py-16 px-4 md:px-0 flex flex-col items-center">
    <div className="max-w-2xl w-full bg-card rounded-2xl shadow-lg p-8 mt-6">
      <h1 className="text-3xl font-bold mb-4 text-primary">Centro de Ayuda & Preguntas Frecuentes</h1>
      <div className="mb-6 space-y-4">
        <div>
          <h2 className="text-lg font-semibold mb-1 text-primary">¿Qué es Chatboc?</h2>
          <p className="text-muted-foreground">Es una plataforma SaaS argentina para automatizar ventas, soporte y atención 24/7 con un agente IA entrenado para pymes y comercios.</p>
        </div>
        <div>
          <h2 className="text-lg font-semibold mb-1 text-primary">¿Cómo integro el chat a mi web?</h2>
          <p className="text-muted-foreground">Desde tu panel podés copiar el código iframe y pegarlo en tu sitio. La integración es instantánea, sin necesidad de desarrollo.</p>
        </div>
        <div>
          <h2 className="text-lg font-semibold mb-1 text-primary">¿Qué archivos de catálogo acepta?</h2>
          <p className="text-muted-foreground">PDF, Excel (.xlsx, .xls) y CSV. El sistema procesa y reconoce productos, precios y cantidades automáticamente.</p>
        </div>
        <div>
          <h2 className="text-lg font-semibold mb-1 text-primary">¿Puedo usarlo desde el celular?</h2>
          <p className="text-muted-foreground">Sí, tanto el panel como el chat funcionan en móvil y escritorio, con diseño responsive y modo oscuro o claro.</p>
        </div>
        <div>
          <h2 className="text-lg font-semibold mb-1 text-primary">¿Qué hago si tengo problemas o dudas?</h2>
          <p className="text-muted-foreground">Podés escribirnos directo por WhatsApp, email o enviar un ticket desde el panel. Respondemos siempre en el día.</p>
        </div>
      </div>
      <div className="text-center mt-4">
        <a href="/docs" className="inline-block text-blue-500 underline">Ir a la documentación técnica</a>
      </div>
    </div>
  </div>
);

export default HelpPage;
