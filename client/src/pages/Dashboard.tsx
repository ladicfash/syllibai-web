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
  ChevronRight, Activity, BarChart2
} from "lucide-react";
import { formatDistanceToNow, isToday, isThisWeek } from "date-fns";
import { cn } from "@/lib/utils";

const quickActions = [
  { label: "Upload Document", icon: Upload, path: "/library", accent: "from-[#3b9edd]/20 to-[#3b9edd]/5", iconColor: "text-[#3b9edd]", border: "border-[#3b9edd]/20" },
  { label: "Study Tools", icon: Brain, path: "/study-tools", accent: "from-violet-500/20 to-violet-500/5", iconColor: "text-violet-500", border: "border-violet-500/20" },
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

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-7">

      {/* Header */}
      <div className="flex items-start justify-between animate-slide-up">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-[#3b9edd] mb-1">Dashboard</p>
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
                stroke="#3b9edd" strokeWidth="4"
                strokeLinecap="round"
                strokeDasharray={`${2 * Math.PI * 22}`}
                strokeDashoffset={`${2 * Math.PI * 22 * (1 - dailyProgress / 100)}`}
                className="transition-all duration-700"
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-xs font-bold">{dailyProgress}%</span>
            </div>
          </div>
          <p className="text-[10px] text-muted-foreground text-center leading-tight">Daily<br/>Goal</p>
        </div>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 animate-slide-up" style={{ animationDelay: "0.05s" }}>
        <StatCard label="Documents" value={docs?.length ?? 0} icon={BookOpen} color="text-[#3b9edd]" bg="bg-[#3b9edd]/10" loading={docsLoading} sub="in your library" />
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
              <BookOpen className="w-4 h-4 text-[#3b9edd]" />
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
                    <div className="w-8 h-8 rounded-lg bg-[#3b9edd]/10 flex items-center justify-center flex-shrink-0">
                      <FileText className="w-3.5 h-3.5 text-[#3b9edd]" />
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
              <div className="w-12 h-12 rounded-2xl bg-[#3b9edd]/10 flex items-center justify-center mx-auto mb-3">
                <BookOpen className="w-5 h-5 text-[#3b9edd]" />
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
