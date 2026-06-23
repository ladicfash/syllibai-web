import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { Globe, Link2, StickyNote, Layers, Check, Copy, Lock } from "lucide-react";
import { cn } from "@/lib/utils";

const SUBJECTS = [
  "Biology", "Chemistry", "Physics", "Mathematics",
  "History", "Literature", "Computer Science", "Economics", "Psychology", "Other"
];

interface SharePopupProps {
  open: boolean;
  onClose: () => void;
}

export function SharePopup({ open, onClose }: SharePopupProps) {
  const [tab, setTab] = useState<"notes" | "decks">("notes");
  const [selectedNotes, setSelectedNotes] = useState<number[]>([]);
  const [selectedDecks, setSelectedDecks] = useState<number[]>([]);
  const [noteSubjects, setNoteSubjects] = useState<Record<number, string>>({});
  const [deckSubjects, setDeckSubjects] = useState<Record<number, string>>({});
  const [deckDescriptions, setDeckDescriptions] = useState<Record<number, string>>({});
  const [publishedLinks, setPublishedLinks] = useState<{ type: string; title: string; url: string }[]>([]);
  const [step, setStep] = useState<"pick" | "done">("pick");

  const { data: notes } = trpc.notes.list.useQuery();
  const { data: decks } = trpc.decks.list.useQuery();

  const publishNoteMut = trpc.share.publishNote.useMutation();
  const publishDeckMut = trpc.share.publishDeck.useMutation();

  const toggleNote = (id: number) =>
    setSelectedNotes(prev => prev.includes(id) ? prev.filter(n => n !== id) : [...prev, id]);
  const toggleDeck = (id: number) =>
    setSelectedDecks(prev => prev.includes(id) ? prev.filter(d => d !== id) : [...prev, id]);

  const handlePublish = async () => {
    const links: { type: string; title: string; url: string }[] = [];
    const base = window.location.origin;

    for (const noteId of selectedNotes) {
      const note = notes?.find(n => n.id === noteId);
      if (!note) continue;
      try {
        const res = await publishNoteMut.mutateAsync({
          noteId,
          isPublic: true,
          subject: noteSubjects[noteId],
        });
        links.push({ type: "note", title: note.title, url: `${base}/explore/note/${res.slug}` });
      } catch (e) {
        toast.error(`Failed to share note: ${note.title}`);
      }
    }

    for (const deckId of selectedDecks) {
      const deck = decks?.find(d => d.id === deckId);
      if (!deck) continue;
      try {
        const res = await publishDeckMut.mutateAsync({
          deckId,
          isPublic: true,
          description: deckDescriptions[deckId],
          subject: deckSubjects[deckId],
        });
        links.push({ type: "deck", title: deck.title, url: `${base}/explore/deck/${res.slug}` });
      } catch (e) {
        toast.error(`Failed to share deck: ${deck.title}`);
      }
    }

    setPublishedLinks(links);
    setStep("done");
  };

  const copyLink = (url: string) => {
    navigator.clipboard.writeText(url);
    toast.success("Link copied to clipboard");
  };

  const handleClose = () => {
    setStep("pick");
    setSelectedNotes([]);
    setSelectedDecks([]);
    setPublishedLinks([]);
    onClose();
  };

  const totalSelected = selectedNotes.length + selectedDecks.length;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg w-full">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base font-semibold">
            <Globe className="w-4 h-4 text-[#3b9edd]" />
            Share to Explore
          </DialogTitle>
        </DialogHeader>

        {step === "pick" && (
          <>
            <p className="text-xs text-muted-foreground -mt-1 mb-3">
              Choose what to make public. Anyone can browse — only signed-in users see the full content.
            </p>

            <Tabs value={tab} onValueChange={v => setTab(v as "notes" | "decks")}>
              <TabsList className="w-full mb-3">
                <TabsTrigger value="notes" className="flex-1 text-xs">
                  <StickyNote className="w-3.5 h-3.5 mr-1.5" />
                  Notes
                  {selectedNotes.length > 0 && (
                    <Badge className="ml-1.5 h-4 px-1 text-[10px] bg-[#3b9edd] text-white">{selectedNotes.length}</Badge>
                  )}
                </TabsTrigger>
                <TabsTrigger value="decks" className="flex-1 text-xs">
                  <Layers className="w-3.5 h-3.5 mr-1.5" />
                  Study Sets
                  {selectedDecks.length > 0 && (
                    <Badge className="ml-1.5 h-4 px-1 text-[10px] bg-[#3b9edd] text-white">{selectedDecks.length}</Badge>
                  )}
                </TabsTrigger>
              </TabsList>

              <TabsContent value="notes">
                {!notes || notes.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground text-sm">
                    No notes yet. Create some in the Notes page.
                  </div>
                ) : (
                  <ScrollArea className="h-64">
                    <div className="space-y-2 pr-2">
                      {notes.map(note => (
                        <div
                          key={note.id}
                          className={cn(
                            "flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-all",
                            selectedNotes.includes(note.id)
                              ? "border-[#3b9edd]/50 bg-[#3b9edd]/5"
                              : "border-border hover:border-border/80 hover:bg-muted/30"
                          )}
                          onClick={() => toggleNote(note.id)}
                        >
                          <Checkbox
                            checked={selectedNotes.includes(note.id)}
                            onCheckedChange={() => toggleNote(note.id)}
                            className="mt-0.5 flex-shrink-0"
                          />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{note.title}</p>
                            <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">
                              {note.content?.slice(0, 60)}...
                            </p>
                            {selectedNotes.includes(note.id) && (
                              <div className="mt-2" onClick={e => e.stopPropagation()}>
                                <Label className="text-[10px] text-muted-foreground mb-1 block">Subject (optional)</Label>
                                <div className="flex flex-wrap gap-1">
                                  {SUBJECTS.map(s => (
                                    <button
                                      key={s}
                                      onClick={() => setNoteSubjects(prev => ({ ...prev, [note.id]: s }))}
                                      className={cn(
                                        "px-2 py-0.5 rounded-full text-[10px] border transition-all",
                                        noteSubjects[note.id] === s
                                          ? "bg-[#3b9edd] text-white border-[#3b9edd]"
                                          : "border-border text-muted-foreground hover:border-[#3b9edd]/50"
                                      )}
                                    >
                                      {s}
                                    </button>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                )}
              </TabsContent>

              <TabsContent value="decks">
                {!decks || decks.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground text-sm">
                    No study sets yet. Generate flashcards in Study Tools.
                  </div>
                ) : (
                  <ScrollArea className="h-64">
                    <div className="space-y-2 pr-2">
                      {decks.map(deck => (
                        <div
                          key={deck.id}
                          className={cn(
                            "flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-all",
                            selectedDecks.includes(deck.id)
                              ? "border-[#3b9edd]/50 bg-[#3b9edd]/5"
                              : "border-border hover:border-border/80 hover:bg-muted/30"
                          )}
                          onClick={() => toggleDeck(deck.id)}
                        >
                          <Checkbox
                            checked={selectedDecks.includes(deck.id)}
                            onCheckedChange={() => toggleDeck(deck.id)}
                            className="mt-0.5 flex-shrink-0"
                          />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{deck.title}</p>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              {deck.cardCount ?? 0} cards
                            </p>
                            {selectedDecks.includes(deck.id) && (
                              <div className="mt-2 space-y-2" onClick={e => e.stopPropagation()}>
                                <div>
                                  <Label className="text-[10px] text-muted-foreground mb-1 block">Description (optional)</Label>
                                  <Input
                                    placeholder="What is this set about?"
                                    value={deckDescriptions[deck.id] ?? ""}
                                    onChange={e => setDeckDescriptions(prev => ({ ...prev, [deck.id]: e.target.value }))}
                                    className="h-7 text-xs"
                                  />
                                </div>
                                <div>
                                  <Label className="text-[10px] text-muted-foreground mb-1 block">Subject (optional)</Label>
                                  <div className="flex flex-wrap gap-1">
                                    {SUBJECTS.map(s => (
                                      <button
                                        key={s}
                                        onClick={() => setDeckSubjects(prev => ({ ...prev, [deck.id]: s }))}
                                        className={cn(
                                          "px-2 py-0.5 rounded-full text-[10px] border transition-all",
                                          deckSubjects[deck.id] === s
                                            ? "bg-[#3b9edd] text-white border-[#3b9edd]"
                                            : "border-border text-muted-foreground hover:border-[#3b9edd]/50"
                                        )}
                                      >
                                        {s}
                                      </button>
                                    ))}
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                )}
              </TabsContent>
            </Tabs>

            <div className="flex items-center justify-between pt-3 border-t border-border mt-2">
              <p className="text-xs text-muted-foreground">
                {totalSelected === 0 ? "Nothing selected" : `${totalSelected} item${totalSelected !== 1 ? "s" : ""} selected`}
              </p>
              <div className="flex gap-2">
                <Button variant="ghost" size="sm" onClick={handleClose}>Cancel</Button>
                <Button
                  size="sm"
                  disabled={totalSelected === 0 || publishNoteMut.isPending || publishDeckMut.isPending}
                  onClick={handlePublish}
                  className="bg-[#3b9edd] hover:bg-[#2d8bc7] text-white"
                >
                  <Globe className="w-3.5 h-3.5 mr-1.5" />
                  Publish {totalSelected > 0 ? `(${totalSelected})` : ""}
                </Button>
              </div>
            </div>
          </>
        )}

        {step === "done" && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm font-medium text-green-600 dark:text-green-400">
              <Check className="w-4 h-4" />
              Published successfully
            </div>
            <p className="text-xs text-muted-foreground">
              These items are now visible on the Explore page. Share the links below with anyone.
            </p>
            <ScrollArea className="max-h-48">
              <div className="space-y-2 pr-1">
                {publishedLinks.map((link, i) => (
                  <div key={i} className="flex items-center gap-2 p-2.5 rounded-lg border border-border bg-muted/30">
                    {link.type === "note"
                      ? <StickyNote className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />
                      : <Layers className="w-3.5 h-3.5 text-[#3b9edd] flex-shrink-0" />
                    }
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium truncate">{link.title}</p>
                      <p className="text-[10px] text-muted-foreground truncate">{link.url}</p>
                    </div>
                    <button
                      onClick={() => copyLink(link.url)}
                      className="p-1.5 rounded hover:bg-muted transition-colors flex-shrink-0"
                    >
                      <Copy className="w-3.5 h-3.5 text-muted-foreground" />
                    </button>
                  </div>
                ))}
              </div>
            </ScrollArea>
            <div className="flex justify-end pt-2">
              <Button size="sm" onClick={handleClose}>Done</Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
