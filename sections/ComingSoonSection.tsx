import React from "react";

const ComingSoonSection = () => {
  return (
    <section id="proximamente" className="bg-muted py-20 px-4 text-center">
      <div className="max-w-6xl mx-auto">
        <h2 className="text-3xl md:text-4xl font-bold mb-6 text-foreground">
          Próximamente: nuevas soluciones para tu negocio
        </h2>
        <p className="text-muted-foreground max-w-2xl mx-auto mb-12">
          Estamos desarrollando nuevas herramientas para que puedas vender más, automatizar tu comercio y fidelizar a tus clientes como nunca antes. Muy pronto estarán disponibles.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-10 mt-10">
          {/* opinar.ar */}
          <div className="bg-background rounded-2xl shadow-lg border border-border p-6 hover:shadow-xl transition duration-300">
            <div className="flex flex-col items-center">
              <img
                src="/images/opinar-icon.svg"
                alt="Icono opinar.ar"
                className="w-20 h-20 mb-4"
              />
              <h3 className="text-2xl font-semibold text-sky-600 dark:text-sky-400 mb-2">Opinar.ar: Inteligencia Ciudadana al Instante</h3>
              <p className="text-muted-foreground mb-4 text-center">
                Plataforma de encuestas y análisis de datos para entender la opinión pública en tiempo real y tomar decisiones informadas.
              </p>
              <img
                src="/images/placeholder.svg"
                alt="Mockup de Opinar.ar"
                className="mt-4 rounded-xl w-full max-w-[90%] h-auto shadow-lg"
              />
              <a
                href="/opinar"
                className="mt-6 inline-block bg-sky-600 text-white px-6 py-2 rounded-xl text-sm hover:bg-sky-700 transition"
              >
                Descubrir Opinar.ar
              </a>
            </div>
          </div>
          {/* ChatPos */}
          <div className="bg-background rounded-2xl shadow-lg border border-border p-6 hover:shadow-xl transition duration-300">
            <div className="flex flex-col items-center">
              <img
                src="/images/chatpos-icon.png"
                alt="Icono ChatPos"
                className="w-20 h-20 mb-4"
              />
              <h3 className="text-2xl font-semibold text-green-600 dark:text-green-400 mb-2">ChatPos</h3>
              <p className="text-muted-foreground mb-4">
                Sistema de punto de venta moderno para facturar, gestionar stock y ver reportes desde cualquier dispositivo.
              </p>
              <img
                src="/images/chatpos.png"
                alt="Mockup ChatPos"
                className="mt-4 rounded-xl w-full max-w-[90%] h-auto shadow-lg"
              />
              <a
                href="/chatpos"
                className="mt-6 inline-block bg-green-600 text-white px-6 py-2 rounded-xl text-sm hover:bg-green-700 transition"
              >
                Ver demo
              </a>
            </div>
          </div>

          {/* ChatCRM */}
          <div className="bg-background rounded-2xl shadow-lg border border-border p-6 hover:shadow-xl transition duration-300">
            <div className="flex flex-col items-center">
              <img
                src="/images/chatcrm-icon.png"
                alt="Icono ChatCRM"
                className="w-20 h-20 mb-4"
              />
              <h3 className="text-2xl font-semibold text-purple-600 dark:text-purple-400 mb-2">ChatCRM</h3>
              <p className="text-muted-foreground mb-4">
                Gestioná contactos, enviá campañas y promociones automáticas. Ideal para aumentar la recompra y fidelización.
              </p>
              <img
                src="/images/chatcrm.png"
                alt="Mockup ChatCRM"
                className="mt-4 rounded-xl w-full max-w-[90%] h-auto shadow-lg"
              />
              <a
                href="/chatcrm"
                className="mt-6 inline-block bg-purple-600 text-white px-6 py-2 rounded-xl text-sm hover:bg-purple-700 transition"
              >
                Ver demo
              </a>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default ComingSoonSection;
