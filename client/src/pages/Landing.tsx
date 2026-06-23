import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";
import { useEffect, useRef, useState } from "react";
import {
  Brain, Zap, Clock, FileText, Mic, FlaskConical,
  ArrowRight, CheckCircle2, ChevronRight, Star,
  BookOpen, Target, Calendar, StickyNote, BarChart3,
  Upload, Layers, Sparkles, TrendingUp, Code2, Landmark, Globe
} from "lucide-react";

const LOGO_URL = "/manus-storage/syllibai-logo_2db0f2cf.png";
const ICON_URL = "/manus-storage/syllibai-icon_7a0c12a1.jpeg";

const features = [
  {
    icon: Brain,
    title: "AI Study Tools",
    desc: "Flashcards, Cornell notes, mind maps, timelines, and flowcharts — generated from your documents in seconds.",
    color: "from-blue-500/20 to-blue-600/5",
    iconColor: "text-blue-500",
  },
  {
    icon: Zap,
    title: "Spaced Repetition",
    desc: "SM-2 algorithm schedules your reviews at the exact moment your memory needs reinforcement. Built to surpass Anki.",
    color: "from-violet-500/20 to-violet-600/5",
    iconColor: "text-violet-500",
  },
  {
    icon: Clock,
    title: "Pomodoro Timer",
    desc: "Customizable work/break cycles with session history and sound alerts to keep your focus locked in.",
    color: "from-emerald-500/20 to-emerald-600/5",
    iconColor: "text-emerald-500",
  },
  {
    icon: Upload,
    title: "Smart File Library",
    desc: "Upload PDFs, images, DOCX files. Preview, convert, and extract text — even from photos via OCR.",
    color: "from-amber-500/20 to-amber-600/5",
    iconColor: "text-amber-500",
  },
  {
    icon: FlaskConical,
    title: "Simulation Environments",
    desc: "Role-aware AI scenarios for medical, finance, coding, and history. Learn by doing, not memorizing.",
    color: "from-rose-500/20 to-rose-600/5",
    iconColor: "text-rose-500",
  },
  {
    icon: Mic,
    title: "Voice Notes + Whisper",
    desc: "Record lectures or thoughts. Whisper AI transcribes them instantly and converts to study materials.",
    color: "from-sky-500/20 to-sky-600/5",
    iconColor: "text-sky-500",
  },
  {
    icon: Calendar,
    title: "Planner & Deadlines",
    desc: "AI detects deadlines from your syllabi. Calendar view, task tracking, and assignment management.",
    color: "from-indigo-500/20 to-indigo-600/5",
    iconColor: "text-indigo-500",
  },
  {
    icon: StickyNote,
    title: "Inline Notes",
    desc: "Color-coded, pinnable notes with rich editing. Share specific notes via email or phone — selectively.",
    color: "from-pink-500/20 to-pink-600/5",
    iconColor: "text-pink-500",
  },
];

const toolMarqueeItems = [
  "Flashcards", "Mind Maps", "Cornell Notes", "Timelines", "Flowcharts",
  "Spaced Repetition", "Pomodoro Timer", "Voice Notes", "OCR", "Simulations",
  "Planner", "Quiz Mode", "Key Points", "TTS Read-Aloud", "File Conversion",
];

const stats = [
  { value: "10+", label: "Study Tools" },
  { value: "AI", label: "Powered" },
  { value: "∞", label: "Documents" },
  { value: "Free", label: "To Start" },
];

