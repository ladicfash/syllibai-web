import { useState, useEffect, useRef, useCallback } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { useSearch } from "wouter";
import {
  Brain, FileText, GitBranch, Clock3, Workflow, Sparkles,
  Volume2, VolumeX, Loader2, RefreshCw, Copy, CheckCheck,
  ChevronLeft, ChevronRight, RotateCcw, BookOpen, Zap,
  BookmarkPlus, FolderOpen, MessageCircle, ClipboardList
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { MarkdownView } from "@/components/MarkdownView";
import { cn } from "@/lib/utils";
import { AIChatBox, type Message } from "@/components/AIChatBox";

declare global {
  interface Window { mermaid: any; }
}

// ── Mermaid Renderer ──────────────────────────────────────────────────────
function MermaidDiagram({ code, className }: { code: string; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [rendered, setRendered] = useState(false);

  useEffect(() => {
    if (!code || !ref.current) return;
    setError(null);
    setRendered(false);
    const id = `mermaid-${Math.random().toString(36).slice(2)}`;
    const clean = code.replace(/```mermaid\n?/g, "").replace(/```\n?/g, "").trim();
    if (typeof window.mermaid === "undefined") {
      setError("Mermaid.js not loaded");
      return;
    }
    window.mermaid.initialize({ startOnLoad: false, theme: document.documentElement.classList.contains("dark") ? "dark" : "default", fontFamily: "Inter, sans-serif", fontSize: 14 });
    window.mermaid.render(id, clean).then(({ svg }: { svg: string }) => {
      if (ref.current) {
        ref.current.innerHTML = svg;
        setRendered(true);
      }
    }).catch((err: any) => {
      setError(`Diagram error: ${err.message ?? "Invalid syntax"}`);
    });
  }, [code]);

  if (error) return (
    <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
      {error}
    </div>
  );

  return (
    <div ref={ref} className={cn("mermaid-container overflow-x-auto rounded-xl bg-muted/30 p-4 min-h-[200px] flex items-center justify-center", className, !rendered && "shimmer")} />
  );
}

// ── Flashcard Flip ────────────────────────────────────────────────────────
function FlashcardView({ cards, deckId, difficulty = "intermediate" }: { cards: any[]; deckId: number; difficulty?: "beginner" | "intermediate" | "advanced" }) {
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [known, setKnown] = useState<Set<number>>(new Set());
  const [needsWork, setNeedsWork] = useState<Set<number>>(new Set());
  const [regeneratingId, setRegeneratingId] = useState<number | null>(null);
  const utils = trpc.useUtils();
  const saveResult = trpc.decks.saveQuizResult.useMutation();
  const regenerateCard = trpc.decks.regenerateCard.useMutation({
    onSuccess: async () => {
      await utils.decks.cards.invalidate({ deckId });
      toast.success("Card regenerated");
    },
    onError: (err) => toast.error(err.message),
    onSettled: () => setRegeneratingId(null),
  });

  const card = cards[index];
  const progress = ((known.size + needsWork.size) / cards.length) * 100;
  const isComplete = known.size + needsWork.size === cards.length;

  const next = () => { setFlipped(false); setTimeout(() => setIndex((i) => Math.min(i + 1, cards.length - 1)), 150); };
  const prev = () => { setFlipped(false); setTimeout(() => setIndex((i) => Math.max(i - 1, 0)), 150); };

  const markKnown = () => {
    setKnown((prev) => { const s = new Set(Array.from(prev)); s.add(card.id); return s; });
    setNeedsWork((prev) => { const s = new Set(Array.from(prev)); s.delete(card.id); return s; });
    if (index < cards.length - 1) next();
  };

  const markNeedsWork = () => {
    setNeedsWork((prev) => { const s = new Set(Array.from(prev)); s.add(card.id); return s; });
    setKnown((prev) => { const s = new Set(Array.from(prev)); s.delete(card.id); return s; });
    if (index < cards.length - 1) next();
  };

  const handleFinish = async () => {
    const score = Math.round((known.size / cards.length) * 100);
    await saveResult.mutateAsync({
      deckId,
      totalCards: cards.length,
      knownCount: known.size,
      needsWorkCount: needsWork.size,
      scorePercent: score,
    });
    toast.success(`Session complete! Score: ${score}%`);
  };

  const handleRegenerate = (feedback: string) => {
    setRegeneratingId(card.id);
    regenerateCard.mutate({ cardId: card.id, feedback, difficulty });
  };

  if (!card) return null;

  return (
    <div className="space-y-6">
      {/* Progress */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Card {index + 1} of {cards.length}</span>
          <div className="flex gap-3 text-xs">
            <span className="text-emerald-600 font-medium">✓ {known.size} known</span>
            <span className="text-amber-600 font-medium">↺ {needsWork.size} review</span>
          </div>
        </div>
        <div className="h-2 bg-muted rounded-full overflow-hidden">
          <div className="h-full bg-gradient-to-r from-emerald-500 to-primary rounded-full transition-all duration-500" style={{ width: `${progress}%` }} />
        </div>
      </div>

      {/* Flip Card */}
      <div className="flip-card h-64 cursor-pointer" onClick={() => setFlipped(!flipped)}>
        <div className={cn("flip-card-inner w-full h-full", flipped && "flipped")}>
          {/* Front */}
          <div className="flip-card-front study-card flex flex-col items-center justify-center p-8 text-center">
            <Badge variant="secondary" className="mb-4 text-xs">Question</Badge>
            <p className="text-lg font-medium leading-relaxed">{card.question}</p>
            <p className="text-xs text-muted-foreground mt-4">Click to reveal answer</p>
          </div>
          {/* Back */}
          <div className="flip-card-back study-card flex flex-col items-center justify-center p-8 text-center bg-primary/5 border-primary/20">
            <Badge className="mb-4 text-xs">Answer</Badge>
            <p className="text-base leading-relaxed">{card.answer}</p>
            <div className="mt-5 flex flex-wrap justify-center gap-2" onClick={(e) => e.stopPropagation()}>
              <Button size="sm" variant="outline" className="h-7 text-xs gap-1" disabled={regeneratingId === card.id} onClick={() => handleRegenerate("Make this card clearer and more precise.")}>
                {regeneratingId === card.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />} Regenerate
              </Button>
              <Button size="sm" variant="ghost" className="h-7 text-xs" disabled={regeneratingId === card.id} onClick={() => handleRegenerate("This card is too easy. Make it more challenging.")}>Too easy</Button>
              <Button size="sm" variant="ghost" className="h-7 text-xs" disabled={regeneratingId === card.id} onClick={() => handleRegenerate("This card is too vague. Make it more specific.")}>Too vague</Button>
            </div>
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="flex items-center justify-between gap-3">
        <Button variant="outline" size="sm" onClick={prev} disabled={index === 0} className="gap-1">
          <ChevronLeft className="w-4 h-4" /> Prev
        </Button>

        {flipped && (
          <div className="flex gap-2 flex-1 justify-center">
            <Button variant="outline" size="sm" onClick={markNeedsWork} className="gap-1.5 border-amber-300 text-amber-700 hover:bg-amber-50 dark:border-amber-700 dark:text-amber-400">
              <RotateCcw className="w-3.5 h-3.5" /> Review Later
            </Button>
            <Button size="sm" onClick={markKnown} className="gap-1.5 bg-emerald-600 hover:bg-emerald-700">
              <CheckCheck className="w-3.5 h-3.5" /> Got It
            </Button>
          </div>
        )}

        <Button variant="outline" size="sm" onClick={next} disabled={index === cards.length - 1} className="gap-1">
          Next <ChevronRight className="w-4 h-4" />
        </Button>
      </div>

      {isComplete && (
        <div className="study-card p-4 bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800 text-center animate-scale-in">
          <p className="font-semibold text-emerald-700 dark:text-emerald-400 mb-2">
            Session Complete — Score: {Math.round((known.size / cards.length) * 100)}%
          </p>
          <Button size="sm" onClick={handleFinish} className="gap-1.5">
            <Zap className="w-3.5 h-3.5" /> Save & Continue
          </Button>
        </div>
      )}
    </div>
  );
}

// ── TTS Controls ──────────────────────────────────────────────────────────
function TTSButton({ text }: { text: string }) {
  const [speaking, setSpeaking] = useState(false);
  const utterRef = useRef<SpeechSynthesisUtterance | null>(null);

  const toggle = () => {
    if (speaking) {
      window.speechSynthesis.cancel();
      setSpeaking(false);
    } else {
      const utter = new SpeechSynthesisUtterance(text.replace(/[#*`]/g, ""));
      utter.rate = 0.95;
      utter.onend = () => setSpeaking(false);
      utterRef.current = utter;
      window.speechSynthesis.speak(utter);
      setSpeaking(true);
    }
  };

  return (
    <Button variant="outline" size="sm" onClick={toggle} className="gap-1.5">
      {speaking ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
      {speaking ? "Stop" : "Read Aloud"}
    </Button>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────
export default function StudyTools() {
  const search = useSearch();
  const params = new URLSearchParams(search);
  const preselectedDocId = params.get("doc") ? parseInt(params.get("doc")!) : undefined;
  const preselectedTab = params.get("tab") || "flashcards";

  const [selectedDocId, setSelectedDocId] = useState<number | undefined>(preselectedDocId);
  const [selectedDocIds, setSelectedDocIds] = useState<number[]>(preselectedDocId ? [preselectedDocId] : []);
  const [difficulty, setDifficulty] = useState<"beginner" | "intermediate" | "advanced">("intermediate");
  const [cardStyle, setCardStyle] = useState<"recall" | "application" | "exam">("application");
  const [cardCount, setCardCount] = useState(12);
  const [activeTab, setActiveTab] = useState(preselectedTab);
  const [copied, setCopied] = useState(false);
  const [chatMessages, setChatMessages] = useState<Message[]>([]);

  const { data: docs } = trpc.documents.list.useQuery();
  const { data: decks, refetch: refetchDecks } = trpc.decks.list.useQuery();
  const selectedDoc = docs?.find((d) => d.id === selectedDocId);
  const latestDeck = decks?.[0];
  const { data: deckCards } = trpc.decks.cards.useQuery(
    { deckId: latestDeck?.id ?? 0 },
    { enabled: !!latestDeck }
  );

  // AI mutations
  const flashcardsMut = trpc.ai.generateFlashcards.useMutation({ onSuccess: () => refetchDecks() });
  const cornellMut = trpc.ai.generateCornellNotes.useMutation();
  const mindMapMut = trpc.ai.generateMindMap.useMutation();
  const timelineMut = trpc.ai.generateTimeline.useMutation();
  const flowchartMut = trpc.ai.generateFlowchart.useMutation();
  const keyPointsMut = trpc.ai.generateKeyPoints.useMutation();
  const studyPlanMut = trpc.ai.generateStudyPlan.useMutation();
  const chatMut = trpc.ai.chatWithDocuments.useMutation();

  const [cornellContent, setCornellContent] = useState("");
  const [mindMapCode, setMindMapCode] = useState("");
  const [timelineCode, setTimelineCode] = useState("");
  const [flowchartCode, setFlowchartCode] = useState("");
  const [keyPointsContent, setKeyPointsContent] = useState("");
  const [studyPlanContent, setStudyPlanContent] = useState("");

  // Save to Notes
  const { data: folders = [] } = trpc.folders.list.useQuery();
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [saveContent, setSaveContent] = useState("");
  const [saveTitle, setSaveTitle] = useState("");
  const [saveFolderId, setSaveFolderId] = useState<number | "">("");
  const createNote = trpc.notes.create.useMutation({
    onSuccess: () => {
      setShowSaveDialog(false);
      toast.success("Saved to Notes!");
    },
  });

  const openSaveDialog = (title: string, content: string) => {
    setSaveTitle(title);
    setSaveContent(content);
    setSaveFolderId("");
    setShowSaveDialog(true);
  };

  const getDocText = () => selectedDoc?.extractedText ?? "";
  const activeDocumentIds = selectedDocIds.length > 0 ? selectedDocIds : selectedDocId ? [selectedDocId] : [];
  const hasSelectedText = activeDocumentIds.some((id) => docs?.find((d) => d.id === id)?.extractedText);

  const toggleDocument = (id: number) => {
    setSelectedDocIds((prev) => prev.includes(id) ? prev.filter((docId) => docId !== id) : [...prev, id]);
    setSelectedDocId(id);
  };

  const runAI = async (tab: string) => {
    if ((tab === "flashcards" || tab === "studyplan") && activeDocumentIds.length > 0) {
      if (!hasSelectedText) {
        toast.error("Please select at least one document with extracted text");
        return;
      }
    } else if (!selectedDocId || !getDocText()) {
      toast.error("Please select a document with extracted text first");
      return;
    }
    const text = getDocText().slice(0, 7500);
    try {
      switch (tab) {
        case "flashcards":
          await flashcardsMut.mutateAsync({ documentIds: activeDocumentIds, difficulty, style: cardStyle, count: cardCount });
          toast.success("Flashcards generated!");
          break;
        case "cornell":
          const cn = await cornellMut.mutateAsync({ documentId: selectedDocId!, text });
          setCornellContent(cn.content);
          break;
        case "mindmap":
          const mm = await mindMapMut.mutateAsync({ documentId: selectedDocId!, text });
          setMindMapCode(mm.content);
          break;
        case "timeline":
          const tl = await timelineMut.mutateAsync({ documentId: selectedDocId!, text });
          setTimelineCode(tl.content);
          break;
        case "flowchart":
          const fc = await flowchartMut.mutateAsync({ documentId: selectedDocId!, text });
          setFlowchartCode(fc.content);
          break;
        case "keypoints":
          const kp = await keyPointsMut.mutateAsync({ documentId: selectedDocId!, text });
          setKeyPointsContent(kp.content);
          break;
        case "studyplan":
          const sp = await studyPlanMut.mutateAsync({ documentIds: activeDocumentIds });
          setStudyPlanContent(sp.content);
          break;
      }
    } catch (err: any) {
      toast.error(err.message ?? "AI generation failed");
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleChatSend = async (content: string) => {
    if (activeDocumentIds.length === 0 || !hasSelectedText) {
      toast.error("Select at least one document with extracted text first");
      return;
    }
    const nextMessages: Message[] = [...chatMessages, { role: "user", content }];
    setChatMessages(nextMessages);
    try {
      const res = await chatMut.mutateAsync({ documentIds: activeDocumentIds.slice(0, 6), messages: nextMessages.filter((m) => m.role !== "system") as any });
      setChatMessages([...nextMessages, { role: "assistant", content: res.response }]);
    } catch (err: any) {
      toast.error(err.message ?? "Chat failed");
    }
  };

  const isLoading = (tab: string) => ({
    flashcards: flashcardsMut.isPending,
    cornell: cornellMut.isPending,
    mindmap: mindMapMut.isPending,
    timeline: timelineMut.isPending,
    flowchart: flowchartMut.isPending,
    keypoints: keyPointsMut.isPending,
    studyplan: studyPlanMut.isPending,
    chat: chatMut.isPending,
  }[tab] ?? false);

  const tabs = [
    { id: "flashcards", label: "Flashcards", icon: Brain },
    { id: "cornell", label: "Cornell Notes", icon: FileText },
    { id: "mindmap", label: "Mind Map", icon: GitBranch },
    { id: "timeline", label: "Timeline", icon: Clock3 },
    { id: "flowchart", label: "Flowchart", icon: Workflow },
    { id: "keypoints", label: "Key Points", icon: Sparkles },
    { id: "studyplan", label: "Study Plan", icon: ClipboardList },
    { id: "chat", label: "Doc Chat", icon: MessageCircle },
  ];

  return (
    <div className="mobile-page p-6 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="animate-slide-up">
        <h1 className="text-2xl font-bold font-serif">AI Study Tools</h1>
        <p className="text-muted-foreground text-sm mt-0.5">Generate intelligent study materials from your documents</p>
      </div>

      {/* Document Selector */}
      <div className="study-card p-4 animate-fade-in">
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-2 text-sm font-medium">
            <BookOpen className="w-4 h-4 text-primary" />
            Source Document:
          </div>
          <Select
            value={selectedDocId?.toString() ?? ""}
            onValueChange={(v) => {
              const id = parseInt(v);
              setSelectedDocId(id);
              setSelectedDocIds((prev) => prev.includes(id) ? prev : [id]);
            }}
          >
            <SelectTrigger className="w-72">
              <SelectValue placeholder="Select a document..." />
            </SelectTrigger>
            <SelectContent>
              {docs?.map((doc) => (
                <SelectItem key={doc.id} value={doc.id.toString()}>
                  {doc.originalName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {selectedDoc && (
            <Badge variant="secondary" className="text-xs">
              {selectedDoc.wordCount?.toLocaleString()} words
            </Badge>
          )}
        </div>
        <div className="mt-4 border-t pt-4">
          <div className="flex items-center justify-between gap-3 flex-wrap mb-3">
            <div>
              <p className="text-sm font-medium">Cross-document mode</p>
              <p className="text-xs text-muted-foreground">Select multiple docs for combined flashcards, study plans, and document chat.</p>
            </div>
            <Badge variant="outline">{activeDocumentIds.length} selected</Badge>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 max-h-40 overflow-y-auto pr-1">
            {docs?.map((doc) => (
              <label key={doc.id} className={cn("flex items-center gap-2 rounded-lg border p-2 text-sm cursor-pointer transition-colors", selectedDocIds.includes(doc.id) ? "border-primary bg-primary/5" : "hover:bg-muted/50")}>
                <input type="checkbox" checked={selectedDocIds.includes(doc.id)} onChange={() => toggleDocument(doc.id)} />
                <span className="truncate" title={doc.originalName}>{doc.originalName}</span>
              </label>
            ))}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="animate-fade-in">
        <TabsList className="grid grid-cols-4 sm:grid-cols-8 h-auto gap-1 bg-muted p-1">
          {tabs.map((tab) => (
            <TabsTrigger key={tab.id} value={tab.id} className="gap-1.5 text-xs py-2">
              <tab.icon className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{tab.label}</span>
            </TabsTrigger>
          ))}
        </TabsList>

        {/* ── Flashcards Tab ── */}
        <TabsContent value="flashcards" className="mt-6 space-y-4">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <h2 className="font-semibold">AI Flashcard Generator</h2>
              <p className="text-sm text-muted-foreground">Difficulty-aware cards from one or multiple documents</p>
            </div>
            <div className="flex flex-wrap gap-2 items-center justify-end">
              <Select value={difficulty} onValueChange={(v: any) => setDifficulty(v)}>
                <SelectTrigger className="w-36 h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="beginner">Beginner</SelectItem>
                  <SelectItem value="intermediate">Intermediate</SelectItem>
                  <SelectItem value="advanced">Advanced</SelectItem>
                </SelectContent>
              </Select>
              <Select value={cardStyle} onValueChange={(v: any) => setCardStyle(v)}>
                <SelectTrigger className="w-36 h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="recall">Recall</SelectItem>
                  <SelectItem value="application">Application</SelectItem>
                  <SelectItem value="exam">Exam-style</SelectItem>
                </SelectContent>
              </Select>
              <Select value={String(cardCount)} onValueChange={(v) => setCardCount(parseInt(v))}>
                <SelectTrigger className="w-24 h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {[8, 12, 16, 20, 30].map((n) => <SelectItem key={n} value={String(n)}>{n} cards</SelectItem>)}
                </SelectContent>
              </Select>
              <Button onClick={() => runAI("flashcards")} disabled={activeDocumentIds.length === 0 || isLoading("flashcards")} className="gap-2">
                {isLoading("flashcards") ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                Generate
              </Button>
            </div>
          </div>
          {deckCards && deckCards.length > 0 ? (
            <FlashcardView cards={deckCards} deckId={latestDeck!.id} difficulty={difficulty} />
          ) : (
            <div className="text-center py-16 study-card">
              <Brain className="w-12 h-12 text-muted-foreground/20 mx-auto mb-4" />
              <p className="text-muted-foreground">Select a document and click Generate to create flashcards</p>
            </div>
          )}
        </TabsContent>

        {/* ── Cornell Notes Tab ── */}
        <TabsContent value="cornell" className="mt-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-semibold">Cornell Notes</h2>
              <p className="text-sm text-muted-foreground">Structured cue column, notes, and summary</p>
            </div>
            <div className="flex gap-2">
              {cornellContent && <TTSButton text={cornellContent} />}
              {cornellContent && (
                <Button variant="outline" size="sm" onClick={() => copyToClipboard(cornellContent)} className="gap-1.5">
                  {copied ? <CheckCheck className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                  Copy
                </Button>
              )}
              {cornellContent && (
                <Button variant="outline" size="sm" onClick={() => openSaveDialog(`Cornell Notes — ${selectedDoc?.originalName ?? "Document"}`, cornellContent)} className="gap-1.5">
                  <BookmarkPlus className="w-3.5 h-3.5" /> Save to Notes
                </Button>
              )}
              <Button onClick={() => runAI("cornell")} disabled={!selectedDocId || isLoading("cornell")} className="gap-2">
                {isLoading("cornell") ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                Generate
              </Button>
            </div>
          </div>
          {cornellMut.isPending ? (
            <div className="space-y-3">
              {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-6 w-full" />)}
            </div>
          ) : cornellContent ? (
            <div className="study-card p-6 animate-fade-in">
              <div className="streamdown-content">
                <MarkdownView>{cornellContent}</MarkdownView>
              </div>
            </div>
          ) : (
            <div className="text-center py-16 study-card">
              <FileText className="w-12 h-12 text-muted-foreground/20 mx-auto mb-4" />
              <p className="text-muted-foreground">Generate Cornell-style notes from your document</p>
            </div>
          )}
        </TabsContent>

        {/* ── Mind Map Tab ── */}
        <TabsContent value="mindmap" className="mt-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-semibold">Mind Map</h2>
              <p className="text-sm text-muted-foreground">Visual concept hierarchy rendered with Mermaid.js</p>
            </div>
            <div className="flex gap-2">
              {mindMapCode && (
                <Button variant="outline" size="sm" onClick={() => openSaveDialog(`Mind Map — ${selectedDoc?.originalName ?? "Document"}`, mindMapCode)} className="gap-1.5">
                  <BookmarkPlus className="w-3.5 h-3.5" /> Save to Notes
                </Button>
              )}
              <Button onClick={() => runAI("mindmap")} disabled={!selectedDocId || isLoading("mindmap")} className="gap-2">
                {isLoading("mindmap") ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                Generate
              </Button>
            </div>
          </div>
          {mindMapMut.isPending ? (
            <Skeleton className="h-64 w-full rounded-xl" />
          ) : mindMapCode ? (
            <div className="animate-fade-in">
              <MermaidDiagram code={mindMapCode} />
            </div>
          ) : (
            <div className="text-center py-16 study-card">
              <GitBranch className="w-12 h-12 text-muted-foreground/20 mx-auto mb-4" />
              <p className="text-muted-foreground">Generate a visual mind map from your document</p>
            </div>
          )}
        </TabsContent>

        {/* ── Timeline Tab ── */}
        <TabsContent value="timeline" className="mt-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-semibold">Timeline</h2>
              <p className="text-sm text-muted-foreground">Chronological events rendered as a visual timeline</p>
            </div>
            <div className="flex gap-2">
              {timelineCode && (
                <Button variant="outline" size="sm" onClick={() => openSaveDialog(`Timeline — ${selectedDoc?.originalName ?? "Document"}`, timelineCode)} className="gap-1.5">
                  <BookmarkPlus className="w-3.5 h-3.5" /> Save to Notes
                </Button>
              )}
              <Button onClick={() => runAI("timeline")} disabled={!selectedDocId || isLoading("timeline")} className="gap-2">
                {isLoading("timeline") ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                Generate
              </Button>
            </div>
          </div>
          {timelineMut.isPending ? (
            <Skeleton className="h-64 w-full rounded-xl" />
          ) : timelineCode ? (
            <div className="animate-fade-in">
              <MermaidDiagram code={timelineCode} />
            </div>
          ) : (
            <div className="text-center py-16 study-card">
              <Clock3 className="w-12 h-12 text-muted-foreground/20 mx-auto mb-4" />
              <p className="text-muted-foreground">Generate a visual timeline from your document</p>
            </div>
          )}
        </TabsContent>

        {/* ── Flowchart Tab ── */}
        <TabsContent value="flowchart" className="mt-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-semibold">Flowchart</h2>
              <p className="text-sm text-muted-foreground">Process flow rendered as an interactive diagram</p>
            </div>
            <div className="flex gap-2">
              {flowchartCode && (
                <Button variant="outline" size="sm" onClick={() => openSaveDialog(`Flowchart — ${selectedDoc?.originalName ?? "Document"}`, flowchartCode)} className="gap-1.5">
                  <BookmarkPlus className="w-3.5 h-3.5" /> Save to Notes
                </Button>
              )}
              <Button onClick={() => runAI("flowchart")} disabled={!selectedDocId || isLoading("flowchart")} className="gap-2">
                {isLoading("flowchart") ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                Generate
              </Button>
            </div>
          </div>
          {flowchartMut.isPending ? (
            <Skeleton className="h-64 w-full rounded-xl" />
          ) : flowchartCode ? (
            <div className="animate-fade-in">
              <MermaidDiagram code={flowchartCode} />
            </div>
          ) : (
            <div className="text-center py-16 study-card">
              <Workflow className="w-12 h-12 text-muted-foreground/20 mx-auto mb-4" />
              <p className="text-muted-foreground">Generate a flowchart from your document</p>
            </div>
          )}
        </TabsContent>

        {/* ── Key Points Tab ── */}
        <TabsContent value="keypoints" className="mt-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-semibold">Key Points</h2>
              <p className="text-sm text-muted-foreground">7-10 essential insights extracted by AI</p>
            </div>
            <div className="flex gap-2">
              {keyPointsContent && <TTSButton text={keyPointsContent} />}
              {keyPointsContent && (
                <Button variant="outline" size="sm" onClick={() => copyToClipboard(keyPointsContent)} className="gap-1.5">
                  {copied ? <CheckCheck className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                  Copy
                </Button>
              )}
              {keyPointsContent && (
                <Button variant="outline" size="sm" onClick={() => openSaveDialog(`Key Points — ${selectedDoc?.originalName ?? "Document"}`, keyPointsContent)} className="gap-1.5">
                  <BookmarkPlus className="w-3.5 h-3.5" /> Save to Notes
                </Button>
              )}
              <Button onClick={() => runAI("keypoints")} disabled={!selectedDocId || isLoading("keypoints")} className="gap-2">
                {isLoading("keypoints") ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                Generate
              </Button>
            </div>
          </div>
          {keyPointsMut.isPending ? (
            <div className="space-y-3">
              {[1, 2, 3, 4, 5].map(i => <Skeleton key={i} className="h-8 w-full" />)}
            </div>
          ) : keyPointsContent ? (
            <div className="study-card p-6 animate-fade-in">
              <div className="streamdown-content">
                <MarkdownView>{keyPointsContent}</MarkdownView>
              </div>
            </div>
          ) : (
            <div className="text-center py-16 study-card">
              <Sparkles className="w-12 h-12 text-muted-foreground/20 mx-auto mb-4" />
              <p className="text-muted-foreground">Extract the most important points from your document</p>
            </div>
          )}
        </TabsContent>

        {/* ── Study Plan Tab ── */}
        <TabsContent value="studyplan" className="mt-6 space-y-4">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div>
              <h2 className="font-semibold">Unified Study Plan</h2>
              <p className="text-sm text-muted-foreground">Combines selected documents into one prioritized plan</p>
            </div>
            <div className="flex gap-2">
              {studyPlanContent && (
                <Button variant="outline" size="sm" onClick={() => openSaveDialog("Unified Study Plan", studyPlanContent)} className="gap-1.5">
                  <BookmarkPlus className="w-3.5 h-3.5" /> Save to Notes
                </Button>
              )}
              <Button onClick={() => runAI("studyplan")} disabled={activeDocumentIds.length === 0 || isLoading("studyplan")} className="gap-2">
                {isLoading("studyplan") ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                Generate Plan
              </Button>
            </div>
          </div>
          {studyPlanMut.isPending ? (
            <div className="space-y-3">{[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-6 w-full" />)}</div>
          ) : studyPlanContent ? (
            <div className="study-card p-6 animate-fade-in"><div className="streamdown-content"><MarkdownView>{studyPlanContent}</MarkdownView></div></div>
          ) : (
            <div className="text-center py-16 study-card">
              <ClipboardList className="w-12 h-12 text-muted-foreground/20 mx-auto mb-4" />
              <p className="text-muted-foreground">Select one or more documents and generate a unified study plan</p>
            </div>
          )}
        </TabsContent>

        {/* ── Document Chat Tab ── */}
        <TabsContent value="chat" className="mt-6 space-y-4">
          <div>
            <h2 className="font-semibold">Chat with your documents</h2>
            <p className="text-sm text-muted-foreground">Ask questions grounded only in the selected document text.</p>
          </div>
          <AIChatBox
            messages={chatMessages}
            onSendMessage={handleChatSend}
            isLoading={chatMut.isPending}
            height={560}
            emptyStateMessage={activeDocumentIds.length > 1 ? `Ask across ${activeDocumentIds.length} selected documents` : "Ask anything about the selected document"}
            suggestedPrompts={[
              "Summarize the selected material",
              "What are the most testable concepts?",
              "Explain the hardest section in simple terms",
              "Make 5 practice questions from this",
            ]}
          />
        </TabsContent>
      </Tabs>

      {/* Save to Notes Dialog */}
      <Dialog open={showSaveDialog} onOpenChange={setShowSaveDialog}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><BookmarkPlus className="w-5 h-5" /> Save to Notes</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <label className="text-sm font-medium text-foreground">Note title</label>
              <input
                value={saveTitle}
                onChange={e => setSaveTitle(e.target.value)}
                className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground"
              />
            </div>
            {folders.length > 0 && (
              <div>
                <label className="text-sm font-medium text-foreground flex items-center gap-1.5"><FolderOpen className="w-3.5 h-3.5" /> Save to folder (optional)</label>
                <select
                  value={saveFolderId}
                  onChange={e => setSaveFolderId(e.target.value ? Number(e.target.value) : "")}
                  className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground"
                >
                  <option value="">No folder</option>
                  {folders.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                </select>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSaveDialog(false)}>Cancel</Button>
            <Button
              onClick={() => createNote.mutate({
                title: saveTitle,
                content: saveContent,
                ...(saveFolderId !== "" ? { folderId: Number(saveFolderId) } : {}),
              } as any)}
              disabled={createNote.isPending || !saveTitle.trim()}
              className="gap-1.5"
            >
              {createNote.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <BookmarkPlus className="w-3.5 h-3.5" />}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
