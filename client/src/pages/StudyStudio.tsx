import { useMemo, useState, type ElementType } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { Streamdown } from "streamdown";
import { cn } from "@/lib/utils";
import {
  BookOpen,
  Brain,
  CheckCircle2,
  ClipboardList,
  Copy,
  FileText,
  GraduationCap,
  Layers3,
  LibraryBig,
  Loader2,
  ListChecks,
  NotebookTabs,
  PanelRightOpen,
  Route,
  SearchCheck,
  ShieldCheck,
  Sparkles,
  Target,
  Wand2,
} from "lucide-react";

type TemplateId = "key_points" | "cornell" | "exam_review" | "practice_quiz" | "study_guide" | "glossary" | "concept_outline" | "weak_spots";
type Depth = "concise" | "standard" | "deep";

const TEMPLATES: Array<{
  id: TemplateId;
  title: string;
  eyebrow: string;
  description: string;
  icon: ElementType;
  accent: string;
  bestFor: string[];
}> = [
  {
    id: "exam_review",
    title: "Exam Review Sheet",
    eyebrow: "Exam prep",
    description: "High-yield concepts, likely question angles, common traps, and final cram checklist.",
    icon: GraduationCap,
    accent: "from-indigo-500/20 to-blue-500/5 border-indigo-500/25",
    bestFor: ["Midterms", "Finals", "Board-style review"],
  },
  {
    id: "practice_quiz",
    title: "Practice Quiz Builder",
    eyebrow: "Exam prep",
    description: "Original mixed-difficulty questions with answer explanations and wrong-answer reasoning.",
    icon: ListChecks,
    accent: "from-emerald-500/20 to-teal-500/5 border-emerald-500/25",
    bestFor: ["Self-testing", "MCQ practice", "Weakness discovery"],
  },
  {
    id: "weak_spots",
    title: "Weak-Spot Diagnostic",
    eyebrow: "Exam prep",
    description: "Find likely misunderstanding zones and generate targeted corrective drills.",
    icon: Target,
    accent: "from-rose-500/20 to-red-500/5 border-rose-500/25",
    bestFor: ["Remediation", "Hard topics", "Test readiness"],
  },
  {
    id: "key_points",
    title: "Advanced Key Points",
    eyebrow: "Academic notes",
    description: "Theme-grouped insights with why-it-matters, evidence snippets, and misconception warnings.",
    icon: Sparkles,
    accent: "from-amber-500/20 to-orange-500/5 border-amber-500/25",
    bestFor: ["Fast review", "Lecture extraction", "High-yield notes"],
  },
  {
    id: "cornell",
    title: "Premium Cornell Notes",
    eyebrow: "Academic notes",
    description: "Cue column, deep notes, synthesis, memory hooks, exam angles, and self-test questions.",
    icon: NotebookTabs,
    accent: "from-violet-500/20 to-purple-500/5 border-violet-500/25",
    bestFor: ["Class notes", "Lectures", "Textbook chapters"],
  },
  {
    id: "study_guide",
    title: "Full Study Guide",
    eyebrow: "Academic notes",
    description: "Learning objectives, topic hierarchy, examples, tables, practice tasks, and study plan.",
    icon: ClipboardList,
    accent: "from-cyan-500/20 to-sky-500/5 border-cyan-500/25",
    bestFor: ["Unit review", "Course modules", "Long documents"],
  },
  {
    id: "concept_outline",
    title: "Concept Outline",
    eyebrow: "Academic notes",
    description: "Structured hierarchy, dependencies, relationships, comparison tables, and learning path.",
    icon: Route,
    accent: "from-blue-500/20 to-indigo-500/5 border-blue-500/25",
    bestFor: ["Complex topics", "Concept maps", "Sequencing"],
  },
  {
    id: "glossary",
    title: "Smart Glossary",
    eyebrow: "Academic notes",
    description: "Definitions, plain-English explanations, related terms, and quick recall checks.",
    icon: BookOpen,
    accent: "from-lime-500/20 to-green-500/5 border-lime-500/25",
    bestFor: ["New subjects", "Vocabulary", "Technical docs"],
  },
];

