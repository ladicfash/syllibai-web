import { useState, useRef, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import {
  FlaskConical, TrendingUp, Code2, Landmark, Send, RotateCcw, Loader2, Bot, User,
  Sparkles, Trophy, Target, GitBranch, GraduationCap, Stethoscope, BriefcaseBusiness,
  TerminalSquare, ScrollText, Wand2, CheckCircle2
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Streamdown } from "streamdown";

type Domain = "medical" | "finance" | "coding" | "history" | "custom";
type Difficulty = "beginner" | "intermediate" | "advanced";
type Mode = "guided" | "branching" | "interview";
type Message = { role: "user" | "assistant"; content: string };

const DOMAINS = [
  {
    id: "medical" as Domain,
    label: "Medical",
    icon: FlaskConical,
    accentIcon: Stethoscope,
    color: "text-red-500",
    bg: "bg-red-50 dark:bg-red-950/30",
    ring: "ring-red-500/20",
    gradient: "from-red-500/15 to-rose-500/5",
    border: "border-red-200 dark:border-red-800/70",
    description: "Clinical case scenarios and diagnostic reasoning",
    skills: ["Differential diagnosis", "Workup", "Treatment decisions"],
    starter: "Start an original clinical case involving a patient with chest pain and shortness of breath. Make me reason step-by-step.",
  },
  {
    id: "finance" as Domain,
    label: "Finance",
    icon: TrendingUp,
    accentIcon: BriefcaseBusiness,
    color: "text-emerald-500",
    bg: "bg-emerald-50 dark:bg-emerald-950/30",
    ring: "ring-emerald-500/20",
    gradient: "from-emerald-500/15 to-green-500/5",
    border: "border-emerald-200 dark:border-emerald-800/70",
    description: "Investment decisions and market analysis",
    skills: ["Risk analysis", "Portfolio allocation", "Market reasoning"],
    starter: "Start a portfolio allocation scenario for a 30-year-old investor with moderate risk tolerance and changing market conditions.",
  },
  {
    id: "coding" as Domain,
    label: "Coding",
    icon: Code2,
    accentIcon: TerminalSquare,
    color: "text-blue-500",
    bg: "bg-blue-50 dark:bg-blue-950/30",
    ring: "ring-blue-500/20",
    gradient: "from-blue-500/15 to-cyan-500/5",
    border: "border-blue-200 dark:border-blue-800/70",
    description: "Technical interviews and system design",
    skills: ["Algorithms", "System design", "Tradeoffs"],
    starter: "Start a realistic technical interview. Give me either a medium algorithm problem or a small system design scenario and evaluate my approach.",
  },
  {
    id: "history" as Domain,
    label: "History",
    icon: Landmark,
    accentIcon: ScrollText,
    color: "text-amber-500",
    bg: "bg-amber-50 dark:bg-amber-950/30",
    ring: "ring-amber-500/20",
    gradient: "from-amber-500/15 to-orange-500/5",
    border: "border-amber-200 dark:border-amber-800/70",
    description: "What-if historical scenarios and analysis",
    skills: ["Cause/effect", "Counterfactuals", "Evidence-based analysis"],
    starter: "Start a historically rigorous what-if scenario. Give me context, a decision point, and ask me to reason through consequences.",
  },
];

const QUICK_RESPONSES = [
  "Ask one clarifying question before I decide.",
  "I choose option A. Walk me through the consequences.",
  "Challenge my reasoning and tell me what I missed.",
  "Give me feedback and advance to the next decision point.",
];

export default function Simulations() {
  const [selectedDomain, setSelectedDomain] = useState<Domain | null>(null);
  const [difficulty, setDifficulty] = useState<Difficulty>("intermediate");
  const [mode, setMode] = useState<Mode>("branching");
  const [customDomain, setCustomDomain] = useState("");
  const [customGoal, setCustomGoal] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [scenario, setScenario] = useState("");
  const [score, setScore] = useState({ decisions: 0, feedback: 0 });
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const simulationMut = trpc.ai.simulation.useMutation();
  const activeDomain = selectedDomain === "custom"
    ? { id: "custom" as Domain, label: customDomain || "Custom", icon: Wand2, accentIcon: GraduationCap, color: "text-violet-500", bg: "bg-violet-50 dark:bg-violet-950/30", ring: "ring-violet-500/20", gradient: "from-violet-500/15 to-fuchsia-500/5", border: "border-violet-200 dark:border-violet-800/70", description: customGoal || "Custom role-aware simulation", skills: ["Custom reasoning", "Decision-making", "Feedback"], starter: customGoal || "Start a custom educational simulation." }
    : DOMAINS.find((d) => d.id === selectedDomain);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, simulationMut.isPending]);

  const startSimulation = async (domain: Domain) => {
    if (domain === "custom" && !customDomain.trim()) {
      toast.error("Name your custom simulation subject first");
      return;
    }
    const d = domain === "custom"
      ? { starter: customGoal || `Create a ${customDomain} simulation with realistic decisions and feedback.` }
      : DOMAINS.find((item) => item.id === domain)!;
    setSelectedDomain(domain);
    setMessages([]);
    setScore({ decisions: 0, feedback: 0 });
    setScenario(d.starter);
    try {
      const result = await simulationMut.mutateAsync({
        domain,
        customDomain: customDomain.trim() || undefined,
        difficulty,
        mode,
        scenario: d.starter,
        conversationHistory: [],
      });
      setMessages([{ role: "assistant", content: result.response }]);
    } catch (err: any) {
      toast.error(err.message ?? "Failed to start simulation");
      setSelectedDomain(null);
    }
  };

  const sendMessage = async (override?: string) => {
    const content = (override ?? input).trim();
    if (!content || !selectedDomain) return;
    const userMsg: Message = { role: "user", content };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput("");
    setScore((prev) => ({ ...prev, decisions: prev.decisions + 1 }));
    try {
      const result = await simulationMut.mutateAsync({
        domain: selectedDomain,
        customDomain: customDomain.trim() || undefined,
        difficulty,
        mode,
        scenario,
        userResponse: content,
        conversationHistory: messages,
      });
      setMessages([...newMessages, { role: "assistant", content: result.response }]);
      setScore((prev) => ({ ...prev, feedback: prev.feedback + 1 }));
    } catch (err: any) {
      toast.error(err.message ?? "Failed to get response");
    }
  };

  const reset = () => {
    setSelectedDomain(null);
    setMessages([]);
    setInput("");
    setScenario("");
    setScore({ decisions: 0, feedback: 0 });
  };

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto space-y-6">
      <div className="relative overflow-hidden rounded-3xl border bg-card p-6 md:p-8 shadow-sm animate-slide-up">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-transparent pointer-events-none" />
        <div className="relative flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-3 py-1 text-xs font-semibold text-primary mb-3">
              <Sparkles className="w-3.5 h-3.5" /> Interactive AI role-play lab
            </div>
            <h1 className="text-3xl font-bold tracking-tight font-serif">Simulation Environments</h1>
            <p className="text-muted-foreground mt-2 max-w-2xl">Learn by doing — adaptive scenarios with decision points, feedback, branching outcomes, and role-aware coaching.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Select value={difficulty} onValueChange={(v: Difficulty) => setDifficulty(v)} disabled={!!selectedDomain}>
              <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="beginner">Beginner</SelectItem>
                <SelectItem value="intermediate">Intermediate</SelectItem>
                <SelectItem value="advanced">Advanced</SelectItem>
              </SelectContent>
            </Select>
            <Select value={mode} onValueChange={(v: Mode) => setMode(v)} disabled={!!selectedDomain}>
              <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="guided">Guided coach</SelectItem>
                <SelectItem value="branching">Branching choices</SelectItem>
                <SelectItem value="interview">Interview mode</SelectItem>
              </SelectContent>
            </Select>
            {selectedDomain && (
              <Button variant="outline" onClick={reset} className="gap-1.5">
                <RotateCcw className="w-3.5 h-3.5" /> New Simulation
              </Button>
            )}
          </div>
        </div>
      </div>

      {!selectedDomain ? (
        <div className="space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 animate-slide-up">
            {DOMAINS.map((domain, i) => {
              const Icon = domain.icon;
              const AccentIcon = domain.accentIcon;
              return (
                <button
                  key={domain.id}
                  onClick={() => startSimulation(domain.id)}
                  className={cn("relative overflow-hidden study-card p-5 text-left group transition-all duration-200 hover:shadow-xl hover:-translate-y-1 border-2", domain.border)}
                  style={{ animationDelay: `${i * 0.07}s` }}
                >
                  <div className={cn("absolute inset-0 bg-gradient-to-br opacity-80", domain.gradient)} />
                  <div className="relative">
                    <div className="flex items-start justify-between mb-4">
                      <div className={cn("w-12 h-12 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform ring-4", domain.bg, domain.ring)}>
                        <Icon className={cn("w-6 h-6", domain.color)} />
                      </div>
                      <AccentIcon className={cn("w-5 h-5 opacity-40", domain.color)} />
                    </div>
                    <h3 className="font-semibold text-lg mb-1">{domain.label}</h3>
                    <p className="text-sm text-muted-foreground min-h-[40px]">{domain.description}</p>
                    <div className="flex flex-wrap gap-1.5 mt-4">
                      {domain.skills.map((skill) => <Badge key={skill} variant="secondary" className="text-[10px]">{skill}</Badge>)}
                    </div>
                    <div className="mt-5 flex items-center justify-between text-sm font-medium text-primary">
                      <span>Start Simulation</span>
                      <span className="group-hover:translate-x-1 transition-transform inline-block">→</span>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          <div className="study-card p-5 border-2 border-violet-200 dark:border-violet-800/70 animate-fade-in">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <Wand2 className="w-4 h-4 text-violet-500" />
                  <h3 className="font-semibold">Custom Simulation</h3>
                  <Badge variant="outline">Any subject</Badge>
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  <input
                    value={customDomain}
                    onChange={(e) => setCustomDomain(e.target.value)}
                    placeholder="Subject, e.g. Organic Chemistry, Real Estate, Constitutional Law"
                    className="rounded-lg border border-input bg-background px-3 py-2 text-sm"
                  />
                  <input
                    value={customGoal}
                    onChange={(e) => setCustomGoal(e.target.value)}
                    placeholder="Goal, e.g. quiz me on reaction mechanisms"
                    className="rounded-lg border border-input bg-background px-3 py-2 text-sm"
                  />
                </div>
              </div>
              <Button onClick={() => startSimulation("custom")} className="gap-2">
                <Wand2 className="w-4 h-4" /> Start Custom
              </Button>
            </div>
          </div>
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[280px_minmax(0,1fr)] animate-fade-in">
          <aside className="space-y-4">
            {activeDomain && (
              <div className={cn("study-card p-5 border-2", activeDomain.border)}>
                <div className={cn("w-12 h-12 rounded-2xl flex items-center justify-center mb-4", activeDomain.bg)}>
                  <activeDomain.icon className={cn("w-6 h-6", activeDomain.color)} />
                </div>
                <h2 className="font-semibold text-lg">{activeDomain.label}</h2>
                <p className="text-sm text-muted-foreground mt-1">{activeDomain.description}</p>
                <div className="grid grid-cols-2 gap-2 mt-4">
                  <div className="rounded-xl bg-muted/50 p-3">
                    <Target className="w-4 h-4 text-primary mb-1" />
                    <p className="text-lg font-bold">{score.decisions}</p>
                    <p className="text-[11px] text-muted-foreground">decisions</p>
                  </div>
                  <div className="rounded-xl bg-muted/50 p-3">
                    <Trophy className="w-4 h-4 text-primary mb-1" />
                    <p className="text-lg font-bold">{score.feedback}</p>
                    <p className="text-[11px] text-muted-foreground">feedback rounds</p>
                  </div>
                </div>
                <div className="mt-4 space-y-2 text-xs text-muted-foreground">
                  <div className="flex items-center gap-2"><CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> {difficulty} difficulty</div>
                  <div className="flex items-center gap-2"><GitBranch className="w-3.5 h-3.5 text-primary" /> {mode.replace("_", " ")} mode</div>
                </div>
              </div>
            )}

            <div className="study-card p-4">
              <p className="font-semibold text-sm mb-3">Quick responses</p>
              <div className="space-y-2">
                {QUICK_RESPONSES.map((quick) => (
                  <button
                    key={quick}
                    onClick={() => sendMessage(quick)}
                    disabled={simulationMut.isPending}
                    className="w-full rounded-lg border border-border px-3 py-2 text-left text-xs hover:bg-muted transition-colors disabled:opacity-50"
                  >
                    {quick}
                  </button>
                ))}
              </div>
            </div>
          </aside>

          <div className="study-card flex flex-col h-[680px] overflow-hidden">
            <div className="flex items-center gap-3 p-4 border-b border-border bg-muted/20">
              {activeDomain && (
                <>
                  <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center", activeDomain.bg)}>
                    <activeDomain.icon className={cn("w-5 h-5", activeDomain.color)} />
                  </div>
                  <div>
                    <p className="font-semibold text-sm">{activeDomain.label} Simulation</p>
                    <p className="text-xs text-muted-foreground">Respond, choose, ask questions, or request feedback</p>
                  </div>
                </>
              )}
              <Badge variant="secondary" className="ml-auto text-xs">Active</Badge>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {messages.map((msg, i) => (
                <div key={i} className={cn("flex gap-3 animate-slide-up", msg.role === "user" && "flex-row-reverse")}>
                  <div className={cn("w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5", msg.role === "assistant" ? "bg-primary/10" : "bg-muted")}>
                    {msg.role === "assistant" ? <Bot className="w-4 h-4 text-primary" /> : <User className="w-4 h-4 text-muted-foreground" />}
                  </div>
                  <div className={cn("max-w-[85%] rounded-2xl px-4 py-3 text-sm shadow-sm", msg.role === "assistant" ? "bg-muted rounded-tl-sm" : "bg-primary text-primary-foreground rounded-tr-sm")}>
                    {msg.role === "assistant" ? (
                      <div className="streamdown-content"><Streamdown>{msg.content}</Streamdown></div>
                    ) : <p className="whitespace-pre-wrap">{msg.content}</p>}
                  </div>
                </div>
              ))}
              {simulationMut.isPending && (
                <div className="flex gap-3">
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0"><Bot className="w-4 h-4 text-primary" /></div>
                  <div className="bg-muted rounded-2xl rounded-tl-sm px-4 py-3">
                    <div className="flex gap-1">{[0, 1, 2].map(i => <div key={i} className="w-2 h-2 bg-muted-foreground/40 rounded-full animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />)}</div>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            <div className="p-4 border-t border-border bg-card">
              <div className="flex gap-2">
                <Textarea
                  placeholder="Make a decision, explain your reasoning, ask for data, or choose A/B/C/D..."
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
                  className="resize-none min-h-[46px] max-h-[140px]"
                  rows={1}
                />
                <Button onClick={() => sendMessage()} disabled={!input.trim() || simulationMut.isPending} size="icon" className="h-11 w-11 flex-shrink-0">
                  {simulationMut.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground mt-2">Press Enter to send · Shift+Enter for new line</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
