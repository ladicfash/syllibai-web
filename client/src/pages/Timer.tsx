import { useState, useEffect, useRef, useCallback } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { toast } from "sonner";
import { Play, Pause, RotateCcw, Settings, Coffee, Brain, Flame, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";

type SessionType = "work" | "short_break" | "long_break";

const SESSION_LABELS: Record<SessionType, string> = {
  work: "Focus Session",
  short_break: "Short Break",
  long_break: "Long Break",
};

const SESSION_COLORS: Record<SessionType, string> = {
  work: "text-violet-500",
  short_break: "text-emerald-500",
  long_break: "text-blue-500",
};

const SESSION_BG: Record<SessionType, string> = {
  work: "from-violet-500/20 to-primary/10",
  short_break: "from-emerald-500/20 to-teal-500/10",
  long_break: "from-blue-500/20 to-sky-500/10",
};

function playBeep(frequency = 880, duration = 0.3, volume = 0.4) {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = frequency;
    osc.type = "sine";
    gain.gain.setValueAtTime(volume, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + duration);
  } catch {}
}

function playSessionComplete() {
  setTimeout(() => playBeep(660, 0.2), 0);
  setTimeout(() => playBeep(880, 0.2), 250);
  setTimeout(() => playBeep(1100, 0.4), 500);
}

