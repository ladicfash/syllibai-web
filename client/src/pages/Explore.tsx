import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Search, BookOpen, StickyNote, Lock, Globe, Layers,
  User, Clock, ArrowRight, Sparkles, GraduationCap
} from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import { AccessGate } from "@/components/AccessGate";

const SUBJECTS = [
  "All", "Biology", "Chemistry", "Physics", "Mathematics",
  "History", "Literature", "Computer Science", "Economics", "Psychology", "Other"
];

function AccessGateBanner() {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-primary/30 bg-gradient-to-br from-primary/10 to-transparent p-6 mb-8">
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
        <div className="w-12 h-12 rounded-xl bg-primary/20 flex items-center justify-center flex-shrink-0">
          <GraduationCap className="w-6 h-6 text-primary" />
        </div>
        <div className="flex-1">
          <p className="font-semibold text-foreground text-sm">Create a free account to unlock everything</p>
          <p className="text-muted-foreground text-xs mt-0.5">
            Browse previews freely — sign in to view full study sets, flip all flashcards, and save content to your library.
          </p>
        </div>
        <Button
          size="sm"
          className="flex-shrink-0 bg-primary hover:bg-primary/90 text-white"
          onClick={() => window.location.href = getLoginUrl()}
        >
          Sign in free
          <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
        </Button>
      </div>
    </div>
  );
}

function DeckCard({ deck, isLoggedIn }: { deck: any; isLoggedIn: boolean }) {
  return (
    <div className={cn(
      "group relative rounded-xl border border-border bg-card p-5 transition-all duration-200",
      "hover:border-primary/40 hover:shadow-lg hover:shadow-primary/5 hover:-translate-y-0.5"
    )}>
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="w-9 h-9 rounded-lg bg-primary/15 flex items-center justify-center flex-shrink-0">
          <Layers className="w-4.5 h-4.5 text-primary" />
        </div>
        <Badge variant="secondary" className="text-[10px] font-medium shrink-0">
          {deck.cardCount ?? 0} cards
        </Badge>
      </div>
      <h3 className="font-semibold text-sm text-foreground line-clamp-2 mb-1 leading-snug">{deck.title}</h3>
      {deck.description && (
        <p className="text-xs text-muted-foreground line-clamp-2 mb-3">{deck.description}</p>
      )}
      <div className="flex items-center gap-2 mt-auto pt-2 border-t border-border/50">
        <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground flex-1 min-w-0">
          <User className="w-3 h-3 flex-shrink-0" />
          <span className="truncate">{deck.authorName ?? "Anonymous"}</span>
        </div>
        {deck.subject && (
          <Badge variant="outline" className="text-[10px] px-1.5 py-0 shrink-0">{deck.subject}</Badge>
        )}
      </div>
      {/* Overlay for logged-out */}
      {!isLoggedIn && (
        <Link href={`/explore/deck/${deck.shareSlug}`}>
          <div className="absolute inset-0 rounded-xl flex items-end p-4 opacity-0 group-hover:opacity-100 transition-opacity bg-gradient-to-t from-background/90 to-transparent cursor-pointer">
            <div className="flex items-center gap-2 text-xs font-medium text-primary">
              <Lock className="w-3.5 h-3.5" />
              Preview (sign in for full access)
            </div>
          </div>
        </Link>
      )}
      {isLoggedIn && (
        <Link href={`/explore/deck/${deck.shareSlug}`}>
          <div className="absolute inset-0 rounded-xl flex items-end p-4 opacity-0 group-hover:opacity-100 transition-opacity bg-gradient-to-t from-background/80 to-transparent cursor-pointer">
            <div className="flex items-center gap-2 text-xs font-medium text-primary">
              Study this set
              <ArrowRight className="w-3.5 h-3.5" />
            </div>
          </div>
        </Link>
      )}
    </div>
  );
}

function NoteCard({ note, isLoggedIn }: { note: any; isLoggedIn: boolean }) {
  const preview = note.preview?.slice(0, 120) ?? "";
  return (
    <div className={cn(
      "group relative rounded-xl border border-border bg-card p-5 transition-all duration-200",
      "hover:border-primary/40 hover:shadow-lg hover:shadow-primary/5 hover:-translate-y-0.5"
    )}>
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="w-9 h-9 rounded-lg bg-amber-500/15 flex items-center justify-center flex-shrink-0">
          <StickyNote className="w-4.5 h-4.5 text-amber-500" />
        </div>
        {note.subject && (
          <Badge variant="outline" className="text-[10px] px-1.5 py-0 shrink-0">{note.subject}</Badge>
        )}
      </div>
      <h3 className="font-semibold text-sm text-foreground line-clamp-1 mb-1">{note.title}</h3>
      <div className="relative">
        <p className="text-xs text-muted-foreground line-clamp-3 leading-relaxed">{preview}</p>
        {!isLoggedIn && (
          <div className="absolute bottom-0 left-0 right-0 h-8 bg-gradient-to-t from-card to-transparent" />
        )}
      </div>
      <div className="flex items-center gap-2 mt-3 pt-2 border-t border-border/50">
        <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground flex-1 min-w-0">
          <User className="w-3 h-3 flex-shrink-0" />
          <span className="truncate">{note.authorName ?? "Anonymous"}</span>
        </div>
        <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
          <Clock className="w-3 h-3" />
          {formatDistanceToNow(new Date(note.createdAt), { addSuffix: true })}
        </div>
      </div>
      {!isLoggedIn && (
        <div className="absolute inset-0 rounded-xl flex items-end p-4 opacity-0 group-hover:opacity-100 transition-opacity bg-gradient-to-t from-background/90 to-transparent cursor-pointer"
          onClick={() => window.location.href = getLoginUrl()}>
          <div className="flex items-center gap-2 text-xs font-medium text-primary">
            <Lock className="w-3.5 h-3.5" />
            Sign in to read full note
          </div>
        </div>
      )}
      {isLoggedIn && (
        <Link href={`/explore/note/${note.shareSlug}`}>
          <div className="absolute inset-0 rounded-xl flex items-end p-4 opacity-0 group-hover:opacity-100 transition-opacity bg-gradient-to-t from-background/80 to-transparent cursor-pointer">
            <div className="flex items-center gap-2 text-xs font-medium text-primary">
              Read note
              <ArrowRight className="w-3.5 h-3.5" />
            </div>
          </div>
        </Link>
      )}
    </div>
  );
}

