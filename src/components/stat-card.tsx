import { type ReactNode } from "react";
import { cn } from "@/lib/utils";

export function StatCard({
  label,
  value,
  icon,
  accent,
}: {
  label: string;
  value: ReactNode;
  icon: ReactNode;
  accent?: boolean;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-muted-foreground">{label}</span>
        <span
          className={cn(
            "grid size-9 place-items-center rounded-lg bg-secondary text-muted-foreground",
            accent && "bg-primary/15 text-primary",
          )}
        >
          {icon}
        </span>
      </div>
      <p className="mt-3 font-display text-3xl font-bold tracking-tight">{value}</p>
    </div>
  );
}
