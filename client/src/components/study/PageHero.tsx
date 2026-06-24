import { cn } from "@/lib/utils";
import type { ElementType, ReactNode } from "react";

export function PageHero({
  eyebrow,
  title,
  description,
  icon: Icon,
  actions,
  stats,
  className,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  icon?: ElementType;
  actions?: ReactNode;
  stats?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("relative overflow-hidden rounded-3xl border bg-card p-6 md:p-8 shadow-sm", className)}>
      <div className="absolute inset-0 bg-gradient-to-br from-primary/12 via-transparent to-violet-500/5 pointer-events-none" />
      <div className="relative flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0">
          {eyebrow && (
            <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-3 py-1 text-xs font-semibold text-primary mb-3">
              {Icon && <Icon className="w-3.5 h-3.5" />} {eyebrow}
            </div>
          )}
          <h1 className="text-3xl font-bold tracking-tight font-serif">{title}</h1>
          {description && <p className="text-muted-foreground mt-2 max-w-2xl">{description}</p>}
        </div>
        {stats && <div className="shrink-0">{stats}</div>}
        {actions && <div className="shrink-0 flex flex-wrap gap-2">{actions}</div>}
      </div>
    </div>
  );
}
