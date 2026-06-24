import { useState } from "react";
import { useRoute, Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { AccessGate } from "@/components/AccessGate";
import {
  User, Layers, StickyNote, Globe, ArrowRight, Lock,
  BookOpen, Calendar
} from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";

export default function Profile() {
  const [, params] = useRoute("/profile/:userId");
  const userId = params?.userId ? parseInt(params.userId) : undefined;
  const { isAuthenticated, user } = useAuth();
  const [tab, setTab] = useState<"decks" | "notes">("decks");

  const { data: decks, isLoading: decksLoading } = trpc.explore.decks.useQuery(undefined);
  const { data: notes, isLoading: notesLoading } = trpc.explore.notes.useQuery(undefined);

  // Filter to only this user's content when a userId param is present
  const userDecks = userId ? (decks ?? []).filter(d => d.authorId === userId) : (decks ?? []);
  const userNotes = userId ? (notes ?? []).filter(n => n.authorId === userId) : (notes ?? []);

  const authorName = userDecks[0]?.authorName ?? userNotes[0]?.authorName ?? "Student";
  const isOwnProfile = user && (!userId || user.id === userId);

  return (
    <div className="mobile-page p-6 max-w-5xl mx-auto">
      {/* Profile header */}
      <div className="flex items-start gap-5 mb-8 pb-8 border-b border-border">
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary/30 to-violet-500/30 flex items-center justify-center flex-shrink-0">
          <User className="w-8 h-8 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-display font-bold tracking-tight truncate">{authorName}</h1>
          <div className="flex items-center gap-4 mt-1.5 flex-wrap">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Layers className="w-3.5 h-3.5" />
              {userDecks.length} public study set{userDecks.length !== 1 ? "s" : ""}
            </div>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <StickyNote className="w-3.5 h-3.5" />
              {userNotes.length} public note{userNotes.length !== 1 ? "s" : ""}
            </div>
          </div>
          {isOwnProfile && (
            <p className="text-xs text-muted-foreground mt-2">
              This is your public profile. Share your profile link to let others browse your public content.
            </p>
          )}
        </div>
        {isOwnProfile && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              navigator.clipboard.writeText(window.location.href);
            }}
            className="flex-shrink-0"
          >
            <Globe className="w-3.5 h-3.5 mr-1.5" />
            Copy profile link
          </Button>
        )}
      </div>

      {/* Access gate banner for logged-out users */}
      {!isAuthenticated && (
        <div className="relative overflow-hidden rounded-2xl border border-primary/30 bg-gradient-to-br from-primary/8 to-transparent p-5 mb-6">
          <div className="flex items-center gap-4">
            <Lock className="w-5 h-5 text-primary flex-shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-semibold">Sign in to access full content</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                You can browse previews here. Create a free account to flip all flashcards and read full notes.
              </p>
            </div>
            <Button
              size="sm"
              className="flex-shrink-0 bg-primary hover:bg-primary/90 text-white"
              onClick={() => { window.location.href = getLoginUrl(); }}
            >
              Sign in free <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
            </Button>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 mb-6 border-b border-border">
        {[
          { key: "decks", label: "Study Sets", icon: Layers, count: userDecks.length },
          { key: "notes", label: "Notes", icon: StickyNote, count: userNotes.length },
        ].map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key as "decks" | "notes")}
            className={cn(
              "flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors",
              tab === t.key
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            <t.icon className="w-4 h-4" />
            {t.label}
            {t.count > 0 && (
              <span className="ml-1 text-[10px] bg-muted px-1.5 py-0.5 rounded-full">{t.count}</span>
            )}
          </button>
        ))}
      </div>

      {/* Study Sets */}
      {tab === "decks" && (
        <>
          {decksLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-40 rounded-xl" />)}
            </div>
          ) : userDecks.length === 0 ? (
            <div className="text-center py-20">
              <Layers className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-muted-foreground text-sm">No public study sets yet.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {userDecks.map(deck => (
                <div key={deck.id} className="group relative rounded-xl border border-border bg-card p-5 transition-all hover:border-primary/40 hover:shadow-lg hover:-translate-y-0.5">
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="w-9 h-9 rounded-lg bg-primary/15 flex items-center justify-center">
                      <Layers className="w-4 h-4 text-primary" />
                    </div>
                    <Badge variant="secondary" className="text-[10px]">{deck.cardCount ?? 0} cards</Badge>
                  </div>
                  <h3 className="font-semibold text-sm line-clamp-2 mb-1">{deck.title}</h3>
                  {deck.description && (
                    <p className="text-xs text-muted-foreground line-clamp-2 mb-2">{deck.description}</p>
                  )}
                  {deck.subject && <Badge variant="outline" className="text-[10px] px-1.5">{deck.subject}</Badge>}

                  {/* Gate overlay for logged-out users */}
                  {!isAuthenticated ? (
                    <div className="absolute inset-0 rounded-xl flex items-end p-4 opacity-0 group-hover:opacity-100 transition-opacity bg-gradient-to-t from-background/90 to-transparent cursor-pointer"
                      onClick={() => { window.location.href = getLoginUrl(); }}>
                      <div className="flex items-center gap-2 text-xs font-medium text-primary">
                        <Lock className="w-3.5 h-3.5" /> Sign in for full access
                      </div>
                    </div>
                  ) : (
                    <Link href={`/explore/deck/${deck.shareSlug}`}>
                      <div className="absolute inset-0 rounded-xl flex items-end p-4 opacity-0 group-hover:opacity-100 transition-opacity bg-gradient-to-t from-background/80 to-transparent cursor-pointer">
                        <div className="flex items-center gap-2 text-xs font-medium text-primary">
                          Study this set <ArrowRight className="w-3.5 h-3.5" />
                        </div>
                      </div>
                    </Link>
                  )}
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* Notes */}
      {tab === "notes" && (
        <>
          {notesLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-40 rounded-xl" />)}
            </div>
          ) : userNotes.length === 0 ? (
            <div className="text-center py-20">
              <StickyNote className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-muted-foreground text-sm">No public notes yet.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {userNotes.map(note => (
                <div key={note.id} className="group relative rounded-xl border border-border bg-card p-5 transition-all hover:border-primary/40 hover:shadow-lg hover:-translate-y-0.5">
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="w-9 h-9 rounded-lg bg-amber-500/15 flex items-center justify-center">
                      <StickyNote className="w-4 h-4 text-amber-500" />
                    </div>
                    {note.subject && <Badge variant="outline" className="text-[10px] px-1.5">{note.subject}</Badge>}
                  </div>
                  <h3 className="font-semibold text-sm line-clamp-1 mb-1">{note.title}</h3>
                  <div className="relative">
                    <p className={cn("text-xs text-muted-foreground line-clamp-3 leading-relaxed", !isAuthenticated && "blur-[2px]")}>
                      {note.preview?.slice(0, 120)}...
                    </p>
                    {!isAuthenticated && (
                      <div className="absolute bottom-0 left-0 right-0 h-6 bg-gradient-to-t from-card to-transparent" />
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground mt-3 pt-2 border-t border-border/50">
                    <Calendar className="w-3 h-3" />
                    {formatDistanceToNow(new Date(note.createdAt), { addSuffix: true })}
                  </div>
                  {!isAuthenticated ? (
                    <div className="absolute inset-0 rounded-xl flex items-end p-4 opacity-0 group-hover:opacity-100 transition-opacity bg-gradient-to-t from-background/90 to-transparent cursor-pointer"
                      onClick={() => { window.location.href = getLoginUrl(); }}>
                      <div className="flex items-center gap-2 text-xs font-medium text-primary">
                        <Lock className="w-3.5 h-3.5" /> Sign in to read full note
                      </div>
                    </div>
                  ) : (
                    <Link href={`/explore/note/${note.shareSlug}`}>
                      <div className="absolute inset-0 rounded-xl flex items-end p-4 opacity-0 group-hover:opacity-100 transition-opacity bg-gradient-to-t from-background/80 to-transparent cursor-pointer">
                        <div className="flex items-center gap-2 text-xs font-medium text-primary">
                          Read note <ArrowRight className="w-3.5 h-3.5" />
                        </div>
                      </div>
                    </Link>
                  )}
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
