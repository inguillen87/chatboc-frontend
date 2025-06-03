import React from "react";
import { Facebook, Twitter, Instagram, Linkedin, Mail } from "lucide-react";

const Footer = () => {
  return (
    <footer className="bg-gray-900 text-white pt-16 pb-8">
      <div className="container mx-auto px-4">
        <div className="grid gap-12 sm:grid-cols-2 lg:grid-cols-5 mb-12">
          {/* Marca y redes */}
          <div>
            <h3 className="text-xl font-bold mb-4">Chatboc</h3>
            <p className="text-gray-400 mb-4">
              Tu experto virtual que entiende y atiende a tus clientes, 24/7.
            </p>
            <div className="flex space-x-4 mb-2">
              <a
                href="https://www.facebook.com/tuempresa"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Facebook"
                className="text-gray-400 hover:text-white transition"
              >
                <Facebook className="h-5 w-5" />
              </a>
              <a
                href="https://www.twitter.com/tuempresa"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Twitter"
                className="text-gray-400 hover:text-white transition"
              >
                <Twitter className="h-5 w-5" />
              </a>
              <a
                href="https://www.instagram.com/tuempresa"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Instagram"
                className="text-gray-400 hover:text-white transition"
              >
                <Instagram className="h-5 w-5" />
              </a>
              <a
                href="https://www.linkedin.com/company/tuempresa"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="LinkedIn"
                className="text-gray-400 hover:text-white transition"
              >
                <Linkedin className="h-5 w-5" />
              </a>
            </div>
            <div className="flex items-center text-gray-400 mt-2">
              <Mail className="h-4 w-4 mr-2" />
              <a
                href="mailto:info@chatboc.ar"
                className="hover:text-white transition"
              >
                info@chatboc.ar
              </a>
            </div>
          </div>

          {/* Producto */}
          <div>
            <h3 className="text-lg font-semibold mb-4">Producto</h3>
            <ul className="space-y-2">
              <li><a href="/que-hace" className="text-gray-400 hover:text-white transition">Qué hace</a></li>
              <li><a href="/planes" className="text-gray-400 hover:text-white transition">Planes</a></li>
              <li><a href="/demo" className="text-gray-400 hover:text-white transition">Probar demo</a></li>
            </ul>
          </div>

          {/* Recursos */}
          <div>
            <h3 className="text-lg font-semibold mb-4">Recursos</h3>
            <ul className="space-y-2">
              <li><a href="/help" className="text-gray-400 hover:text-white transition">Centro de ayuda</a></li>
              <li><a href="/docs" className="text-gray-400 hover:text-white transition">Documentación técnica</a></li>
              <li>
                <a
                  href="https://wa.me/5492613168608"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-gray-400 hover:text-white transition"
                  aria-label="Escribinos por WhatsApp"
                >
                  Escribinos por WhatsApp
                </a>
              </li>
            </ul>
          </div>

          {/* Legal */}
          <div>
            <h3 className="text-lg font-semibold mb-4">Legal</h3>
            <ul className="space-y-2">
              <li><a href="/legal/privacy" className="text-gray-400 hover:text-white transition">Política de privacidad</a></li>
              <li><a href="/legal/terms" className="text-gray-400 hover:text-white transition">Términos y condiciones</a></li>
              <li><a href="/legal/cookies" className="text-gray-400 hover:text-white transition">Política de cookies</a></li>
            </ul>
          </div>

          {/* Contacto rápido (opcional, mejor UX en mobile) */}
          <div>
            <h3 className="text-lg font-semibold mb-4">Contacto</h3>
            <ul className="space-y-2">
              <li>
                <a
                  href="mailto:info@chatboc.ar"
                  className="text-gray-400 hover:text-white transition"
                  aria-label="Enviar email"
                >
                  Email: info@chatboc.ar
                </a>
              </li>
              <li>
                <a
                  href="https://wa.me/5492613168608"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-gray-400 hover:text-white transition"
                  aria-label="WhatsApp"
                >
                  WhatsApp: +54 9 261 316 8608
                </a>
              </li>
            </ul>
          </div>
        </div>

        <div className="border-t border-gray-800 pt-6">
          <p className="text-center text-sm text-gray-500">
            © 2025 Chatboc · Todos los derechos reservados.
          </p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
