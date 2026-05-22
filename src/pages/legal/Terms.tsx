const updatedAt = "22 de mayo de 2026";

export default function TermsPage() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <section className="mx-auto w-full max-w-4xl px-5 py-12 sm:px-8">
        <p className="mb-3 text-sm font-semibold uppercase tracking-wide text-primary">Chatboc.ar</p>
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Terminos y condiciones</h1>
        <p className="mt-4 max-w-3xl text-base leading-7 text-muted-foreground">
          Estos terminos regulan el uso de Chatboc.ar, una plataforma SaaS para atencion conversacional,
          CRM, tickets, turnos, pedidos, encuestas, automatizaciones, integraciones y agentes de IA para
          empresas, municipios, instituciones educativas y otros clientes.
        </p>
        <p className="mt-3 text-sm text-muted-foreground">Ultima actualizacion: {updatedAt}</p>

        <div className="mt-10 space-y-8 text-sm leading-7 sm:text-base">
          <section>
            <h2 className="text-xl font-semibold">Uso aceptable</h2>
            <p className="mt-3 text-muted-foreground">
              El usuario se compromete a usar Chatboc.ar de forma legal, responsable y compatible con las
              politicas de las plataformas conectadas, incluyendo Meta, WhatsApp Business, Twilio y otros
              proveedores. No se permite enviar spam, suplantar identidad, vulnerar derechos de terceros,
              procesar datos sin autorizacion o usar la plataforma para actividades ilicitas.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold">Cuentas, tenants e integraciones</h2>
            <p className="mt-3 text-muted-foreground">
              Cada organizacion es responsable de la informacion que carga, de sus operadores, de las
              credenciales que conecta y de obtener los consentimientos necesarios para comunicarse con sus
              usuarios, vecinos, clientes, alumnos o familias.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold">Mensajeria y canales externos</h2>
            <p className="mt-3 text-muted-foreground">
              Las comunicaciones por WhatsApp, email, voz u otros canales pueden depender de servicios de
              terceros. El cliente debe respetar opt-in, ventanas de atencion, plantillas aprobadas, limites
              de envio y politicas aplicables a cada canal.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold">Disponibilidad y cambios</h2>
            <p className="mt-3 text-muted-foreground">
              Trabajamos para mantener la plataforma disponible y segura, pero pueden existir interrupciones
              por mantenimiento, cambios de proveedores, errores, fuerza mayor o actualizaciones. Podemos
              modificar funciones, planes o condiciones avisando cuando corresponda.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold">Propiedad intelectual</h2>
            <p className="mt-3 text-muted-foreground">
              Chatboc.ar, su software, marca, interfaces, documentacion y activos son propiedad de sus
              titulares. El cliente conserva la titularidad sobre sus datos y contenidos, otorgando a
              Chatboc.ar los permisos necesarios para operar el servicio contratado.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold">Privacidad y datos</h2>
            <p className="mt-3 text-muted-foreground">
              El tratamiento de datos personales se describe en la{" "}
              <a className="text-primary underline underline-offset-4" href="/privacidad">
                Politica de privacidad
              </a>
              . Las solicitudes de eliminacion pueden iniciarse desde{" "}
              <a className="text-primary underline underline-offset-4" href="/eliminacion-datos">
                Eliminacion de datos
              </a>
              .
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold">Contacto</h2>
            <p className="mt-3 text-muted-foreground">
              Para consultas comerciales, soporte, privacidad o terminos, escribinos a{" "}
              <a className="text-primary underline underline-offset-4" href="mailto:info@chatboc.ar">
                info@chatboc.ar
              </a>
              .
            </p>
          </section>
        </div>

        <nav className="mt-12 flex flex-wrap gap-4 text-sm">
          <a className="text-primary underline underline-offset-4" href="/privacidad">
            Politica de privacidad
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
