const updatedAt = "22 de mayo de 2026";

export default function PrivacyPolicy() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <section className="mx-auto w-full max-w-4xl px-5 py-12 sm:px-8">
        <p className="mb-3 text-sm font-semibold uppercase tracking-wide text-primary">Chatboc.ar</p>
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Politica de privacidad</h1>
        <p className="mt-4 max-w-3xl text-base leading-7 text-muted-foreground">
          Esta politica explica como Chatboc.ar recopila, usa, protege y conserva datos personales y
          comerciales cuando una persona o una organizacion usa nuestra plataforma, nuestro sitio web,
          nuestras APIs, WhatsApp Business, el widget web, llamadas, encuestas, CRM, tickets, turnos,
          pedidos y automatizaciones con inteligencia artificial.
        </p>
        <p className="mt-3 text-sm text-muted-foreground">Ultima actualizacion: {updatedAt}</p>

        <div className="mt-10 space-y-8 text-sm leading-7 sm:text-base">
          <section>
            <h2 className="text-xl font-semibold">Responsable del tratamiento</h2>
            <p className="mt-3 text-muted-foreground">
              El responsable de esta plataforma es Chatboc.ar. Para consultas de privacidad, seguridad,
              acceso, rectificacion o eliminacion de datos, escribinos a{" "}
              <a className="text-primary underline underline-offset-4" href="mailto:info@chatboc.ar">
                info@chatboc.ar
              </a>
              .
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold">Datos que podemos tratar</h2>
            <ul className="mt-3 list-disc space-y-2 pl-6 text-muted-foreground">
              <li>Datos de contacto: nombre, telefono, email, empresa, institucion o municipio.</li>
              <li>Datos de conversacion: mensajes, notas de voz, imagenes, adjuntos, ubicaciones y respuestas.</li>
              <li>Datos operativos: tickets, reclamos, pedidos, turnos, encuestas, etiquetas, estados y responsables.</li>
              <li>Datos tecnicos: IP, navegador, dispositivo, identificadores anonimos, logs, webhooks y eventos de entrega.</li>
              <li>Datos de integraciones: WhatsApp Business, Twilio, Meta, proveedores de IA y sistemas conectados por el cliente.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold">Finalidades</h2>
            <ul className="mt-3 list-disc space-y-2 pl-6 text-muted-foreground">
              <li>Prestar servicios de atencion automatizada, CRM, mesa de ayuda, turnos, tickets y ventas conversacionales.</li>
              <li>Permitir que organizaciones administren conversaciones, operadores, auditoria y seguimiento.</li>
              <li>Enviar respuestas, notificaciones, recordatorios y mensajes transaccionales cuando exista base legitima u opt-in.</li>
              <li>Mejorar seguridad, rendimiento, trazabilidad, soporte y calidad del servicio.</li>
              <li>Cumplir obligaciones legales, contractuales y de plataformas externas como Meta y Twilio.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold">Base legal y consentimiento</h2>
            <p className="mt-3 text-muted-foreground">
              Tratamos datos para ejecutar servicios solicitados, responder consultas, cumplir contratos,
              resguardar intereses legitimos de seguridad y operar canales autorizados por cada cliente.
              Cuando corresponde, solicitamos consentimiento u opt-in para comunicaciones por WhatsApp,
              email u otros canales.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold">Proveedores y terceros</h2>
            <p className="mt-3 text-muted-foreground">
              Podemos usar proveedores de infraestructura, mensajeria, inteligencia artificial, hosting,
              analitica, almacenamiento y comunicaciones. Solo compartimos datos necesarios para operar el
              servicio, bajo controles razonables de seguridad, confidencialidad y finalidad.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold">Conservacion y seguridad</h2>
            <p className="mt-3 text-muted-foreground">
              Conservamos los datos durante el tiempo necesario para prestar el servicio, cumplir obligaciones
              legales, resolver incidentes y mantener trazabilidad. Aplicamos medidas tecnicas y organizativas
              para proteger la informacion contra accesos no autorizados, perdida, uso indebido o divulgacion.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold">Derechos de las personas</h2>
            <p className="mt-3 text-muted-foreground">
              Podes solicitar acceso, actualizacion, rectificacion, portabilidad, oposicion o eliminacion de
              tus datos. Para ejercer estos derechos, escribinos a info@chatboc.ar o usa la pagina de{" "}
              <a className="text-primary underline underline-offset-4" href="/eliminacion-datos">
                eliminacion de datos
              </a>
              .
            </p>
          </section>
        </div>

        <nav className="mt-12 flex flex-wrap gap-4 text-sm">
          <a className="text-primary underline underline-offset-4" href="/terminos">
            Terminos y condiciones
          </a>
          <a className="text-primary underline underline-offset-4" href="/eliminacion-datos">
            Eliminacion de datos
          </a>
          <a className="text-muted-foreground underline underline-offset-4" href="/">
            Volver al inicio
          </a>
        </nav>
      </section>
    </main>
  );
}
