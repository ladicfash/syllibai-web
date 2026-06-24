import { Button } from "@/components/ui/button";
import type { ElementType, ReactNode } from "react";

export function EmptyState({ icon: Icon, title, description, actions }: { icon: ElementType; title: string; description: string; actions?: ReactNode }) {
  return (
    <div className="rounded-3xl border border-dashed bg-card p-10 text-center">
      <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10">
        <Icon className="h-7 w-7 text-primary" />
      </div>
      <h3 className="text-lg font-semibold">{title}</h3>
      <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">{description}</p>
      {actions && <div className="mt-5 flex flex-wrap justify-center gap-2">{actions}</div>}
    </div>
  );
}
