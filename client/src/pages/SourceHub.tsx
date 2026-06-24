import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import {
  AlertTriangle,
  BookOpen,
  Clipboard,
  Database,
  FilePlus2,
  Gavel,
  Loader2,
  Microscope,
  Search,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { useMemo, useState, type ElementType } from "react";

type Field = "all" | "medicine" | "law" | "general";
type Source = "openalex" | "pubmed" | "europepmc" | "arxiv" | "clinicaltrials" | "courtlistener" | "semanticscholar" | "govinfo" | "congress";
type StudyAidKind = "medical" | "law" | "research";

type SearchResult = {
  source: Source;
  externalId: string;
  title: string;
  authors?: string[];
  abstract?: string;
  url?: string;
  publishedDate?: string;
  license?: string;
  licenseConfidence?: "high" | "medium" | "low" | "unknown";
  isOpenAccess?: boolean;
  fullTextUrl?: string;
  contentType: string;
  tags?: string[];
};

const sourceOptions: { value: "" | Source; label: string; field?: Field }[] = [
  { value: "", label: "All free/open sources" },
  { value: "openalex", label: "OpenAlex", field: "general" },
  { value: "pubmed", label: "PubMed", field: "medicine" },
  { value: "europepmc", label: "Europe PMC", field: "medicine" },
  { value: "clinicaltrials", label: "ClinicalTrials.gov", field: "medicine" },
  { value: "semanticscholar", label: "Semantic Scholar", field: "general" },
  { value: "arxiv", label: "arXiv", field: "general" },
  { value: "courtlistener", label: "CourtListener", field: "law" },
  { value: "govinfo", label: "GovInfo", field: "law" },
  { value: "congress", label: "Congress.gov", field: "law" },
];

const fieldOptions: { value: Field; label: string; icon: ElementType }[] = [
  { value: "all", label: "All", icon: Database },
  { value: "medicine", label: "Medical", icon: Microscope },
  { value: "law", label: "Law", icon: Gavel },
  { value: "general", label: "Research", icon: BookOpen },
];

function sourceLabel(source: string) {
  return sourceOptions.find((s) => s.value === source)?.label ?? source;
}

function sourceTone(source: string) {
  if (["pubmed", "europepmc", "clinicaltrials"].includes(source)) return "bg-emerald-500/10 text-emerald-700 border-emerald-500/20";
  if (["courtlistener", "govinfo", "congress"].includes(source)) return "bg-purple-500/10 text-purple-700 border-purple-500/20";
  if (source === "semanticscholar") return "bg-cyan-500/10 text-cyan-700 border-cyan-500/20";
  return "bg-blue-500/10 text-blue-700 border-blue-500/20";
}

function licenseTone(confidence?: string) {
  if (confidence === "high") return "bg-emerald-600 text-white";
  if (confidence === "medium") return "bg-blue-600 text-white";
  if (confidence === "low") return "bg-amber-500 text-white";
  return "bg-muted text-muted-foreground";
}

function licenseLabel(confidence?: string) {
  if (confidence === "high") return "License: high confidence";
  if (confidence === "medium") return "License: medium confidence";
  if (confidence === "low") return "License: low confidence";
  return "License: unknown";
}

export default function SourceHub() {
  const utils = trpc.useUtils();
  const [query, setQuery] = useState("");
  const [field, setField] = useState<Field>("all");
  const [source, setSource] = useState<"" | Source>("");
  const [submitted, setSubmitted] = useState<{ query: string; field: Field; source?: Source; limit: number } | null>(null);
  const [selected, setSelected] = useState<SearchResult | null>(null);
  const [studyAid, setStudyAid] = useState("");
  const [doi, setDoi] = useState("");

  const searchQuery = trpc.sources.search.useQuery(submitted ?? { query: "", field: "all", limit: 12 }, {
    enabled: !!submitted,
  });
  const policyQuery = trpc.sources.policy.useQuery();
  const capabilitiesQuery = trpc.sources.capabilities.useQuery();
  const importedQuery = trpc.sources.imported.useQuery();

  const importMutation = trpc.sources.import.useMutation({
    onSuccess: async () => {
      toast.success("Imported to your Library");
      await Promise.all([utils.documents.list.invalidate(), utils.sources.imported.invalidate()]);
    },
    onError: (err) => toast.error(err.message),
  });

  const importDoiMutation = trpc.sources.importDoi.useMutation({
    onSuccess: async () => {
      toast.success("Open-access DOI source imported to your Library");
      setDoi("");
      await Promise.all([utils.documents.list.invalidate(), utils.sources.imported.invalidate()]);
    },
    onError: (err) => toast.error(err.message),
  });

  const studyAidMutation = trpc.sources.generateStudyAid.useMutation({
    onSuccess: (data) => {
      setStudyAid(data.content);
      toast.success(data.noteId ? "Study aid generated and saved as a note" : "Study aid generated");
      if (data.noteId) utils.notes.list.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  const results = (searchQuery.data?.results ?? []) as SearchResult[];
  const errors = searchQuery.data?.errors ?? [];

  const suggestedKind: StudyAidKind = useMemo(() => {
    if (selected?.source === "courtlistener") return "law";
    if (["pubmed", "europepmc", "clinicaltrials"].includes(selected?.source ?? "")) return "medical";
    return "research";
  }, [selected]);

  const handleSearch = (event: React.FormEvent) => {
    event.preventDefault();
    if (query.trim().length < 2) {
      toast.error("Enter at least 2 characters to search");
      return;
    }
    setStudyAid("");
    setSelected(null);
    setSubmitted({ query: query.trim(), field, source: source || undefined, limit: 12 });
  };

  const handleDoiImport = (event: React.FormEvent) => {
    event.preventDefault();
    const trimmed = doi.trim().replace(/^https?:\/\/doi\.org\//i, "");
    if (!trimmed.startsWith("10.")) {
      toast.error("Enter a valid DOI, e.g. 10.1038/nature12373");
      return;
    }
    importDoiMutation.mutate({ doi: trimmed });
  };

  const copy = async (text: string) => {
    await navigator.clipboard.writeText(text);
    toast.success("Copied");
  };

  return (
    <div className="h-full overflow-y-auto bg-background mobile-page">
      <div className="max-w-7xl mx-auto p-4 md:p-8 space-y-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-3 py-1 text-xs font-semibold text-primary mb-3">
              <ShieldCheck className="w-3.5 h-3.5" /> Legal/open-source academic importer
            </div>
            <h1 className="text-3xl font-bold tracking-tight">Source Hub</h1>
            <p className="text-muted-foreground mt-2 max-w-3xl">
              Search free academic, medical, legal, and research databases. Import public metadata/abstracts and open materials into your Library with citations and provenance.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:flex">
            {(importedQuery.data?.length ?? 0) > 0 && (
              <div className="rounded-xl border bg-card px-4 py-2 text-sm">
                <span className="font-semibold">{importedQuery.data?.length}</span> imported sources
              </div>
            )}
          </div>
        </div>

        <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-4">
          <div className="flex gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div className="space-y-2 text-sm">
              <p className="font-semibold text-foreground">Copyright-safe by design</p>
              <p className="text-muted-foreground">
                {policyQuery.data?.summary ?? "Only import public/open materials. Do not scrape or store commercial question banks."}
              </p>
              <p className="text-muted-foreground">
                UWorld, NBME, AMBOSS, BARBRI/Themis-style content should be generated as original practice questions only — never copied or represented as official vendor content.
              </p>
            </div>
          </div>
        </div>

        <form onSubmit={handleSearch} className="rounded-2xl border bg-card p-4 md:p-5 shadow-sm space-y-4">
          <div className="flex flex-col gap-3 lg:flex-row">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search: myocardial infarction, Chevron deference, transformer attention..."
                className="pl-9 h-11"
              />
            </div>
            <select
              value={source}
              onChange={(e) => setSource(e.target.value as "" | Source)}
              className="h-11 rounded-md border border-input bg-background px-3 text-sm"
            >
              {sourceOptions.map((option) => <option key={option.value || "all"} value={option.value}>{option.label}</option>)}
            </select>
            <Button type="submit" className="h-11" disabled={searchQuery.isFetching}>
              {searchQuery.isFetching ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Search className="w-4 h-4 mr-2" />}
              Search
            </Button>
          </div>

          <div className="flex flex-wrap gap-2">
            {fieldOptions.map((option) => {
              const Icon = option.icon;
              const active = field === option.value;
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setField(option.value)}
                  className={cn(
                    "inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm transition-colors",
                    active ? "border-primary bg-primary text-primary-foreground" : "border-border hover:bg-muted"
                  )}
                >
                  <Icon className="w-4 h-4" /> {option.label}
                </button>
              );
            })}
          </div>
        </form>

        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_420px]">
          <form onSubmit={handleDoiImport} className="rounded-2xl border bg-card p-4 shadow-sm space-y-3">
            <div className="flex items-center gap-2">
              <FilePlus2 className="w-4 h-4 text-primary" />
              <p className="font-semibold">Import open-access paper by DOI</p>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Input value={doi} onChange={(e) => setDoi(e.target.value)} placeholder="10.xxxx/xxxxx or https://doi.org/10.xxxx/xxxxx" />
              <Button type="submit" disabled={importDoiMutation.isPending}>
                {importDoiMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <FilePlus2 className="w-4 h-4 mr-2" />}
                Fetch OA
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">Uses Unpaywall-style DOI resolution to find lawful open-access locations. Paywalled/unclear full text is not copied.</p>
          </form>

          <div className="rounded-2xl border bg-card p-4 shadow-sm">
            <p className="font-semibold mb-2">Source status</p>
            <div className="flex flex-wrap gap-2">
              {capabilitiesQuery.data?.map((cap) => (
                <Badge key={cap.id} variant={cap.configured ? "secondary" : "outline"} className={cn(!cap.configured && "border-amber-500/40 text-amber-700")}>
                  {cap.label}{cap.requiresApiKey && !cap.configured ? " · needs free key" : ""}
                </Badge>
              ))}
            </div>
          </div>
        </div>

        {errors.length > 0 && (
          <div className="rounded-xl border border-destructive/20 bg-destructive/5 p-3 text-sm text-muted-foreground">
            Some sources failed: {errors.map((e) => `${e.source}: ${e.message}`).join(" · ")}
          </div>
        )}

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
          <div className="space-y-3">
            {searchQuery.isFetching && (
              <div className="rounded-2xl border bg-card p-8 text-center text-muted-foreground">
                <Loader2 className="w-6 h-6 animate-spin mx-auto mb-3" /> Searching public academic sources...
              </div>
            )}

            {!searchQuery.isFetching && submitted && results.length === 0 && (
              <div className="rounded-2xl border bg-card p-8 text-center text-muted-foreground">
                No results found. Try a broader query or another source.
              </div>
            )}

            {results.map((item) => (
              <button
                key={`${item.source}-${item.externalId}`}
                onClick={() => { setSelected(item); setStudyAid(""); }}
                className={cn(
                  "w-full text-left rounded-2xl border bg-card p-4 shadow-sm transition-all hover:border-primary/40 hover:shadow-md",
                  selected?.source === item.source && selected?.externalId === item.externalId && "border-primary ring-2 ring-primary/10"
                )}
              >
                <div className="flex flex-wrap items-center gap-2 mb-2">
                  <Badge variant="outline" className={sourceTone(item.source)}>{sourceLabel(item.source)}</Badge>
                  <Badge variant="secondary">{item.contentType}</Badge>
                  {item.isOpenAccess && <Badge className="bg-emerald-600">Open access</Badge>}
                  {item.fullTextUrl && <Badge className="bg-teal-600">Full-text link</Badge>}
                  <Badge className={licenseTone(item.licenseConfidence)}>{licenseLabel(item.licenseConfidence)}</Badge>
                  {item.publishedDate && <span className="text-xs text-muted-foreground">{item.publishedDate}</span>}
                </div>
                <h2 className="font-semibold leading-snug">{item.title}</h2>
                {item.authors?.length ? <p className="text-xs text-muted-foreground mt-1 truncate">{item.authors.slice(0, 4).join(", ")}{item.authors.length > 4 ? " et al." : ""}</p> : null}
                {item.abstract && <p className="text-sm text-muted-foreground mt-3 line-clamp-3">{item.abstract}</p>}
                <div className="flex flex-wrap gap-1.5 mt-3">
                  {item.tags?.slice(0, 5).map((tag) => <span key={tag} className="rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">{tag}</span>)}
                </div>
              </button>
            ))}
          </div>

          <aside className="xl:sticky xl:top-6 h-fit rounded-2xl border bg-card p-4 shadow-sm">
            {!selected ? (
              <div className="py-10 text-center text-muted-foreground">
                <Database className="w-10 h-10 mx-auto mb-3 opacity-30" />
                <p className="font-medium text-foreground">Select a result</p>
                <p className="text-sm mt-1">Import sources, generate original practice questions, and save citations.</p>
              </div>
            ) : (
              <div className="space-y-4">
                <div>
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="outline" className={sourceTone(selected.source)}>{sourceLabel(selected.source)}</Badge>
                    <Badge className={licenseTone(selected.licenseConfidence)}>{licenseLabel(selected.licenseConfidence)}</Badge>
                    {selected.fullTextUrl && <Badge className="bg-teal-600">OA full-text link</Badge>}
                  </div>
                  <h3 className="font-bold text-lg mt-3 leading-tight">{selected.title}</h3>
                  {selected.url && <a className="text-sm text-primary hover:underline break-all" href={selected.url} target="_blank" rel="noreferrer">Open original source</a>}
                </div>

                {selected.licenseConfidence !== "high" && (
                  <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-3 text-xs text-muted-foreground">
                    License confidence is {selected.licenseConfidence ?? "unknown"}. Import stores metadata/abstract/citation and avoids copying paywalled or unclear-license full text.
                  </div>
                )}

                <div className="grid grid-cols-2 gap-2">
                  <Button
                    onClick={() => importMutation.mutate({ source: selected.source, externalId: selected.externalId })}
                    disabled={importMutation.isPending}
                  >
                    {importMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <FilePlus2 className="w-4 h-4 mr-2" />}
                    Import
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => selected.url && copy(`${selected.title}\n${selected.url}`)}
                    disabled={!selected.url}
                  >
                    <Clipboard className="w-4 h-4 mr-2" /> Cite
                  </Button>
                </div>

                <div className="rounded-xl border bg-muted/30 p-3 space-y-3">
                  <p className="text-sm font-semibold flex items-center gap-2"><Sparkles className="w-4 h-4 text-primary" /> Generate original study aid</p>
                  <div className="grid grid-cols-3 gap-2">
                    {(["medical", "law", "research"] as StudyAidKind[]).map((kind) => (
                      <Button
                        key={kind}
                        variant={suggestedKind === kind ? "default" : "outline"}
                        size="sm"
                        onClick={() => studyAidMutation.mutate({ source: selected.source, externalId: selected.externalId, kind, saveAsNote: false })}
                        disabled={studyAidMutation.isPending}
                      >
                        {kind === "medical" ? "USMLE" : kind === "law" ? "Law" : "Research"}
                      </Button>
                    ))}
                  </div>
                  <Button
                    variant="secondary"
                    className="w-full"
                    onClick={() => studyAidMutation.mutate({ source: selected.source, externalId: selected.externalId, kind: suggestedKind, saveAsNote: true })}
                    disabled={studyAidMutation.isPending}
                  >
                    {studyAidMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Sparkles className="w-4 h-4 mr-2" />}
                    Generate + save note
                  </Button>
                  <p className="text-xs text-muted-foreground">Practice questions are original “style” questions, not copied UWorld/NBME/bar-prep content.</p>
                </div>

                {selected.abstract && (
                  <div>
                    <p className="text-sm font-semibold mb-1">Abstract / summary</p>
                    <p className="text-sm text-muted-foreground max-h-40 overflow-y-auto pr-1">{selected.abstract}</p>
                  </div>
                )}

                {studyAid && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-semibold">Generated study aid</p>
                      <Button variant="ghost" size="sm" onClick={() => copy(studyAid)}>Copy</Button>
                    </div>
                    <Textarea value={studyAid} readOnly className="min-h-[260px] text-xs" />
                  </div>
                )}
              </div>
            )}
          </aside>
        </div>
      </div>
    </div>
  );
}
