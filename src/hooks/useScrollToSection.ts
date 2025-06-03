import { useNavigate, useLocation } from "react-router-dom";

export const useScrollToSection = () => {
  const navigate = useNavigate();
  const location = useLocation();

  return (sectionId: string) => {
    // Si ya estamos en la home, scrollea
    if (location.pathname === "/") {
      const section = document.getElementById(sectionId);
      if (section) {
        section.scrollIntoView({ behavior: "smooth" });
      }
    } else {
      // Guarda la sección deseada y redirige
      sessionStorage.setItem("pendingScrollSection", sectionId);
      navigate("/");
    }
  };
};
