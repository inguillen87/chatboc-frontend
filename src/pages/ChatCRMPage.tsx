import React from "react";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import CustomerHistoryPanel from "@/components/admin/CustomerHistoryPanel";
import { useTenant } from "@/context/TenantContext";

const ChatCRMPage = () => {
  const whatsappURL = "https://wa.me/5492613168608?text=Hola!%20Estoy%20interesado%20en%20probar%20la%20demo%20de%20ChatCRM.";
  const { currentSlug } = useTenant();

  return (
    <main className="bg-background text-foreground py-20 px-6 md:px-12">
      {/* Customer Context Demo Section */}
      {currentSlug && (
        <section className="max-w-6xl mx-auto mb-20">
            <h2 className="text-2xl font-bold mb-6 text-center">Vista de Agente: Contexto del Cliente</h2>
            <div className="grid md:grid-cols-2 gap-8 items-start">
                <div className="border rounded-xl p-6 bg-card shadow-sm h-[600px]">
                    <h3 className="text-lg font-semibold mb-4 border-b pb-2">Chat en Vivo</h3>
                    <div className="flex flex-col h-full justify-center items-center text-muted-foreground bg-muted/20 rounded-lg">
                        <p>Simulación de chat con cliente...</p>
                    </div>
                </div>
                <div className="h-[600px] border rounded-xl overflow-hidden shadow-sm bg-card">
                    {/* Integrated Customer History Panel */}
                    <CustomerHistoryPanel
                        customerId="demo-customer-123"
                        tenantSlug={currentSlug}
                    />
                </div>
            </div>
        </section>
      )}

      {/* Hero */}
      <section className="text-center max-w-5xl mx-auto mb-24">
        <motion.img
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.6 }}
          src="/images/chatcrm-icon.png"
          alt="ChatCRM Logo"
          className="mx-auto mb-6 w-20 h-20"
        />
        <motion.h1
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="text-5xl font-bold mb-4 text-primary dark:text-purple-400"
        >
          ChatCRM
        </motion.h1>
        <p className="text-muted-foreground text-xl">
          Gestioná contactos, automatizá campañas y fidelizá como las grandes marcas.
        </p>
        <div className="mt-8 flex justify-center gap-4">
          <Button asChild className="bg-primary text-primary-foreground hover:bg-primary/90 shadow-md">
            <a href={whatsappURL} target="_blank" rel="noopener noreferrer">
              Solicitar demo
            </a>
          </Button>
          <Button variant="outline" className="border-border text-foreground hover:bg-accent hover:text-accent-foreground">
            Ver precios
          </Button>
        </div>
      </section>

      {/* Funcionalidades */}
      <section className="max-w-6xl mx-auto grid md:grid-cols-2 gap-16 items-center mb-24">
        <div>
          <h2 className="text-3xl font-semibold mb-6 text-foreground">Herramienta de fidelización 360°</h2>
          <ul className="text-muted-foreground list-disc pl-6 space-y-3">
            <li>Captura automática de clientes desde consultas o ventas</li>
            <li>Segmentación por intereses, historial o ubicación</li>
            <li>Promociones por WhatsApp y email en 1 clic</li>
            <li>Campañas programadas por fecha, visita o categoría</li>
            <li>Historial completo y reportes con métricas clave</li>
          </ul>
        </div>
        <motion.img
          initial={{ opacity: 0, x: 50 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.7 }}
          src="/images/chatcrm.png"
          alt="Mockup ChatCRM"
          className="rounded-2xl shadow-xl w-full"
        />
      </section>

      {/* Integración con Chatboc */}
      <section className="bg-muted py-20 px-6 md:px-12 rounded-2xl max-w-6xl mx-auto mb-24 shadow-sm">
        <h2 className="text-3xl font-semibold text-center mb-10 text-foreground">
          Impulsado por Chatboc
        </h2>
        <div className="grid md:grid-cols-2 gap-12 items-center">
          <div className="space-y-4 text-muted-foreground text-lg">
            <p>Chatboc registra clientes desde el primer contacto automático.</p>
            <p>Usalo como canal de campañas personalizadas vía WhatsApp o web.</p>
            <p>Funciona como asistente postventa y motor de fidelización continua.</p>
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
        <h2 className="text-3xl font-semibold mb-10 text-foreground">Planes estimados</h2>
        <div className="grid md:grid-cols-3 gap-8">
          <motion.div
            whileHover={{ scale: 1.03 }}
            className="border p-6 rounded-2xl shadow-sm bg-card border-border text-foreground"
          >
            <h3 className="text-xl font-bold mb-2 text-foreground">Base</h3>
            <p className="text-muted-foreground mb-3">Gestión simple de clientes</p>
            <p className="text-3xl font-bold text-primary dark:text-purple-400">$/mes</p>
          </motion.div>
          <motion.div
            whileHover={{ scale: 1.05 }}
            className="border p-6 rounded-2xl bg-card border-border dark:bg-purple-900/20 shadow-md text-foreground"
          >
            <h3 className="text-xl font-bold mb-2 text-foreground">Avanzado</h3>
            <p className="text-muted-foreground mb-3">
              Campañas automatizadas + WhatsApp
            </p>
            <p className="text-3xl font-bold text-primary dark:text-purple-400">$/mes</p>
          </motion.div>
          <motion.div
            whileHover={{ scale: 1.03 }}
            className="border p-6 rounded-2xl shadow-sm bg-card border-border text-foreground"
          >
            <h3 className="text-xl font-bold mb-2 text-foreground">Completo</h3>
            <p className="text-muted-foreground mb-3">
              Todo incluido + Chatboc embebido
            </p>
            <p className="text-3xl font-bold text-primary dark:text-purple-400">$/mes</p>
          </motion.div>
        </div>
      </section>
    </main>
  );
};

export default ChatCRMPage;
