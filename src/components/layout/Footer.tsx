import React from "react";
import { Link } from "react-router-dom";
import { Facebook, Twitter, Instagram, Linkedin, Mail, MessageCircle, Copy } from "lucide-react";
import { useScrollToSection } from "@/hooks/useScrollToSection"; // Asegúrate de que esta ruta sea correcta
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
    // MODIFICADO: Fondo del footer y colores de texto adaptativos
    // Optamos por un fondo oscuro que se adapta sutilmente.
    <footer className="bg-background dark:bg-gray-900 text-foreground dark:text-gray-100 pt-16 pb-8">
      <div className="container mx-auto px-4">
        <div className="grid gap-12 sm:grid-cols-2 lg:grid-cols-4 mb-12">
          {/* Marca y redes */}
          <div>
            <h3 className="text-xl font-bold mb-4 text-foreground">Chatboc</h3> {/* Usar text-foreground */}
            <p className="text-muted-foreground mb-4"> {/* Usar text-muted-foreground */}
              Tu experto virtual que entiende y atiende a tus clientes, 24/7.
            </p>
            <div className="flex space-x-4 mt-2">
              <a href="https://www.facebook.com/chatboc.ar" target="_blank" rel="noopener noreferrer" aria-label="Facebook" className="text-muted-foreground hover:text-primary transition"> {/* Usar text-muted-foreground y hover:text-primary */}
                <Facebook className="h-5 w-5" />
              </a>
              <a href="https://www.twitter.com/chatboc.ar" target="_blank" rel="noopener noreferrer" aria-label="Twitter" className="text-muted-foreground hover:text-primary transition">
                <Twitter className="h-5 w-5" />
              </a>
              <a href="https://www.instagram.com/chatboc.ar" target="_blank" rel="noopener noreferrer" aria-label="Instagram" className="text-muted-foreground hover:text-primary transition">
                <Instagram className="h-5 w-5" />
              </a>
              <a href="https://www.linkedin.com/company/chatboc" target="_blank" rel="noopener noreferrer" aria-label="LinkedIn" className="text-muted-foreground hover:text-primary transition">
                <Linkedin className="h-5 w-5" />
              </a>
            </div>
          </div>

          {/* Producto */}
          <div>
            <h3 className="text-lg font-semibold mb-4 text-foreground">Producto</h3> {/* Usar text-foreground */}
            <ul className="space-y-2">
              <li>
                <button
                  type="button"
                  className="text-muted-foreground hover:text-primary transition bg-transparent border-none p-0 m-0 cursor-pointer"
                  onClick={() => scrollToSection("solution")}
                >
                  Qué hace
                </button>
              </li>
              <li>
                <button
                  type="button"
                  className="text-muted-foreground hover:text-primary transition bg-transparent border-none p-0 m-0 cursor-pointer"
                  onClick={() => scrollToSection("precios")}
                >
                  Planes
                </button>
              </li>
              <li>
                <Link to="/demo" className="text-muted-foreground hover:text-primary transition">
                  Probar demo
                </Link>
              </li>
            </ul>
          </div>

          {/* Recursos */}
          <div>
            <h3 className="text-lg font-semibold mb-4 text-foreground">Recursos</h3>
            <ul className="space-y-2">
              <li>
                <Link to="/faqs" className="text-muted-foreground hover:text-primary transition">
                  Centro de ayuda (FAQs)
                </Link>
              </li>
              <li>
                <Link to="/documentacion" className="text-muted-foreground hover:text-primary transition">
                  Documentación técnica
                </Link>
              </li>
              <li className="flex items-center space-x-2">
                <MessageCircle className="h-4 w-4 text-green-500" /> {/* Mantengo un verde vívido para WhatsApp */}
                <a
                  href="https://wa.me/5492613168608"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-muted-foreground hover:text-primary transition underline underline-offset-2"
                  title="Chatear por WhatsApp"
                >
                  WhatsApp
                </a>
              </li>
              <li className="flex items-center space-x-2">
                <Mail className="h-4 w-4 text-blue-500" /> {/* Mantengo un azul vívido para Mail */}
                <a
                  href={`mailto:${email}`}
                  className="text-muted-foreground hover:text-primary transition underline underline-offset-2"
                  title="Enviar correo"
                >
                  {email}
                </a>
                <button
                  className="ml-2"
                  title="Copiar mail"
                  onClick={handleCopyEmail}
                >
                  <Copy className={`h-4 w-4 ${copied ? "text-green-500" : "text-muted-foreground"} transition`} /> {/* Color de copia adaptativo */}
                </button>
                {copied && <span className="text-green-500 ml-1 text-xs">¡Copiado!</span>}
              </li>
            </ul>
          </div>

          {/* Legal */}
          <div>
            <h3 className="text-lg font-semibold mb-4 text-foreground">Legal</h3>
            <ul className="space-y-2">
              <li>
                <Link to="/legal/privacy" className="text-muted-foreground hover:text-primary transition">
                  Política de privacidad
                </Link>
              </li>
              <li>
                <Link to="/legal/terms" className="text-muted-foreground hover:text-primary transition">
                  Términos y condiciones
                </Link>
              </li>
              <li>
                <Link to="/legal/cookies" className="text-muted-foreground hover:text-primary transition">
                  Política de cookies
                </Link>
              </li>
            </ul>
          </div>
        </div>
        <div className="border-t border-border pt-6"> {/* Usar border-border */}
          <p className="text-center text-sm text-muted-foreground"> {/* Usar text-muted-foreground */}
            © 2025 Chatboc · Todos los derechos reservados.
          </p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;