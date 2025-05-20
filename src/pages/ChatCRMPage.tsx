import React from "react";
import { Button } from "@/components/ui/button";

const ChatCRMPage = () => {
  return (
    <main className="bg-background text-foreground py-16 px-4 md:px-10">
      {/* Hero */}
      <section className="text-center max-w-4xl mx-auto mb-20">
        <img
          src="/icons/chatcrm-icon.png"
          alt="ChatCRM Logo"
          className="mx-auto mb-4 w-16 h-16"
        />
        <h1 className="text-4xl md:text-5xl font-bold mb-4 text-purple-700">
          ChatCRM
        </h1>
        <p className="text-muted-foreground text-lg md:text-xl">
          Gestioná contactos, automatizá campañas y hacé que tus clientes vuelvan.
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
            <li>Registro automático de contactos desde consultas o ventas</li>
            <li>Segmentación por intereses o historial</li>
            <li>Envío de promociones por WhatsApp o email</li>
            <li>Campañas automatizadas por fechas, categorías o visitas</li>
            <li>Historial completo por cliente y reportes de impacto</li>
          </ul>
        </div>
        <img
          src="/mockups/chatcrm.png"
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
            <p>Podés usarlo como canal de campañas personalizadas vía WhatsApp.</p>
            <p>Actuá como asistente postventa y motor de fidelización continua.</p>
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
            <p className="text-2xl font-bold text-purple-700">$10/mes</p>
          </div>
          <div className="border p-6 rounded-xl bg-purple-50">
            <h3 className="text-lg font-bold mb-2">Avanzado</h3>
            <p className="text-muted-foreground mb-4">
              Campañas automatizadas + WhatsApp
            </p>
            <p className="text-2xl font-bold text-purple-700">$25/mes</p>
          </div>
          <div className="border p-6 rounded-xl">
            <h3 className="text-lg font-bold mb-2">Completo</h3>
            <p className="text-muted-foreground mb-4">
              Todo incluido + Chatboc embebido
            </p>
            <p className="text-2xl font-bold text-purple-700">$45/mes</p>
          </div>
        </div>
      </section>
    </main>
  );
};

export default ChatCRMPage;
