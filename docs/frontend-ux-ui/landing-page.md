# Documentación: Landing Page

Este documento describe los cambios clave implementados en la landing page de Chatboc, su nueva estructura y el enfoque estratégico que guía su diseño y contenido.

## 1. Nuevo Enfoque Estratégico

La landing page ha sido rediseñada para reflejar un **enfoque más amplio y centrado en el usuario final**. Anteriormente, el mensaje estaba muy dirigido a PYMEs. El nuevo enfoque abarca:

-   **Municipios y Entidades Gubernamentales:** Destacando cómo la plataforma Chatboc (CRM + Chatbots IA) les ayuda a mejorar la atención ciudadana, agilizar trámites, facilitar el acceso a información y optimizar la gestión de servicios para los **vecinos**.
-   **Empresas (de todos los tamaños):** Enfatizando cómo la plataforma potencia la relación con sus **clientes**, optimiza la comunicación, automatiza procesos y mejora la experiencia de servicio.

El lenguaje, los problemas presentados, las soluciones y los testimonios han sido adaptados para resonar con estas audiencias y el impacto positivo en sus respectivos usuarios finales.

## 2. Estructura de Secciones y Contenido

La landing page (`src/pages/Index.tsx`) se compone de las siguientes secciones modulares (ubicadas en `src/components/sections/`):

1.  **`HeroSection.tsx`**:
    -   **Propósito:** Captar la atención inmediatamente y comunicar la propuesta de valor principal.
    -   **Contenido Clave:**
        -   Titular: "Conectamos Gobiernos y Empresas con sus Comunidades".
        -   Subtítulo: Describe la plataforma IA (CRM y Chatbots) y su impacto en la interacción con ciudadanos y clientes.
        -   Visual: Simulación de chat adaptada a un caso de uso municipal (ej. consulta sobre trámites).
        -   CTAs: "Probar Demo Interactiva" y "Conocer Soluciones".

2.  **`ProblemsSection.tsx`**:
    -   **Propósito:** Presentar los desafíos comunes que enfrentan las organizaciones y sus usuarios finales.
    -   **Contenido Clave:**
        -   Título: "¿Tu Organización Enfrenta Estos Desafíos?".
        -   Tarjetas de problemas: Incluyen desafíos como respuestas lentas, equipos saturados, información dispersa, falta de personalización y gestión ineficiente, todos con un enfoque dual (organización/usuario final).
        -   Cada problema incluye un "comentario" que introduce cómo Chatboc lo soluciona.

3.  **`SolutionSection.tsx`**:
    -   **Propósito:** Detallar cómo la plataforma Chatboc ofrece una solución integral.
    -   **Contenido Clave:**
        -   Título: "La Solución Integral para Conectar y Servir Mejor".
        -   Tarjetas de características/beneficios: Describen los componentes clave de la plataforma (Asistentes Virtuales IA, CRM 360°, Base de Conocimiento Inteligente, Paneles Analíticos, Automatización) y su impacto.

4.  **`HowItWorksSection.tsx`**:
    -   **Propósito:** Explicar de forma sencilla cómo empezar a usar la plataforma.
    -   **Contenido Clave:**
        -   Título: "Implementación Sencilla, Impacto Inmediato".
        -   Pasos: (1) Descubrimiento y Configuración, (2) Alimenta la Inteligencia, (3) Personaliza y Activa Asistente IA, (4) Mide y Evoluciona.
        -   CTA: "Solicita una Demostración".

5.  **`TargetSection.tsx`**:
    -   **Propósito:** Especificar a quién se dirige la plataforma y los beneficios para cada grupo.
    -   **Contenido Clave:**
        -   Título: "Una Solución Versátil para Cada Organización".
        -   Dos bloques principales:
            -   "Gobiernos Cercanos, Ciudadanos Satisfechos": Beneficios para municipios y entidades públicas.
            -   "Empresas Conectadas, Clientes Leales": Beneficios para empresas de diversos tamaños.
        -   CTA: "Agenda una Consultoría Personalizada".

6.  **`TestimonialsSection.tsx`**:
    -   **Propósito:** Proveer prueba social y credibilidad.
    -   **Contenido Clave:**
        -   Título: "Organizaciones que Ya Transforman su Comunicación".
        -   Tarjetas de testimonios: Placeholder para testimonios de diversos tipos de organizaciones (municipios, empresas), destacando el rol y la organización del testimoniante. Se usan avatares con iconos o iniciales.

7.  **`PricingSection.tsx`**:
    -   **Propósito:** Presentar las opciones de planes y el camino para soluciones personalizadas.
    -   **Contenido Clave:**
        -   Título: "Planes Flexibles para Impulsar tu Comunicación".
        -   Planes para empresas: "Inicia con IA" (prueba gratuita) y "Profesional Conectado".
        -   Tarjeta especial: "Soluciones para Gobiernos y Grandes Empresas" con un CTA para contacto directo.

8.  **`CtaSection.tsx`**:
    -   **Propósito:** Llamada a la acción final y clara.
    -   **Contenido Clave:**
        -   Título: "¿Listo para Transformar la Interacción con tus Usuarios?".
        -   CTAs: "Ver Demo Interactiva", "Hablar con un Asesor", "Crear Cuenta".

9.  **`ComingSoonSection.tsx`** (Opcional, actualmente comentada en `Index.tsx`):
    -   **Propósito:** Anunciar o destacar módulos/soluciones específicas como ChatPOS y ChatCRM.
    -   **Contenido Clave:** Tarjetas dedicadas para cada solución con descripción, imagen y enlace a su página de detalle o demo.

## 3. Guía de Estilo Aplicada

La landing page utiliza el sistema de diseño y los componentes definidos en:
-   `docs/style-guide/01-design-tokens.md`
-   `docs/style-guide/02-componentes-ui.md`

Esto incluye la paleta de colores, tipografía (`Inter`), `border-radius` (`0.25rem`), y el uso consistente de los componentes de `shadcn/ui` (Button, Card, etc.) con los estilos personalizados.

## 4. Responsive Design

Todas las secciones han sido diseñadas y construidas con un enfoque **mobile-first** utilizando Tailwind CSS para asegurar una correcta visualización y usabilidad en una amplia gama de dispositivos (móvil, tablet, desktop).

---

Esta documentación sirve como guía para entender la estructura actual, el contenido y el diseño de la landing page. Cualquier modificación futura debería tener en cuenta estos lineamientos para mantener la coherencia.
