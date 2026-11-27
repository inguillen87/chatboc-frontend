import { useEffect, useState } from "react";
import { ArrowUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";

const prefersReducedMotion = () =>
  typeof window !== "undefined" &&
  (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ||
    document.documentElement.classList.contains("a11y-reduced-motion"));

const ScrollToTopButton = ({ showLabel = false }: { showLabel?: boolean }) => {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const onScroll = () => {
      setVisible(window.scrollY > 400);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: prefersReducedMotion() ? "auto" : "smooth" });
  };

  return (
    <button
      type="button"
      onClick={scrollToTop}
      aria-label="Volver arriba"
      // While hidden it is not a control: keep it out of the Tab order and the accessibility tree.
      aria-hidden={visible ? undefined : true}
      tabIndex={visible ? undefined : -1}
      className={cn(
        buttonVariants({ variant: "secondary", size: showLabel ? "default" : "icon" }),
        "chatboc-scroll-top min-h-11 min-w-11 gap-2 transition-opacity motion-reduce:transition-none",
        showLabel ? "px-4" : "h-11 w-11",
        visible ? "opacity-100" : "pointer-events-none opacity-0"
      )}
      title="Volver arriba"
    >
      <ArrowUp className="h-4 w-4" aria-hidden="true" />
      {showLabel ? <span>Volver arriba</span> : null}
    </button>
  );
};

export default ScrollToTopButton;
