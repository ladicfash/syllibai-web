import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Copy, Download, FileText, Save, Sparkles } from "lucide-react";

export function OutputAssetHeader({
  title,
  subtitle,
  sources,
  copied,
  onCopy,
  onSave,
  onDownload,
  onFlashcards,
  flashcardsPending,
}: {
  title: string;
  subtitle?: string;
  sources?: string[];
  copied?: boolean;
  onCopy?: () => void;
  onSave?: () => void;
  onDownload?: () => void;
  onFlashcards?: () => void;
  flashcardsPending?: boolean;
}) {
  return (
    <div className="border-b bg-muted/20 p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="font-semibold flex items-center gap-2"><FileText className="h-4 w-4 text-primary" /> {title}</p>
          {subtitle && <p className="mt-0.5 text-xs text-muted-foreground">{subtitle}</p>}
          {!!sources?.length && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {sources.slice(0, 4).map((source) => <Badge key={source} variant="secondary" className="max-w-[180px] truncate text-[10px]">{source}</Badge>)}
              {sources.length > 4 && <Badge variant="outline" className="text-[10px]">+{sources.length - 4} more</Badge>}
            </div>
          )}
        </div>
        <div className="flex flex-wrap gap-1">
          {onCopy && <Button variant="ghost" size="sm" onClick={onCopy} className="gap-1.5">{copied ? <CheckCircle2 className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />} Copy</Button>}
          {onSave && <Button variant="ghost" size="sm" onClick={onSave} className="gap-1.5"><Save className="h-3.5 w-3.5" /> Save</Button>}
          {onDownload && <Button variant="ghost" size="sm" onClick={onDownload} className="gap-1.5"><Download className="h-3.5 w-3.5" /> MD</Button>}
          {onFlashcards && <Button variant="secondary" size="sm" onClick={onFlashcards} className="gap-1.5" disabled={flashcardsPending}><Sparkles className="h-3.5 w-3.5" /> Cards</Button>}
        </div>
      </div>
    </div>
  );
}
