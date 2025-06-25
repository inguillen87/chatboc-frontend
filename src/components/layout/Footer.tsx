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
    <footer className="bg-gray-900 text-white pt-16 pb-8">
      <div className="container mx-auto px-4">
        <div className="grid gap-12 sm:grid-cols-2 lg:grid-cols-4 mb-12">
          {/* Marca y redes */}
          <div>
            <h3 className="text-xl font-bold mb-4">Chatboc</h3>
            <p className="text-gray-400 mb-4">
              Tu experto virtual que entiende y atiende a tus clientes, 24/7.
            </p>
            <div className="flex space-x-4 mt-2">
              <a href="https://www.facebook.com/chatboc" target="_blank" rel="noopener noreferrer" aria-label="Facebook" className="text-gray-400 hover:text-white transition">
                <Facebook className="h-5 w-5" />
              </a>
              <a href="https://www.twitter.com/chatboc.ar" target="_blank" rel="noopener noreferrer" aria-label="Twitter" className="text-gray-400 hover:text-white transition">
                <Twitter className="h-5 w-5" />
              </a>
              <a href="https://www.instagram.com/chatboc.ar" target="_blank" rel="noopener noreferrer" aria-label="Instagram" className="text-gray-400 hover:text-white transition">
                <Instagram className="h-5 w-5" />
              </a>
              <a href="https://www.linkedin.com/company/chatboc" target="_blank" rel="noopener noreferrer" aria-label="LinkedIn" className="text-gray-400 hover:text-white transition">
                <Linkedin className="h-5 w-5" />
              </a>
            </div>
          </div>

          {/* Producto */}
          <div>
            <h3 className="text-lg font-semibold mb-4">Producto</h3>
            <ul className="space-y-2">
              <li>
                <button
                  type="button"
                  className="text-gray-400 hover:text-white transition bg-transparent border-none p-0 m-0 cursor-pointer"
                  onClick={() => scrollToSection("solution")}
                >
                  Qué hace
                </button>
              </li>
              <li>
                <button
                  type="button"
                  className="text-gray-400 hover:text-white transition bg-transparent border-none p-0 m-0 cursor-pointer"
                  onClick={() => scrollToSection("pricing")}
                >
                  Planes
                </button>
              </li>
              <li>
                <Link to="/demo" className="text-gray-400 hover:text-white transition">
                  Probar demo
                </Link>
              </li>
            </ul>
          </div>

          {/* Recursos */}
          <div>
            <h3 className="text-lg font-semibold mb-4">Recursos</h3>
            <ul className="space-y-2">
              <li>
                <Link to="/faqs" className="text-gray-400 hover:text-white transition">
                  Centro de ayuda (FAQs)
                </Link>
              </li>
              <li>
                <Link to="/documentacion" className="text-gray-400 hover:text-white transition">
                  Documentación técnica
                </Link>
              </li>
              <li className="flex items-center space-x-2">
                <MessageCircle className="h-4 w-4 text-green-400" />
                <a
                  href="https://wa.me/5492613168608"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-gray-400 hover:text-white transition underline underline-offset-2"
                  title="Chatear por WhatsApp"
                >
                  WhatsApp
                </a>
              </li>
              <li className="flex items-center space-x-2">
                <Mail className="h-4 w-4 text-blue-400" />
                <a
                  href={`mailto:${email}`}
                  className="text-gray-400 hover:text-white transition underline underline-offset-2"
                  title="Enviar correo"
                >
                  {email}
                </a>
                <button
                  className="ml-2"
                  title="Copiar mail"
                  onClick={handleCopyEmail}
                >
                  <Copy className={`h-4 w-4 ${copied ? "text-green-400" : "text-gray-400"} transition`} />
                </button>
                {copied && <span className="text-green-400 ml-1 text-xs">¡Copiado!</span>}
              </li>
            </ul>
          </div>

          {/* Legal */}
          <div>
            <h3 className="text-lg font-semibold mb-4">Legal</h3>
            <ul className="space-y-2">
  <li>
    <Link to="/legal/privacy" className="text-gray-400 hover:text-white transition">
      Política de privacidad
    </Link>
  </li>
  <li>
    <Link to="/legal/terms" className="text-gray-400 hover:text-white transition">
      Términos y condiciones
    </Link>
  </li>
  <li>
    <Link to="/legal/cookies" className="text-gray-400 hover:text-white transition">
      Política de cookies
    </Link>
  </li>
  <li className="mt-4">
    <a
      href="http://qr.afip.gob.ar/?qr=hNBOkNhlJyhWrlnUph25jQ,,"
      target="_blank"
      rel="noopener noreferrer"
      title="Datos fiscales - AFIP"
      className="inline-block"
    >
      <img
        src="http://www.afip.gob.ar/images/f960/DATAWEB.jpg"
        alt="Formulario 960 AFIP"
        className="w-24 sm:w-20 md:w-24 lg:w-28"
      />
    </a>
  </li>
</ul>

          </div>
        </div>

        
        <div className="border-t border-gray-800 pt-6 mt-4">
          <p className="text-center text-sm text-gray-500">
            © 2025 Chatboc · Todos los derechos reservados.
          </p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
