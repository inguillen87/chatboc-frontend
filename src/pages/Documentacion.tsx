import React from "react";

const DocsPage = () => (
  <div className="min-h-screen bg-background text-foreground py-16 px-4 md:px-0 flex flex-col items-center">
    <div className="max-w-2xl w-full bg-card rounded-2xl shadow-lg p-8 mt-6">
      <h1 className="text-3xl font-bold mb-4 text-primary">Documentación Técnica</h1>
      <p className="mb-6 text-lg text-muted-foreground">
        Todo lo que necesitás para integrar y aprovechar Chatboc al máximo. 
        Si sos desarrollador, acá encontrás ejemplos de uso, autenticación, integración por iframe, API REST y webhooks.
      </p>
      <h2 className="text-xl font-semibold mb-2 mt-6 text-primary">Guía rápida de integración</h2>
      <ol className="list-decimal ml-6 mb-4 text-base">
        <li>Registrate y obtené tu token de acceso.</li>
        <li>Agregá el widget de Chatboc copiando el iframe personalizado a tu web.</li>
        <li>Consultá los endpoints disponibles para automatizar ventas y soporte.</li>
      </ol>
      <h2 className="text-xl font-semibold mb-2 mt-6 text-primary">Principales endpoints</h2>
      <ul className="list-disc ml-6 mb-4">
        <li><strong>POST /ask</strong> — Consulta al agente IA</li>
        <li><strong>GET /perfil</strong> — Datos y configuración de tu empresa</li>
        <li><strong>POST /catalogo/upload</strong> — Carga de catálogos (PDF, Excel)</li>
      </ul>
      <p className="mb-2">¿Dudas técnicas? Escribinos a <a href="mailto:soporte@chatboc.ar" className="text-blue-500 underline">soporte@chatboc.ar</a> o consultá el <a href="/help" className="text-blue-500 underline">Centro de Ayuda</a>.</p>
    </div>
  </div>
);

export default DocsPage;
