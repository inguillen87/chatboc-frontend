// src/components/Footer.tsx

import React from "react";
import { Link } from "react-router-dom";
import { Facebook, Twitter, Instagram, Linkedin, Mail, MessageCircle, Copy, Download, ExternalLink, ShieldCheck } from "lucide-react";
import { useScrollToSection } from "@/hooks/useScrollToSection";
import { useState } from "react";

const afipDataFiscalHref = "https://qr.afip.gob.ar/?qr=hNBOkNhlJyhWrlnUph25jQ,,";
const mipymeCertificateHref = "/certificados/certificado-mipyme-intellitech.pdf";

const Footer = () => {
  const scrollToSection = useScrollToSection();
  const [copied, setCopied] = useState(false);
  const email = "info@chatboc.ar";

  const handleCopyEmail = () => {
    navigator.clipboard.writeText(email);
    setCopied(true);
    setTimeout(() => setCopied(false), 1200);
  };

  return (
    <footer className="bg-muted text-muted-foreground py-8">
      <div className="container mx-auto px-4">
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4 mb-8 text-center sm:text-left">
          {/* Marca y redes */}
          <div className="flex flex-col items-center sm:items-start">
            <h3 className="text-xl font-bold mb-3 text-foreground">Chatboc</h3>
            <p className="text-muted-foreground mb-4 max-w-xs">
              Tu experto virtual para atender, vender y ordenar conversaciones en cada canal conectado.
            </p>
            <div className="flex space-x-4">
              <a href="https://www.facebook.com/chatboc" target="_blank" rel="noopener noreferrer" aria-label="Facebook" className="text-muted-foreground hover:text-primary transition-colors">
                <Facebook className="h-5 w-5" />
              </a>
              <a href="https://www.twitter.com/chatboc.ar" target="_blank" rel="noopener noreferrer" aria-label="Twitter" className="text-muted-foreground hover:text-primary transition-colors">
                <Twitter className="h-5 w-5" />
              </a>
              <a href="https://www.instagram.com/chatboc.ar" target="_blank" rel="noopener noreferrer" aria-label="Instagram" className="text-muted-foreground hover:text-primary transition-colors">
                <Instagram className="h-5 w-5" />
              </a>
              <a href="https://www.linkedin.com/company/chatboc" target="_blank" rel="noopener noreferrer" aria-label="LinkedIn" className="text-muted-foreground hover:text-primary transition-colors">
                <Linkedin className="h-5 w-5" />
              </a>
            </div>
          </div>

          {/* Producto */}
          <div className="flex flex-col items-center sm:items-start">
            <h3 className="text-lg font-semibold mb-3 text-foreground">Producto</h3>
            <ul className="space-y-2">
              <li>
                <button
                  type="button"
                  className="text-muted-foreground hover:text-primary transition-colors bg-transparent border-none p-0 m-0 cursor-pointer"
                  onClick={() => scrollToSection("solution")}
                >
                  Qué hace
                </button>
              </li>
              <li>
                <button
                  type="button"
                  className="text-muted-foreground hover:text-primary transition-colors bg-transparent border-none p-0 m-0 cursor-pointer"
                  onClick={() => scrollToSection("pricing")}
                >
                  Planes
                </button>
              </li>
              <li>
                <Link to="/demo" className="text-muted-foreground hover:text-primary transition-colors">
                  Probar demo
                </Link>
              </li>
            </ul>
          </div>

          {/* Recursos */}
          <div className="flex flex-col items-center sm:items-start">
            <h3 className="text-lg font-semibold mb-3 text-foreground">Recursos</h3>
            <ul className="space-y-2">
              <li>
                <Link to="/faqs" className="text-muted-foreground hover:text-primary transition-colors">
                  Centro de ayuda (FAQs)
                </Link>
              </li>
              <li>
                <Link to="/documentacion" className="text-muted-foreground hover:text-primary transition-colors">
                  Guia de uso
                </Link>
              </li>
              <li className="flex items-center space-x-2">
                <MessageCircle className="h-4 w-4 text-primary" />
                <a
                  href="https://wa.me/5492613168608"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-muted-foreground hover:text-primary transition-colors underline underline-offset-2"
                  title="Chatear por WhatsApp"
                >
                  WhatsApp
                </a>
              </li>
              <li className="flex items-center space-x-2">
                <Mail className="h-4 w-4 text-primary" />
                <a
                  href={`mailto:${email}`}
                  className="text-muted-foreground hover:text-primary transition-colors underline underline-offset-2"
                  title="Enviar correo"
                >
                  {email}
                </a>
                <button
                  className="ml-1"
                  title="Copiar mail"
                  onClick={handleCopyEmail}
                >
                  <Copy className={`h-4 w-4 ${copied ? "text-primary" : "text-muted-foreground"} transition-colors`} />
                </button>
                {copied && <span className="text-primary ml-1 text-xs">¡Copiado!</span>}
              </li>
            </ul>
          </div>

          {/* Legal */}
          <div className="flex flex-col items-center sm:items-start">
            <h3 className="text-lg font-semibold mb-3 text-foreground">Legal</h3>
            <ul className="space-y-2">
              <li>
                <Link to="/privacidad" className="text-muted-foreground hover:text-primary transition-colors">
                  Política de privacidad
                </Link>
              </li>
              <li>
                <Link to="/terminos" className="text-muted-foreground hover:text-primary transition-colors">
                  Términos y condiciones
                </Link>
              </li>
              <li>
                <Link to="/legal/cookies" className="text-muted-foreground hover:text-primary transition-colors">
                  Política de cookies
                </Link>
              </li>
              <li>
                <Link to="/eliminacion-datos" className="text-muted-foreground hover:text-primary transition-colors">
                  Eliminacion de datos
                </Link>
              </li>
            </ul>
          </div>
        </div>

        <div className="mb-7 grid gap-3 rounded-2xl border border-border bg-background/70 p-3 shadow-sm sm:grid-cols-2 sm:p-4">
          <a
            href={afipDataFiscalHref}
            target="_F960AFIPInfo"
            rel="noopener noreferrer"
            className="group rounded-xl border border-border bg-card p-4 text-left transition hover:-translate-y-0.5 hover:border-primary/60"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-primary">Data fiscal</p>
                <p className="mt-1 text-sm font-bold text-foreground">Inscripcion digital AFIP</p>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">Acceso publico a informacion fiscal de la empresa.</p>
              </div>
              <ExternalLink className="mt-1 h-4 w-4 text-muted-foreground transition group-hover:text-primary" />
            </div>
            <span className="mt-4 inline-flex rounded-lg border border-border bg-white p-2 shadow-sm">
              <img src="https://www.afip.gob.ar/images/f960/DATAWEB.jpg" alt="Formulario 960 Data Fiscal AFIP" className="h-10 w-auto" />
            </span>
          </a>

          <a
            href={mipymeCertificateHref}
            download
            className="group rounded-xl border border-emerald-500/25 bg-emerald-500/10 p-4 text-left transition hover:-translate-y-0.5 hover:border-emerald-500/60"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-emerald-600 dark:text-emerald-300">Certificado MiPyME</p>
                <p className="mt-1 text-sm font-bold text-foreground">Respaldo institucional SEPyME</p>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">Documento oficial descargable para clientes, partners y validacion comercial.</p>
              </div>
              <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-background text-emerald-600 shadow-sm dark:text-emerald-300">
                <ShieldCheck className="h-4 w-4" />
              </span>
            </div>
            <span className="mt-4 inline-flex items-center gap-2 rounded-lg bg-foreground px-3 py-2 text-xs font-bold text-background transition group-hover:bg-emerald-600 group-hover:text-white">
              <Download className="h-4 w-4" />
              Descargar certificado
            </span>
          </a>
        </div>

        <div className="border-t border-border pt-5 mt-2">
          <p className="text-center text-sm text-muted-foreground/80">
            © 2025 Chatboc · Todos los derechos reservados.
          </p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
