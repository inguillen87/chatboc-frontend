import React from "react";
import { Button } from "@/components/ui/button";

const ChatCRMPage = () => {
  return (
    <main className="bg-background text-foreground py-16 px-4 md:px-10">
      {/* Hero */}
      <section className="text-center max-w-4xl mx-auto mb-20">
        <img
          src="/images/chatcrm-icon.png"
          alt="ChatCRM Logo"
          className="mx-auto mb-4 w-16 h-16"
        />
        <h1 className="text-4xl md:text-5xl font-bold mb-4 text-purple-600 dark:text-purple-400">
          ChatCRM
        </h1>
        <p className="text-muted-foreground text-lg md:text-xl">
          Gestioná contactos, automatizá campañas y fidelizá como las grandes marcas.
        </p>
        <div className="mt-6 flex justify-center gap-4">
          <Button className="bg-purple-600 text-white hover:bg-purple-700">
            Solicitar demo
          </Button>
          <Button variant="outline">Ver precios</Button>
        </div>
      </section>

      {/* Cómo funciona */}
      <section className="max-w-6xl mx-auto grid md:grid-cols-2 gap-12 mb-20 items-center">
        <div>
          <h2 className="text-2xl font-semibold mb-4">Herramienta de fidelización 360°</h2>
          <ul className="text-muted-foreground list-disc pl-6 space-y-2">
            <li>Captura automática de clientes desde consultas o ventas</li>
            <li>Segmentación por intereses, historial o ubicación</li>
            <li>Promociones por WhatsApp y email en 1 clic</li>
            <li>Campañas programadas por fecha, visita o categoría</li>
            <li>Historial completo y reportes con métricas clave</li>
          </ul>
        </div>
        <img
          src="/images/chatcrm.png"
          alt="Mockup ChatCRM"
          className="rounded-xl shadow-lg w-full h-auto"
        />
      </section>

      {/* Integración con Chatboc */}
      <section className="bg-muted py-16 px-4 md:px-10 rounded-xl max-w-6xl mx-auto mb-20">
        <h2 className="text-2xl font-semibold text-center mb-6">Impulsado por Chatboc</h2>
        <div className="grid md:grid-cols-2 gap-12 items-center">
          <div className="space-y-3 text-muted-foreground">
            <p>Chatboc registra clientes desde el primer contacto automático.</p>
            <p>Usalo como canal de campañas personalizadas vía WhatsApp o web.</p>
            <p>Funciona como asistente postventa y motor de fidelización continua.</p>
          </div>
          <img
            src="/chatboc_widget_64x64.webp"
            alt="Chatboc"
            className="mx-auto w-24 h-24"
          />
        </div>
      </section>

      {/* Precios */}
      <section className="max-w-4xl mx-auto text-center">
        <h2 className="text-2xl font-semibold mb-6">Planes estimados</h2>
        <div className="grid md:grid-cols-3 gap-6">
          <div className="border p-6 rounded-xl">
            <h3 className="text-lg font-bold mb-2">Base</h3>
            <p className="text-muted-foreground mb-4">Gestión simple de clientes</p>
            <p className="text-2xl font-bold text-purple-600 dark:text-purple-400">$10/mes</p>
          </div>
          <div className="border p-6 rounded-xl bg-purple-50 dark:bg-purple-900/20">
            <h3 className="text-lg font-bold mb-2">Avanzado</h3>
            <p className="text-muted-foreground mb-4">
              Campañas automatizadas + WhatsApp
            </p>
            <p className="text-2xl font-bold text-purple-600 dark:text-purple-400">$25/mes</p>
          </div>
          <div className="border p-6 rounded-xl">
            <h3 className="text-lg font-bold mb-2">Completo</h3>
            <p className="text-muted-foreground mb-4">
              Todo incluido + Chatboc embebido
            </p>
            <p className="text-2xl font-bold text-purple-600 dark:text-purple-400">$45/mes</p>
          </div>
        </div>
      </section>
    </main>
  );
};

export default ChatCRMPage;
