import { LucideIcon } from "lucide-react";
import { ReactNode } from "react";

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  cta?: ReactNode;
  compact?: boolean;
}

export function EmptyState({ icon: Icon, title, description, cta, compact = false }: EmptyStateProps) {
  if (compact) {
    return (
      <div className="flex flex-col items-center justify-center text-center p-5 rounded-xl border border-dashed border-border bg-card/30 backdrop-blur-sm animate-in fade-in duration-200">
        <div className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary mb-2.5">
          <Icon className="size-4.5" />
        </div>
        <h4 className="text-sm font-medium text-foreground tracking-tight">{title}</h4>
        <p className="text-xs text-muted-foreground mt-1 max-w-[280px] leading-relaxed">{description}</p>
        {cta && <div className="mt-3.5">{cta}</div>}
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center text-center p-10 rounded-2xl border border-dashed border-border bg-card/50 backdrop-blur-md shadow-sm animate-in fade-in duration-300">
      <div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-primary/10 text-primary mb-5 ring-8 ring-primary/5">
        <Icon className="size-7" />
      </div>
      <h3 className="text-lg font-semibold text-foreground tracking-tight">{title}</h3>
      <p className="mt-2 max-w-sm text-sm text-muted-foreground leading-relaxed">{description}</p>
      {cta && <div className="mt-6">{cta}</div>}
    </div>
  );
}
