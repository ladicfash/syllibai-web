import { useState, useRef } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  Video, Square, Loader2, Trash2,
  Upload, Camera, RefreshCw, FileVideo, AlertTriangle, Brain, ChevronDown, ChevronUp, FileText, Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import { MarkdownView } from "@/components/MarkdownView";
import { EmptyState } from "@/components/study/EmptyState";

const MAX_VIDEOS = 20;
const MAX_FILE_SIZE_MB = 200;

type CaptureMode = "idle" | "camera" | "uploading" | "preview";

export default function VideoNotes() {
  const [captureMode, setCaptureMode] = useState<CaptureMode>("idle");
  const [isRecording, setIsRecording] = useState(false);
  const [videoBlob, setVideoBlob] = useState<Blob | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [videoMimeType, setVideoMimeType] = useState("video/webm");
  const [duration, setDuration] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [transcribing, setTranscribing] = useState<number | null>(null);
  const [convertingFlash, setConvertingFlash] = useState<number | null>(null);
  const [expandedVideoId, setExpandedVideoId] = useState<number | null>(null);
  const [noteTitle, setNoteTitle] = useState("Video Note");
  const [aiOutputByNote, setAiOutputByNote] = useState<Record<number, { title: string; content: string }>>({});

  const videoPreviewRef = useRef<HTMLVideoElement | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const durationRef = useRef(0);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const utils = trpc.useUtils();

  const uploadMut = trpc.videoNotes.upload.useMutation({
    onSuccess: () => {
      utils.videoNotes.list.invalidate();
      toast.success("Video note saved!");
      resetCapture();
    },
    onError: (err) => toast.error("Upload failed: " + err.message),
  });

  const deleteMut = trpc.videoNotes.delete.useMutation({
    onSuccess: () => { utils.videoNotes.list.invalidate(); toast.success("Video deleted"); },
    onError: (err) => toast.error("Delete failed: " + err.message),
  });

  const transcribeMut = trpc.videoNotes.transcribe.useMutation({
    onSuccess: () => {
      utils.videoNotes.list.invalidate();
      toast.success("Transcription complete!");
      setTranscribing(null);
    },
    onError: (err) => { toast.error("Transcription failed: " + err.message); setTranscribing(null); },
  });

  const convertToFlashMut = trpc.ai.generateFlashcards.useMutation({
    onSuccess: () => { utils.decks.list.invalidate(); toast.success("Flashcards created!"); },
    onError: (err) => toast.error("Flashcard creation failed: " + err.message),
  });
  const summarizeMut = trpc.ai.summarizeText.useMutation({
    onSuccess: (data, vars: any) => {
      const labels = { summary: "Summary", cornell: "Cornell Notes", key_points: "Key Points" } as const;
      setAiOutputByNote((prev) => ({ ...prev, [vars.noteId]: { title: labels[vars.mode as keyof typeof labels], content: data.content } }));
    },
    onError: (err) => toast.error("AI generation failed: " + err.message),
  });

  const { data: videoNotes, isLoading: notesLoading } = trpc.videoNotes.list.useQuery();
  const videoCount = videoNotes?.length ?? 0;

  const resetCapture = () => {
    setVideoBlob(null);
    setVideoUrl(null);
    setDuration(0);
    setNoteTitle("Video Note");
    setCaptureMode("idle");
    setIsRecording(false);
  };

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      streamRef.current = stream;
      if (videoPreviewRef.current) {
        videoPreviewRef.current.srcObject = stream;
        videoPreviewRef.current.play();
      }
      setCaptureMode("camera");
    } catch (err: any) {
      toast.error("Camera access denied: " + (err.message ?? ""));
    }
  };

  const stopCamera = () => {
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
    if (videoPreviewRef.current) videoPreviewRef.current.srcObject = null;
  };

  const startCameraRecording = () => {
    if (!streamRef.current) return;
    const mimeType = MediaRecorder.isTypeSupported("video/webm;codecs=vp9,opus")
      ? "video/webm;codecs=vp9,opus"
      : MediaRecorder.isTypeSupported("video/webm")
      ? "video/webm"
      : "video/mp4";
    setVideoMimeType(mimeType.split(";")[0]);
    const recorder = new MediaRecorder(streamRef.current, { mimeType });
    chunksRef.current = [];
    recorder.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
    recorder.onstop = () => {
      const baseMime = mimeType.split(";")[0];
      const blob = new Blob(chunksRef.current, { type: baseMime });
      setVideoBlob(blob);
      setVideoUrl(URL.createObjectURL(blob));
      setVideoMimeType(baseMime);
      stopCamera();
      setCaptureMode("preview");
    };
    mediaRecorderRef.current = recorder;
    recorder.start(100);
    setIsRecording(true);
    durationRef.current = 0;
    setDuration(0);
    timerRef.current = setInterval(() => {
      durationRef.current += 1;
      setDuration(durationRef.current);
    }, 1000);
  };

  const stopCameraRecording = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    mediaRecorderRef.current?.stop();
    setIsRecording(false);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
      toast.error(`File too large. Maximum size is ${MAX_FILE_SIZE_MB}MB.`);
      return;
    }
    setVideoBlob(file);
    setVideoUrl(URL.createObjectURL(file));
    setVideoMimeType(file.type || "video/mp4");
    setNoteTitle(file.name.replace(/\.[^.]+$/, ""));
    setCaptureMode("preview");
  };

  const handleUpload = async () => {
    if (!videoBlob) return;
    if (videoCount >= MAX_VIDEOS) {
      toast.error(`Video limit reached (${MAX_VIDEOS} maximum). Delete some videos first.`);
      return;
    }
    setUploading(true);
    try {
      const uint8 = new Uint8Array(await videoBlob.arrayBuffer());
      let binary = "";
      for (let i = 0; i < uint8.length; i++) binary += String.fromCharCode(uint8[i]);
      const base64 = btoa(binary);
      await uploadMut.mutateAsync({
        videoData: base64,
        mimeType: videoMimeType,
        title: noteTitle,
        duration: durationRef.current,
      });
    } catch (err: any) {
      toast.error("Upload failed: " + (err.message ?? "Unknown error"));
    } finally {
      setUploading(false);
    }
  };

  const handleTranscribe = async (note: { id: number; s3Url: string }) => {
    setTranscribing(note.id);
    await transcribeMut.mutateAsync({ id: note.id, audioUrl: note.s3Url });
  };

  const handleConvertToFlash = async (note: { id: number; transcript: string | null }) => {
    if (!note.transcript) return;
    setConvertingFlash(note.id);
    try {
      await convertToFlashMut.mutateAsync({ documentId: 0, text: note.transcript.slice(0, 7500), difficulty: "intermediate", style: "application" });
    } finally {
      setConvertingFlash(null);
    }
  };

  const handleTranscriptAI = (note: { id: number; transcript: string | null }, mode: "summary" | "cornell" | "key_points") => {
    if (!note.transcript) return;
    summarizeMut.mutate({ text: note.transcript.slice(0, 12000), mode, noteId: note.id } as any);
  };

  const formatDuration = (s: number) =>
    `${Math.floor(s / 60).toString().padStart(2, "0")}:${(s % 60).toString().padStart(2, "0")}`;

  return (
    <div className="mobile-page p-6 max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="animate-slide-up">
        <h1 className="text-2xl font-bold font-serif">Video Notes</h1>
        <p className="text-muted-foreground text-sm mt-0.5">
          Record or upload video notes — up to {MAX_VIDEOS} videos, {MAX_FILE_SIZE_MB}MB each
        </p>
      </div>

      {/* Storage cap warning */}
      {videoCount >= MAX_VIDEOS && (
        <div className="flex items-center gap-3 p-4 rounded-xl border border-amber-500/30 bg-amber-500/10 text-amber-400 text-sm animate-fade-in">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          <span>Storage limit reached ({MAX_VIDEOS}/{MAX_VIDEOS} videos). Delete existing videos to add new ones.</span>
        </div>
      )}
      {videoCount > 0 && videoCount < MAX_VIDEOS && (
        <p className="text-xs text-muted-foreground">{videoCount}/{MAX_VIDEOS} videos used</p>
      )}

      {/* Capture Panel */}
      {captureMode === "idle" && (
        <div className="study-card p-8 animate-fade-in">
          <div className="flex flex-col items-center gap-6">
            <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center">
              <Video className="w-8 h-8 text-primary" />
            </div>
            <div className="text-center">
              <h3 className="font-semibold">Add a Video Note</h3>
              <p className="text-sm text-muted-foreground mt-1">Record from your camera or upload a video file</p>
            </div>
            <div className="flex gap-3 flex-wrap justify-center">
              <Button
                variant="outline"
                onClick={startCamera}
                disabled={videoCount >= MAX_VIDEOS}
                className="gap-2"
              >
                <Camera className="w-4 h-4" /> Record from Camera
              </Button>
              <Button
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
                disabled={videoCount >= MAX_VIDEOS}
                className="gap-2"
              >
                <Upload className="w-4 h-4" /> Upload Video File
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                accept="video/*"
                className="hidden"
                onChange={handleFileSelect}
              />
            </div>
          </div>
        </div>
      )}

      {/* Camera View */}
      {captureMode === "camera" && (
        <div className="study-card p-6 space-y-4 animate-fade-in">
          <div className="relative rounded-xl overflow-hidden bg-black aspect-video">
            <video
              ref={videoPreviewRef}
              autoPlay
              muted
              playsInline
              className="w-full h-full object-cover"
            />
            {isRecording && (
              <div className="absolute top-3 left-3 flex items-center gap-2 bg-red-600/90 text-white text-xs px-2.5 py-1 rounded-full">
                <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
                REC {formatDuration(duration)}
              </div>
            )}
          </div>
          <div className="flex items-center gap-3 justify-center">
            {!isRecording ? (
              <>
                <Button onClick={startCameraRecording} className="gap-2 bg-red-500 hover:bg-red-600">
                  <Video className="w-4 h-4" /> Start Recording
                </Button>
                <Button variant="outline" onClick={() => { stopCamera(); setCaptureMode("idle"); }}>
                  Cancel
                </Button>
              </>
            ) : (
              <Button onClick={stopCameraRecording} className="gap-2 bg-red-700 hover:bg-red-800">
                <Square className="w-4 h-4" /> Stop Recording
              </Button>
            )}
          </div>
        </div>
      )}

      {/* Preview & Save */}
      {captureMode === "preview" && videoUrl && (
        <div className="study-card p-6 space-y-4 animate-slide-up">
          <div className="relative rounded-xl overflow-hidden bg-black aspect-video">
            <video
              src={videoUrl}
              controls
              playsInline
              className="w-full h-full object-contain"
            />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs text-muted-foreground whitespace-nowrap">Note title</label>
            <input
              type="text"
              value={noteTitle}
              onChange={(e) => setNoteTitle(e.target.value)}
              className="flex-1 bg-muted/40 border border-border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
              placeholder="Give this video a title..."
            />
          </div>
          <div className="flex gap-3">
            <Button
              onClick={handleUpload}
              disabled={uploading || videoCount >= MAX_VIDEOS}
              className="gap-2 flex-1"
            >
              {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
              {uploading ? "Uploading..." : "Save Video Note"}
            </Button>
            <Button variant="outline" onClick={resetCapture} className="gap-2">
              <Trash2 className="w-4 h-4" /> Discard
            </Button>
          </div>
        </div>
      )}

      {/* Saved Videos List */}
      <div className="space-y-3 animate-fade-in">
        <h2 className="text-lg font-semibold">Saved Video Notes</h2>
        {notesLoading ? (
          <div className="space-y-2">
            {[1, 2].map(i => (
              <div key={i} className="study-card p-4 animate-pulse">
                <div className="h-4 bg-muted rounded w-1/3 mb-2" />
                <div className="h-3 bg-muted rounded w-1/4" />
              </div>
            ))}
          </div>
        ) : !videoNotes?.length ? (
          <EmptyState
            icon={Video}
            title="No video notes yet"
            description="Record from your camera or upload a lecture clip, then transcribe it into summaries, Cornell notes, and flashcards."
          />
        ) : (
          <div className="space-y-3">
            {videoNotes.map((note) => (
              <div key={note.id} className="study-card overflow-hidden">
                {/* Note header row */}
                <div className="p-4 flex items-start gap-3">
                  <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <FileVideo className="w-4 h-4 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm">{note.title}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {formatDuration(note.duration)} · {formatDistanceToNow(new Date(note.createdAt), { addSuffix: true })}
                    </p>
                    {note.transcript && (
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-2 leading-relaxed">
                        {note.transcript}
                      </p>
                    )}
                    {!note.transcript && (
                      <p className="text-xs text-muted-foreground/50 mt-1 italic">No transcript yet</p>
                    )}
                  </div>
                  {/* Action buttons */}
                  <div className="flex items-center gap-1 flex-shrink-0">
                    {/* Expand/collapse video player */}
                    <button
                      onClick={() => setExpandedVideoId(expandedVideoId === note.id ? null : note.id)}
                      className="p-1.5 rounded-lg hover:bg-muted transition-colors"
                      title={expandedVideoId === note.id ? "Hide video" : "Play video"}
                    >
                      {expandedVideoId === note.id
                        ? <ChevronUp className="w-3.5 h-3.5 text-muted-foreground" />
                        : <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />}
                    </button>
                    {/* Transcribe */}
                    {!note.transcript && (
                      <button
                        onClick={() => handleTranscribe(note)}
                        disabled={transcribing === note.id}
                        className="p-1.5 rounded-lg hover:bg-primary/10 transition-colors"
                        title="Transcribe with Whisper"
                      >
                        {transcribing === note.id
                          ? <Loader2 className="w-3.5 h-3.5 text-primary animate-spin" />
                          : <RefreshCw className="w-3.5 h-3.5 text-muted-foreground" />}
                      </button>
                    )}
                    {/* Transcript AI actions */}
                    {note.transcript && (
                      <>
                        <button onClick={() => handleTranscriptAI(note, "summary")} disabled={summarizeMut.isPending} className="p-1.5 rounded-lg hover:bg-primary/10 transition-colors" title="Summarize transcript">
                          {summarizeMut.isPending ? <Loader2 className="w-3.5 h-3.5 text-primary animate-spin" /> : <Sparkles className="w-3.5 h-3.5 text-muted-foreground" />}
                        </button>
                        <button onClick={() => handleTranscriptAI(note, "cornell")} disabled={summarizeMut.isPending} className="p-1.5 rounded-lg hover:bg-primary/10 transition-colors" title="Create Cornell notes">
                          <FileText className="w-3.5 h-3.5 text-muted-foreground" />
                        </button>
                        <button
                          onClick={() => handleConvertToFlash(note)}
                          disabled={convertingFlash === note.id}
                          className="p-1.5 rounded-lg hover:bg-primary/10 transition-colors"
                          title="Convert transcript to flashcards"
                        >
                          {convertingFlash === note.id
                            ? <Loader2 className="w-3.5 h-3.5 text-primary animate-spin" />
                            : <Brain className="w-3.5 h-3.5 text-muted-foreground" />}
                        </button>
                      </>
                    )}
                    {/* Delete */}
                    <button
                      onClick={() => {
                        deleteMut.mutate({ id: note.id });
                        if (expandedVideoId === note.id) setExpandedVideoId(null);
                      }}
                      className="p-1.5 rounded-lg hover:bg-destructive/10 transition-colors"
                      title="Delete"
                    >
                      <Trash2 className="w-3.5 h-3.5 text-muted-foreground hover:text-destructive" />
                    </button>
                  </div>
                </div>

                {/* Inline video player (expanded) */}
                {expandedVideoId === note.id && (
                  <div className="border-t border-border bg-black">
                    <video
                      src={note.s3Url}
                      controls
                      playsInline
                      autoPlay
                      className="w-full max-h-80 object-contain"
                      onError={() => toast.error("Could not load video. The file may have expired or been removed.")}
                    />
                  </div>
                )}
                {aiOutputByNote[note.id] && (
                  <div className="border-t border-border p-4 bg-muted/20">
                    <h4 className="font-semibold text-sm mb-2">{aiOutputByNote[note.id].title}</h4>
                    <div className="streamdown-content text-sm"><MarkdownView>{aiOutputByNote[note.id].content}</MarkdownView></div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
