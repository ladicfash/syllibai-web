import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { Zap, Brain, CheckCheck, RotateCcw, TrendingUp, Calendar, Star, ChevronRight, Wand2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { format, formatDistanceToNow } from "date-fns";
import { EmptyState } from "@/components/study/EmptyState";
import { Link } from "wouter";

const QUALITY_BUTTONS = [
  { quality: 0, label: "Blackout", desc: "Complete blank", color: "border-red-400 text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30" },
  { quality: 1, label: "Wrong", desc: "Incorrect, recalled", color: "border-orange-400 text-orange-600 hover:bg-orange-50 dark:hover:bg-orange-950/30" },
  { quality: 2, label: "Hard", desc: "Correct, very hard", color: "border-amber-400 text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/30" },
  { quality: 3, label: "Good", desc: "Correct with effort", color: "border-yellow-400 text-yellow-600 hover:bg-yellow-50 dark:hover:bg-yellow-950/30" },
  { quality: 4, label: "Easy", desc: "Correct, small hesitation", color: "border-emerald-400 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/30" },
  { quality: 5, label: "Perfect", desc: "Instant recall", color: "border-green-500 text-green-700 hover:bg-green-50 dark:hover:bg-green-950/30" },
];

export default function SpacedRep() {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [reviewed, setReviewed] = useState(0);
  const [sessionDone, setSessionDone] = useState(false);

  const utils = trpc.useUtils();
  const { data: dueCards, isLoading } = trpc.decks.dueCards.useQuery();
  const reviewCard = trpc.decks.reviewCard.useMutation({
    onSuccess: (result) => {
      utils.decks.dueCards.invalidate();
    },
  });

  const cards = dueCards ?? [];
  const card = cards[currentIndex];
  const remaining = cards.length - currentIndex;

  const handleRate = async (quality: number) => {
    if (!card) return;
    await reviewCard.mutateAsync({
      cardId: card.id,
      quality,
      currentInterval: card.interval,
      currentRepetitions: card.repetitions,
      currentEaseFactor: card.easeFactor,
    });
    setReviewed(r => r + 1);
    if (currentIndex >= cards.length - 1) {
      setSessionDone(true);
    } else {
      setRevealed(false);
      setCurrentIndex(i => i + 1);
    }
  };

  if (isLoading) return (
    <div className="mobile-page p-6 max-w-3xl mx-auto space-y-6">
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-64 w-full rounded-2xl" />
    </div>
  );

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div className="animate-slide-up">
        <h1 className="text-2xl font-bold font-serif flex items-center gap-2">
          <Zap className="w-6 h-6 text-violet-500" />
          Spaced Repetition
        </h1>
        <p className="text-muted-foreground text-sm mt-0.5">SM-2 algorithm — review cards at the optimal moment</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 animate-fade-in">
        {[
          { label: "Due Today", value: cards.length, icon: Calendar, color: "text-violet-500", bg: "bg-violet-50 dark:bg-violet-950/30" },
          { label: "Reviewed", value: reviewed, icon: CheckCheck, color: "text-emerald-500", bg: "bg-emerald-50 dark:bg-emerald-950/30" },
          { label: "Remaining", value: Math.max(0, remaining), icon: Brain, color: "text-amber-500", bg: "bg-amber-50 dark:bg-amber-950/30" },
        ].map((s) => (
          <div key={s.label} className="study-card p-4 text-center">
            <div className={cn("w-9 h-9 rounded-xl mx-auto mb-2 flex items-center justify-center", s.bg)}>
              <s.icon className={cn("w-4.5 h-4.5", s.color)} />
            </div>
            <p className="text-2xl font-bold">{s.value}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Session Complete */}
      {sessionDone ? (
        <div className="study-card p-10 text-center animate-scale-in">
          <div className="w-16 h-16 rounded-full bg-emerald-100 dark:bg-emerald-950/30 flex items-center justify-center mx-auto mb-4">
            <Star className="w-8 h-8 text-emerald-500" />
          </div>
          <h2 className="text-2xl font-bold font-serif mb-2">Session Complete!</h2>
          <p className="text-muted-foreground mb-6">You reviewed {reviewed} card{reviewed !== 1 ? "s" : ""}. Cards are now scheduled for optimal future review.</p>
          <Button onClick={() => { setCurrentIndex(0); setReviewed(0); setSessionDone(false); setRevealed(false); utils.decks.dueCards.invalidate(); }} className="gap-2">
            <RotateCcw className="w-4 h-4" /> Start New Session
          </Button>
        </div>
      ) : cards.length === 0 ? (
        <EmptyState
          icon={CheckCheck}
          title="All caught up"
          description="No cards are due right now. Keep the habit going by generating a new deck in Study Studio or checking back tomorrow."
          actions={<Link href="/study-tools"><Button className="gap-2"><Wand2 className="w-4 h-4" /> Open Study Studio</Button></Link>}
        />
      ) : card ? (
        <div className="space-y-4 animate-fade-in">
          {/* Progress */}
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>Card {currentIndex + 1} of {cards.length}</span>
            <span>Ease: {card.easeFactor.toFixed(1)} · Interval: {card.interval}d</span>
          </div>
          <div className="h-1.5 bg-muted rounded-full overflow-hidden">
            <div className="h-full bg-gradient-to-r from-violet-500 to-primary rounded-full transition-all duration-500" style={{ width: `${(currentIndex / cards.length) * 100}%` }} />
          </div>

          {/* Card */}
          <div
            className="study-card p-8 min-h-[200px] flex flex-col items-center justify-center text-center cursor-pointer group transition-all duration-200 hover:shadow-md"
            onClick={() => !revealed && setRevealed(true)}
          >
            <Badge variant="secondary" className="mb-4 text-xs">Question</Badge>
            <p className="text-lg font-medium leading-relaxed mb-4">{card.question}</p>
            {!revealed && (
              <p className="text-sm text-muted-foreground group-hover:text-primary transition-colors">
                Click to reveal answer
              </p>
            )}
          </div>

          {/* Answer */}
          {revealed && (
            <div className="study-card p-6 bg-primary/5 border-primary/20 text-center animate-slide-up">
              <Badge className="mb-3 text-xs">Answer</Badge>
              <p className="text-base leading-relaxed">{card.answer}</p>
            </div>
          )}

          {/* Rating Buttons */}
          {revealed && (
            <div className="animate-slide-up">
              <p className="text-sm text-center text-muted-foreground mb-3 font-medium">How well did you recall this?</p>
              <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                {QUALITY_BUTTONS.map((btn) => (
                  <button
                    key={btn.quality}
                    onClick={() => handleRate(btn.quality)}
                    disabled={reviewCard.isPending}
                    className={cn(
                      "flex flex-col items-center p-3 rounded-xl border-2 transition-all duration-150 text-center",
                      btn.color,
                      "hover:scale-105 active:scale-95"
                    )}
                  >
                    <span className="font-semibold text-sm">{btn.label}</span>
                    <span className="text-xs opacity-70 mt-0.5 hidden sm:block">{btn.desc}</span>
                  </button>
                ))}
              </div>
              <p className="text-xs text-center text-muted-foreground mt-3">
                Ratings 0-2 reset the card · 3-5 advance the schedule
              </p>
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