export default function Timer() {
  const [workMins, setWorkMins] = useState(25);
  const [shortBreakMins, setShortBreakMins] = useState(5);
  const [longBreakMins, setLongBreakMins] = useState(15);
  const [sessionType, setSessionType] = useState<SessionType>("work");
  const [secondsLeft, setSecondsLeft] = useState(workMins * 60);
  const [running, setRunning] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [sessionsCompleted, setSessionsCompleted] = useState(0);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const utils = trpc.useUtils();
  const saveSession = trpc.timer.saveSession.useMutation({ onSuccess: () => utils.timer.history.invalidate() });
  const { data: history } = trpc.timer.history.useQuery();

  const totalSeconds = {
    work: workMins * 60,
    short_break: shortBreakMins * 60,
    long_break: longBreakMins * 60,
  }[sessionType];

  const progress = ((totalSeconds - secondsLeft) / totalSeconds) * 100;
  const circumference = 2 * Math.PI * 90;
  const strokeDashoffset = circumference - (progress / 100) * circumference;

  const mins = Math.floor(secondsLeft / 60).toString().padStart(2, "0");
  const secs = (secondsLeft % 60).toString().padStart(2, "0");

  const reset = useCallback(() => {
    setRunning(false);
    if (intervalRef.current) clearInterval(intervalRef.current);
    setSecondsLeft(totalSeconds);
  }, [totalSeconds]);

  useEffect(() => { reset(); }, [sessionType, workMins, shortBreakMins, longBreakMins]);

  useEffect(() => {
    if (running) {
      intervalRef.current = setInterval(() => {
        setSecondsLeft((prev) => {
          if (prev <= 1) {
            clearInterval(intervalRef.current!);
            setRunning(false);
            playSessionComplete();
            const mins = sessionType === "work" ? workMins : sessionType === "short_break" ? shortBreakMins : longBreakMins;
            saveSession.mutate({ sessionType, durationMinutes: mins });
            if (sessionType === "work") setSessionsCompleted((c) => c + 1);
            toast.success(`${SESSION_LABELS[sessionType]} complete!`);
            return 0;
          }
          if (prev === 60) playBeep(440, 0.15, 0.2);
          return prev - 1;
        });
      }, 1000);
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current);
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [running, sessionType]);

  const todayWork = history?.filter((s) => {
    const today = new Date();
    const d = new Date(s.createdAt);
    return s.sessionType === "work" && d.toDateString() === today.toDateString();
  }) ?? [];
  const todayMinutes = todayWork.reduce((acc, s) => acc + s.durationMinutes, 0);

  return (
    <div className="mobile-page p-6 max-w-4xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between animate-slide-up">
        <div>
          <h1 className="text-2xl font-bold font-serif">Study Timer</h1>
          <p className="text-muted-foreground text-sm mt-0.5">Pomodoro technique for deep focus</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => setShowSettings(!showSettings)} className="gap-2">
          <Settings className="w-4 h-4" />
          {showSettings ? "Hide" : "Settings"}
        </Button>
      </div>

      {/* Settings Panel */}
      {showSettings && (
        <div className="study-card p-5 animate-slide-up space-y-5">
          <h3 className="font-semibold text-sm">Timer Settings</h3>
          <div className="grid sm:grid-cols-3 gap-6">
            {[
              { label: "Focus Duration", value: workMins, setter: setWorkMins, min: 5, max: 90, color: "text-violet-500" },
              { label: "Short Break", value: shortBreakMins, setter: setShortBreakMins, min: 1, max: 30, color: "text-emerald-500" },
              { label: "Long Break", value: longBreakMins, setter: setLongBreakMins, min: 5, max: 60, color: "text-blue-500" },
            ].map((s) => (
              <div key={s.label} className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium">{s.label}</label>
                  <span className={cn("text-lg font-bold", s.color)}>{s.value}m</span>
                </div>
                <Slider
                  value={[s.value]}
                  onValueChange={([v]) => s.setter(v)}
                  min={s.min}
                  max={s.max}
                  step={1}
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Session Type Selector */}
      <div className="flex gap-2 justify-center animate-fade-in">
        {(["work", "short_break", "long_break"] as SessionType[]).map((type) => (
          <button
            key={type}
            onClick={() => setSessionType(type)}
            className={cn(
              "px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200",
              sessionType === type
                ? "bg-primary text-primary-foreground shadow-sm"
                : "bg-muted text-muted-foreground hover:bg-muted/80"
            )}
          >
            {type === "work" ? "Focus" : type === "short_break" ? "Short Break" : "Long Break"}
          </button>
        ))}
      </div>

      {/* Timer Circle */}
      <div className={cn("flex flex-col items-center py-8 rounded-2xl bg-gradient-to-br animate-fade-in", SESSION_BG[sessionType])}>
        <div className="relative w-52 h-52">
          <svg className="w-full h-full -rotate-90" viewBox="0 0 200 200">
            {/* Track */}
            <circle cx="100" cy="100" r="90" fill="none" stroke="currentColor" strokeWidth="8" className="text-border opacity-30" />
            {/* Progress */}
            <circle
              cx="100" cy="100" r="90"
              fill="none"
              stroke="currentColor"
              strokeWidth="8"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              className={cn("progress-ring-circle", SESSION_COLORS[sessionType])}
            />
          </svg>
          {/* Time display */}
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-5xl font-bold font-mono tracking-tight">{mins}:{secs}</span>
            <span className={cn("text-sm font-medium mt-1", SESSION_COLORS[sessionType])}>
              {SESSION_LABELS[sessionType]}
            </span>
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-4 mt-6">
          <Button variant="outline" size="icon" onClick={reset} className="w-11 h-11 rounded-full">
            <RotateCcw className="w-4 h-4" />
          </Button>
          <Button
            size="icon"
            onClick={() => setRunning(!running)}
            className={cn("w-16 h-16 rounded-full shadow-lg text-lg transition-all duration-200", running ? "bg-amber-500 hover:bg-amber-600 animate-pulse-glow" : "bg-primary hover:bg-primary/90")}
          >
            {running ? <Pause className="w-6 h-6" /> : <Play className="w-6 h-6 ml-0.5" />}
          </Button>
          <div className="w-11 h-11" />
        </div>
      </div>

      {/* Today's Stats */}
      <div className="grid grid-cols-3 gap-4 animate-slide-up">
        {[
          { label: "Today's Focus", value: `${todayMinutes}m`, icon: Flame, color: "text-amber-500", bg: "bg-amber-50 dark:bg-amber-950/30" },
          { label: "Sessions Done", value: sessionsCompleted, icon: Brain, color: "text-violet-500", bg: "bg-violet-50 dark:bg-violet-950/30" },
          { label: "Total Sessions", value: history?.filter(s => s.sessionType === "work").length ?? 0, icon: Clock, color: "text-blue-500", bg: "bg-blue-50 dark:bg-blue-950/30" },
        ].map((stat) => (
          <div key={stat.label} className="study-card p-4 text-center">
            <div className={cn("w-9 h-9 rounded-xl mx-auto mb-2 flex items-center justify-center", stat.bg)}>
              <stat.icon className={cn("w-4.5 h-4.5", stat.color)} />
            </div>
            <p className="text-2xl font-bold">{stat.value}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* Session History */}
      {history && history.length > 0 && (
        <div className="study-card p-5 animate-slide-up">
          <h3 className="font-semibold mb-4 flex items-center gap-2">
            <Clock className="w-4 h-4 text-muted-foreground" />
            Recent Sessions
          </h3>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {history.slice(0, 15).map((session) => (
              <div key={session.id} className="flex items-center justify-between py-2 border-b border-border/50 last:border-0">
                <div className="flex items-center gap-3">
                  {session.sessionType === "work" ? (
                    <Brain className="w-4 h-4 text-violet-500" />
                  ) : (
                    <Coffee className="w-4 h-4 text-emerald-500" />
                  )}
                  <span className="text-sm">{SESSION_LABELS[session.sessionType as SessionType]}</span>
                </div>
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  <span className="font-medium">{session.durationMinutes}m</span>
                  <span>{format(new Date(session.createdAt), "MMM d, h:mm a")}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
