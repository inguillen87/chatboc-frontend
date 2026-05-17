import React from "react";
import {
  motion,
  useMotionValue,
  useReducedMotion,
  useSpring,
  useTransform,
} from "framer-motion";
import { X } from "lucide-react";
import { useLocation } from "react-router-dom";

import { CHATBOC_AGENT_AVATAR } from "@/utils/brandAssets";

type GuideSection = {
  id: string;
  title: string;
  copy: string;
  element: HTMLElement;
  index: number;
  total: number;
};

const SESSION_DISMISSED_KEY = "chatboc_scroll_guide_dismissed";

const GUIDE_HEADING_SELECTOR = [
  "main [data-guide-title]",
  "main section h1",
  "main section h2",
  "main section h3",
  "main h1",
  "main h2",
].join(", ");

const GUIDE_SECTION_SELECTOR =
  "[data-guide-section], section, article, [role='region'], .container";

const PUBLIC_GUIDE_EXACT_PATHS = new Set([
  "/",
  "/demo",
  "/educacion",
  "/chatpos",
  "/chatcrm",
  "/opinar",
  "/documentacion",
  "/faqs",
  "/encuestas",
]);

const PUBLIC_GUIDE_PREFIXES = ["/demo/", "/encuestas/"];

function normalizeText(value: string | null | undefined) {
  return (value ?? "").replace(/\s+/g, " ").trim();
}

function truncateText(value: string, maxLength = 136) {
  if (value.length <= maxLength) return value;
  return `${value.slice(0, maxLength - 3).trim()}...`;
}

function shouldShowGuideForPath(pathname: string) {
  const normalizedPath = pathname.toLowerCase();
  if (PUBLIC_GUIDE_EXACT_PATHS.has(normalizedPath)) return true;
  return PUBLIC_GUIDE_PREFIXES.some((prefix) => normalizedPath.startsWith(prefix));
}

function getSectionCopy(scope: HTMLElement, heading: HTMLElement) {
  const explicitCopy = scope.querySelector<HTMLElement>("[data-guide-copy]");
  if (explicitCopy) {
    return truncateText(
      normalizeText(explicitCopy.getAttribute("data-guide-copy") || explicitCopy.textContent)
    );
  }

  const paragraphs = Array.from(scope.querySelectorAll<HTMLElement>("p"));
  const headingText = normalizeText(heading.textContent);
  const paragraph = paragraphs.find((node) => {
    const text = normalizeText(node.textContent);
    return text.length > 32 && text !== headingText && !text.includes(headingText);
  });

  return truncateText(normalizeText(paragraph?.textContent));
}

function collectGuideSections(): GuideSection[] {
  if (typeof document === "undefined") return [];

  const headings = Array.from(
    document.querySelectorAll<HTMLElement>(GUIDE_HEADING_SELECTOR)
  );
  const seenScopes = new Set<HTMLElement>();
  const collected: Omit<GuideSection, "index" | "total">[] = [];

  headings.forEach((heading, headingIndex) => {
    const title = normalizeText(
      heading.getAttribute("data-guide-title") || heading.textContent
    );
    if (title.length < 3) return;

    const scope =
      heading.closest<HTMLElement>(GUIDE_SECTION_SELECTOR) ||
      heading.parentElement ||
      heading;
    if (seenScopes.has(scope)) return;
    seenScopes.add(scope);

    collected.push({
      id: heading.id || `${title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${headingIndex}`,
      title: truncateText(title, 72),
      copy: getSectionCopy(scope, heading),
      element: scope,
    });
  });

  const visible = collected.filter((section) => {
    const rect = section.element.getBoundingClientRect();
    const styles = window.getComputedStyle(section.element);
    return rect.height > 80 && styles.display !== "none" && styles.visibility !== "hidden";
  });

  const limited = visible.slice(0, 12);
  return limited.map((section, index) => ({
    ...section,
    index,
    total: limited.length,
  }));
}