export default function Landing() {
  const { isAuthenticated, loading } = useAuth();
  const [, setLocation] = useLocation();
  const [scrollY, setScrollY] = useState(0);

  useEffect(() => {
    if (!loading && isAuthenticated) {
      setLocation("/dashboard");
    }
  }, [isAuthenticated, loading, setLocation]);

  useEffect(() => {
    const handleScroll = () => setScrollY(window.scrollY);
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const handleStart = () => {
    if (isAuthenticated) {
      setLocation("/dashboard");
    } else {
      window.location.href = getLoginUrl();
    }
  };

  const doubled = [...toolMarqueeItems, ...toolMarqueeItems];

  return (
    <div className="min-h-screen bg-background overflow-x-hidden">

      {/* ── Navbar ─────────────────────────────────────────────────────── */}
      <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrollY > 40
          ? "bg-background/90 backdrop-blur-xl border-b border-border shadow-sm"
          : "bg-transparent"
      }`}>
        <div className="container flex items-center justify-between h-16">
          <img src={LOGO_URL} alt="syllabAI" className="h-8 object-contain" />
          <div className="hidden md:flex items-center gap-8 text-sm font-medium text-muted-foreground">
            <a href="#features" className="hover:text-foreground transition-colors">Features</a>
            <a href="#how-it-works" className="hover:text-foreground transition-colors">How It Works</a>
            <a href="#simulations" className="hover:text-foreground transition-colors">Simulations</a>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={handleStart} className="hidden sm:flex text-muted-foreground hover:text-foreground">
              Sign in
            </Button>
            <Button size="sm" onClick={handleStart} className="gap-1.5 shadow-md shadow-primary/20">
              Get Started <ArrowRight className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>
      </nav>

      {/* ── Hero ───────────────────────────────────────────────────────── */}
      <section className="relative min-h-screen flex flex-col items-center justify-center pt-16 overflow-hidden">
        {/* Background layers */}
        <div className="absolute inset-0 landing-grid" />
        <div className="absolute inset-0 landing-glow" />
        <div className="absolute inset-0 landing-noise pointer-events-none" />

        {/* Floating orbs */}
        <div
          className="absolute top-1/4 -left-40 w-[500px] h-[500px] rounded-full opacity-[0.12] blur-3xl pointer-events-none"
          style={{
            background: "oklch(0.52 0.19 232)",
            transform: `translateY(${scrollY * 0.12}px)`,
          }}
        />
        <div
          className="absolute bottom-1/4 -right-40 w-96 h-96 rounded-full opacity-[0.10] blur-3xl pointer-events-none"
          style={{
            background: "oklch(0.55 0.2 285)",
            transform: `translateY(${scrollY * -0.08}px)`,
          }}
        />

        <div className="container relative z-10 flex flex-col items-center text-center gap-8 py-24">
          {/* Badge */}
          <div className="pill-badge animate-fade-in">
            <Sparkles className="w-3 h-3" />
            AI-Powered Academic Platform
          </div>

          {/* Headline */}
          <h1
            className="font-display text-5xl sm:text-6xl md:text-7xl lg:text-[5.5rem] font-bold leading-[0.92] tracking-tight max-w-5xl animate-slide-up"
            style={{ animationDelay: "0.05s" }}
          >
            Study Smarter.{" "}
            <br className="hidden sm:block" />
            <span className="relative inline-block mt-2">
              <span className="gradient-text">Not Harder.</span>
              {/* Underline squiggle */}
              <svg
                className="absolute -bottom-3 left-0 w-full"
                viewBox="0 0 400 14"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                preserveAspectRatio="none"
              >
                <path
                  d="M2 9 Q50 3 100 9 Q150 15 200 9 Q250 3 300 9 Q350 15 398 9"
                  stroke="oklch(0.52 0.19 232)"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  fill="none"
                  opacity="0.55"
                />
              </svg>
            </span>
          </h1>

          {/* Subheadline */}
          <p
            className="text-lg sm:text-xl text-muted-foreground max-w-2xl leading-relaxed animate-slide-up"
            style={{ animationDelay: "0.1s" }}
          >
            Upload your syllabus, notes, or textbook.{" "}
            <strong className="text-foreground font-semibold">syllabAI</strong> extracts every deadline,
            builds your flashcards, maps your knowledge, and schedules your reviews — before you even open a notebook.
          </p>

          {/* CTAs */}
          <div
            className="flex flex-col sm:flex-row items-center gap-4 animate-slide-up"
            style={{ animationDelay: "0.15s" }}
          >
            <Button
              size="lg"
              onClick={handleStart}
              className="gap-2 px-8 h-12 text-base shadow-xl shadow-primary/30 hover:shadow-primary/45 transition-all hover:-translate-y-0.5"
            >
              Start Studying Free
              <ArrowRight className="w-4 h-4" />
            </Button>
            <Button
              variant="outline"
              size="lg"
              className="gap-2 px-8 h-12 text-base bg-background/60 backdrop-blur-sm"
              onClick={() => document.getElementById("features")?.scrollIntoView({ behavior: "smooth" })}
            >
              <BookOpen className="w-4 h-4" />
              See All Features
            </Button>
          </div>

          {/* Trust signals */}
          <div
            className="flex items-center gap-2 text-sm text-muted-foreground animate-fade-in"
            style={{ animationDelay: "0.2s" }}
          >
            <div className="flex -space-x-0.5">
              {[...Array(5)].map((_, i) => (
                <Star key={i} className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
              ))}
            </div>
            <span>No credit card required · Free to start</span>
          </div>

          {/* Stats row */}
          <div
            className="grid grid-cols-4 gap-8 mt-2 pt-8 border-t border-border/50 w-full max-w-md animate-fade-in"
            style={{ animationDelay: "0.25s" }}
          >
            {stats.map((s) => (
              <div key={s.label} className="text-center">
                <div className="font-display text-3xl font-bold text-primary">{s.value}</div>
                <div className="text-xs text-muted-foreground mt-1 font-medium">{s.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Scroll indicator */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1 opacity-40 animate-bounce">
          <div className="w-px h-8 bg-gradient-to-b from-transparent to-primary" />
          <ChevronRight className="w-4 h-4 rotate-90 text-primary" />
        </div>
      </section>

      {/* ── Marquee ─────────────────────────────────────────────────────── */}
      <section className="py-5 border-y border-border bg-muted/20 overflow-hidden">
        <div className="flex overflow-hidden">
          <div className="marquee-track">
            {doubled.map((tool, i) => (
              <span
                key={i}
                className="flex items-center gap-3 text-sm font-semibold text-muted-foreground whitespace-nowrap"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-primary/60 inline-block flex-shrink-0" />
                {tool}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* ── Features ────────────────────────────────────────────────────── */}
      <section id="features" className="py-28 relative">
        <div className="container">
          {/* Section header */}
          <div className="flex flex-col items-center text-center gap-4 mb-16">
            <div className="pill-badge">
              <Layers className="w-3 h-3" />
              Everything You Need
            </div>
            <h2 className="font-display text-4xl sm:text-5xl font-bold tracking-tight max-w-2xl leading-tight">
              One Platform.{" "}
              <span className="gradient-text">Every Study Tool.</span>
            </h2>
            <p className="text-muted-foreground text-lg max-w-xl">
              From AI-generated flashcards to spaced repetition, from voice notes to exam planners — all seamlessly integrated.
            </p>
          </div>

          {/* Feature grid — 4 cols on large, 2 on md, 1 on sm */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {features.map((f, i) => (
              <div
                key={f.title}
                className="feature-card group"
                style={{ animationDelay: `${i * 0.05}s` }}
              >
                <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${f.color} flex items-center justify-center mb-4`}>
                  <f.icon className={`w-5 h-5 ${f.iconColor}`} />
                </div>
                <h3 className="font-display font-semibold text-base mb-2 leading-snug">{f.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── How It Works ────────────────────────────────────────────────── */}
      <section id="how-it-works" className="py-28 bg-muted/25 relative overflow-hidden">
        <div className="absolute inset-0 landing-grid opacity-40" />
        <div className="container relative z-10">
          <div className="flex flex-col items-center text-center gap-4 mb-16">
            <div className="pill-badge">
              <Target className="w-3 h-3" />
              How It Works
            </div>
            <h2 className="font-display text-4xl sm:text-5xl font-bold tracking-tight leading-tight">
              Three Steps to{" "}
              <span className="gradient-text">Deep Understanding</span>
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-4xl mx-auto">
            {[
              {
                step: "01",
                icon: Upload,
                title: "Upload Your Materials",
                desc: "Drop in PDFs, DOCX files, images, or even photos of your notes. OCR extracts text from anything.",
              },
              {
                step: "02",
                icon: Brain,
                title: "AI Does the Heavy Lifting",
                desc: "syllabAI generates flashcards, mind maps, Cornell notes, quizzes, and key points — all from your content.",
              },
              {
                step: "03",
                icon: BarChart3,
                title: "Study Smarter Over Time",
                desc: "Spaced repetition schedules your reviews. The planner tracks deadlines. The timer keeps you focused.",
              },
            ].map((step, i) => (
              <div key={step.step} className="relative flex flex-col items-center text-center gap-4">
                {i < 2 && (
                  <div className="hidden md:block absolute top-8 left-[calc(50%+3.5rem)] w-[calc(100%-7rem)] h-px border-t border-dashed border-border" />
                )}
                <div className="relative">
                  <div className="w-16 h-16 rounded-2xl bg-primary/8 border border-primary/20 flex items-center justify-center">
                    <step.icon className="w-7 h-7 text-primary" />
                  </div>
                  <div className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs font-bold flex items-center justify-center font-mono">
                    {i + 1}
                  </div>
                </div>
                <h3 className="font-display font-semibold text-lg">{step.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Simulations ─────────────────────────────────────────────────── */}
      <section id="simulations" className="py-28 relative overflow-hidden">
        <div className="absolute inset-0 landing-glow opacity-40" />
        <div className="container relative z-10">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            <div className="flex flex-col gap-6">
              <div className="pill-badge w-fit">
                <FlaskConical className="w-3 h-3" />
                Simulation Environments
              </div>
              <h2 className="font-display text-4xl sm:text-5xl font-bold tracking-tight leading-tight">
                Learn by Doing,{" "}
                <span className="gradient-text">Not Memorizing</span>
              </h2>
              <p className="text-muted-foreground text-lg leading-relaxed">
                Role-aware AI scenarios put you in the room. Diagnose patients, analyze markets, debug systems, or rewrite history — with contextually accurate AI feedback at every step.
              </p>
              <div className="flex flex-col gap-3">
                {[
                  { icon: FlaskConical, label: "Medical", desc: "Clinical case scenarios & diagnostic reasoning", color: "text-rose-500" },
                  { icon: TrendingUp, label: "Finance", desc: "Investment decisions & market analysis", color: "text-emerald-500" },
                  { icon: Code2, label: "Coding", desc: "Technical interviews & system design", color: "text-blue-500" },
                  { icon: Landmark, label: "History", desc: "What-if scenarios & historical analysis", color: "text-amber-500" },
                ].map((item) => (
                  <div key={item.label} className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
                      <item.icon className={`w-4 h-4 ${item.color}`} />
                    </div>
                    <div>
                      <span className="text-sm font-semibold">{item.label}</span>
                      <span className="text-sm text-muted-foreground"> — {item.desc}</span>
                    </div>
                  </div>
                ))}
              </div>
              <Button onClick={handleStart} className="gap-2 w-fit shadow-md shadow-primary/20">
                Try a Simulation <ArrowRight className="w-4 h-4" />
              </Button>
            </div>

            {/* Simulation preview card */}
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-br from-primary/10 to-violet-500/10 rounded-3xl blur-2xl scale-95" />
              <div className="relative bg-card border border-border rounded-2xl p-6 shadow-2xl">
                <div className="flex items-center gap-3 mb-4 pb-4 border-b border-border">
                  <div className="w-8 h-8 rounded-lg bg-rose-500/10 flex items-center justify-center">
                    <FlaskConical className="w-4 h-4 text-rose-500" />
                  </div>
                  <div>
                    <div className="text-sm font-semibold font-display">Medical Simulation</div>
                    <div className="text-xs text-muted-foreground">Clinical Case #47</div>
                  </div>
                  <div className="ml-auto px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 text-xs font-semibold">● Live</div>
                </div>
                <div className="space-y-3">
                  <div className="bg-muted/50 rounded-xl p-3">
                    <p className="text-xs text-muted-foreground mb-1 font-semibold uppercase tracking-wide">Patient Presentation</p>
                    <p className="text-sm leading-relaxed">A 58-year-old male presents with sudden onset chest pain radiating to the left arm, diaphoresis, and shortness of breath...</p>
                  </div>
                  <div className="bg-primary/5 border border-primary/20 rounded-xl p-3">
                    <p className="text-xs text-primary font-semibold mb-1 uppercase tracking-wide">Your Response</p>
                    <p className="text-sm text-muted-foreground italic">Order a 12-lead ECG and troponin levels immediately...</p>
                  </div>
                  <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-xl p-3">
                    <p className="text-xs text-emerald-600 font-semibold mb-1 uppercase tracking-wide">AI Feedback</p>
                    <p className="text-sm text-muted-foreground">Excellent clinical reasoning. ECG shows ST elevation in leads II, III, aVF — consistent with inferior STEMI...</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Collaborate Section ──────────────────────────────────────── */}
      <section className="py-28 relative overflow-hidden">
        <div className="absolute inset-0 landing-grid opacity-30" />
        <div className="container relative z-10">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            {/* Left: copy */}
            <div className="flex flex-col gap-6">
              <div className="pill-badge w-fit">
                <Globe className="w-3 h-3" />
                Explore & Collaborate
              </div>
              <h2 className="font-display text-4xl sm:text-5xl font-bold tracking-tight leading-tight">
                Share What You Know.{" "}
                <span className="gradient-text">Learn Together.</span>
              </h2>
              <p className="text-muted-foreground text-lg leading-relaxed">
                Publish your best study sets and notes to the public Explore feed — or keep them private. Anyone can browse; only members can unlock full content.
              </p>
              <div className="flex flex-col gap-3">
                {[
                  { icon: CheckCircle2, label: "Selective sharing", desc: "Choose exactly which notes and decks to make public" },
                  { icon: CheckCircle2, label: "Quizlet-style gating", desc: "Guests see previews; full access requires an account" },
                  { icon: CheckCircle2, label: "Subject tagging", desc: "Browse by subject — Biology, CS, History, and more" },
                ].map((item) => (
                  <div key={item.label} className="flex items-start gap-3">
                    <item.icon className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                    <div>
                      <span className="text-sm font-semibold">{item.label}</span>
                      <span className="text-sm text-muted-foreground"> — {item.desc}</span>
                    </div>
                  </div>
                ))}
              </div>
              <Button onClick={handleStart} variant="outline" className="gap-2 w-fit">
                Browse Explore <ArrowRight className="w-4 h-4" />
              </Button>
            </div>
            {/* Right: mock Explore card */}
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-br from-sky-500/10 to-violet-500/10 rounded-3xl blur-2xl scale-95" />
              <div className="relative bg-card border border-border rounded-2xl p-6 shadow-2xl space-y-3">
                <div className="flex items-center justify-between pb-4 border-b border-border">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-full bg-primary/20 flex items-center justify-center text-xs font-bold text-primary">S</div>
                    <div>
                      <p className="text-sm font-semibold">Organic Chemistry — Exam 2</p>
                      <p className="text-xs text-muted-foreground">by @student · 48 cards</p>
                    </div>
                  </div>
                  <span className="px-2 py-0.5 rounded-full bg-sky-500/10 text-sky-600 text-[10px] font-semibold">Chemistry</span>
                </div>
                {/* Blurred preview cards */}
                {["Describe the mechanism of an SN2 reaction.", "What is Markovnikov's rule?", "Define chirality and give an example."].map((q, i) => (
                  <div key={i} className={`bg-muted/50 rounded-xl p-3 ${i > 0 ? "relative overflow-hidden" : ""}`}>
                    <p className="text-xs text-muted-foreground mb-0.5 font-semibold uppercase tracking-wide">Card {i + 1}</p>
                    <p className={`text-sm ${i > 0 ? "blur-[3px] select-none" : ""}`}>{q}</p>
                    {i > 0 && (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <span className="text-[10px] font-semibold text-muted-foreground bg-background/80 px-2 py-0.5 rounded-full border border-border">Sign in to unlock</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── CTA ─────────────────────────────────────────────────────────── */}
      <section className="py-32 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/6 via-transparent to-violet-500/6" />
        <div className="absolute inset-0 landing-grid opacity-25" />
        {/* Big blurred circle behind CTA */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full opacity-10 blur-3xl"
          style={{ background: "oklch(0.52 0.19 232)" }} />
        <div className="container relative z-10 flex flex-col items-center text-center gap-8">
          <img src={ICON_URL} alt="syllabAI" className="w-16 h-16 rounded-2xl shadow-xl shadow-primary/20" />
          <h2 className="font-display text-4xl sm:text-5xl md:text-6xl font-bold tracking-tight max-w-3xl leading-tight">
            Ready to Transform{" "}
            <span className="gradient-text">How You Study?</span>
          </h2>
          <p className="text-muted-foreground text-lg max-w-xl">
            Join students who are already studying smarter with AI-powered tools built for deep understanding.
          </p>
          <Button
            size="lg"
            onClick={handleStart}
            className="gap-2 px-12 h-14 text-lg shadow-2xl shadow-primary/35 hover:shadow-primary/50 transition-all hover:-translate-y-0.5"
          >
            Get Started Free
            <ArrowRight className="w-5 h-5" />
          </Button>
          <p className="text-xs text-muted-foreground">No credit card required · Works on any device</p>
        </div>
      </section>

      {/* ── Footer ──────────────────────────────────────────────────────── */}
      <footer className="border-t border-border py-12">
        <div className="container flex flex-col md:flex-row items-center justify-between gap-6">
          <img src={LOGO_URL} alt="syllabAI" className="h-7 object-contain" />
          <p className="text-xs text-muted-foreground text-center max-w-md italic leading-relaxed">
            "The best platform would be invisible — it removes friction between you and deep understanding,
            rather than adding features for their own sake."
          </p>
          <p className="text-xs text-muted-foreground whitespace-nowrap">
            © {new Date().getFullYear()} syllabAI
          </p>
        </div>
      </footer>
    </div>
  );
}