export default function Explore() {
  const { isAuthenticated } = useAuth();
  const [tab, setTab] = useState<"decks" | "notes">("decks");
  const [search, setSearch] = useState("");
  const [subject, setSubject] = useState("All");

  const { data: decks, isLoading: decksLoading } = trpc.explore.decks.useQuery(
    subject !== "All" ? { subject } : undefined
  );
  const { data: notes, isLoading: notesLoading } = trpc.explore.notes.useQuery(
    subject !== "All" ? { subject } : undefined
  );

  const filteredDecks = (decks ?? []).filter(d =>
    !search || d.title.toLowerCase().includes(search.toLowerCase())
  );
  const filteredNotes = (notes ?? []).filter(n =>
    !search || n.title.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="mobile-page p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-1">
          <div className="w-8 h-8 rounded-lg bg-primary/15 flex items-center justify-center">
            <Globe className="w-4 h-4 text-primary" />
          </div>
          <h1 className="text-2xl font-display font-bold tracking-tight">Explore</h1>
        </div>
        <p className="text-muted-foreground text-sm ml-11">
          Discover study sets and notes shared by the syllabAI community.
        </p>
      </div>

      {/* Access gate for logged-out users */}
      {!isAuthenticated && <AccessGateBanner />}

      {/* Search + subject filter */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search study sets and notes..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      {/* Subject chips */}
      <div className="flex gap-2 flex-wrap mb-6">
        {SUBJECTS.map(s => (
          <button
            key={s}
            onClick={() => setSubject(s)}
            className={cn(
              "px-3 py-1 rounded-full text-xs font-medium transition-all border",
              subject === s
                ? "bg-primary text-white border-primary"
                : "bg-transparent text-muted-foreground border-border hover:border-primary/50 hover:text-foreground"
            )}
          >
            {s}
          </button>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 border-b border-border">
        <button
          onClick={() => setTab("decks")}
          className={cn(
            "flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors",
            tab === "decks"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          )}
        >
          <Layers className="w-4 h-4" />
          Study Sets
          {filteredDecks.length > 0 && (
            <span className="ml-1 text-[10px] bg-muted px-1.5 py-0.5 rounded-full">{filteredDecks.length}</span>
          )}
        </button>
        <button
          onClick={() => setTab("notes")}
          className={cn(
            "flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors",
            tab === "notes"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          )}
        >
          <StickyNote className="w-4 h-4" />
          Notes
          {filteredNotes.length > 0 && (
            <span className="ml-1 text-[10px] bg-muted px-1.5 py-0.5 rounded-full">{filteredNotes.length}</span>
          )}
        </button>
      </div>

      {/* Content */}
      {tab === "decks" && (
        <>
          {decksLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-40 rounded-xl" />
              ))}
            </div>
          ) : filteredDecks.length === 0 ? (
            <div className="text-center py-20">
              <Layers className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-muted-foreground text-sm">No public study sets yet.</p>
              {isAuthenticated && (
                <p className="text-xs text-muted-foreground mt-1">
                  Be the first — share a deck from your <Link href="/study-tools" className="text-primary hover:underline">Study Tools</Link>.
                </p>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredDecks.map(deck => (
                <DeckCard key={deck.id} deck={deck} isLoggedIn={isAuthenticated} />
              ))}
            </div>
          )}
        </>
      )}

      {tab === "notes" && (
        <>
          {notesLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-40 rounded-xl" />
              ))}
            </div>
          ) : filteredNotes.length === 0 ? (
            <div className="text-center py-20">
              <StickyNote className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-muted-foreground text-sm">No public notes yet.</p>
              {isAuthenticated && (
                <p className="text-xs text-muted-foreground mt-1">
                  Share a note from your <Link href="/notes" className="text-primary hover:underline">Notes</Link> page.
                </p>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredNotes.map(note => (
                <NoteCard key={note.id} note={note} isLoggedIn={isAuthenticated} />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