export default function StudyStudio() {
  const { data: docs = [], isLoading: docsLoading } = trpc.documents.list.useQuery();
  const utils = trpc.useUtils();
  const [selectedDocIds, setSelectedDocIds] = useState<number[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<TemplateId>("exam_review");
  const [depth, setDepth] = useState<Depth>("deep");
  const [examType, setExamType] = useState("");
  const [instructions, setInstructions] = useState("");
  const [output, setOutput] = useState("");
  const [copied, setCopied] = useState(false);

  const selectedDocs = useMemo(() => docs.filter((doc) => selectedDocIds.includes(doc.id)), [docs, selectedDocIds]);
  const selectedWords = selectedDocs.reduce((sum, doc) => sum + (doc.wordCount ?? 0), 0);
  const template = TEMPLATES.find((item) => item.id === selectedTemplate)!;

  const createNote = trpc.notes.create.useMutation({
    onSuccess: () => {
      utils.notes.list.invalidate();
      toast.success("Saved to Notes");
    },
    onError: (err) => toast.error(err.message),
  });

  const generate = trpc.ai.generateStudyTemplate.useMutation({
    onSuccess: (data) => setOutput(data.content),
    onError: (err) => toast.error(err.message),
  });

  const toggleDoc = (id: number) => {
    setSelectedDocIds((prev) => prev.includes(id) ? prev.filter((docId) => docId !== id) : [...prev, id]);
  };

  const handleGenerate = () => {
    if (selectedDocIds.length === 0) {
      toast.error("Select at least one source document");
      return;
    }
    setOutput("");
    generate.mutate({
      documentIds: selectedDocIds,
      template: selectedTemplate,
      depth,
      examType: examType.trim() || undefined,
      instructions: instructions.trim() || undefined,
    });
  };

  const copyOutput = async () => {
    await navigator.clipboard.writeText(output);
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  };

  return (
    <div className="h-full overflow-y-auto bg-background">
      <div className="max-w-7xl mx-auto p-4 md:p-6 space-y-5">
        <div className="relative overflow-hidden rounded-3xl border bg-card p-6 md:p-8 shadow-sm">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/12 via-transparent to-transparent pointer-events-none" />
          <div className="relative flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-3 py-1 text-xs font-semibold text-primary mb-3">
                <Wand2 className="w-3.5 h-3.5" /> Advanced Study Studio
              </div>
              <h1 className="text-3xl font-bold tracking-tight font-serif">AI Study Tools, redesigned</h1>
              <p className="text-muted-foreground mt-2 max-w-2xl">
                Choose documents, pick an academic template, set the depth, and generate polished exam-prep or note-taking materials that look and read like a real study product.
              </p>
            </div>
            <div className="grid grid-cols-3 gap-2 min-w-[280px]">
              <div className="rounded-2xl border bg-background/70 p-3">
                <LibraryBig className="w-4 h-4 text-primary mb-1" />
                <p className="text-xl font-bold">{selectedDocs.length}</p>
                <p className="text-[11px] text-muted-foreground">docs selected</p>
              </div>
              <div className="rounded-2xl border bg-background/70 p-3">
                <Layers3 className="w-4 h-4 text-primary mb-1" />
                <p className="text-xl font-bold">{selectedWords.toLocaleString()}</p>
                <p className="text-[11px] text-muted-foreground">source words</p>
              </div>
              <div className="rounded-2xl border bg-background/70 p-3">
                <ShieldCheck className="w-4 h-4 text-primary mb-1" />
                <p className="text-xl font-bold">8</p>
                <p className="text-[11px] text-muted-foreground">templates</p>
              </div>
            </div>
          </div>
        </div>

        <div className="grid gap-5 xl:grid-cols-[310px_minmax(0,1fr)_380px]">
          <aside className="space-y-4">
            <div className="rounded-2xl border bg-card p-4 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h2 className="font-semibold flex items-center gap-2"><FileText className="w-4 h-4 text-primary" /> Source documents</h2>
                  <p className="text-xs text-muted-foreground">Select up to 8 docs</p>
                </div>
                {selectedDocIds.length > 0 && <Button variant="ghost" size="sm" onClick={() => setSelectedDocIds([])}>Clear</Button>}
              </div>
              <div className="space-y-2 max-h-[460px] overflow-y-auto pr-1">
                {docsLoading ? [1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-14 rounded-xl" />) : docs.map((doc) => {
                  const active = selectedDocIds.includes(doc.id);
                  return (
                    <button
                      key={doc.id}
                      onClick={() => toggleDoc(doc.id)}
                      disabled={!doc.extractedText || (!active && selectedDocIds.length >= 8)}
                      className={cn(
                        "w-full rounded-xl border p-3 text-left transition-all disabled:opacity-50 disabled:cursor-not-allowed",
                        active ? "border-primary bg-primary/5 ring-2 ring-primary/10" : "hover:bg-muted/50"
                      )}
                    >
                      <div className="flex items-start gap-2">
                        <div className={cn("mt-0.5 w-4 h-4 rounded border flex items-center justify-center", active ? "bg-primary border-primary" : "border-muted-foreground/30")}>{active && <CheckCircle2 className="w-3 h-3 text-primary-foreground" />}</div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium truncate">{doc.originalName}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">{doc.wordCount?.toLocaleString() ?? 0} words</p>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </aside>

          <main className="space-y-4">
            <div className="rounded-2xl border bg-card p-4 shadow-sm">
              <div className="flex items-center justify-between gap-3 flex-wrap mb-4">
                <div>
                  <h2 className="font-semibold flex items-center gap-2"><Brain className="w-4 h-4 text-primary" /> Template gallery</h2>
                  <p className="text-xs text-muted-foreground">Exam prep + academic note templates inspired by modern LMS dashboard patterns.</p>
                </div>
                <div className="flex gap-2">
                  <Select value={depth} onValueChange={(v: Depth) => setDepth(v)}>
                    <SelectTrigger className="w-32 h-9"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="concise">Concise</SelectItem>
                      <SelectItem value="standard">Standard</SelectItem>
                      <SelectItem value="deep">Deep</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                {TEMPLATES.map((item) => {
                  const Icon = item.icon;
                  const active = selectedTemplate === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => setSelectedTemplate(item.id)}
                      className={cn(
                        "relative overflow-hidden rounded-2xl border p-4 text-left transition-all hover:-translate-y-0.5 hover:shadow-md",
                        active ? "border-primary ring-2 ring-primary/15" : "border-border"
                      )}
                    >
                      <div className={cn("absolute inset-0 bg-gradient-to-br", item.accent)} />
                      <div className="relative">
                        <div className="flex items-start justify-between gap-3">
                          <div className="w-10 h-10 rounded-xl bg-background/80 border flex items-center justify-center"><Icon className="w-5 h-5 text-primary" /></div>
                          <Badge variant="secondary" className="text-[10px]">{item.eyebrow}</Badge>
                        </div>
                        <h3 className="font-semibold mt-3">{item.title}</h3>
                        <p className="text-sm text-muted-foreground mt-1 min-h-[40px]">{item.description}</p>
                        <div className="flex flex-wrap gap-1.5 mt-3">
                          {item.bestFor.map((tag) => <span key={tag} className="rounded-full bg-background/70 border px-2 py-0.5 text-[10px] text-muted-foreground">{tag}</span>)}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="rounded-2xl border bg-card p-4 shadow-sm space-y-3">
              <div>
                <h2 className="font-semibold flex items-center gap-2"><PanelRightOpen className="w-4 h-4 text-primary" /> Generation controls</h2>
                <p className="text-xs text-muted-foreground">Give the AI context so the output feels tailored, not generic.</p>
              </div>
              <input
                value={examType}
                onChange={(e) => setExamType(e.target.value)}
                placeholder="Optional context: SQL final, USMLE Step 1, AP Bio, law exam, midterm..."
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
              />
              <Textarea
                value={instructions}
                onChange={(e) => setInstructions(e.target.value)}
                placeholder="Optional instructions: focus on joins/window functions, make it beginner-friendly, include tables, emphasize likely exam traps..."
                className="min-h-[90px]"
              />
              <Button onClick={handleGenerate} disabled={selectedDocIds.length === 0 || generate.isPending} className="w-full gap-2 h-11">
                {generate.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                Generate {template.title}
              </Button>
            </div>
          </main>

          <aside className="xl:sticky xl:top-5 h-fit rounded-2xl border bg-card shadow-sm overflow-hidden">
            <div className="p-4 border-b bg-muted/20 flex items-center justify-between gap-2">
              <div>
                <p className="font-semibold">Output Preview</p>
                <p className="text-xs text-muted-foreground">{template.title} · {depth} depth</p>
              </div>
              {output && (
                <div className="flex gap-1">
                  <Button variant="ghost" size="sm" onClick={copyOutput} className="gap-1.5">{copied ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />} Copy</Button>
                  <Button variant="ghost" size="sm" onClick={() => createNote.mutate({ title: template.title, content: output })}>Save</Button>
                </div>
              )}
            </div>
            <div className="p-4 max-h-[720px] overflow-y-auto">
              {generate.isPending ? (
                <div className="space-y-3">
                  <div className="rounded-2xl border bg-primary/5 p-4 text-sm text-muted-foreground flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin text-primary" /> Building advanced study material...</div>
                  {[1, 2, 3, 4, 5, 6].map((i) => <Skeleton key={i} className="h-5 w-full" />)}
                </div>
              ) : output ? (
                <div className="streamdown-content text-sm"><Streamdown>{output}</Streamdown></div>
              ) : (
                <div className="py-16 text-center text-muted-foreground">
                  <SearchCheck className="w-12 h-12 mx-auto mb-4 opacity-25" />
                  <p className="font-medium text-foreground">No output yet</p>
                  <p className="text-sm mt-1">Select documents, choose a template, then generate a polished study artifact.</p>
                </div>
              )}
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