export default function ScrollMascotGuide() {
  const location = useLocation();
  const prefersReducedMotion = useReducedMotion();
  const pointerX = useMotionValue(0);
  const pointerY = useMotionValue(0);
  const springX = useSpring(pointerX, { stiffness: 170, damping: 18, mass: 0.42 });
  const springY = useSpring(pointerY, { stiffness: 170, damping: 18, mass: 0.42 });
  const rotateY = useTransform(springX, [-1, 1], [10, -10]);
  const rotateX = useTransform(springY, [-1, 1], [-8, 8]);
  const [sections, setSections] = React.useState<GuideSection[]>([]);
  const [activeIndex, setActiveIndex] = React.useState(0);
  const [guideTop, setGuideTop] = React.useState(150);
  const [expanded, setExpanded] = React.useState(false);
  const [isWinking, setIsWinking] = React.useState(false);
  const [dismissed, setDismissed] = React.useState(() => {
    if (typeof sessionStorage === "undefined") return false;
    return sessionStorage.getItem(SESSION_DISMISSED_KEY) === "1";
  });

  const routeAllowsGuide = shouldShowGuideForPath(location.pathname);

  React.useEffect(() => {
    setDismissed(sessionStorage.getItem(SESSION_DISMISSED_KEY) === "1");
  }, [location.pathname]);

  React.useEffect(() => {
    if (!routeAllowsGuide || dismissed) {
      setSections([]);
      return;
    }

    let refreshTimer = window.setTimeout(() => {
      setSections(collectGuideSections());
    }, 80);

    const refresh = () => {
      window.clearTimeout(refreshTimer);
      refreshTimer = window.setTimeout(() => {
        setSections(collectGuideSections());
      }, 120);
    };

    refresh();
    const main = document.querySelector("main");
    const observer = main ? new MutationObserver(refresh) : null;
    observer?.observe(main as HTMLElement, {
      childList: true,
      subtree: true,
      characterData: true,
    });

    window.addEventListener("load", refresh);
    window.addEventListener("resize", refresh);

    return () => {
      window.clearTimeout(refreshTimer);
      observer?.disconnect();
      window.removeEventListener("load", refresh);
      window.removeEventListener("resize", refresh);
    };
  }, [dismissed, location.pathname, routeAllowsGuide]);

  React.useEffect(() => {
    if (!sections.length) return;

    let animationFrame = 0;

    const updatePosition = () => {
      const maxScroll = Math.max(
        1,
        document.documentElement.scrollHeight - window.innerHeight
      );
      const scrollProgress = Math.min(1, Math.max(0, window.scrollY / maxScroll));
      const minTop = 176;
      const maxTop = Math.max(minTop, window.innerHeight - 230);
      setGuideTop(Math.round(minTop + (maxTop - minTop) * scrollProgress));

      const anchorY = window.innerHeight * 0.38;
      let nextIndex = activeIndex;
      let bestDistance = Number.POSITIVE_INFINITY;

      sections.forEach((section, index) => {
        const rect = section.element.getBoundingClientRect();
        const isVisible = rect.bottom > 80 && rect.top < window.innerHeight - 80;
        if (!isVisible) return;

        const distance = Math.abs(rect.top - anchorY);
        if (distance < bestDistance) {
          bestDistance = distance;
          nextIndex = index;
        }
      });

      if (bestDistance === Number.POSITIVE_INFINITY) {
        const firstBelow = sections.findIndex(
          (section) => section.element.getBoundingClientRect().top > anchorY
        );
        nextIndex = firstBelow === -1 ? sections.length - 1 : Math.max(0, firstBelow - 1);
      }

      setActiveIndex((current) => (current === nextIndex ? current : nextIndex));
    };

    const onScrollOrResize = () => {
      window.cancelAnimationFrame(animationFrame);
      animationFrame = window.requestAnimationFrame(updatePosition);
    };

    updatePosition();
    window.addEventListener("scroll", onScrollOrResize, { passive: true });
    window.addEventListener("resize", onScrollOrResize);

    return () => {
      window.cancelAnimationFrame(animationFrame);
      window.removeEventListener("scroll", onScrollOrResize);
      window.removeEventListener("resize", onScrollOrResize);
    };
  }, [activeIndex, sections]);

  React.useEffect(() => {
    if (!sections.length) return;

    const isMobileViewport = window.matchMedia("(max-width: 768px)").matches;
    setExpanded(!isMobileViewport && window.scrollY > 160);
    setIsWinking(true);
    const winkTimer = window.setTimeout(() => setIsWinking(false), 720);

    return () => {
      window.clearTimeout(winkTimer);
    };
  }, [activeIndex, sections.length]);

  if (!routeAllowsGuide || dismissed || sections.length < 1) return null;

  const current = sections[Math.min(activeIndex, sections.length - 1)];
  const rootClassName = [
    "chatboc-scroll-guide",
    expanded ? "chatboc-scroll-guide--expanded" : "chatboc-scroll-guide--compact",
    isWinking ? "chatboc-scroll-guide--wink" : "",
  ]
    .filter(Boolean)
    .join(" ");

  const handleDismiss = () => {
    sessionStorage.setItem(SESSION_DISMISSED_KEY, "1");
    setDismissed(true);
  };

  const resetPointerDepth = () => {
    pointerX.set(0);
    pointerY.set(0);
  };

  const handleAvatarPointerMove = (event: React.PointerEvent<HTMLButtonElement>) => {
    if (prefersReducedMotion) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const nextX = ((event.clientX - rect.left) / rect.width - 0.5) * 2;
    const nextY = ((event.clientY - rect.top) / rect.height - 0.5) * 2;
    pointerX.set(Math.max(-1, Math.min(1, nextX)));
    pointerY.set(Math.max(-1, Math.min(1, nextY)));
  };

  return (
    <aside
      className={rootClassName}
      style={{ "--chatboc-guide-top": `${guideTop}px` } as React.CSSProperties}
      aria-label="Chatboc guia contextual"
    >
      <div className="chatboc-scroll-guide__stage">
        <motion.button
          className="chatboc-scroll-guide__avatar-button"
          type="button"
          style={prefersReducedMotion ? undefined : { rotateX, rotateY }}
          onClick={() => setExpanded((value) => !value)}
          onPointerMove={handleAvatarPointerMove}
          onPointerLeave={resetPointerDepth}
          onBlur={resetPointerDepth}
          aria-expanded={expanded}
          aria-label={expanded ? "Ocultar guia" : "Mostrar guia"}
        >
          <span className="chatboc-scroll-guide__back-glow" aria-hidden="true" />
          <span className="chatboc-scroll-guide__rim-light" aria-hidden="true" />
          <span
            className="chatboc-scroll-guide__spark chatboc-scroll-guide__spark--one"
            aria-hidden="true"
          />
          <span
            className="chatboc-scroll-guide__spark chatboc-scroll-guide__spark--two"
            aria-hidden="true"
          />
          <span className="chatboc-scroll-guide__shine" aria-hidden="true" />
          <img
            className="chatboc-scroll-guide__avatar"
            src={CHATBOC_AGENT_AVATAR}
            alt=""
            loading="lazy"
          />
          <span className="chatboc-scroll-guide__wink" aria-hidden="true" />
          <span className="chatboc-scroll-guide__feet" aria-hidden="true">
            <span />
            <span />
          </span>
        </motion.button>

        <div className="chatboc-scroll-guide__bubble" aria-live="polite">
          <button
            className="chatboc-scroll-guide__dismiss"
            type="button"
            onClick={handleDismiss}
            aria-label="Cerrar guia"
          >
            <X aria-hidden="true" size={14} />
          </button>
          <span className="chatboc-scroll-guide__meta">
            Seccion {current.index + 1}/{current.total}
          </span>
          <strong className="chatboc-scroll-guide__title">{current.title}</strong>
          {current.copy ? (
            <p className="chatboc-scroll-guide__copy">{current.copy}</p>
          ) : null}
        </div>
      </div>
    </aside>
  );
}
