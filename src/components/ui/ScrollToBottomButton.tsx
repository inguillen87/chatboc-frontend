import { useEffect, useState } from "react";
import { ArrowDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";

interface ScrollToBottomButtonProps {
  target?: HTMLElement | null;
}

const ScrollToBottomButton = ({ target }: ScrollToBottomButtonProps) => {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!target) return;
    const onScroll = () => {
      const atBottom =
        target.scrollHeight - target.scrollTop - target.clientHeight < 100;
      setVisible(!atBottom);
    };
    target.addEventListener("scroll", onScroll);
    onScroll();
    return () => target.removeEventListener("scroll", onScroll);
  }, [target]);

  const scrollToBottom = () => {
    if (target) {
      target.scrollTo({ top: target.scrollHeight, behavior: "smooth" });
    }
  };

  if (!target) return null;

  return (
    <button
      type="button"
      onClick={scrollToBottom}
      className={cn(
        buttonVariants({ variant: "secondary", size: "icon" }),
        "absolute bottom-24 right-4 z-20 transition-opacity",
        visible ? "opacity-100" : "pointer-events-none opacity-0"
      )}
      aria-label="Ir al final"
      title="Ir al final"
    >
      <ArrowDown className="h-4 w-4" />
    </button>
  );
};

export default ScrollToBottomButton;
