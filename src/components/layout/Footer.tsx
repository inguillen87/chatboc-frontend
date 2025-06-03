import React from "react";
import { Facebook, Twitter, Instagram, Linkedin, Mail, MessageCircle } from "lucide-react";

const Footer = () => {
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
              <a href="https://www.facebook.com" target="_blank" rel="noopener noreferrer" aria-label="Facebook" className="text-gray-400 hover:text-white transition">
                <Facebook className="h-5 w-5" />
              </a>
              <a href="https://www.twitter.com" target="_blank" rel="noopener noreferrer" aria-label="Twitter" className="text-gray-400 hover:text-white transition">
                <Twitter className="h-5 w-5" />
              </a>
              <a href="https://www.instagram.com" target="_blank" rel="noopener noreferrer" aria-label="Instagram" className="text-gray-400 hover:text-white transition">
                <Instagram className="h-5 w-5" />
              </a>
              <a href="https://www.linkedin.com" target="_blank" rel="noopener noreferrer" aria-label="LinkedIn" className="text-gray-400 hover:text-white transition">
                <Linkedin className="h-5 w-5" />
              </a>
            </div>
          </div>

          {/* Producto */}
          <div>
            <h3 className="text-lg font-semibold mb-4">Producto</h3>
            <ul className="space-y-2">
              <li><a href="#solution" className="text-gray-400 hover:text-white transition">Qué hace</a></li>
              <li><a href="#pricing" className="text-gray-400 hover:text-white transition">Planes</a></li>
              <li><a href="/demo" className="text-gray-400 hover:text-white transition">Probar demo</a></li>
            </ul>
          </div>

          {/* Recursos */}
          <div>
            <h3 className="text-lg font-semibold mb-4">Recursos</h3>
            <ul className="space-y-2">
              <li>
                <a href="/Faqs" className="text-gray-400 hover:text-white transition">Centro de ayuda (FAQs)</a>
              </li>
              <li>
                <a href="/Documentacion" className="text-gray-400 hover:text-white transition">Documentación técnica</a>
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
                  href="mailto:soporte@chatboc.ar"
                  className="text-gray-400 hover:text-white transition underline underline-offset-2"
                  style={{ wordBreak: "break-all" }}
                  title="Enviar correo a soporte@chatboc.ar"
                >
                  soporte@chatboc.ar
                </a>
              </li>
            </ul>
          </div>

          {/* Legal */}
          <div>
            <h3 className="text-lg font-semibold mb-4">Legal</h3>
            <ul className="space-y-2">
              <li>
                <a href="/legal/Privacy" className="text-gray-400 hover:text-white transition">Política de privacidad</a>
              </li>
              <li>
                <a href="/legal/Terms" className="text-gray-400 hover:text-white transition">Términos y condiciones</a>
              </li>
              <li>
                <a href="/legal/Cookies" className="text-gray-400 hover:text-white transition">Política de cookies</a>
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
