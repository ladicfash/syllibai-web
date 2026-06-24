import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import {
  Plus, Pin, PinOff, Trash2, Share2, Edit3, Check, X, Search,
  FolderPlus, Folder, FolderOpen, ChevronDown, ChevronRight, FolderInput, Palette,
} from "lucide-react";
import { SharePopup } from "@/components/SharePopup";
import { EmptyState } from "@/components/study/EmptyState";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";

// 30-colour ROYGBIV gradient palette for note cards
const NOTE_COLORS: string[] = [
  // Reds
  "#ffcccc", "#ff9999", "#ff6666",
  // Oranges
  "#ffd9b3", "#ffb366", "#ff8c00",
  // Yellows
  "#fff9c4", "#fff176", "#ffd600",
  // Yellow-greens
  "#f0f4c3", "#dce775", "#c6e03e",
  // Greens
  "#c8f5d0", "#81e89b", "#34c759",
  // Teals
  "#b2ebf2", "#4dd0e1", "#00acc1",
  // Blues
  "#bbdefb", "#64b5f6", "#1e88e5",
  // Indigos
  "#c5cae9", "#7986cb", "#3949ab",
  // Violets / Purples
  "#e1bee7", "#ba68c8", "#8e24aa",
  // Pinks / Magentas
  "#f8bbd0", "#f48fb1", "#e91e8c",
];

// WCAG-based auto-contrast: returns dark or light text for best readability
function contrastColor(hex: string): string {
  if (!hex || hex.length < 7) return "#1a1a1a";
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  const toLinear = (c: number) => c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  const lum = 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
  return lum > 0.35 ? "#1a1a1a" : "#f5f5f5";
}

// Derive a slightly darker border from the card background
function borderColor(hex: string): string {
  if (!hex || hex.length < 7) return "#e5e7eb";
  const r = Math.max(0, parseInt(hex.slice(1, 3), 16) - 35);
  const g = Math.max(0, parseInt(hex.slice(3, 5), 16) - 35);
  const b = Math.max(0, parseInt(hex.slice(5, 7), 16) - 35);
  return `rgb(${r},${g},${b})`;
}

const FOLDER_COLORS = [
  "#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899",
  "#06b6d4", "#f97316", "#84cc16", "#e11d48",
];

// Color picker component with palette grid + free-pick input
function ColorPicker({ value, onChange }: { value: string; onChange: (hex: string) => void }) {
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-10 gap-1">
        {NOTE_COLORS.map(c => (
          <button
            key={c}
            type="button"
            onClick={() => onChange(c)}
            title={c}
            className={cn(
              "w-6 h-6 rounded-full border-2 transition-all hover:scale-110 focus:outline-none focus:ring-2 focus:ring-primary",
              value === c ? "border-foreground scale-110 shadow-md" : "border-transparent"
            )}
            style={{ backgroundColor: c }}
          />
        ))}
      </div>
      <div className="flex items-center gap-2">
        <Palette className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
        <label className="text-xs text-muted-foreground">Custom:</label>
        <input
          type="color"
          value={value}
          onChange={e => onChange(e.target.value)}
          className="w-8 h-6 rounded cursor-pointer border border-border bg-transparent p-0"
          title="Pick any colour"
        />
        <span className="text-xs font-mono text-muted-foreground">{value}</span>
      </div>
    </div>
  );
}

