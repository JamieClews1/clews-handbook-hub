import { Link } from "react-router-dom";
import { ChevronRight } from "lucide-react";

interface PageHeadingProps {
  section?: { label: string; href: string };
  title: string;
  description?: string;
  actions?: React.ReactNode;
}

export function PageHeading({ section, title, description, actions }: PageHeadingProps) {
  return (
    <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
      <div className="min-w-0">
        {section && (
          <nav aria-label="Breadcrumb" className="mb-2 flex items-center gap-1 text-xs text-muted-foreground">
            <Link to={section.href} className="hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">{section.label}</Link>
            <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
            <span aria-current="page" className="text-foreground">{title}</span>
          </nav>
        )}
        <h1 className="text-2xl font-semibold text-foreground">{title}</h1>
        {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
      </div>
      {actions}
    </div>
  );
}