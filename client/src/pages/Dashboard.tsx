import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import {
  BookOpen, Brain, Clock, Calendar, Zap, FileText, Target,
  ArrowRight, Flame, Plus, Upload, Mic, StickyNote, Globe,
  ChevronRight, Activity, BarChart2, Sparkles
} from "lucide-react";
import { formatDistanceToNow, isToday, isThisWeek } from "date-fns";
import { cn } from "@/lib/utils";

const quickActions = [
  { label: "Upload Document", icon: Upload, path: "/library", accent: "from-primary/20 to-primary/5", iconColor: "text-primary", border: "border-primary/20" },
  { label: "Study Studio", icon: Brain, path: "/study-tools", accent: "from-violet-500/20 to-violet-500/5", iconColor: "text-violet-500", border: "border-violet-500/20" },
  { label: "Start Timer", icon: Clock, path: "/timer", accent: "from-amber-500/20 to-amber-500/5", iconColor: "text-amber-500", border: "border-amber-500/20" },
  { label: "Voice Notes", icon: Mic, path: "/voice", accent: "from-rose-500/20 to-rose-500/5", iconColor: "text-rose-500", border: "border-rose-500/20" },
  { label: "My Notes", icon: StickyNote, path: "/notes", accent: "from-emerald-500/20 to-emerald-500/5", iconColor: "text-emerald-500", border: "border-emerald-500/20" },
  { label: "Explore", icon: Globe, path: "/explore", accent: "from-sky-500/20 to-sky-500/5", iconColor: "text-sky-500", border: "border-sky-500/20" },
];

function StatCard({ label, value, icon: Icon, color, bg, loading, sub }: any) {
  return (
    <div className="study-card p-5 group hover:shadow-lg transition-all duration-200">
      <div className="flex items-start justify-between mb-3">
        <div className={`w-10 h-10 rounded-xl ${bg} flex items-center justify-center`}>
          <Icon className={`w-5 h-5 ${color}`} />
        </div>
        <BarChart2 className="w-3.5 h-3.5 text-muted-foreground/30 group-hover:text-muted-foreground/60 transition-colors" />
      </div>
      {loading ? (
        <Skeleton className="h-8 w-14 mb-1" />
      ) : (
        <p className="text-3xl font-bold tracking-tight">{value}</p>
      )}
      <p className="text-xs text-muted-foreground font-medium mt-1">{label}</p>
      {sub && <p className="text-[10px] text-muted-foreground/60 mt-0.5">{sub}</p>}
    </div>
  );
}