function NoteCard({ note, onUpdate, onDelete, folders, onMove, selected, onSelect }: any) {
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(note.title);
  const [content, setContent] = useState(note.content);
  const [showMove, setShowMove] = useState(false);

  const bg = note.color || NOTE_COLORS[6]; // default yellow
  const fg = contrastColor(bg);
  const border = borderColor(bg);

  const save = () => {
    onUpdate(note.id, { title, content });
    setEditing(false);
  };

  return (
    <div
      className={cn(
        "rounded-xl border-2 p-4 transition-all duration-200 group relative shadow-sm hover:shadow-md",
        selected && "ring-2 ring-primary ring-offset-2"
      )}
      style={{ backgroundColor: bg, borderColor: border, color: fg }}
    >
      {/* Select checkbox */}
      <button
        onClick={() => onSelect(note.id)}
        className={cn(
          "absolute top-3 right-3 w-5 h-5 rounded border-2 transition-all",
          selected ? "bg-primary border-primary" : "border-current opacity-20 group-hover:opacity-60"
        )}
      >
        {selected && <Check className="w-3 h-3 text-white mx-auto" />}
      </button>

      {/* Pinned indicator */}
      {note.isPinned && !editing && (
        <Pin className="absolute top-3 left-3 w-3 h-3 opacity-50" style={{ color: fg }} />
      )}

      {editing ? (
        <div className="space-y-2">
          <Input
            value={title}
            onChange={e => setTitle(e.target.value)}
            className="text-sm font-semibold border-0 shadow-none px-0 h-auto bg-transparent"
            style={{ color: fg }}
          />
          <Textarea
            value={content}
            onChange={e => setContent(e.target.value)}
            className="text-sm border-0 shadow-none px-0 resize-none min-h-[80px] bg-transparent"
            style={{ color: fg }}
          />
          <div className="flex gap-2">
            <Button size="sm" onClick={save} className="h-7 text-xs gap-1"><Check className="w-3 h-3" /> Save</Button>
            <Button size="sm" variant="ghost" onClick={() => setEditing(false)} className="h-7 text-xs gap-1"><X className="w-3 h-3" /> Cancel</Button>
          </div>
        </div>
      ) : (
        <>
          <div className={cn("pr-6", note.isPinned && "pl-5")}>
            <p className="font-semibold text-sm mb-1.5" style={{ color: fg }}>{note.title}</p>
            <p className="text-sm leading-relaxed whitespace-pre-wrap line-clamp-6" style={{ color: fg, opacity: 0.85 }}>{note.content}</p>
          </div>
          <div className="flex items-center justify-between mt-3 pt-2" style={{ borderTop: `1px solid ${fg}18` }}>
            <span className="text-xs" style={{ color: fg, opacity: 0.55 }}>
              {formatDistanceToNow(new Date(note.updatedAt), { addSuffix: true })}
            </span>
            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <button
                onClick={() => onUpdate(note.id, { isPinned: !note.isPinned })}
                className="p-1 rounded hover:bg-black/10 dark:hover:bg-white/10"
                title={note.isPinned ? "Unpin" : "Pin"}
              >
                {note.isPinned
                  ? <PinOff className="w-3.5 h-3.5" style={{ color: fg }} />
                  : <Pin className="w-3.5 h-3.5" style={{ color: fg }} />}
              </button>
              <button onClick={() => setEditing(true)} className="p-1 rounded hover:bg-black/10 dark:hover:bg-white/10" title="Edit">
                <Edit3 className="w-3.5 h-3.5" style={{ color: fg }} />
              </button>
              <div className="relative">
                <button onClick={() => setShowMove(v => !v)} className="p-1 rounded hover:bg-black/10 dark:hover:bg-white/10" title="Move to folder">
                  <FolderInput className="w-3.5 h-3.5" style={{ color: fg }} />
                </button>
                {showMove && (
                  <div className="absolute right-0 bottom-7 z-50 bg-popover border border-border rounded-lg shadow-lg p-1 min-w-[160px]">
                    <button
                      onClick={() => { onMove(note.id, null); setShowMove(false); }}
                      className="w-full text-left px-3 py-1.5 text-xs rounded hover:bg-accent hover:text-accent-foreground flex items-center gap-2"
                    >
                      <X className="w-3 h-3" /> No folder
                    </button>
                    {folders?.map((f: any) => (
                      <button
                        key={f.id}
                        onClick={() => { onMove(note.id, f.id); setShowMove(false); }}
                        className="w-full text-left px-3 py-1.5 text-xs rounded hover:bg-accent hover:text-accent-foreground flex items-center gap-2"
                      >
                        <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: f.color }} />
                        {f.name}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <button onClick={() => onDelete(note.id)} className="p-1 rounded hover:bg-black/10 dark:hover:bg-white/10" title="Delete">
                <Trash2 className="w-3.5 h-3.5 text-red-500" />
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function FolderSection({ folder, notes, onUpdateFolder, onDeleteFolder, onUpdateNote, onDeleteNote, onMoveNote, allFolders, selectedNotes, onSelect }: any) {
  const [expanded, setExpanded] = useState(true);
  const [renaming, setRenaming] = useState(false);
  const [newName, setNewName] = useState(folder.name);

  const saveRename = () => {
    if (newName.trim()) onUpdateFolder(folder.id, { name: newName.trim() });
    setRenaming(false);
  };

  return (
    <div className="mb-4">
      <div className="flex items-center gap-2 mb-2 group/folder">
        <button onClick={() => setExpanded(v => !v)} className="flex items-center gap-2 flex-1 min-w-0 text-left">
          {expanded ? <ChevronDown className="w-4 h-4 text-muted-foreground flex-shrink-0" /> : <ChevronRight className="w-4 h-4 text-muted-foreground flex-shrink-0" />}
          <span className="w-3 h-3 rounded-sm flex-shrink-0" style={{ backgroundColor: folder.color }} />
          {expanded
            ? <FolderOpen className="w-4 h-4 flex-shrink-0" style={{ color: folder.color }} />
            : <Folder className="w-4 h-4 flex-shrink-0" style={{ color: folder.color }} />}
          {renaming ? (
            <Input
              value={newName}
              onChange={e => setNewName(e.target.value)}
              onBlur={saveRename}
              onKeyDown={e => { if (e.key === "Enter") saveRename(); if (e.key === "Escape") setRenaming(false); }}
              autoFocus
              className="h-6 text-sm py-0 px-1 w-40"
              onClick={e => e.stopPropagation()}
            />
          ) : (
            <span className="text-sm font-semibold text-foreground truncate">{folder.name}</span>
          )}
          <span className="text-xs text-muted-foreground ml-1">({notes.length})</span>
          {folder.isPinned && <Pin className="w-3 h-3 text-muted-foreground flex-shrink-0" />}
        </button>
        <div className="flex items-center gap-1 opacity-0 group-hover/folder:opacity-100 transition-opacity">
          <button onClick={() => onUpdateFolder(folder.id, { isPinned: !folder.isPinned })} className="p-1 rounded hover:bg-accent" title={folder.isPinned ? "Unpin folder" : "Pin folder"}>
            {folder.isPinned ? <PinOff className="w-3.5 h-3.5 text-muted-foreground" /> : <Pin className="w-3.5 h-3.5 text-muted-foreground" />}
          </button>
          <button onClick={() => setRenaming(true)} className="p-1 rounded hover:bg-accent" title="Rename folder">
            <Edit3 className="w-3.5 h-3.5 text-muted-foreground" />
          </button>
          <button onClick={() => onDeleteFolder(folder.id)} className="p-1 rounded hover:bg-accent" title="Delete folder (notes kept)">
            <Trash2 className="w-3.5 h-3.5 text-red-500" />
          </button>
        </div>
      </div>
      {expanded && (
        <div className="pl-6">
          {notes.length === 0 ? (
            <p className="text-xs text-muted-foreground italic py-2">Empty folder. Move notes here using the folder icon on a note card.</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {notes.map((note: any, i: number) => (
                <div key={note.id} className="animate-scale-in" style={{ animationDelay: `${i * 0.04}s` }}>
                  <NoteCard
                    note={note}
                    onUpdate={onUpdateNote}
                    onDelete={onDeleteNote}
                    folders={allFolders}
                    onMove={onMoveNote}
                    selected={selectedNotes.has(note.id)}
                    onSelect={onSelect}
                  />
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function Notes() {
  const utils = trpc.useUtils();
  const { data: notes = [], isLoading: notesLoading } = trpc.notes.list.useQuery();
  const { data: folders = [], isLoading: foldersLoading } = trpc.folders.list.useQuery();

  const [search, setSearch] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [newTitle, setNewTitle] = useState("Untitled Note");
  const [newContent, setNewContent] = useState("");
  const [newColor, setNewColor] = useState(NOTE_COLORS[6]); // default yellow
  const [newFolderId, setNewFolderId] = useState<number | "">("");
  const [selectedNotes, setSelectedNotes] = useState<Set<number>>(new Set());
  const [showShare, setShowShare] = useState(false);
  const [shareEmail, setShareEmail] = useState("");
  const [sharePhone, setSharePhone] = useState("");
  const [showSharePopup, setShowSharePopup] = useState(false);
  const [showAddFolder, setShowAddFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [newFolderColor, setNewFolderColor] = useState(FOLDER_COLORS[0]);

  const createNote = trpc.notes.create.useMutation({
    onSuccess: () => {
      utils.notes.list.invalidate();
      setShowAdd(false);
      setNewTitle("Untitled Note");
      setNewContent("");
      setNewColor(NOTE_COLORS[6]);
      setNewFolderId("");
      toast.success("Note created");
    },
  });

  const updateNote = trpc.notes.update.useMutation({
    onSuccess: () => utils.notes.list.invalidate(),
  });

  const deleteNote = trpc.notes.delete.useMutation({
    onSuccess: () => { utils.notes.list.invalidate(); toast.success("Note deleted"); },
  });

  const shareNotes = trpc.notes.share.useMutation({
    onSuccess: (data) => {
      const url = `${window.location.origin}/share/${data.token}`;
      navigator.clipboard.writeText(url)
        .then(() => toast.success("Share link copied to clipboard!"))
        .catch(() => toast.info(`Share link: ${url}`));
      setShowShare(false);
      setShareEmail("");
      setSharePhone("");
    },
  });

  const createFolder = trpc.folders.create.useMutation({
    onSuccess: () => {
      utils.folders.list.invalidate();
      setShowAddFolder(false);
      setNewFolderName("");
      toast.success("Folder created");
    },
  });

  const updateFolder = trpc.folders.update.useMutation({
    onSuccess: () => utils.folders.list.invalidate(),
  });

  const deleteFolder = trpc.folders.delete.useMutation({
    onSuccess: () => {
      utils.folders.list.invalidate();
      utils.notes.list.invalidate();
      toast.success("Folder deleted (notes kept)");
    },
  });

  const moveNote = trpc.folders.moveNote.useMutation({
    onSuccess: () => { utils.notes.list.invalidate(); toast.success("Note moved"); },
  });

  const toggleSelect = (id: number) => {
    setSelectedNotes(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const filtered = notes.filter(n =>
    n.title.toLowerCase().includes(search.toLowerCase()) ||
    n.content.toLowerCase().includes(search.toLowerCase())
  );

  // Sort folders: pinned first
  const sortedFolders = [...folders].sort((a, b) => {
    if (a.isPinned && !b.isPinned) return -1;
    if (!a.isPinned && b.isPinned) return 1;
    return 0;
  });

  // Group notes by folder
  const notesByFolder: Record<number, typeof notes> = {};
  for (const f of folders) notesByFolder[f.id] = [];
  const unfolderedNotes: typeof notes = [];
  for (const n of filtered) {
    if (n.folderId != null && notesByFolder[n.folderId]) {
      notesByFolder[n.folderId].push(n);
    } else {
      unfolderedNotes.push(n);
    }
  }

  const pinnedNotes = unfolderedNotes.filter(n => n.isPinned);
  const unpinnedNotes = unfolderedNotes.filter(n => !n.isPinned);
  const isLoading = notesLoading || foldersLoading;

  return (
    <div className="mobile-page p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3 animate-slide-up">
        <div>
          <h1 className="text-2xl font-bold font-serif text-foreground">Notes</h1>
          <p className="text-sm text-muted-foreground">{notes.length} note{notes.length !== 1 ? "s" : ""} · {folders.length} folder{folders.length !== 1 ? "s" : ""}</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {selectedNotes.size > 0 && (
            <Button variant="outline" size="sm" onClick={() => setShowShare(true)} className="gap-1.5">
              <Share2 className="w-3.5 h-3.5" /> Share ({selectedNotes.size})
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={() => setShowAddFolder(true)} className="gap-1.5">
            <FolderPlus className="w-4 h-4" /> New Folder
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

      {/* Loading */}
      {isLoading && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {[1,2,3,4].map(i => <Skeleton key={i} className="h-40 rounded-xl" />)}
        </div>
      )}

      {/* Folders */}
      {!isLoading && sortedFolders.map(folder => (
        <FolderSection
          key={folder.id}
          folder={folder}
          notes={notesByFolder[folder.id] ?? []}
          onUpdateFolder={(id: number, data: any) => updateFolder.mutate({ id, ...data })}
          onDeleteFolder={(id: number) => deleteFolder.mutate({ id })}
          onUpdateNote={(id: number, data: any) => updateNote.mutate({ id, ...data })}
          onDeleteNote={(id: number) => deleteNote.mutate({ id })}
          onMoveNote={(noteId: number, folderId: number | null) => moveNote.mutate({ noteId, folderId })}
          allFolders={folders}
          selectedNotes={selectedNotes}
          onSelect={toggleSelect}
        />
      ))}

      {/* Unfoldered notes */}
      {!isLoading && (
        <div>
          {/* Pinned */}
          {pinnedNotes.length > 0 && (
            <div className="mb-6">
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-1.5">
                <Pin className="w-3.5 h-3.5" /> Pinned
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {pinnedNotes.map((note, i) => (
                  <div key={note.id} className="animate-scale-in" style={{ animationDelay: `${i * 0.04}s` }}>
                    <NoteCard
                      note={note}
                      onUpdate={(id: number, data: any) => updateNote.mutate({ id, ...data })}
                      onDelete={(id: number) => deleteNote.mutate({ id })}
                      folders={folders}
                      onMove={(noteId: number, folderId: number | null) => moveNote.mutate({ noteId, folderId })}
                      selected={selectedNotes.has(note.id)}
                      onSelect={toggleSelect}
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* All other notes */}
          {unpinnedNotes.length > 0 && (
            <div>
              {pinnedNotes.length > 0 && (
                <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">All Notes</h2>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {unpinnedNotes.map((note, i) => (
                  <div key={note.id} className="animate-scale-in" style={{ animationDelay: `${i * 0.04}s` }}>
                    <NoteCard
                      note={note}
                      onUpdate={(id: number, data: any) => updateNote.mutate({ id, ...data })}
                      onDelete={(id: number) => deleteNote.mutate({ id })}
                      folders={folders}
                      onMove={(noteId: number, folderId: number | null) => moveNote.mutate({ noteId, folderId })}
                      selected={selectedNotes.has(note.id)}
                      onSelect={toggleSelect}
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Empty state */}
          {notes.length === 0 && !isLoading && (
            <EmptyState
              icon={Plus}
              title="Build your study notebook"
              description="Capture class notes, save AI outputs from Study Studio, organize by folder, and share selected notes when you’re ready."
              actions={<Button onClick={() => setShowAdd(true)} className="gap-1.5"><Plus className="w-4 h-4" /> New Note</Button>}
            />
          )}

          {/* Search empty state */}
          {notes.length > 0 && filtered.length === 0 && (
            <div className="study-card p-8 text-center text-muted-foreground text-sm animate-fade-in">
              No notes match your search.
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
            {/* Preview */}
            {newContent && (
              <div
                className="rounded-lg p-3 text-sm border-2 transition-all"
                style={{ backgroundColor: newColor, borderColor: borderColor(newColor), color: contrastColor(newColor) }}
              >
                <p className="font-semibold text-xs mb-1" style={{ color: contrastColor(newColor) }}>{newTitle || "Untitled"}</p>
                <p className="line-clamp-3 text-xs leading-relaxed" style={{ color: contrastColor(newColor), opacity: 0.85 }}>{newContent}</p>
              </div>
            )}
            <div className="space-y-1.5">
              <span className="text-sm text-muted-foreground">Card colour:</span>
              <ColorPicker value={newColor} onChange={setNewColor} />
            </div>
            {folders.length > 0 && (
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">Folder:</span>
                <select
                  value={newFolderId}
                  onChange={e => setNewFolderId(e.target.value ? Number(e.target.value) : "")}
                  className="flex-1 text-sm rounded-md border border-input bg-background px-3 py-1.5 text-foreground"
                >
                  <option value="">No folder</option>
                  {folders.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                </select>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAdd(false)}>Cancel</Button>
            <Button
              onClick={() => createNote.mutate({
                title: newTitle,
                content: newContent,
                color: newColor,
                ...(newFolderId !== "" ? { folderId: Number(newFolderId) } : {}),
              } as any)}
              disabled={!newContent.trim()}
            >
              Create Note
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Folder Dialog */}
      <Dialog open={showAddFolder} onOpenChange={setShowAddFolder}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><FolderPlus className="w-5 h-5" /> New Folder</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <Input placeholder="Folder name" value={newFolderName} onChange={e => setNewFolderName(e.target.value)} autoFocus />
            <div className="space-y-1.5">
              <span className="text-sm text-muted-foreground">Folder colour:</span>
              <div className="flex flex-wrap gap-2">
                {FOLDER_COLORS.map(c => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setNewFolderColor(c)}
                    className={cn("w-7 h-7 rounded-full border-2 transition-all hover:scale-110", newFolderColor === c ? "border-foreground scale-110 shadow-md" : "border-transparent")}
                    style={{ backgroundColor: c }}
                  />
                ))}
                <input
                  type="color"
                  value={newFolderColor}
                  onChange={e => setNewFolderColor(e.target.value)}
                  className="w-7 h-7 rounded-full cursor-pointer border border-border bg-transparent p-0"
                  title="Pick any colour"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddFolder(false)}>Cancel</Button>
            <Button onClick={() => createFolder.mutate({ name: newFolderName, color: newFolderColor })} disabled={!newFolderName.trim()}>
              Create Folder
            </Button>
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
            <p className="text-sm text-muted-foreground">Sharing {selectedNotes.size} selected note{selectedNotes.size !== 1 ? "s" : ""}. A shareable link will be generated that expires in 7 days.</p>
            <div className="space-y-3">
              <Input placeholder="Email address (optional)" type="email" value={shareEmail} onChange={e => setShareEmail(e.target.value)} />
              <Input placeholder="Phone number (optional)" type="tel" value={sharePhone} onChange={e => setSharePhone(e.target.value)} />
            </div>
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
