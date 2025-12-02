// src/components/Footer.tsx

import React from "react";
import { Link } from "react-router-dom";
import { Facebook, Twitter, Instagram, Linkedin, Mail, MessageCircle, Copy } from "lucide-react";
import { useScrollToSection } from "@/hooks/useScrollToSection";
import { useState } from "react";

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
              Tu experto virtual que entiende y atiende a tus clientes, 24/7.
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
                  Documentación técnica
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
                <Link to="/legal/privacy" className="text-muted-foreground hover:text-primary transition-colors">
                  Política de privacidad
                </Link>
              </li>
              <li>
                <Link to="/legal/terms" className="text-muted-foreground hover:text-primary transition-colors">
                  Términos y condiciones
                </Link>
              </li>
              <li>
                <Link to="/legal/cookies" className="text-muted-foreground hover:text-primary transition-colors">
                  Política de cookies
                </Link>
              </li>
              <li className="mt-3">
                <a
                  href="https://qr.afip.gob.ar/?qr=hNBOkNhlJyhWrlnUph25jQ,,"
                  target="_blank"
                  rel="noopener noreferrer"
                  title="Datos fiscales - AFIP"
                  className="inline-block"
                >
                  <img
                    src="https://www.afip.gob.ar/images/f960/DATAWEB.jpg"
                    alt="Formulario 960 AFIP"
                    className="w-20"
                  />
                </a>
              </li>
            </ul>
          </div>
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
