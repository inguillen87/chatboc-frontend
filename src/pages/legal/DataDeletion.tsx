export default function DataDeletionPage() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <section className="mx-auto w-full max-w-4xl px-5 py-12 sm:px-8">
        <p className="mb-3 text-sm font-semibold uppercase tracking-wide text-primary">Chatboc.ar</p>
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Eliminacion de datos</h1>
        <p className="mt-4 max-w-3xl text-base leading-7 text-muted-foreground">
          Esta pagina informa como solicitar la eliminacion, rectificacion o acceso a datos personales
          tratados por Chatboc.ar o por una organizacion que usa Chatboc.ar como plataforma de atencion.
        </p>

        <div className="mt-10 space-y-8 text-sm leading-7 sm:text-base">
          <section>
            <h2 className="text-xl font-semibold">Como pedir la eliminacion</h2>
            <p className="mt-3 text-muted-foreground">
              Envia un email a{" "}
              <a className="text-primary underline underline-offset-4" href="mailto:info@chatboc.ar">
                info@chatboc.ar
              </a>{" "}
              con el asunto "Eliminacion de datos". Inclui el canal usado, por ejemplo WhatsApp, widget
              web, email, llamada o cuenta de plataforma, y el telefono o email asociado.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold">Que verificamos</h2>
            <p className="mt-3 text-muted-foreground">
              Para proteger a las personas y organizaciones, podemos pedir informacion adicional para
              validar identidad, titularidad del dato o relacion con el tenant que recibio la conversacion.
              Si el dato pertenece a un cliente de Chatboc.ar, coordinamos la solicitud con ese responsable.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold">Plazos y alcance</h2>
            <p className="mt-3 text-muted-foreground">
              Procesamos las solicitudes en un plazo razonable segun complejidad, normativa aplicable y
              obligaciones de conservacion. Algunos registros pueden mantenerse bloqueados o minimizados
              cuando sean necesarios para seguridad, auditoria, prevencion de fraude o cumplimiento legal.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold">Datos de terceros</h2>
            <p className="mt-3 text-muted-foreground">
              Si una conversacion o archivo incluye datos de otra persona, podemos limitar la entrega o
              eliminacion hasta confirmar autorizacion suficiente y evitar afectar derechos de terceros.
            </p>
          </section>
        </div>

        <nav className="mt-12 flex flex-wrap gap-4 text-sm">
          <a className="text-primary underline underline-offset-4" href="/privacidad">
            Politica de privacidad
          </a>
          <a className="text-primary underline underline-offset-4" href="/terminos">
            Terminos y condiciones
          </a>
          <a className="text-muted-foreground underline underline-offset-4" href="/">
            Volver al inicio
          </a>
        </nav>
      </section>
    </main>
  );
}
