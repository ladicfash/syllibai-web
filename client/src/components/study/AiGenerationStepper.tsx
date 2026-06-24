import { CheckCircle2, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

const defaultSteps = ["Reading sources", "Extracting high-yield concepts", "Structuring output", "Adding study actions", "Final polish"];

export function AiGenerationStepper({ active, steps = defaultSteps }: { active: boolean; steps?: string[] }) {
  return (
    <div className="rounded-2xl border bg-primary/5 p-4">
      <div className="mb-3 flex items-center gap-2 text-sm font-semibold">
        <Loader2 className={cn("h-4 w-4 text-primary", active && "animate-spin")} />
        Building your study asset
      </div>
      <div className="space-y-2">
        {steps.map((step, i) => (
          <div key={step} className="flex items-center gap-2 text-xs text-muted-foreground">
            {i < 2 ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" /> : <span className="h-3.5 w-3.5 rounded-full border border-primary/30" />}
            {step}
          </div>
        ))}
      </div>
    </div>
  );
}
