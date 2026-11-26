import { usePrivateWorkspacePresentation } from "@/hooks/usePrivateWorkspacePresentation";
import { PrivateWorkspaceFooter } from "@/components/brand/PrivateWorkspaceBrand";

import { useState } from "react";
import { useTenant } from "@/context/TenantContext";
import { Link, useLocation } from "react-router-dom";
import {
  Copy,
  Download,
  ExternalLink,
  Facebook,
  Instagram,
  Linkedin,
  Twitter,
} from "lucide-react";
import { useScrollToSection } from "@/hooks/useScrollToSection";

const afipDataFiscalHref = "https://qr.afip.gob.ar/?qr=hNBOkNhlJyhWrlnUph25jQ,,";
const afipDataFiscalImage = "https://www.afip.gob.ar/images/f960/DATAWEB.jpg";
const mipymeCertificateHref = "/certificados/certificado-mipyme-intellitech.pdf";

const linkFocusClass =
  "rounded-[4px] transition-colors motion-reduce:transition-none hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background";

const MarketingFooter = () => {
  const scrollToSection = useScrollToSection();
  const [copied, setCopied] = useState(false);
  const email = "info@chatboc.ar";
  const year = new Date().getFullYear();

  const handleCopyEmail = () => {
    navigator.clipboard.writeText(email);
    setCopied(true);
    setTimeout(() => setCopied(false), 1200);
  };

  return (
    <footer className="border-t border-border bg-muted/20 py-14 text-slate-600 dark:bg-muted/10 dark:text-muted-foreground">
      <div className="container mx-auto px-4">
        <div className="mx-auto max-w-6xl">
          <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-[1.35fr_0.85fr_1fr_0.9fr]">
            <div>
              <h3 className="chatboc-display text-xl font-bold text-foreground">Chatboc</h3>
              <p className="mt-3 max-w-xs text-sm leading-6">
                Atención, ventas y seguimiento en web y WhatsApp con la identidad de tu organización.
              </p>
              <div className="mt-5 flex items-center gap-4">
                <a
                  href="https://www.facebook.com/chatboc"
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Facebook"
                  className={`inline-flex p-1 ${linkFocusClass}`}
                >
                  <Facebook className="h-4 w-4" aria-hidden="true" />
                </a>
                <a
                  href="https://www.twitter.com/chatboc.ar"
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Twitter"
                  className={`inline-flex p-1 ${linkFocusClass}`}
                >
                  <Twitter className="h-4 w-4" aria-hidden="true" />
                </a>
                <a
                  href="https://www.instagram.com/chatboc.ar"
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Instagram"
                  className={`inline-flex p-1 ${linkFocusClass}`}
                >
                  <Instagram className="h-4 w-4" aria-hidden="true" />
                </a>
                <a
                  href="https://www.linkedin.com/company/chatboc"
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="LinkedIn"
                  className={`inline-flex p-1 ${linkFocusClass}`}
                >
                  <Linkedin className="h-4 w-4" aria-hidden="true" />
                </a>
              </div>
            </div>

            <div>
              <h3 className="text-sm font-semibold text-foreground">Producto</h3>
              <ul className="mt-3 space-y-2.5 text-sm">
                <li>
                  <button
                    type="button"
                    className={`m-0 cursor-pointer border-none bg-transparent p-0 text-left ${linkFocusClass}`}
                    onClick={() => scrollToSection("solucion")}
                  >
                    Qué hace
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    className={`m-0 cursor-pointer border-none bg-transparent p-0 text-left ${linkFocusClass}`}
                    onClick={() => scrollToSection("precios")}
                  >
                    Planes
                  </button>
                </li>
                <li>
                  <Link to="/demo" className={linkFocusClass}>
                    Probar demo
                  </Link>
                </li>
              </ul>
            </div>

            <div>
              <h3 className="text-sm font-semibold text-foreground">Recursos</h3>
              <ul className="mt-3 space-y-2.5 text-sm">
                <li>
                  <Link to="/faqs" className={linkFocusClass}>
                    Centro de ayuda (FAQs)
                  </Link>
                </li>
                <li>
                  <Link to="/documentacion" className={linkFocusClass}>
                    Guía de uso
                  </Link>
                </li>
                <li>
                  <a
                    href="https://wa.me/5492613168608"
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`underline underline-offset-4 ${linkFocusClass}`}
                    title="Chatear por WhatsApp"
                  >
                    WhatsApp
                  </a>
                </li>
                <li className="flex flex-wrap items-center gap-2">
                  <a
                    href={`mailto:${email}`}
                    className={`underline underline-offset-4 ${linkFocusClass}`}
                    title="Enviar correo"
                  >
                    {email}
                  </a>
                  <button
                    type="button"
                    className={`inline-flex items-center p-1 ${linkFocusClass}`}
                    title="Copiar mail"
                    aria-label="Copiar mail"
                    onClick={handleCopyEmail}
                  >
                    <Copy
                      className={`h-3.5 w-3.5 ${copied ? "text-primary" : ""}`}
                      aria-hidden="true"
                    />
                  </button>
                  <span aria-live="polite" className="text-xs font-medium text-foreground">
                    {copied ? "Copiado" : ""}
                  </span>
                </li>
              </ul>
            </div>

            <div>
              <h3 className="text-sm font-semibold text-foreground">Legal</h3>
              <ul className="mt-3 space-y-2.5 text-sm">
                <li>
                  <Link to="/privacidad" className={linkFocusClass}>
                    Política de privacidad
                  </Link>
                </li>
                <li>
                  <Link to="/terminos" className={linkFocusClass}>
                    Términos y condiciones
                  </Link>
                </li>
                <li>
                  <Link to="/legal/cookies" className={linkFocusClass}>
                    Política de cookies
                  </Link>
                </li>
                <li>
                  <Link to="/eliminacion-datos" className={linkFocusClass}>
                    Eliminación de datos
                  </Link>
                </li>
              </ul>
            </div>
          </div>

          <section aria-label="Credenciales institucionales" className="mt-12 border-t border-border pt-8">
            <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between">
              <h3 className="text-sm font-semibold text-foreground">Credenciales institucionales</h3>
              <p className="text-xs leading-5">
                Accesos oficiales para revisar información fiscal y descargar el certificado MiPyME.
              </p>
            </div>

            <div className="mt-6 grid gap-8 md:grid-cols-2">
              <div className="flex items-start gap-4">
                <a
                  href={afipDataFiscalHref}
                  target="_F960AFIPInfo"
                  rel="noopener noreferrer"
                  className="shrink-0 rounded-[8px] border border-border bg-white p-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                >
                  <img src={afipDataFiscalImage} alt="Formulario 960 Data Fiscal AFIP" className="h-11 w-auto" />
                </a>
                <div className="min-w-0">
                  <p className="text-xs font-medium">Data fiscal</p>
                  <p className="mt-0.5 text-sm font-semibold text-foreground">Formulario F960/D</p>
                  <p className="mt-1 text-xs leading-5">Acceso a la constancia pública fiscal.</p>
                  <a
                    href={afipDataFiscalHref}
                    target="_F960AFIPInfo"
                    rel="noopener noreferrer"
                    className={`mt-2.5 inline-flex items-center gap-1.5 text-xs font-semibold text-primary underline-offset-4 hover:underline ${linkFocusClass}`}
                  >
                    Abrir constancia AFIP
                    <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                  </a>
                </div>
              </div>

              <div>
                <p className="text-xs font-medium">Certificado MiPyME</p>
                <p className="mt-0.5 text-sm font-semibold text-foreground">Respaldo institucional SEPyME</p>
                <p className="mt-1 text-xs leading-5">
                  Documento oficial disponible para clientes, socios y validación comercial.
                </p>
                <div className="mt-3 flex flex-wrap gap-2.5">
                  <a
                    href={mipymeCertificateHref}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 rounded-[8px] border border-border bg-background px-3 py-1.5 text-xs font-semibold text-foreground transition-colors motion-reduce:transition-none hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                  >
                    Ver PDF
                  </a>
                  <a
                    href={mipymeCertificateHref}
                    download
                    className="inline-flex items-center gap-1.5 rounded-[8px] bg-foreground px-3 py-1.5 text-xs font-semibold text-background transition-colors motion-reduce:transition-none hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                  >
                    <Download className="h-3.5 w-3.5" aria-hidden="true" />
                    Descargar certificado
                  </a>
                </div>
              </div>
            </div>
          </section>

          <div className="mt-10 border-t border-border pt-6 text-sm">
            <p>© {year} Chatboc. Todos los derechos reservados.</p>
          </div>
        </div>
      </div>
    </footer>
  );
};

