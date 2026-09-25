import {usePrivateWorkspacePresentation} from '@/hooks/usePrivateWorkspacePresentation';
import {PrivateWorkspaceFooter} from '@/components/brand/PrivateWorkspaceBrand';
// src/components/Footer.tsx

import { useState } from "react";
import { Link } from "react-router-dom";
import {
  Copy,
  Download,
  ExternalLink,
  Facebook,
  FileCheck2,
  Instagram,
  Linkedin,
  Mail,
  MessageCircle,
  QrCode,
  ShieldCheck,
  Twitter,
} from "lucide-react";
import { useScrollToSection } from "@/hooks/useScrollToSection";

const afipDataFiscalHref = "https://qr.afip.gob.ar/?qr=hNBOkNhlJyhWrlnUph25jQ,,";
const afipDataFiscalImage = "https://www.afip.gob.ar/images/f960/DATAWEB.jpg";
const mipymeCertificateHref = "/certificados/certificado-mipyme-intellitech.pdf";

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
    <footer className="bg-muted py-8 text-slate-700 dark:text-slate-300">
      <div className="container mx-auto px-4">
        <div className="mb-8 grid gap-8 text-center sm:grid-cols-2 sm:text-left lg:grid-cols-4">
          <div className="flex flex-col items-center sm:items-start">
            <h3 className="mb-3 text-xl font-bold text-foreground">Chatboc</h3>
            <p className="mb-4 max-w-xs text-slate-700 dark:text-slate-300">
              Tu experto virtual para atender, vender y ordenar conversaciones en cada canal conectado.
            </p>
            <div className="flex space-x-4">
              <a href="https://www.facebook.com/chatboc" target="_blank" rel="noopener noreferrer" aria-label="Facebook" className="text-slate-700 transition-colors hover:text-primary dark:text-slate-300">
                <Facebook className="h-5 w-5" />
              </a>
              <a href="https://www.twitter.com/chatboc.ar" target="_blank" rel="noopener noreferrer" aria-label="Twitter" className="text-slate-700 transition-colors hover:text-primary dark:text-slate-300">
                <Twitter className="h-5 w-5" />
              </a>
              <a href="https://www.instagram.com/chatboc.ar" target="_blank" rel="noopener noreferrer" aria-label="Instagram" className="text-slate-700 transition-colors hover:text-primary dark:text-slate-300">
                <Instagram className="h-5 w-5" />
              </a>
              <a href="https://www.linkedin.com/company/chatboc" target="_blank" rel="noopener noreferrer" aria-label="LinkedIn" className="text-slate-700 transition-colors hover:text-primary dark:text-slate-300">
                <Linkedin className="h-5 w-5" />
              </a>
            </div>
          </div>

          <div className="flex flex-col items-center sm:items-start">
            <h3 className="mb-3 text-lg font-semibold text-foreground">Producto</h3>
            <ul className="space-y-2">
              <li>
                <button
                  type="button"
                  className="m-0 cursor-pointer border-none bg-transparent p-0 text-slate-700 transition-colors hover:text-primary dark:text-slate-300"
                  onClick={() => scrollToSection("solucion")}
                >
                  Que hace
                </button>
              </li>
              <li>
                <button
                  type="button"
                  className="m-0 cursor-pointer border-none bg-transparent p-0 text-slate-700 transition-colors hover:text-primary dark:text-slate-300"
                  onClick={() => scrollToSection("precios")}
                >
                  Planes
                </button>
              </li>
              <li>
                <Link to="/demo" className="text-slate-700 transition-colors hover:text-primary dark:text-slate-300">
                  Probar demo
                </Link>
              </li>
            </ul>
          </div>

          <div className="flex flex-col items-center sm:items-start">
            <h3 className="mb-3 text-lg font-semibold text-foreground">Recursos</h3>
            <ul className="space-y-2">
              <li>
                <Link to="/faqs" className="text-slate-700 transition-colors hover:text-primary dark:text-slate-300">
                  Centro de ayuda (FAQs)
                </Link>
              </li>
              <li>
                <Link to="/documentacion" className="text-slate-700 transition-colors hover:text-primary dark:text-slate-300">
                  Guia de uso
                </Link>
              </li>
              <li className="flex items-center space-x-2">
                <MessageCircle className="h-4 w-4 text-primary" />
                <a
                  href="https://wa.me/5492613168608"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-slate-700 underline underline-offset-2 transition-colors hover:text-primary dark:text-slate-300"
                  title="Chatear por WhatsApp"
                >
                  WhatsApp
                </a>
              </li>
              <li className="flex items-center space-x-2">
                <Mail className="h-4 w-4 text-primary" />
                <a
                  href={`mailto:${email}`}
                  className="text-slate-700 underline underline-offset-2 transition-colors hover:text-primary dark:text-slate-300"
                  title="Enviar correo"
                >
                  {email}
                </a>
                <button type="button" className="ml-1" title="Copiar mail" aria-label="Copiar mail" onClick={handleCopyEmail}>
                  <Copy className={`h-4 w-4 ${copied ? "text-primary" : "text-slate-700 dark:text-slate-300"} transition-colors`} />
                </button>
                {copied ? <span className="ml-1 text-xs text-primary">Copiado</span> : null}
              </li>
            </ul>
          </div>

          <div className="flex flex-col items-center sm:items-start">
            <h3 className="mb-3 text-lg font-semibold text-foreground">Legal</h3>
            <ul className="space-y-2">
              <li>
                <Link to="/privacidad" className="text-slate-700 transition-colors hover:text-primary dark:text-slate-300">
                  Politica de privacidad
                </Link>
              </li>
              <li>
                <Link to="/terminos" className="text-slate-700 transition-colors hover:text-primary dark:text-slate-300">
                  Terminos y condiciones
                </Link>
              </li>
              <li>
                <Link to="/legal/cookies" className="text-slate-700 transition-colors hover:text-primary dark:text-slate-300">
                  Politica de cookies
                </Link>
              </li>
              <li>
                <Link to="/eliminacion-datos" className="text-slate-700 transition-colors hover:text-primary dark:text-slate-300">
                  Eliminacion de datos
                </Link>
              </li>
            </ul>
          </div>
        </div>

        <section aria-label="Credenciales institucionales" className="mb-7 rounded-2xl border border-border bg-background/80 p-3 shadow-sm sm:p-4">
          <div className="mb-3 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.22em] text-primary">Credenciales institucionales</p>
              <h3 className="text-base font-bold text-foreground">Validaciones publicas de Chatboc</h3>
            </div>
            <p className="max-w-xl text-xs leading-5 text-slate-700 dark:text-slate-300">
              Accesos oficiales para revisar informacion fiscal y descargar el certificado MiPyME.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <a
              href={afipDataFiscalHref}
              target="_F960AFIPInfo"
              rel="noopener noreferrer"
              className="group rounded-xl border border-border bg-card p-4 text-left transition hover:-translate-y-0.5 hover:border-primary/60 hover:shadow-md"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-primary">Data fiscal</p>
                  <p className="mt-1 text-sm font-bold text-foreground">Formulario F960/D</p>
                  <p className="mt-1 text-xs leading-5 text-slate-700 dark:text-slate-300">
                    Banner de acceso a informacion publica fiscal.
                  </p>
                </div>
                <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <QrCode className="h-4 w-4" />
                </span>
              </div>
              <span className="mt-4 inline-flex rounded-lg border border-border bg-white p-2 shadow-sm">
                <img src={afipDataFiscalImage} alt="Formulario 960 Data Fiscal AFIP" className="h-10 w-auto" />
              </span>
              <span className="mt-3 flex items-center gap-2 text-xs font-semibold text-primary">
                Abrir constancia AFIP
                <ExternalLink className="h-3.5 w-3.5" />
              </span>
            </a>

            <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/10 p-4 text-left transition hover:-translate-y-0.5 hover:border-emerald-500/60 hover:shadow-md">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-emerald-800 dark:text-emerald-300">Certificado MiPyME</p>
                  <p className="mt-1 text-sm font-bold text-foreground">Respaldo institucional SEPyME</p>
                  <p className="mt-1 text-xs leading-5 text-slate-700 dark:text-slate-300">
                    Documento oficial disponible para clientes, partners y validacion comercial.
                  </p>
                </div>
                <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-background text-emerald-600 shadow-sm dark:text-emerald-300">
                  <ShieldCheck className="h-4 w-4" />
                </span>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <a
                  href={mipymeCertificateHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2 text-xs font-bold text-foreground transition hover:border-emerald-500/60 hover:text-emerald-700 dark:hover:text-emerald-300"
                >
                  <FileCheck2 className="h-4 w-4" />
                  Ver PDF
                </a>
                <a
                  href={mipymeCertificateHref}
                  download
                  className="inline-flex items-center gap-2 rounded-lg bg-foreground px-3 py-2 text-xs font-bold text-background transition hover:bg-emerald-600 hover:text-white"
                >
                  <Download className="h-4 w-4" />
                  Descargar certificado
                </a>
              </div>
            </div>
          </div>
        </section>

        <div className="mt-2 border-t border-border pt-5">
          <p className="text-center text-sm text-slate-700 dark:text-slate-300">
            (c) {year} Chatboc - Todos los derechos reservados.
          </p>
        </div>
      </div>
    </footer>
  );
};

const Footer=()=>{
  const presentation=usePrivateWorkspacePresentation();
  return presentation.active?<PrivateWorkspaceFooter identity={presentation.identity}/>:<MarketingFooter/>;
};
export default Footer;
