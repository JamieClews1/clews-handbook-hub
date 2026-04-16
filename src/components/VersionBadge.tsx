import packageJson from "../../package.json";

export const VersionBadge = () => {
  return (
    <div className="px-4 py-2 text-xs text-muted-foreground/60 border-t border-border/50">
      <div className="flex items-center justify-between">
        <span>v{packageJson.version}</span>
        <span className="text-[10px] opacity-50">{new Date().toLocaleDateString('en-GB', { month: 'short', year: '2-digit' })}</span>
      </div>
    </div>
  );
};
