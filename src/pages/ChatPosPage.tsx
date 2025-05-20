import React from "react";
import { Button } from "@/components/ui/button";

const ChatPosPage = () => {
  return (
    <main className="bg-background text-foreground py-16 px-4 md:px-10">
      {/* Hero */}
      <section className="text-center max-w-4xl mx-auto mb-20">
        <img
          src="/images/chatpos-icon.png"
          alt="ChatPos Logo"
          className="mx-auto mb-4 w-16 h-16"
        />
        <h1 className="text-4xl md:text-5xl font-bold mb-4 text-green-700">
          ChatPos
        </h1>
        <p className="text-muted-foreground text-lg md:text-xl">
          Tu sistema de ventas, stock y facturación 100% online, integrado con asistencia inteligente.
        </p>
        <div className="mt-6 flex justify-center gap-4">
          <Button className="bg-green-600 text-white hover:bg-green-700">
            Solicitar demo
          </Button>
          <Button variant="outline">Ver precios</Button>
        </div>
      </section>

      {/* Cómo funciona */}
      <section className="max-w-6xl mx-auto grid md:grid-cols-2 gap-12 mb-20 items-center">
        <div>
          <h2 className="text-2xl font-semibold mb-4">Todo lo que tu comercio necesita</h2>
          <ul className="text-muted-foreground list-disc pl-6 space-y-2">
            <li>Facturación y ventas rápidas desde cualquier dispositivo</li>
            <li>Control de stock en tiempo real</li>
            <li>Reportes diarios y mensuales</li>
            <li>Compatible con impresora térmica y cajón automático</li>
            <li>Panel de administración para múltiples sucursales</li>
          </ul>
        </div>
        <img
          src="/images/chatpos.png"
          alt="Mockup ChatPos"
          className="rounded-xl shadow-lg w-full h-auto"
        />
      </section>

      {/* Integración con Chatboc */}
      <section className="bg-muted py-16 px-4 md:px-10 rounded-xl max-w-6xl mx-auto mb-20">
        <h2 className="text-2xl font-semibold text-center mb-6">
          Integración con Chatboc
        </h2>
        <div className="grid md:grid-cols-2 gap-12 items-center">
          <div className="space-y-3 text-muted-foreground">
            <p>Asistente virtual que responde dudas sobre el uso del sistema.</p>
            <p>Atención automática a tus clientes desde WhatsApp o tu web.</p>
            <p>Escalá consultas y convertí preguntas en ventas.</p>
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
            <h3 className="text-lg font-bold mb-2">Básico</h3>
            <p className="text-muted-foreground mb-4">Ideal para un solo local</p>
            <p className="text-2xl font-bold text-green-700">$15/mes</p>
          </div>
          <div className="border p-6 rounded-xl bg-green-50">
            <h3 className="text-lg font-bold mb-2">Profesional</h3>
            <p className="text-muted-foreground mb-4">Multi-sucursal + Soporte + Chatboc</p>
            <p className="text-2xl font-bold text-green-700">$30/mes</p>
          </div>
          <div className="border p-6 rounded-xl">
            <h3 className="text-lg font-bold mb-2">Premium</h3>
            <p className="text-muted-foreground mb-4">Todo incluido + dominio propio</p>
            <p className="text-2xl font-bold text-green-700">$50/mes</p>
          </div>
        </div>
      </section>
    </main>
  );
};

export default ChatPosPage;
