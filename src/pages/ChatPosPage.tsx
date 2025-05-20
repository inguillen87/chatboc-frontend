import React from "react";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";

const ChatPosPage = () => {
  const whatsappURL = "https://wa.me/2613168608?text=Hola!%20Estoy%20interesado%20en%20probar%20la%20demo%20de%20ChatPos.";

  return (
    <main className="bg-background text-foreground py-20 px-6 md:px-12">
      {/* Hero Section */}
      <section className="text-center max-w-5xl mx-auto mb-24">
        <motion.img
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.6 }}
          src="/images/chatpos-icon.png"
          alt="ChatPos Logo"
          className="mx-auto mb-6 w-20 h-20"
          style={{ filter: 'drop-shadow(0 0 2px rgba(255,255,255,0.2))' }}

        />
        <motion.h1
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="text-5xl font-bold mb-4 text-green-700"
        >
          ChatPos
        </motion.h1>
        <p className="text-muted-foreground text-xl">
          Sistema profesional de ventas, stock y facturación en la nube con asistencia inteligente.
        </p>
        <div className="mt-8 flex justify-center gap-4">
          <Button asChild className="bg-green-600 text-white hover:bg-green-700 shadow-md">
            <a href={whatsappURL} target="_blank" rel="noopener noreferrer">
              Solicitar demo
            </a>
          </Button>
          <Button variant="outline">Ver precios</Button>
        </div>
      </section>

      {/* Funcionalidades */}
      <section className="max-w-6xl mx-auto grid md:grid-cols-2 gap-16 items-center mb-24">
        <div>
          <h2 className="text-3xl font-semibold mb-6">Solución completa para tu negocio</h2>
          <ul className="text-muted-foreground list-disc pl-6 space-y-3">
            <li>Facturación online desde cualquier dispositivo</li>
            <li>Control de inventario y stock en tiempo real</li>
            <li>Reportes visuales y exportación de datos</li>
            <li>Soporte para impresoras y cajones automáticos</li>
            <li>Gestión de múltiples sucursales desde un solo panel</li>
          </ul>
        </div>
        <motion.img
          initial={{ opacity: 0, x: 50 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.7 }}
          src="/images/chatpos.png"
          alt="ChatPos Mockup"
          className="rounded-2xl shadow-xl w-full"
        />
      </section>

      {/* Integración con Chatboc */}
      <section className="bg-muted py-20 px-6 md:px-12 rounded-2xl max-w-6xl mx-auto mb-24 shadow-sm">
        <h2 className="text-3xl font-semibold text-center mb-10">
          Potenciado con Chatboc
        </h2>
        <div className="grid md:grid-cols-2 gap-12 items-center">
          <div className="space-y-4 text-muted-foreground text-lg">
            <p>Responde consultas frecuentes directamente desde el sistema.</p>
            <p>Integra soporte automatizado por WhatsApp, web y redes.</p>
            <p>Convierte dudas en ventas mediante atención inteligente.</p>
          </div>
          <motion.img
            initial={{ opacity: 0, rotate: -10 }}
            whileInView={{ opacity: 1, rotate: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            src="/chatboc_widget_64x64.webp"
            alt="Chatboc Widget"
            className="mx-auto w-28 h-28"
          />
        </div>
      </section>

      {/* Precios */}
      <section className="max-w-5xl mx-auto text-center">
        <h2 className="text-3xl font-semibold mb-10">Planes accesibles para cada etapa</h2>
        <div className="grid md:grid-cols-3 gap-8">
          <motion.div
            whileHover={{ scale: 1.03 }}
            className="border p-6 rounded-2xl shadow-sm bg-background"
          >
            <h3 className="text-xl font-bold mb-2">Básico</h3>
            <p className="text-muted-foreground mb-3">Para un solo local</p>
            <p className="text-3xl font-bold text-green-700">$15/mes</p>
          </motion.div>
          <motion.div
            whileHover={{ scale: 1.05 }}
            className="border p-6 rounded-2xl bg-green-50 shadow-md"
          >
            <h3 className="text-xl font-bold mb-2">Profesional</h3>
            <p className="text-muted-foreground mb-3">Multi-sucursal + Soporte + Chatboc</p>
            <p className="text-3xl font-bold text-green-700">$30/mes</p>
          </motion.div>
          <motion.div
            whileHover={{ scale: 1.03 }}
            className="border p-6 rounded-2xl shadow-sm bg-background"
          >
            <h3 className="text-xl font-bold mb-2">Premium</h3>
            <p className="text-muted-foreground mb-3">Todo incluido + dominio propio</p>
            <p className="text-3xl font-bold text-green-700">$50/mes</p>
          </motion.div>
        </div>
      </section>
    </main>
  );
};

export default ChatPosPage;
