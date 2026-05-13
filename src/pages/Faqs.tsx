import React from "react";

const HelpPage = () => (
  <div className="flex min-h-screen flex-col items-center bg-background px-4 py-16 text-foreground md:px-0">
    <div className="mt-6 w-full max-w-2xl rounded-[8px] border border-border bg-card p-8 shadow-lg">
      <h1 className="mb-4 text-3xl font-bold text-primary">Centro de ayuda</h1>
      <div className="mb-6 space-y-5">
        <div>
          <h2 className="mb-1 text-lg font-semibold text-primary">Que es Chatboc?</h2>
          <p className="text-muted-foreground">
            Es una solucion para atender, vender, crear casos, medir resultados y acompanar a usuarios en web,
            WhatsApp y otros canales conectados.
          </p>
        </div>
        <div>
          <h2 className="mb-1 text-lg font-semibold text-primary">Que lo diferencia de un chatbot comun?</h2>
          <p className="text-muted-foreground">
            No se limita a responder. Puede pedir datos, recibir adjuntos, crear reclamos o pedidos, activar encuestas,
            derivar a una persona y dejar seguimiento para el equipo.
          </p>
        </div>
        <div>
          <h2 className="mb-1 text-lg font-semibold text-primary">Sirve para empresas, gobiernos y colegios?</h2>
          <p className="text-muted-foreground">
            Si. La experiencia se adapta a ventas, reclamos ciudadanos, tramites, familias, staff, encuestas,
            votaciones, casos sensibles y atencion con historial.
          </p>
        </div>
        <div>
          <h2 className="mb-1 text-lg font-semibold text-primary">Que archivos o mensajes puede entender?</h2>
          <p className="text-muted-foreground">
            Puede trabajar con texto, imagenes, PDFs, planillas, comprobantes, notas de voz, ubicaciones y llamadas
            cuando el canal de la organizacion lo permite.
          </p>
        </div>
        <div>
          <h2 className="mb-1 text-lg font-semibold text-primary">Puedo probarlo antes de contratar?</h2>
          <p className="text-muted-foreground">
            Si. La demo permite recorrer casos por rubro y ver como una consulta puede convertirse en accion,
            seguimiento y datos utiles para decidir.
          </p>
        </div>
        <div>
          <h2 className="mb-1 text-lg font-semibold text-primary">Necesito un equipo tecnico para empezar?</h2>
          <p className="text-muted-foreground">
            No. Chatboc acompana la configuracion inicial y ayuda a ordenar el recorrido para que usuarios,
            operadores y administradores lo entiendan rapido.
          </p>
        </div>
        <div>
          <h2 className="mb-1 text-lg font-semibold text-primary">Como cuidan la seguridad?</h2>
          <p className="text-muted-foreground">
            La experiencia se configura por organizacion, con permisos, trazabilidad y canales definidos para que cada
            equipo vea lo que corresponde.
          </p>
        </div>
      </div>
      <div className="mt-4 flex flex-wrap justify-center gap-3 text-center">
        <a href="/demo" className="inline-flex rounded-[8px] border border-primary/30 px-4 py-2 text-primary">
          Probar demo
        </a>
        <a
          href="https://wa.me/5492613168608"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex rounded-[8px] border border-green-500/40 px-4 py-2 text-green-500"
        >
          Chatear por WhatsApp
        </a>
        <a href="mailto:info@chatboc.ar" className="inline-flex rounded-[8px] border border-border px-4 py-2">
          Contactar por email
        </a>
      </div>
      <div className="mt-8 text-center text-xs text-muted-foreground">
        No encontraste tu respuesta? Escribinos y armamos el recorrido que mejor encaje con tu organizacion.
      </div>
    </div>
  </div>
);

export default HelpPage;
