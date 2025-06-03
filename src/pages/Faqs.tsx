import React from "react";

const HelpPage = () => (
  <div className="min-h-screen bg-background text-foreground py-16 px-4 md:px-0 flex flex-col items-center">
    <div className="max-w-2xl w-full bg-card rounded-2xl shadow-lg p-8 mt-6">
      <h1 className="text-3xl font-bold mb-4 text-primary">Centro de Ayuda & Preguntas Frecuentes</h1>
      <div className="mb-6 space-y-4">
        <div>
          <h2 className="text-lg font-semibold mb-1 text-primary">¿Qué es Chatboc?</h2>
          <p className="text-muted-foreground">
            Es una plataforma SaaS argentina para automatizar ventas, soporte y atención 24/7 con un agente IA entrenado para pymes y comercios.
          </p>
        </div>
        <div>
          <h2 className="text-lg font-semibold mb-1 text-primary">¿Cómo integro el chat en mi web?</h2>
          <p className="text-muted-foreground">
            Solo copiás el código iframe desde tu panel y lo pegás donde quieras en tu web. No requiere desarrollo ni mantenimiento, funciona al instante.
          </p>
        </div>
        <div>
          <h2 className="text-lg font-semibold mb-1 text-primary">¿Qué archivos de catálogo acepta?</h2>
          <p className="text-muted-foreground">
            PDF, Excel (.xlsx, .xls) y CSV. El sistema lee y reconoce productos, precios y cantidades de forma automática.
          </p>
        </div>
        <div>
          <h2 className="text-lg font-semibold mb-1 text-primary">¿Puedo probar Chatboc antes de pagar?</h2>
          <p className="text-muted-foreground">
            Sí, ofrecemos una demo gratuita con preguntas limitadas para que veas cómo funciona el agente IA en acción.
          </p>
        </div>
        <div>
          <h2 className="text-lg font-semibold mb-1 text-primary">¿Funciona desde el celular?</h2>
          <p className="text-muted-foreground">
            Sí, tanto el panel como el chat son 100% responsive, con modo oscuro y claro para máxima comodidad.
          </p>
        </div>
        <div>
          <h2 className="text-lg font-semibold mb-1 text-primary">¿Cómo es la seguridad de mis datos?</h2>
          <p className="text-muted-foreground">
            Toda la información se procesa en servidores seguros. No vendemos ni compartimos datos personales. Cumplimos con normas legales de privacidad.
          </p>
        </div>
        <div>
          <h2 className="text-lg font-semibold mb-1 text-primary">¿Tengo soporte real?</h2>
          <p className="text-muted-foreground">
            Sí, brindamos soporte humano por WhatsApp, email y ticket. Todas las consultas se responden en el mismo día hábil.
          </p>
        </div>
        <div>
          <h2 className="text-lg font-semibold mb-1 text-primary">¿Puedo cancelar o cambiar de plan?</h2>
          <p className="text-muted-foreground">
            Podés cancelar cuando quieras, sin permanencia. También podés cambiar de plan o volver a la demo desde tu panel.
          </p>
        </div>
        <div>
          <h2 className="text-lg font-semibold mb-1 text-primary">¿Qué hago si tengo dudas técnicas?</h2>
          <p className="text-muted-foreground">
            Consultá la <a href="/documentacion" className="text-blue-500 underline">Documentación Técnica</a> o escribinos a <a href="mailto:soporte@chatboc.ar" className="text-blue-500 underline">soporte@chatboc.ar</a>.
          </p>
        </div>
        <div>
          <h2 className="text-lg font-semibold mb-1 text-primary">¿Quiénes usan Chatboc?</h2>
          <p className="text-muted-foreground">
            Lo usan negocios, pymes, tiendas online, servicios y comercios de todo el país que quieren vender más y automatizar su atención.
          </p>
        </div>
      </div>
      <div className="text-center mt-4 space-y-2">
        <a href="/documentacion" className="inline-block text-blue-500 underline mr-2">Ir a la documentación técnica</a>
        <span className="mx-2">·</span>
        <a href="https://wa.me/5492613168608" target="_blank" rel="noopener noreferrer" className="inline-block text-green-500 underline mr-2">Chatear por WhatsApp</a>
        <span className="mx-2">·</span>
        <a href="mailto:soporte@chatboc.ar" className="inline-block text-blue-500 underline">Contactar por Email</a>
      </div>
      <div className="text-center text-xs text-gray-400 mt-8">
        ¿No encontrás tu respuesta? Escribinos, resolvemos cualquier consulta.
      </div>
    </div>
  </div>
);

export default HelpPage;
