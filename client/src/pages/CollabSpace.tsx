import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  Users, Globe, Lock, Link as LinkIcon, Layers, StickyNote,
  Plus, Copy, ArrowRight, BookOpen, Search
} from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";

export default function CollabSpace() {
  const { isAuthenticated, user } = useAuth();
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<"community" | "mine">("community");
  const [showShareGuide, setShowShareGuide] = useState(false);

  const { data: decks, isLoading: decksLoading } = trpc.explore.decks.useQuery(undefined);
  const { data: notes, isLoading: notesLoading } = trpc.explore.notes.useQuery(undefined);

  const allItems = [
    ...(decks ?? []).map(d => ({ ...d, type: "deck" as const })),
    ...(notes ?? []).map(n => ({ ...n, type: "note" as const })),
  ];

  const filtered = allItems.filter(item =>
    !search || item.title.toLowerCase().includes(search.toLowerCase())
  );

  const myItems = filtered.filter(item => item.authorName === user?.name);
  const communityItems = filtered;

  const copyProfileLink = () => {
    const url = `${window.location.origin}/profile/${user?.id}`;
    navigator.clipboard.writeText(url);
    toast.success("Profile link copied to clipboard");
  };

  return (
    <div className="mobile-page p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-8">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <div className="w-8 h-8 rounded-lg bg-violet-500/15 flex items-center justify-center">
              <Users className="w-4 h-4 text-violet-500" />
            </div>
            <h1 className="text-2xl font-display font-bold tracking-tight">Collab Space</h1>
          </div>
          <p className="text-muted-foreground text-sm ml-11">
            Browse shared study sets and notes from the syllabAI community.
          </p>
        </div>
        {isAuthenticated && (
          <div className="flex items-center gap-2 flex-shrink-0">
            <Button variant="outline" size="sm" onClick={copyProfileLink}>
              <LinkIcon className="w-3.5 h-3.5 mr-1.5" />
              Share profile
            </Button>
            <Button
              size="sm"
              onClick={() => setShowShareGuide(true)}
            >
              <Plus className="w-3.5 h-3.5 mr-1.5" />
              Share content
            </Button>
          </div>
        )}
      </div>

      {/* Access gate for logged-out users */}
      {!isAuthenticated && (
        <div className="relative overflow-hidden rounded-2xl border border-violet-500/30 bg-gradient-to-br from-violet-500/8 to-transparent p-5 mb-6">
          <div className="flex items-center gap-4">
            <Lock className="w-5 h-5 text-violet-500 flex-shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-semibold">Sign in to collaborate</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Browse previews freely. Create a free account to access full study sets, save content, and share your own work.
              </p>
            </div>
            <Button
              size="sm"
              className="flex-shrink-0"
              onClick={() => { window.location.href = getLoginUrl(); }}
            >
              Get started free <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
            </Button>
          </div>
        </div>
      )}

      {/* Stats bar */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        {[
          { label: "Study Sets", value: decks?.length ?? 0, icon: Layers, color: "text-primary", bg: "bg-primary/10" },
          { label: "Notes", value: notes?.length ?? 0, icon: StickyNote, color: "text-amber-500", bg: "bg-amber-500/10" },
          { label: "Contributors", value: new Set([...(decks ?? []).map(d => d.authorName), ...(notes ?? []).map(n => n.authorName)].filter(Boolean)).size, icon: Users, color: "text-violet-500", bg: "bg-violet-500/10" },
        ].map(stat => (
          <div key={stat.label} className="rounded-xl border border-border bg-card p-4 flex items-center gap-3">
            <div className={cn("w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0", stat.bg)}>
              <stat.icon className={cn("w-4.5 h-4.5", stat.color)} />
            </div>
            <div>
              <p className="text-xl font-bold font-display leading-none">{stat.value}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{stat.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Search */}
      <div className="relative mb-5">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Search community content..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Tabs */}
      {isAuthenticated && (
        <div className="flex gap-1 mb-6 border-b border-border">
          {[
            { key: "community", label: "Community", count: communityItems.length },
            { key: "mine", label: "My Shared Content", count: myItems.length },
          ].map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key as "community" | "mine")}
              className={cn(
                "flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors",
                tab === t.key
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              )}
            >
              {t.label}
              <span className="ml-1 text-[10px] bg-muted px-1.5 py-0.5 rounded-full">{t.count}</span>
            </button>
          ))}
        </div>
      )}

      {/* Content grid */}
      {(decksLoading || notesLoading) ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-44 rounded-xl" />)}
        </div>
      ) : (tab === "mine" ? myItems : communityItems).length === 0 ? (
        <div className="text-center py-20">
          <BookOpen className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-muted-foreground text-sm">
            {tab === "mine"
              ? "You haven't shared any content yet. Use the Share button in Notes or Study Tools."
              : "No community content yet. Be the first to share!"}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {(tab === "mine" ? myItems : communityItems).map(item => (
            <CollabCard key={`${item.type}-${item.id}`} item={item} isLoggedIn={isAuthenticated} />
          ))}
        </div>
      )}

      {/* Share guide dialog */}
      <Dialog open={showShareGuide} onOpenChange={setShowShareGuide}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Globe className="w-4.5 h-4.5 text-primary" />
              How to share content
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            {[
              { step: "1", title: "Go to Notes or Study Tools", desc: "Open the page with the content you want to share." },
              { step: "2", title: "Click the Share button", desc: "Look for the globe icon in the page header. A popup will open." },
              { step: "3", title: "Choose what to share", desc: "Select specific notes or decks, set visibility (Public / Link-only / Private), then confirm." },
              { step: "4", title: "Your content appears here", desc: "Public content is immediately visible in the Collab Space and Explore page for anyone to discover." },
            ].map(({ step, title, desc }) => (
              <div key={step} className="flex gap-3">
                <div className="w-7 h-7 rounded-full bg-primary/15 flex items-center justify-center flex-shrink-0 text-xs font-bold text-primary">{step}</div>
                <div>
                  <p className="text-sm font-medium">{title}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{desc}</p>
                </div>
              </div>
            ))}
            <Button className="w-full mt-2" onClick={() => setShowShareGuide(false)}>
              Got it
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function CollabCard({ item, isLoggedIn }: { item: any; isLoggedIn: boolean }) {
  const isNote = item.type === "note";

  return (
    <div className={cn(
      "group relative rounded-xl border border-border bg-card p-5 transition-all duration-200",
      "hover:border-primary/40 hover:shadow-lg hover:shadow-primary/5 hover:-translate-y-0.5"
    )}>
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className={cn(
          "w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0",
          isNote ? "bg-amber-500/15" : "bg-primary/15"
        )}>
          {isNote
            ? <StickyNote className="w-4 h-4 text-amber-500" />
            : <Layers className="w-4 h-4 text-primary" />
          }
        </div>
        <div className="flex items-center gap-1.5">
          <Badge variant="secondary" className="text-[10px]">
            {isNote ? "Note" : `${item.cardCount ?? 0} cards`}
          </Badge>
          <Globe className="w-3 h-3 text-muted-foreground/50" />
        </div>
      </div>
      <h3 className="font-semibold text-sm line-clamp-2 mb-1 leading-snug">{item.title}</h3>
      {!isNote && item.description && (
        <p className="text-xs text-muted-foreground line-clamp-2 mb-2">{item.description}</p>
      )}
      {isNote && (
        <p className={cn("text-xs text-muted-foreground line-clamp-2 mb-2", !isLoggedIn && "blur-[2px]")}>
          {item.preview?.slice(0, 100)}...
        </p>
      )}
      <div className="flex items-center gap-2 pt-2 border-t border-border/50">
        <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground flex-1 min-w-0">
          <Users className="w-3 h-3 flex-shrink-0" />
          <span className="truncate">{item.authorName ?? "Anonymous"}</span>
        </div>
        <span className="text-[10px] text-muted-foreground">
          {formatDistanceToNow(new Date(item.createdAt), { addSuffix: true })}
        </span>
      </div>

      {/* Hover overlay */}
      {!isLoggedIn ? (
        <div
          className="absolute inset-0 rounded-xl flex items-end p-4 opacity-0 group-hover:opacity-100 transition-opacity bg-gradient-to-t from-background/90 to-transparent cursor-pointer"
          onClick={() => { window.location.href = getLoginUrl(); }}
        >
          <div className="flex items-center gap-2 text-xs font-medium text-primary">
            <Lock className="w-3.5 h-3.5" /> Sign in for full access
          </div>
        </div>
      ) : (
        <a href={isNote ? `/explore/note/${item.shareSlug}` : `/explore/deck/${item.shareSlug}`}>
          <div className="absolute inset-0 rounded-xl flex items-end p-4 opacity-0 group-hover:opacity-100 transition-opacity bg-gradient-to-t from-background/80 to-transparent cursor-pointer">
            <div className="flex items-center gap-2 text-xs font-medium text-primary">
              {isNote ? "Read note" : "Study this set"} <ArrowRight className="w-3.5 h-3.5" />
            </div>
          </div>
        </a>
      )}
    </div>
  );
}
