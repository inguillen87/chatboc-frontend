import { useNavigate, useLocation } from "react-router-dom";

// Espera a que el DOM esté listo
function scrollToId(id: string) {
  const el = document.getElementById(id);
  if (el) el.scrollIntoView({ behavior: "smooth" });
}

export function useScrollToSection() {
  const navigate = useNavigate();
  const location = useLocation();

  return (sectionId: string) => {
    if (location.pathname !== "/") {
      navigate("/");
      setTimeout(() => scrollToId(sectionId), 400); // ajusta delay si ves que lo necesita
    } else {
      scrollToId(sectionId);
    }
  };
}
