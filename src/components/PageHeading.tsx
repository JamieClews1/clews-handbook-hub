interface PageHeadingProps {
  section?: { label: string; href: string };
  title: string;
  description?: string;
  actions?: React.ReactNode;
}

export function PageHeading({ title, description, actions }: PageHeadingProps) {
  return (
    <div className="mb-6 flex flex-wrap items-center justify-between gap-4" data-page-heading>
      <div className="flex min-w-0 flex-wrap items-baseline gap-x-3 gap-y-1">
        <h1 className="text-2xl font-bold text-foreground">{title}</h1>
        {description && <p className="text-sm text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}