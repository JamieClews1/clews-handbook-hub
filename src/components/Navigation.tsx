import { Link, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Home, Phone } from "lucide-react";

interface NavigationProps {
  language: string;
}

const translations = {
  en: {
    handbook: "Handbook",
    contact: "HR Contact",
  },
  pl: {
    handbook: "Podręcznik",
    contact: "Kontakt HR",
  },
  uk: {
    handbook: "Довідник",
    contact: "Контакт HR",
  },
  ro: {
    handbook: "Manual",
    contact: "Contact HR",
  },
};

export const Navigation = ({ language }: NavigationProps) => {
  const location = useLocation();
  const t = translations[language as keyof typeof translations];

  return (
    <nav className="bg-card border-b border-border">
      <div className="container mx-auto px-4 py-2 flex gap-2">
        <Link to="/portal">
          <Button
            variant="ghost"
            size="sm"
            className="gap-2"
          >
            <Home className="h-4 w-4" />
            Home
          </Button>
        </Link>
        <Link to="/handbook">
          <Button
            variant={location.pathname === "/handbook" ? "default" : "ghost"}
            size="sm"
            className="gap-2"
          >
            {t.handbook}
          </Button>
        </Link>
        <Link to="/contact">
          <Button
            variant={location.pathname === "/contact" ? "default" : "ghost"}
            size="sm"
            className="gap-2"
          >
            <Phone className="h-4 w-4" />
            {t.contact}
          </Button>
        </Link>
      </div>
    </nav>
  );
};