export default function Dashboard() {
  const { user } = useAuth();
  const { data: docs, isLoading: docsLoading } = trpc.documents.list.useQuery();
  const { data: decks, isLoading: decksLoading } = trpc.decks.list.useQuery();
  const { data: tasks, isLoading: tasksLoading } = trpc.tasks.list.useQuery();
  const { data: timerHistory } = trpc.timer.history.useQuery();
  const { data: dueCards } = trpc.decks.dueCards.useQuery();
  const { data: activity } = trpc.activity.summary.useQuery();
  const { data: recentOutputs = [] } = trpc.ai.listStudyOutputs.useQuery();

  const greeting = () => {
    const h = new Date().getHours();
    if (h < 5) return "Still up";
    if (h < 12) return "Good morning";
    if (h < 17) return "Good afternoon";
    return "Good evening";
  };

  const totalStudyMinutes = timerHistory?.filter(s => s.sessionType === "work").reduce((acc, s) => acc + s.durationMinutes, 0) ?? 0;
  const todayMinutes = timerHistory?.filter(s => s.sessionType === "work" && isToday(new Date(s.createdAt))).reduce((acc, s) => acc + s.durationMinutes, 0) ?? 0;
  const weekMinutes = timerHistory?.filter(s => s.sessionType === "work" && isThisWeek(new Date(s.createdAt))).reduce((acc, s) => acc + s.durationMinutes, 0) ?? 0;

  const pendingTasks = tasks?.filter(t => t.status !== "done") ?? [];
  const upcomingTasks = pendingTasks
    .filter(t => t.dueDate)
    .sort((a, b) => new Date(a.dueDate!).getTime() - new Date(b.dueDate!).getTime())
    .slice(0, 4);

  const dailyGoalMinutes = 60;
  const dailyProgress = Math.min(100, Math.round((todayMinutes / dailyGoalMinutes) * 100));

  const firstName = user?.name?.split(" ")[0] ?? "Student";
  const recentDoc = docs?.[0];
  const dueCount = dueCards?.length ?? 0;

  return (
    <div className="mobile-page p-6 max-w-6xl mx-auto space-y-7">

      {/* Header */}
      <div className="flex items-start justify-between animate-slide-up">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-primary mb-1">Dashboard</p>
          <h1 className="text-2xl font-bold tracking-tight">
            {greeting()}, {firstName}.
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            {dueCards && dueCards.length > 0
              ? `${dueCards.length} card${dueCards.length !== 1 ? "s" : ""} due for review today.`
              : "You're all caught up on reviews."}
          </p>
        </div>
        {/* Daily goal ring */}
        <div className="hidden sm:flex flex-col items-center gap-1">
          <div className="relative w-14 h-14">
            <svg className="w-14 h-14 -rotate-90" viewBox="0 0 56 56">
              <circle cx="28" cy="28" r="22" fill="none" stroke="currentColor" strokeWidth="4" className="text-muted/20" />
              <circle
                cx="28" cy="28" r="22" fill="none"
                stroke="currentColor" strokeWidth="4"
                strokeLinecap="round"
                strokeDasharray={`${2 * Math.PI * 22}`}
                strokeDashoffset={`${2 * Math.PI * 22 * (1 - dailyProgress / 100)}`}
                className="text-primary transition-all duration-700"
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-xs font-bold">{dailyProgress}%</span>
            </div>
          </div>
          <p className="text-[10px] text-muted-foreground text-center leading-tight">Daily<br/>Goal</p>
        </div>
      </div>

      {/* Today's command center */}
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,0.75fr)] animate-slide-up" style={{ animationDelay: "0.04s" }}>
        <div className="relative overflow-hidden rounded-3xl border bg-card p-5 shadow-sm">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-violet-500/5 pointer-events-none" />
          <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-primary">Today’s Study Command Center</p>
              <h2 className="mt-1 text-xl font-bold">{dueCount > 0 ? `${dueCount} cards due today` : "You’re caught up today"}</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {dueCount > 0 ? "Start with spaced review, then continue your latest document in Study Studio." : "No due cards. Build new study assets or continue your latest source."}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link href="/spaced-rep"><Button className="gap-2"><Zap className="w-4 h-4" /> Start Review</Button></Link>
              <Link href={recentDoc ? `/study-tools?doc=${recentDoc.id}` : "/study-tools"}><Button variant="outline" className="gap-2"><Brain className="w-4 h-4" /> Study Studio</Button></Link>
            </div>
          </div>
        </div>
        <div className="rounded-3xl border bg-card p-5 shadow-sm">
          <p className="text-sm font-semibold flex items-center gap-2"><Target className="w-4 h-4 text-primary" /> Recommended next action</p>
          {recentDoc ? (
            <div className="mt-3 space-y-3">
              <div className="rounded-2xl bg-muted/40 p-3">
                <p className="text-sm font-medium truncate">{recentDoc.originalName}</p>
                <p className="text-xs text-muted-foreground mt-1">{recentDoc.wordCount?.toLocaleString() ?? 0} words · ready for exam review</p>
              </div>
              <Link href={`/study-tools?doc=${recentDoc.id}`}><Button variant="secondary" className="w-full gap-2"><Sparkles className="w-4 h-4" /> Generate review sheet</Button></Link>
            </div>
          ) : (
            <div className="mt-3 space-y-3 text-sm text-muted-foreground">
              <p>Upload a syllabus, PDF, or lecture notes to unlock AI study templates.</p>
              <Link href="/library"><Button variant="secondary" className="w-full gap-2"><Upload className="w-4 h-4" /> Upload first document</Button></Link>
            </div>
          )}
        </div>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 animate-slide-up" style={{ animationDelay: "0.05s" }}>
        <StatCard label="Documents" value={docs?.length ?? 0} icon={BookOpen} color="text-primary" bg="bg-primary/10" loading={docsLoading} sub="in your library" />
        <StatCard label="Study Sets" value={decks?.length ?? 0} icon={Brain} color="text-violet-500" bg="bg-violet-500/10" loading={decksLoading} sub="flashcard decks" />
        <StatCard label="This Week" value={`${weekMinutes}m`} icon={Flame} color="text-amber-500" bg="bg-amber-500/10" loading={false} sub={`${todayMinutes}m today`} />
        <StatCard label="Cards Due" value={dueCards?.length ?? 0} icon={Zap} color="text-emerald-500" bg="bg-emerald-500/10" loading={false} sub="for spaced review" />
      </div>

      {/* Daily Goal Progress Bar (mobile) */}
      <div className="sm:hidden study-card p-4 animate-slide-up" style={{ animationDelay: "0.08s" }}>
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs font-medium">Daily Study Goal</p>
          <p className="text-xs text-muted-foreground">{todayMinutes} / {dailyGoalMinutes} min</p>
        </div>
        <Progress value={dailyProgress} className="h-2" />
      </div>

      {/* Habit loop */}
      <div className="grid gap-4 md:grid-cols-3 animate-slide-up" style={{ animationDelay: "0.08s" }}>
        <div className="rounded-3xl border bg-card p-5 shadow-sm">
          <p className="text-sm font-semibold flex items-center gap-2"><Flame className="w-4 h-4 text-amber-500" /> Review streak</p>
          <p className="mt-2 text-3xl font-bold">{activity?.streak ?? 0} days</p>
          <p className="text-xs text-muted-foreground">Best: {activity?.bestStreak ?? 0} days · {activity?.reviewedToday ?? 0} cards reviewed today</p>
        </div>
        <div className="md:col-span-2 rounded-3xl border bg-card p-5 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-semibold flex items-center gap-2"><Sparkles className="w-4 h-4 text-primary" /> Recent Study Studio outputs</p>
            <Link href="/study-tools"><Button variant="ghost" size="sm">Open Studio</Button></Link>
          </div>
          {recentOutputs.length === 0 ? <p className="text-sm text-muted-foreground">Generate your first exam review, quiz, or study guide to see it here.</p> : (
            <div className="grid gap-2 sm:grid-cols-2">
              {recentOutputs.slice(0, 2).map((out: any) => (
                <Link key={out.id} href="/study-tools">
                  <div className="rounded-2xl border bg-muted/30 p-3 hover:bg-muted/50 transition-colors cursor-pointer">
                    <p className="text-sm font-medium truncate">{out.title}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{out.templateType?.replace(/_/g, " ")} · {new Date(out.createdAt).toLocaleDateString()}</p>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Quick Actions */}
      <div className="animate-slide-up" style={{ animationDelay: "0.1s" }}>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-widest">Quick Access</h2>
        </div>
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
          {quickActions.map((action, i) => (
            <Link key={action.label} href={action.path}>
              <div
                className={cn(
                  "study-card p-3 cursor-pointer group flex flex-col items-center text-center gap-2.5 border",
                  action.border,
                  "hover:shadow-md transition-all duration-200"
                )}
                style={{ animationDelay: `${i * 0.04}s` }}
              >
                <div className={cn("w-9 h-9 rounded-xl bg-gradient-to-br flex items-center justify-center group-hover:scale-110 transition-transform duration-200", action.accent)}>
                  <action.icon className={cn("w-4 h-4", action.iconColor)} />
                </div>
                <span className="text-[11px] font-medium leading-tight">{action.label}</span>
              </div>
            </Link>
          ))}
        </div>
      </div>

      {/* Main content grid */}
      <div className="grid lg:grid-cols-5 gap-5 animate-slide-up" style={{ animationDelay: "0.15s" }}>

        {/* Recent Documents — 3 cols */}
        <div className="lg:col-span-3 study-card p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-sm flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-primary" />
              Recent Documents
            </h2>
            <Link href="/library">
              <Button variant="ghost" size="sm" className="gap-1 text-xs h-7 text-muted-foreground hover:text-foreground">
                Library <ChevronRight className="w-3 h-3" />
              </Button>
            </Link>
          </div>
          {docsLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map(i => <Skeleton key={i} className="h-12 w-full" />)}
            </div>
          ) : docs && docs.length > 0 ? (
            <div className="space-y-1">
              {docs.slice(0, 5).map((doc) => (
                <Link key={doc.id} href={`/library?doc=${doc.id}`}>
                  <div className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-muted/50 transition-colors cursor-pointer group">
                    <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <FileText className="w-3.5 h-3.5 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{doc.originalName}</p>
                      <p className="text-xs text-muted-foreground">
                        {doc.wordCount ? `${doc.wordCount.toLocaleString()} words · ` : ""}
                        {formatDistanceToNow(new Date(doc.createdAt), { addSuffix: true })}
                      </p>
                    </div>
                    <ArrowRight className="w-3.5 h-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="text-center py-10">
              <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-3">
                <BookOpen className="w-5 h-5 text-primary" />
              </div>
              <p className="text-sm text-muted-foreground mb-3">No documents yet</p>
              <Link href="/library">
                <Button size="sm" variant="outline" className="gap-1.5 text-xs">
                  <Plus className="w-3.5 h-3.5" /> Upload First Document
                </Button>
              </Link>
            </div>
          )}
        </div>

        {/* Upcoming Deadlines — 2 cols */}
        <div className="lg:col-span-2 study-card p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-sm flex items-center gap-2">
              <Calendar className="w-4 h-4 text-emerald-500" />
              Upcoming
            </h2>
            <Link href="/planner">
              <Button variant="ghost" size="sm" className="gap-1 text-xs h-7 text-muted-foreground hover:text-foreground">
                Planner <ChevronRight className="w-3 h-3" />
              </Button>
            </Link>
          </div>
          {tasksLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map(i => <Skeleton key={i} className="h-10 w-full" />)}
            </div>
          ) : upcomingTasks.length > 0 ? (
            <div className="space-y-2">
              {upcomingTasks.map((task) => (
                <div key={task.id} className="flex items-start gap-2.5 p-2.5 rounded-lg hover:bg-muted/40 transition-colors">
                  <div className={cn(
                    "w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0",
                    task.priority === "high" ? "bg-red-500" :
                    task.priority === "medium" ? "bg-amber-500" : "bg-emerald-500"
                  )} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate leading-tight">{task.title}</p>
                    {task.dueDate && (
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        {formatDistanceToNow(new Date(task.dueDate), { addSuffix: true })}
                      </p>
                    )}
                  </div>
                  <Badge
                    variant="secondary"
                    className={cn(
                      "text-[10px] px-1.5 py-0 border-0 flex-shrink-0",
                      task.priority === "high" ? "bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-400" :
                      task.priority === "medium" ? "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400" :
                      "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400"
                    )}
                  >
                    {task.priority}
                  </Badge>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-10">
              <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 flex items-center justify-center mx-auto mb-3">
                <Target className="w-5 h-5 text-emerald-500" />
              </div>
              <p className="text-sm text-muted-foreground mb-3">No upcoming deadlines</p>
              <Link href="/planner">
                <Button size="sm" variant="outline" className="gap-1.5 text-xs">
                  <Plus className="w-3.5 h-3.5" /> Add Task
                </Button>
              </Link>
            </div>
          )}
        </div>
      </div>

      {/* Spaced Repetition Banner */}
      {dueCards && dueCards.length > 0 && (
        <div
          className="study-card p-5 border-l-4 border-l-violet-500 animate-slide-up bg-gradient-to-r from-violet-500/5 to-transparent"
          style={{ animationDelay: "0.2s" }}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-violet-500/10 flex items-center justify-center">
                <Activity className="w-5 h-5 text-violet-500" />
              </div>
              <div>
                <p className="font-semibold text-sm">Spaced Repetition Due</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {dueCards.length} card{dueCards.length !== 1 ? "s" : ""} ready for review — keep your streak going
                </p>
              </div>
            </div>
            <Link href="/spaced-rep">
              <Button size="sm" className="gap-2 bg-violet-600 hover:bg-violet-700 text-white">
                Review Now <ArrowRight className="w-3.5 h-3.5" />
              </Button>
            </Link>
          </div>
        </div>
      )}

      {/* Total study time footer stat */}
      <div className="flex items-center gap-2 text-xs text-muted-foreground/60 animate-fade-in pb-2" style={{ animationDelay: "0.25s" }}>
        <Clock className="w-3 h-3" />
        <span>{totalStudyMinutes} total study minutes logged on syllabAI</span>
      </div>
    </div>
  );
}