/** Pie único de un espacio publicado: el mismo para dominio propio y para /t/<slug>. */
const SpaceFooter = ({ name, home }: { name?: string; home?: string }) => (
  <footer
    className="mx-auto flex w-full max-w-5xl flex-wrap items-center justify-between gap-4 border-t px-6 py-5 text-sm text-muted-foreground"
    aria-label="Información del espacio"
  >
    {name && home ? (
      <Link to={home} className="min-h-11 py-3 font-medium">
        {name}
      </Link>
    ) : (
      <span aria-hidden="true" />
    )}
    <nav className="flex flex-wrap gap-4" aria-label="Información legal de la plataforma">
      <Link className="min-h-11 py-3" to="/privacidad">
        Privacidad de la plataforma
      </Link>
      <Link className="min-h-11 py-3" to="/terminos">
        Términos de la plataforma
      </Link>
    </nav>
  </footer>
);

const Footer = () => {
  const presentation = usePrivateWorkspacePresentation();
  const { hostBinding, tenant, currentSlug, isLoadingTenant, tenantError } = useTenant();
  const { pathname } = useLocation();
  // Un espacio publicado en /t/<slug> es del organismo, no una página comercial de Chatboc.
  const spaceSlug = /^\/t\/([^/]+)/i.exec(pathname)?.[1]?.toLowerCase();
  if (!hostBinding && !presentation.active && spaceSlug) {
    const same = (value?: string | null) => value?.trim().toLowerCase() === spaceSlug;
    // Solo nombra al organismo con identidad vigente: carga terminada, sin error y slug coincidente.
    const authoritative =
      !isLoadingTenant && !tenantError && same(currentSlug) && same(tenant?.slug) && Boolean(tenant?.nombre?.trim());
    // En carga, error o cambio de organización el pie queda neutral: ni el organismo anterior ni el pie comercial.
    return authoritative && tenant ? <SpaceFooter name={tenant.nombre} home={`/t/${tenant.slug}`} /> : <SpaceFooter />;
  }
  if (hostBinding) return <SpaceFooter name={hostBinding.tenant.nombre} home={hostBinding.paths.home} />;
  return presentation.active ? <PrivateWorkspaceFooter identity={presentation.identity} /> : <MarketingFooter />;
};

export default Footer;
