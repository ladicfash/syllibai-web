import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { Plus, Calendar, CheckCircle2, Circle, Clock, Trash2, Sparkles,
  BookOpen, GraduationCap, FileText, MoreHorizontal, Loader2, AlertTriangle
} from "lucide-react";
import { cn } from "@/lib/utils";
import SyllabusUpload from "@/components/SyllabusUpload";
import { EmptyState } from "@/components/study/EmptyState";
import { format, isToday, isTomorrow, isPast, addDays, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, isSameMonth } from "date-fns";

const PRIORITY_COLORS = {
  low: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400",
  medium: "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400",
  high: "bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-400",
};

const TYPE_ICONS = {
  assignment: FileText,
  exam: GraduationCap,
  reading: BookOpen,
  other: MoreHorizontal,
};

function getDueDateLabel(date: Date | null | undefined) {
  if (!date) return null;
  const d = new Date(date);
  if (isToday(d)) return { label: "Today", color: "text-amber-600" };
  if (isTomorrow(d)) return { label: "Tomorrow", color: "text-orange-500" };
  if (isPast(d)) return { label: "Overdue", color: "text-destructive" };
  return { label: format(d, "MMM d"), color: "text-muted-foreground" };
}

export default function Planner() {
  const [view, setView] = useState<"list" | "calendar">("list");
  const [showAdd, setShowAdd] = useState(false);
  const [showAI, setShowAI] = useState(false);
  const [calendarDate, setCalendarDate] = useState(new Date());
  const [filter, setFilter] = useState<"all" | "todo" | "done">("all");

  // Add task form
  const [newTitle, setNewTitle] = useState("");
  const [newDue, setNewDue] = useState("");
  const [newPriority, setNewPriority] = useState<"low" | "medium" | "high">("medium");
  const [newType, setNewType] = useState<"assignment" | "exam" | "reading" | "other">("other");
  const [newDesc, setNewDesc] = useState("");

  // AI deadline detection
  const [selectedDocId, setSelectedDocId] = useState<number | undefined>();
  const [detectedDeadlines, setDetectedDeadlines] = useState<any[]>([]);

  const utils = trpc.useUtils();
  const { data: tasks, isLoading } = trpc.tasks.list.useQuery();
  const { data: docs } = trpc.documents.list.useQuery();
  const createTask = trpc.tasks.create.useMutation({ onSuccess: () => { utils.tasks.list.invalidate(); setShowAdd(false); resetForm(); toast.success("Task added"); } });
  const updateTask = trpc.tasks.update.useMutation({ onSuccess: () => utils.tasks.list.invalidate() });
  const deleteTask = trpc.tasks.delete.useMutation({ onSuccess: () => { utils.tasks.list.invalidate(); toast.success("Task deleted"); } });
  const addSubtasks = trpc.tasks.addSubtasks.useMutation({ onSuccess: () => { utils.tasks.list.invalidate(); toast.success("Subtasks added"); } });
  const updateSubtask = trpc.tasks.updateSubtask.useMutation({ onSuccess: () => utils.tasks.list.invalidate() });
  const breakdownTask = trpc.tasks.breakdown.useMutation({
    onSuccess: (data, vars) => addSubtasks.mutate({ taskId: vars.taskId, subtasks: data.subtasks }),
    onError: (err) => toast.error(err.message),
  });
  const detectDeadlines = trpc.ai.detectDeadlines.useMutation();

  const resetForm = () => { setNewTitle(""); setNewDue(""); setNewPriority("medium"); setNewType("other"); setNewDesc(""); };

  const handleAdd = () => {
    if (!newTitle.trim()) return;
    createTask.mutate({ title: newTitle, description: newDesc, dueDate: newDue || undefined, priority: newPriority, type: newType });
  };

  const handleDetect = async () => {
    if (!selectedDocId) return;
    const doc = docs?.find(d => d.id === selectedDocId);
    if (!doc?.extractedText) { toast.error("Document has no extracted text"); return; }
    try {
      const result = await detectDeadlines.mutateAsync({ documentId: selectedDocId, text: doc.extractedText.slice(0, 7000) });
      setDetectedDeadlines(result.deadlines);
    } catch (err: any) {
      toast.error(err.message ?? "Detection failed");
    }
  };

  const importDeadline = (dl: any) => {
    createTask.mutate({ title: dl.title, description: dl.description, dueDate: dl.date, type: dl.type, priority: "medium" });
    setDetectedDeadlines(prev => prev.filter(d => d !== dl));
  };

  const filteredTasks = tasks?.filter(t => {
    if (filter === "todo") return t.status !== "done";
    if (filter === "done") return t.status === "done";
    return true;
  }) ?? [];

  // Calendar
  const monthStart = startOfMonth(calendarDate);
  const monthEnd = endOfMonth(calendarDate);
  const calDays = eachDayOfInterval({ start: monthStart, end: monthEnd });
  const startPad = monthStart.getDay();
  const tasksByDay = (day: Date) => tasks?.filter(t => t.dueDate && isSameDay(new Date(t.dueDate), day)) ?? [];

  return (
    <div className="mobile-page p-6 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between animate-slide-up">
        <div>
          <h1 className="text-2xl font-bold font-display">Planner</h1>
          <p className="text-muted-foreground text-sm mt-0.5">{tasks?.filter(t => t.status !== "done").length ?? 0} tasks pending</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setShowAI(true)} className="gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-primary" /> Detect Deadlines
          </Button>
          <Button size="sm" onClick={() => setShowAdd(true)} className="gap-1.5">
            <Plus className="w-4 h-4" /> Add Task
          </Button>
        </div>
      </div>

      {/* Syllabus Upload */}
      <div className="animate-fade-in">
        <SyllabusUpload onTasksCreated={() => utils.tasks.list.invalidate()} />
      </div>

      {/* View Toggle + Filter */}
      <div className="flex items-center justify-between gap-4 animate-fade-in">
        <div className="flex gap-1 bg-muted p-1 rounded-lg">
          {(["list", "calendar"] as const).map((v) => (
            <button key={v} onClick={() => setView(v)} className={cn("px-3 py-1.5 rounded-md text-sm font-medium transition-all", view === v ? "bg-card shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground")}>
              {v === "list" ? "List" : "Calendar"}
            </button>
          ))}
        </div>
        {view === "list" && (
          <div className="flex gap-1">
            {(["all", "todo", "done"] as const).map((f) => (
              <button key={f} onClick={() => setFilter(f)} className={cn("px-3 py-1.5 rounded-lg text-sm font-medium transition-all capitalize", filter === f ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground")}>
                {f}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* List View */}
      {view === "list" && (
        <div className="space-y-2 animate-fade-in">
          {isLoading ? (
            Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-16 rounded-xl" />)
          ) : filteredTasks.length === 0 ? (
            <EmptyState
              icon={Calendar}
              title={filter === "done" ? "No completed tasks yet" : "Plan your next study move"}
              description="Add tasks manually, detect deadlines from a syllabus, or use AI breakdown to turn big assignments into manageable steps."
              actions={<><Button size="sm" onClick={() => setShowAdd(true)} className="gap-1.5"><Plus className="w-4 h-4" /> Add Task</Button><Button size="sm" variant="outline" onClick={() => setShowAI(true)} className="gap-1.5"><Sparkles className="w-4 h-4" /> Detect Deadlines</Button></>}
            />
          ) : (
            filteredTasks.map((task, i) => {
              const dueLabel = getDueDateLabel(task.dueDate ?? null);
              const Icon = TYPE_ICONS[task.type as keyof typeof TYPE_ICONS] ?? MoreHorizontal;
              const isDone = task.status === "done";
              return (
                <div key={task.id} className={cn("study-card p-4 flex items-start gap-3 animate-slide-up", isDone && "opacity-60")} style={{ animationDelay: `${i * 0.03}s` }}>
                  <button
                    onClick={() => updateTask.mutate({ id: task.id, status: isDone ? "todo" : "done" })}
                    className="mt-0.5 flex-shrink-0 text-muted-foreground hover:text-primary transition-colors"
                  >
                    {isDone ? <CheckCircle2 className="w-5 h-5 text-emerald-500" /> : <Circle className="w-5 h-5" />}
                  </button>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className={cn("font-medium text-sm", isDone && "line-through text-muted-foreground")}>{task.title}</p>
                      <Badge variant="secondary" className={cn("text-xs border-0 px-1.5 py-0", PRIORITY_COLORS[task.priority as keyof typeof PRIORITY_COLORS])}>
                        {task.priority}
                      </Badge>
                    </div>
                    {task.description && <p className="text-xs text-muted-foreground mt-0.5 truncate">{task.description}</p>}
                    {(task as any).subtasks?.length > 0 && (
                      <div className="mt-3 space-y-2">
                        <div className="flex items-center gap-2">
                          <div className="h-1.5 flex-1 rounded-full bg-muted overflow-hidden"><div className="h-full bg-primary rounded-full" style={{ width: `${(task as any).progressPercent ?? 0}%` }} /></div>
                          <span className="text-[11px] text-muted-foreground">{(task as any).progressPercent ?? 0}%</span>
                        </div>
                        <div className="grid gap-1 sm:grid-cols-2">
                          {(task as any).subtasks.slice(0, 6).map((sub: any) => (
                            <label key={sub.id} className="flex items-center gap-2 text-xs text-muted-foreground">
                              <input type="checkbox" checked={sub.isDone} onChange={(e) => updateSubtask.mutate({ id: sub.id, isDone: e.target.checked })} />
                              <span className={cn(sub.isDone && "line-through")}>{sub.title}</span>
                            </label>
                          ))}
                        </div>
                      </div>
                    )}
                    <div className="flex items-center gap-3 mt-1">
                      <Icon className="w-3.5 h-3.5 text-muted-foreground" />
                      <span className="text-xs text-muted-foreground capitalize">{task.type}</span>
                      {dueLabel && (
                        <span className={cn("text-xs font-medium flex items-center gap-1", dueLabel.color)}>
                          <Clock className="w-3 h-3" /> {dueLabel.label}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button
                      onClick={() => breakdownTask.mutate({ taskId: task.id, title: task.title, description: task.description ?? undefined, dueDate: task.dueDate ? new Date(task.dueDate).toISOString() : undefined })}
                      disabled={breakdownTask.isPending}
                      className="text-muted-foreground hover:text-primary transition-colors p-1"
                      title="Break into subtasks"
                    >
                      {breakdownTask.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                    </button>
                    <button onClick={() => deleteTask.mutate({ id: task.id })} className="text-muted-foreground hover:text-destructive transition-colors p-1" title="Delete task">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* Calendar View */}
      {view === "calendar" && (
        <div className="study-card p-5 animate-fade-in">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold">{format(calendarDate, "MMMM yyyy")}</h2>
            <div className="flex gap-1">
              <Button variant="ghost" size="sm" onClick={() => setCalendarDate(d => addDays(startOfMonth(d), -1))}>‹</Button>
              <Button variant="ghost" size="sm" onClick={() => setCalendarDate(new Date())}>Today</Button>
              <Button variant="ghost" size="sm" onClick={() => setCalendarDate(d => addDays(endOfMonth(d), 1))}>›</Button>
            </div>
          </div>
          <div className="grid grid-cols-7 gap-1 mb-2">
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(d => (
              <div key={d} className="text-center text-xs font-medium text-muted-foreground py-1">{d}</div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {Array.from({ length: startPad }).map((_, i) => <div key={`pad-${i}`} />)}
            {calDays.map((day) => {
              const dayTasks = tasksByDay(day);
              const isCurrentMonth = isSameMonth(day, calendarDate);
              return (
                <div key={day.toISOString()} className={cn("min-h-[70px] p-1.5 rounded-lg border transition-colors", isToday(day) ? "border-primary bg-primary/5" : "border-transparent hover:border-border hover:bg-muted/30", !isCurrentMonth && "opacity-40")}>
                  <span className={cn("text-xs font-medium", isToday(day) ? "text-primary" : "text-foreground")}>{format(day, "d")}</span>
                  <div className="mt-1 space-y-0.5">
                    {dayTasks.slice(0, 2).map(t => (
                      <div key={t.id} className={cn("text-xs px-1 py-0.5 rounded truncate", t.priority === "high" ? "bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-400" : t.priority === "medium" ? "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400" : "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400")}>
                        {t.title}
                      </div>
                    ))}
                    {dayTasks.length > 2 && <div className="text-xs text-muted-foreground">+{dayTasks.length - 2} more</div>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Add Task Dialog */}
      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add Task</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <Input placeholder="Task title *" value={newTitle} onChange={e => setNewTitle(e.target.value)} />
            <Input placeholder="Description (optional)" value={newDesc} onChange={e => setNewDesc(e.target.value)} />
            <Input type="datetime-local" value={newDue} onChange={e => setNewDue(e.target.value)} />
            <div className="grid grid-cols-2 gap-3">
              <Select value={newPriority} onValueChange={(v: any) => setNewPriority(v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low Priority</SelectItem>
                  <SelectItem value="medium">Medium Priority</SelectItem>
                  <SelectItem value="high">High Priority</SelectItem>
                </SelectContent>
              </Select>
              <Select value={newType} onValueChange={(v: any) => setNewType(v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="assignment">Assignment</SelectItem>
                  <SelectItem value="exam">Exam</SelectItem>
                  <SelectItem value="reading">Reading</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAdd(false)}>Cancel</Button>
            <Button onClick={handleAdd} disabled={!newTitle.trim() || createTask.isPending}>
              {createTask.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Add Task
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* AI Deadline Detection Dialog */}
      <Dialog open={showAI} onOpenChange={setShowAI}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-primary" /> AI Deadline Detection
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-sm text-muted-foreground">Select a document (e.g., syllabus) and AI will extract all deadlines and assignments automatically.</p>
            <Select value={selectedDocId?.toString() ?? ""} onValueChange={v => setSelectedDocId(parseInt(v))}>
              <SelectTrigger><SelectValue placeholder="Select a document..." /></SelectTrigger>
              <SelectContent>
                {docs?.map(d => <SelectItem key={d.id} value={d.id.toString()}>{d.originalName}</SelectItem>)}
              </SelectContent>
            </Select>
            <Button onClick={handleDetect} disabled={!selectedDocId || detectDeadlines.isPending} className="w-full gap-2">
              {detectDeadlines.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              Detect Deadlines
            </Button>

            {detectedDeadlines.length > 0 && (
              <div className="space-y-2 max-h-64 overflow-y-auto">
                <p className="text-sm font-medium">{detectedDeadlines.length} deadline{detectedDeadlines.length !== 1 ? "s" : ""} found:</p>
                {detectedDeadlines.map((dl, i) => (
                  <div key={i} className="flex items-start justify-between gap-3 p-3 rounded-lg border border-border bg-muted/30">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{dl.title}</p>
                      <p className="text-xs text-muted-foreground">{dl.date} · {dl.type}</p>
                      {dl.description && <p className="text-xs text-muted-foreground mt-0.5 truncate">{dl.description}</p>}
                    </div>
                    <Button size="sm" variant="outline" onClick={() => importDeadline(dl)} className="flex-shrink-0 h-7 text-xs">
                      Import
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
