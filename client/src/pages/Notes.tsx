import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { Plus, Pin, PinOff, Trash2, Share2, Edit3, Check, X, Search, Mail, Globe } from "lucide-react";
import { SharePopup } from "@/components/SharePopup";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";

const NOTE_COLORS = [
  { id: "yellow", class: "note-yellow", hex: "#fef9c3" },
  { id: "blue", class: "note-blue", hex: "#dbeafe" },
  { id: "green", class: "note-green", hex: "#dcfce7" },
  { id: "pink", class: "note-pink", hex: "#fce7f3" },
  { id: "purple", class: "note-purple", hex: "#f3e8ff" },
  { id: "orange", class: "note-orange", hex: "#ffedd5" },
];

function NoteCard({ note, onUpdate, onDelete, onToggleShare, selected, onSelect }: any) {
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(note.title);
  const [content, setContent] = useState(note.content);

  const colorClass = NOTE_COLORS.find(c => c.hex === note.color)?.class ?? "note-yellow";

  const save = () => {
    onUpdate(note.id, { title, content });
    setEditing(false);
  };

  return (
    <div className={cn("rounded-xl border-2 p-4 transition-all duration-200 group relative", colorClass, selected && "ring-2 ring-primary ring-offset-2")}>
      {/* Select checkbox */}
      <button
        onClick={() => onSelect(note.id)}
        className={cn("absolute top-3 right-3 w-5 h-5 rounded border-2 transition-all", selected ? "bg-primary border-primary" : "border-muted-foreground/30 opacity-0 group-hover:opacity-100")}
      >
        {selected && <Check className="w-3 h-3 text-white mx-auto" />}
      </button>

      {editing ? (
        <div className="space-y-2">
          <Input value={title} onChange={e => setTitle(e.target.value)} className="bg-white/60 dark:bg-black/20 text-sm font-semibold border-0 shadow-none px-0 h-auto" />
          <Textarea value={content} onChange={e => setContent(e.target.value)} className="bg-white/60 dark:bg-black/20 text-sm border-0 shadow-none px-0 resize-none min-h-[80px]" />
          <div className="flex gap-2">
            <Button size="sm" onClick={save} className="h-7 text-xs gap-1"><Check className="w-3 h-3" /> Save</Button>
            <Button size="sm" variant="ghost" onClick={() => setEditing(false)} className="h-7 text-xs gap-1"><X className="w-3 h-3" /> Cancel</Button>
          </div>
        </div>
      ) : (
        <>
          <div className="pr-6">
            <p className="font-semibold text-sm mb-1.5 text-gray-800 dark:text-gray-100">{note.title}</p>
            <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed whitespace-pre-wrap line-clamp-6">{note.content}</p>
          </div>
          <div className="flex items-center justify-between mt-3 pt-2 border-t border-black/5 dark:border-white/10">
            <span className="text-xs text-gray-500 dark:text-gray-400">{formatDistanceToNow(new Date(note.updatedAt), { addSuffix: true })}</span>
            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <button onClick={() => onUpdate(note.id, { isPinned: !note.isPinned })} className="p-1 rounded hover:bg-black/10 dark:hover:bg-white/10 transition-colors">
                {note.isPinned ? <PinOff className="w-3.5 h-3.5 text-gray-600 dark:text-gray-300" /> : <Pin className="w-3.5 h-3.5 text-gray-600 dark:text-gray-300" />}
              </button>
              <button onClick={() => setEditing(true)} className="p-1 rounded hover:bg-black/10 dark:hover:bg-white/10 transition-colors">
                <Edit3 className="w-3.5 h-3.5 text-gray-600 dark:text-gray-300" />
              </button>
              <button onClick={() => onDelete(note.id)} className="p-1 rounded hover:bg-red-100 dark:hover:bg-red-950/30 transition-colors">
                <Trash2 className="w-3.5 h-3.5 text-red-500" />
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export default function Notes() {
  const [search, setSearch] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [showShare, setShowShare] = useState(false);
  const [showSharePopup, setShowSharePopup] = useState(false);
  const [newTitle, setNewTitle] = useState("Untitled Note");
  const [newContent, setNewContent] = useState("");
  const [newColor, setNewColor] = useState("#fef9c3");
  const [selectedNotes, setSelectedNotes] = useState<Set<number>>(new Set());
  const [shareEmail, setShareEmail] = useState("");
  const [sharePhone, setSharePhone] = useState("");

  const utils = trpc.useUtils();
  const { data: notes, isLoading } = trpc.notes.list.useQuery();
  const createNote = trpc.notes.create.useMutation({ onSuccess: () => { utils.notes.list.invalidate(); setShowAdd(false); setNewTitle("Untitled Note"); setNewContent(""); toast.success("Note created"); } });
  const updateNote = trpc.notes.update.useMutation({ onSuccess: () => utils.notes.list.invalidate() });
  const deleteNote = trpc.notes.delete.useMutation({ onSuccess: () => { utils.notes.list.invalidate(); toast.success("Note deleted"); } });
  const shareNotes = trpc.notes.share.useMutation({
    onSuccess: (data) => {
      toast.success(`Share link created! Link: ${window.location.origin}${data.shareUrl}`);
      setShowShare(false);
      setSelectedNotes(new Set());
    },
  });

  const toggleSelect = (id: number) => {
    setSelectedNotes(prev => {
      const s = new Set(Array.from(prev));
      if (s.has(id)) s.delete(id); else s.add(id);
      return s;
    });
  };

  const filteredNotes = notes?.filter(n =>
    n.title.toLowerCase().includes(search.toLowerCase()) ||
    n.content.toLowerCase().includes(search.toLowerCase())
  ) ?? [];

  const pinnedNotes = filteredNotes.filter(n => n.isPinned);
  const unpinnedNotes = filteredNotes.filter(n => !n.isPinned);

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between animate-slide-up">
        <div>
          <h1 className="text-2xl font-bold font-serif">Notes</h1>
          <p className="text-muted-foreground text-sm mt-0.5">{notes?.length ?? 0} note{notes?.length !== 1 ? "s" : ""}</p>
        </div>
        <div className="flex gap-2">
          {selectedNotes.size > 0 && (
            <Button variant="outline" size="sm" onClick={() => setShowShare(true)} className="gap-1.5">
              <Share2 className="w-3.5 h-3.5" /> Share {selectedNotes.size} Note{selectedNotes.size !== 1 ? "s" : ""}
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={() => setShowSharePopup(true)} className="gap-1.5">
            <Globe className="w-3.5 h-3.5" /> Share to Explore
          </Button>
          <Button size="sm" onClick={() => setShowAdd(true)} className="gap-1.5">
            <Plus className="w-4 h-4" /> New Note
          </Button>
        </div>
      </div>

      {/* Search */}
      <div className="relative animate-fade-in">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input placeholder="Search notes..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
      </div>

      {selectedNotes.size > 0 && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground animate-slide-up">
          <Check className="w-4 h-4 text-primary" />
          {selectedNotes.size} note{selectedNotes.size !== 1 ? "s" : ""} selected
          <button onClick={() => setSelectedNotes(new Set())} className="text-primary hover:underline ml-1">Clear</button>
        </div>
      )}

      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-48 rounded-xl" />)}
        </div>
      ) : filteredNotes.length === 0 ? (
        <div className="text-center py-16 animate-fade-in">
          <Edit3 className="w-12 h-12 text-muted-foreground/20 mx-auto mb-4" />
          <p className="text-muted-foreground">{search ? "No notes match your search" : "No notes yet. Create your first note!"}</p>
        </div>
      ) : (
        <div className="space-y-6">
          {pinnedNotes.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3 flex items-center gap-1.5">
                <Pin className="w-3 h-3" /> Pinned
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {pinnedNotes.map((note, i) => (
                  <div key={note.id} className="animate-scale-in" style={{ animationDelay: `${i * 0.04}s` }}>
                    <NoteCard
                      note={note}
                      onUpdate={(id: number, data: any) => updateNote.mutate({ id, ...data })}
                      onDelete={(id: number) => deleteNote.mutate({ id })}
                      selected={selectedNotes.has(note.id)}
                      onSelect={toggleSelect}
                    />
                  </div>
                ))}
              </div>
            </div>
          )}
          {unpinnedNotes.length > 0 && (
            <div>
              {pinnedNotes.length > 0 && <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Other Notes</p>}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {unpinnedNotes.map((note, i) => (
                  <div key={note.id} className="animate-scale-in" style={{ animationDelay: `${i * 0.04}s` }}>
                    <NoteCard
                      note={note}
                      onUpdate={(id: number, data: any) => updateNote.mutate({ id, ...data })}
                      onDelete={(id: number) => deleteNote.mutate({ id })}
                      selected={selectedNotes.has(note.id)}
                      onSelect={toggleSelect}
                    />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Add Note Dialog */}
      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>New Note</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <Input placeholder="Title" value={newTitle} onChange={e => setNewTitle(e.target.value)} />
            <Textarea placeholder="Write your note..." value={newContent} onChange={e => setNewContent(e.target.value)} className="min-h-[120px]" />
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Color:</span>
              {NOTE_COLORS.map(c => (
                <button key={c.id} onClick={() => setNewColor(c.hex)} className={cn("w-6 h-6 rounded-full border-2 transition-all", newColor === c.hex ? "border-primary scale-125" : "border-transparent")} style={{ backgroundColor: c.hex }} />
              ))}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAdd(false)}>Cancel</Button>
            <Button onClick={() => createNote.mutate({ title: newTitle, content: newContent, color: newColor })} disabled={!newContent.trim()}>Create Note</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Share to Explore Popup */}
      <SharePopup open={showSharePopup} onClose={() => setShowSharePopup(false)} />

      {/* Share Dialog */}
      <Dialog open={showShare} onOpenChange={setShowShare}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Share2 className="w-5 h-5 text-primary" /> Share Notes
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-sm text-muted-foreground">Sharing {selectedNotes.size} selected note{selectedNotes.size !== 1 ? "s" : ""}. Enter an email or phone number to send a share link.</p>
            <div className="space-y-3">
              <Input placeholder="Email address (optional)" type="email" value={shareEmail} onChange={e => setShareEmail(e.target.value)} />
              <Input placeholder="Phone number (optional)" type="tel" value={sharePhone} onChange={e => setSharePhone(e.target.value)} />
            </div>
            <p className="text-xs text-muted-foreground">A shareable link will be generated that expires in 7 days.</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowShare(false)}>Cancel</Button>
            <Button
              onClick={() => shareNotes.mutate({ noteIds: Array.from(selectedNotes), recipientEmail: shareEmail || undefined, recipientPhone: sharePhone || undefined })}
              disabled={shareNotes.isPending}
              className="gap-1.5"
            >
              <Share2 className="w-3.5 h-3.5" /> Generate Share Link
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
