import { useEffect, useState } from "react";
import { ArrowUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";

const ScrollToTopButton = () => {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const onScroll = () => {
      setVisible(window.scrollY > 400);
    };
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <button
      type="button"
      onClick={scrollToTop}
      className={cn(
        buttonVariants({ variant: "secondary", size: "icon" }),
        "fixed bottom-5 right-5 z-40 transition-opacity",
        visible ? "opacity-100" : "pointer-events-none opacity-0"
      )}
      title="Volver arriba"
    >
      <ArrowUp className="h-4 w-4" />
    </button>
  );
};

export default ScrollToTopButton;
