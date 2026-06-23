import { useState, useRef, useCallback } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { useLocation } from "wouter";
import {
  Upload, FileText, Image, File, X, Eye, Trash2, Brain, Search,
  Download, ChevronRight, AlertCircle, CheckCircle2, Loader2,
  FolderOpen, Plus, RefreshCw, ArrowRightLeft
} from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDistanceToNow, format } from "date-fns";

type UploadFile = {
  file: File;
  id: string;
  status: "pending" | "uploading" | "done" | "error";
  progress: number;
  docId?: number;
  error?: string;
};

function getFileIcon(mimeType: string) {
  if (mimeType.startsWith("image/")) return Image;
  if (mimeType === "application/pdf") return FileText;
  return File;
}

function getFileBadgeColor(mimeType: string) {
  if (mimeType.startsWith("image/")) return "bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400";
  if (mimeType === "application/pdf") return "bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-400";
  if (mimeType.includes("word")) return "bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400";
  return "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400";
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function Library() {
  const [, navigate] = useLocation();
  const [dragActive, setDragActive] = useState(false);
  const [uploadQueue, setUploadQueue] = useState<UploadFile[]>([]);
  const [search, setSearch] = useState("");
  const [previewDoc, setPreviewDoc] = useState<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [convertingDoc, setConvertingDoc] = useState<any>(null);
  const [convertTarget, setConvertTarget] = useState<"pdf" | "docx" | "txt">("pdf");
  const [convertLoading, setConvertLoading] = useState(false);
  const [ocrDocId, setOcrDocId] = useState<number | null>(null);

  const utils = trpc.useUtils();
  const { data: docs, isLoading } = trpc.documents.list.useQuery();
  const uploadMutation = trpc.documents.upload.useMutation();
  const updateTextMutation = trpc.documents.updateText.useMutation();
  const convertMutation = trpc.documents.convert.useMutation({
    onSuccess: (data) => {
      toast.success(`Converted! Downloading ${data.filename}...`);
      const a = document.createElement("a");
      a.href = data.url;
      a.download = data.filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setConvertingDoc(null);
      setConvertLoading(false);
    },
    onError: (err) => {
      toast.error("Conversion failed: " + err.message);
      setConvertLoading(false);
    },
  });
  const ocrMutation = trpc.documents.ocr.useMutation({
    onSuccess: (data) => {
      utils.documents.list.invalidate();
      toast.success(`OCR complete — ${data.wordCount.toLocaleString()} words extracted!`);
      setOcrDocId(null);
    },
    onError: (err) => {
      toast.error("OCR failed: " + err.message);
      setOcrDocId(null);
    },
  });

  const deleteMutation = trpc.documents.delete.useMutation({
    onSuccess: () => {
      utils.documents.list.invalidate();
      toast.success("Document deleted");
    },
  });

  const processFiles = useCallback(async (files: FileList | File[]) => {
    const fileArray = Array.from(files);
    const newItems: UploadFile[] = fileArray.map((f) => ({
      file: f,
      id: Math.random().toString(36).slice(2),
      status: "pending",
      progress: 0,
    }));
    setUploadQueue((prev) => [...prev, ...newItems]);

    for (const item of newItems) {
      setUploadQueue((prev) => prev.map((q) => q.id === item.id ? { ...q, status: "uploading" } : q));
      try {
        const buffer = await item.file.arrayBuffer();
        const uint8 = new Uint8Array(buffer);
        let binary = '';
        for (let i = 0; i < uint8.length; i++) binary += String.fromCharCode(uint8[i]);
        const base64 = btoa(binary);
        const result = await uploadMutation.mutateAsync({
          filename: item.file.name.replace(/\s+/g, "_"),
          originalName: item.file.name,
          mimeType: item.file.type || "application/octet-stream",
          fileSize: item.file.size,
          fileData: base64,
        });
        setUploadQueue((prev) => prev.map((q) => q.id === item.id ? { ...q, status: "done", progress: 100 } : q));
        utils.documents.list.invalidate();
        toast.success(`${item.file.name} uploaded successfully`);
      } catch (err: any) {
        setUploadQueue((prev) => prev.map((q) => q.id === item.id ? { ...q, status: "error", error: err.message } : q));
        toast.error(`Failed to upload ${item.file.name}`);
      }
    }
  }, [uploadMutation, utils]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    if (e.dataTransfer.files.length > 0) processFiles(e.dataTransfer.files);
  }, [processFiles]);

  const filteredDocs = docs?.filter((d) =>
    d.originalName.toLowerCase().includes(search.toLowerCase())
  ) ?? [];

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between animate-slide-up">
        <div>
          <h1 className="text-2xl font-bold font-serif">Document Library</h1>
          <p className="text-muted-foreground text-sm mt-0.5">{docs?.length ?? 0} document{docs?.length !== 1 ? "s" : ""} stored</p>
        </div>
        <Button onClick={() => fileInputRef.current?.click()} className="gap-2">
          <Plus className="w-4 h-4" /> Upload Files
        </Button>
      </div>

      {/* Drop Zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
        onDragLeave={() => setDragActive(false)}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={cn(
          "border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-all duration-200 animate-fade-in",
          dragActive
            ? "border-primary bg-primary/5 scale-[1.01]"
            : "border-border hover:border-primary/50 hover:bg-muted/30"
        )}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept=".pdf,.txt,.md,.docx,.doc,.png,.jpg,.jpeg,.gif,.webp,.csv"
          className="hidden"
          onChange={(e) => e.target.files && processFiles(e.target.files)}
        />
        <div className="flex flex-col items-center gap-3">
          <div className={cn("w-14 h-14 rounded-2xl flex items-center justify-center transition-colors", dragActive ? "bg-primary/15" : "bg-muted")}>
            <Upload className={cn("w-6 h-6 transition-colors", dragActive ? "text-primary" : "text-muted-foreground")} />
          </div>
          <div>
            <p className="font-semibold text-base">{dragActive ? "Drop files here" : "Drag & drop files here"}</p>
            <p className="text-sm text-muted-foreground mt-1">or click to browse · PDF, DOCX, TXT, Images</p>
          </div>
        </div>
      </div>

      {/* Upload Queue */}
      {uploadQueue.length > 0 && (
        <div className="study-card p-4 space-y-2 animate-slide-up">
          <div className="flex items-center justify-between mb-1">
            <p className="text-sm font-medium">Uploads</p>
            <button onClick={() => setUploadQueue([])} className="text-xs text-muted-foreground hover:text-foreground">Clear</button>
          </div>
          {uploadQueue.map((item) => (
            <div key={item.id} className="flex items-center gap-3 py-1.5">
              <div className="flex-1 min-w-0">
                <p className="text-sm truncate">{item.file.name}</p>
                <div className="flex items-center gap-2 mt-1">
                  {item.status === "uploading" && (
                    <div className="flex-1 h-1 bg-muted rounded-full overflow-hidden">
                      <div className="h-full bg-primary rounded-full shimmer" style={{ width: "60%" }} />
                    </div>
                  )}
                  {item.status === "done" && <span className="text-xs text-emerald-600 flex items-center gap-1"><CheckCircle2 className="w-3 h-3" /> Done</span>}
                  {item.status === "error" && <span className="text-xs text-destructive flex items-center gap-1"><AlertCircle className="w-3 h-3" /> {item.error}</span>}
                  {item.status === "uploading" && <span className="text-xs text-muted-foreground flex items-center gap-1"><Loader2 className="w-3 h-3 animate-spin" /> Uploading...</span>}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Search */}
      <div className="relative animate-fade-in">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Search documents..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Document Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map(i => <Skeleton key={i} className="h-40 rounded-xl" />)}
        </div>
      ) : filteredDocs.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredDocs.map((doc, i) => {
            const Icon = getFileIcon(doc.mimeType);
            const ext = doc.originalName.split(".").pop()?.toUpperCase() ?? "FILE";
            return (
              <div
                key={doc.id}
                className="study-card p-4 group animate-scale-in"
                style={{ animationDelay: `${i * 0.04}s` }}
              >
                <div className="flex items-start gap-3 mb-3">
                  <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center flex-shrink-0">
                    <Icon className="w-5 h-5 text-muted-foreground" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate" title={doc.originalName}>{doc.originalName}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant="secondary" className={cn("text-xs border-0 px-1.5 py-0", getFileBadgeColor(doc.mimeType))}>
                        {ext}
                      </Badge>
                      {doc.fileSize && <span className="text-xs text-muted-foreground">{formatBytes(doc.fileSize)}</span>}
                    </div>
                  </div>
                </div>

                <div className="text-xs text-muted-foreground mb-3">
                  {doc.wordCount ? `${doc.wordCount.toLocaleString()} words · ` : ""}
                  {formatDistanceToNow(new Date(doc.createdAt), { addSuffix: true })}
                </div>

                {/* Preview snippet */}
                {doc.extractedText && (
                  <p className="text-xs text-muted-foreground line-clamp-2 mb-3 bg-muted/50 rounded p-2">
                    {doc.extractedText.slice(0, 120)}…
                  </p>
                )}

                {/* Actions */}
                <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Button
                    size="sm"
                    variant="outline"
                    className="flex-1 gap-1.5 h-8 text-xs"
                    onClick={() => setPreviewDoc(doc)}
                  >
                    <Eye className="w-3.5 h-3.5" /> Preview
                  </Button>
                  <Button
                    size="sm"
                    className="flex-1 gap-1.5 h-8 text-xs"
                    onClick={() => navigate(`/study-tools?doc=${doc.id}`)}
                  >
                    <Brain className="w-3.5 h-3.5" /> Study
                  </Button>
                  {doc.mimeType.startsWith("image/") && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 w-8 p-0"
                      title="Extract text from image (OCR)"
                      disabled={ocrDocId === doc.id}
                      onClick={() => {
                        setOcrDocId(doc.id);
                        ocrMutation.mutate({ documentId: doc.id, fileKey: doc.fileKey });
                      }}
                    >
                      {ocrDocId === doc.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileText className="w-3.5 h-3.5" />}
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 w-8 p-0"
                    title="Convert file format"
                    onClick={() => { setConvertingDoc(doc); setConvertTarget("pdf"); }}
                  >
                    <ArrowRightLeft className="w-3.5 h-3.5" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                    onClick={() => {
                      if (confirm("Delete this document?")) deleteMutation.mutate({ id: doc.id });
                    }}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="text-center py-20 animate-fade-in">
          <FolderOpen className="w-16 h-16 text-muted-foreground/20 mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">{search ? "No documents found" : "Your library is empty"}</h3>
          <p className="text-muted-foreground text-sm mb-6">
            {search ? `No documents match "${search}"` : "Upload your first document to get started with AI-powered studying."}
          </p>
          {!search && (
            <Button onClick={() => fileInputRef.current?.click()} className="gap-2">
              <Upload className="w-4 h-4" /> Upload Your First Document
            </Button>
          )}
        </div>
      )}

      {/* Conversion Modal */}
      {convertingDoc && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in" onClick={() => setConvertingDoc(null)}>
          <div className="bg-card rounded-2xl shadow-2xl w-full max-w-md animate-scale-in p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <div>
                <h3 className="font-semibold flex items-center gap-2"><ArrowRightLeft className="w-4 h-4 text-primary" /> Convert File</h3>
                <p className="text-xs text-muted-foreground mt-1 truncate max-w-[260px]">{convertingDoc.originalName}</p>
              </div>
              <button onClick={() => setConvertingDoc(null)} className="text-muted-foreground hover:text-foreground transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-3 mb-5">
              <p className="text-sm font-medium text-muted-foreground">Convert to:</p>
              {/* Only show valid target formats for the source MIME type */}
              {(() => {
                const mime = convertingDoc?.mimeType ?? "";
                let formats: ("pdf" | "docx" | "txt")[] = [];
                if (mime === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") formats = ["pdf", "txt"];
                else if (mime === "text/plain") formats = ["pdf", "docx"];
                else if (mime === "image/jpeg" || mime === "image/jpg" || mime === "image/png") formats = ["pdf"];
                if (formats.length === 0) return (
                  <div className="text-center py-4 text-sm text-muted-foreground">
                    No conversions available for this file type ({mime || "unknown"}).
                  </div>
                );
                return formats.map((fmt) => (
                  <button
                    key={fmt}
                    onClick={() => setConvertTarget(fmt)}
                    className={cn(
                      "w-full flex items-center gap-3 px-4 py-3 rounded-xl border-2 transition-all text-left",
                      convertTarget === fmt
                        ? "border-primary bg-primary/5 text-primary"
                        : "border-border hover:border-primary/40"
                    )}
                  >
                    <FileText className="w-4 h-4 flex-shrink-0" />
                    <div>
                      <p className="font-medium text-sm">.{fmt.toUpperCase()}</p>
                      <p className="text-xs text-muted-foreground">
                        {fmt === "pdf" ? "Portable Document Format" : fmt === "docx" ? "Microsoft Word Document" : "Plain Text File"}
                      </p>
                    </div>
                  </button>
                ));
              })()}
            </div>
            <Button
              className="w-full gap-2"
              disabled={convertLoading}
              onClick={async () => {
                if (!convertingDoc) return;
                setConvertLoading(true);
                try {
                  const resp = await fetch(convertingDoc.fileUrl);
                  const buf = await resp.arrayBuffer();
                  const uint8 = new Uint8Array(buf);
                  let binary = "";
                  for (let i = 0; i < uint8.length; i++) binary += String.fromCharCode(uint8[i]);
                  const base64 = btoa(binary);
                  convertMutation.mutate({
                    fileData: base64,
                    mimeType: convertingDoc.mimeType,
                    originalName: convertingDoc.originalName,
                    targetFormat: convertTarget,
                  });
                } catch (err: any) {
                  toast.error("Failed to fetch file for conversion");
                  setConvertLoading(false);
                }
              }}
            >
              {convertLoading ? <><Loader2 className="w-4 h-4 animate-spin" /> Converting...</> : <><ArrowRightLeft className="w-4 h-4" /> Convert & Download</>}
            </Button>
          </div>
        </div>
      )}

      {/* Preview Modal */}
      {previewDoc && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in" onClick={() => setPreviewDoc(null)}>
          <div className="bg-card rounded-2xl shadow-2xl w-full max-w-3xl max-h-[85vh] flex flex-col animate-scale-in" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-5 border-b border-border">
              <div>
                <h3 className="font-semibold">{previewDoc.originalName}</h3>
                <p className="text-xs text-muted-foreground mt-0.5">{previewDoc.wordCount?.toLocaleString()} words · {format(new Date(previewDoc.createdAt), "MMM d, yyyy")}</p>
              </div>
              <div className="flex gap-2">
                <Button size="sm" onClick={() => { navigate(`/study-tools?doc=${previewDoc.id}`); setPreviewDoc(null); }} className="gap-1.5">
                  <Brain className="w-3.5 h-3.5" /> Study This
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setPreviewDoc(null)}>
                  <X className="w-4 h-4" />
                </Button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-5">
              {previewDoc.mimeType.startsWith("image/") ? (
                <div className="space-y-4">
                  <img src={previewDoc.fileUrl} alt={previewDoc.originalName} className="max-w-full rounded-lg mx-auto" />
                  {previewDoc.extractedText ? (
                    <div className="bg-muted/50 rounded-xl p-4">
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Extracted Text (OCR)</p>
                      <pre className="text-sm text-foreground/90 whitespace-pre-wrap font-sans leading-relaxed">{previewDoc.extractedText}</pre>
                    </div>
                  ) : (
                    <div className="flex justify-center">
                      <Button
                        size="sm"
                        variant="outline"
                        className="gap-2"
                        disabled={ocrDocId === previewDoc.id}
                        onClick={() => {
                          setOcrDocId(previewDoc.id);
                          ocrMutation.mutate({ documentId: previewDoc.id, fileKey: previewDoc.fileKey });
                        }}
                      >
                        {ocrDocId === previewDoc.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileText className="w-3.5 h-3.5" />}
                        {ocrDocId === previewDoc.id ? "Extracting text..." : "Extract Text from Image (OCR)"}
                      </Button>
                    </div>
                  )}
                </div>
              ) : previewDoc.mimeType === "application/pdf" ? (
                <iframe src={previewDoc.fileUrl} className="w-full h-[60vh] rounded-lg border border-border" title={previewDoc.originalName} />
              ) : previewDoc.extractedText ? (
                <pre className="text-sm text-foreground/90 whitespace-pre-wrap font-sans leading-relaxed">{previewDoc.extractedText}</pre>
              ) : (
                <div className="text-center py-12 text-muted-foreground">
                  <File className="w-12 h-12 mx-auto mb-3 opacity-30" />
                  <p>Preview not available for this file type</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
