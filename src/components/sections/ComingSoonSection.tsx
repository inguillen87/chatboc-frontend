import React from "react";
import Image from "next/image";

const ComingSoonSection = () => {
  return (
    <section id="coming-soon" className="bg-muted py-20 px-4 text-center">
      <div className="max-w-6xl mx-auto">
        <h2 className="text-3xl md:text-4xl font-bold mb-6 text-primary">
          Próximamente: nuevas soluciones para tu negocio
        </h2>
        <p className="text-muted-foreground max-w-2xl mx-auto mb-12">
          Estamos desarrollando nuevas herramientas para que puedas vender más, automatizar tu comercio y fidelizar a tus clientes como nunca antes. Muy pronto estarán disponibles.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-10 mt-10">
          {/* ChatPos */}
          <div className="bg-background rounded-2xl shadow-lg border border-border p-6 hover:shadow-xl transition duration-300">
            <div className="flex flex-col items-center">
              <Image
                src="/images/chatpos.png" // reemplazar con tu imagen real
                alt="Mockup ChatPos"
                width={400}
                height={250}
                className="rounded-md mb-4"
              />
              <div className="flex items-center gap-2 mb-2">
                <Image
                  src="/images/chatpos-icon.png" // ícono del POS (puede ser un ticket o caja registradora)
                  alt="Icono ChatPos"
                  width={32}
                  height={32}
                />
                <h3 className="text-2xl font-semibold text-green-700">ChatPos</h3>
              </div>
              <p className="text-muted-foreground mb-4">
                Sistema de punto de venta moderno para facturar, gestionar stock y ver reportes desde cualquier dispositivo.
              </p>
              <a
                href="/chatpos"
                className="inline-block bg-green-600 text-white px-6 py-2 rounded-xl text-sm hover:bg-green-700 transition"
              >
                Ver demo
              </a>
            </div>
          </div>

          {/* ChatCRM */}
          <div className="bg-background rounded-2xl shadow-lg border border-border p-6 hover:shadow-xl transition duration-300">
            <div className="flex flex-col items-center">
              <Image
                src="/images/chatcrm.png" // reemplazar con tu imagen real
                alt="Mockup ChatCRM"
                width={400}
                height={250}
                className="rounded-md mb-4"
              />
              <div className="flex items-center gap-2 mb-2">
                <Image
                  src="/images/chatcrm-icon.png" // ícono de CRM (clientes, gráfico, contacto)
                  alt="Icono ChatCRM"
                  width={32}
                  height={32}
                />
                <h3 className="text-2xl font-semibold text-purple-700">ChatCRM</h3>
              </div>
              <p className="text-muted-foreground mb-4">
                Gestioná contactos, enviá campañas y promociones automáticas. Ideal para aumentar la recompra y fidelización.
              </p>
              <a
                href="/chatcrm"
                className="inline-block bg-purple-600 text-white px-6 py-2 rounded-xl text-sm hover:bg-purple-700 transition"
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
si 