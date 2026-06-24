import { useState, useRef, useCallback } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  Mic, Square, Play, Pause, Brain, Loader2, Trash2,
  FileAudio, Save, RefreshCw, FileText, Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import { MarkdownView } from "@/components/MarkdownView";
import { EmptyState } from "@/components/study/EmptyState";

type RecordingState = "idle" | "recording" | "stopped" | "processing";

export default function VoiceNotes() {
  const [recordingState, setRecordingState] = useState<RecordingState>("idle");
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [transcript, setTranscript] = useState("");
  const [duration, setDuration] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [convertingToFlash, setConvertingToFlash] = useState(false);
  const [savingNote, setSavingNote] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [noteTitle, setNoteTitle] = useState("Voice Note");
  const [aiOutput, setAiOutput] = useState<{ title: string; content: string } | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const durationRef = useRef(0);

  const utils = trpc.useUtils();
  const uploadAudioMut = trpc.voice.uploadAudio.useMutation();
  const transcribeMut = trpc.voice.transcribe.useMutation();
  const saveNoteMut = trpc.voice.saveNote.useMutation({
    onSuccess: () => {
      utils.voice.listNotes.invalidate();
      toast.success("Voice note saved!");
      resetRecorder();
    },
    onError: (err) => toast.error("Failed to save: " + err.message),
  });
  const deleteNoteMut = trpc.voice.deleteNote.useMutation({
    onSuccess: () => { utils.voice.listNotes.invalidate(); toast.success("Note deleted"); },
    onError: (err) => toast.error("Delete failed: " + err.message),
  });
  const convertToFlashMut = trpc.ai.generateFlashcards.useMutation({
    onSuccess: () => { utils.decks.list.invalidate(); toast.success("Flashcards created from voice note!"); },
  });
  const summarizeMut = trpc.ai.summarizeText.useMutation({
    onSuccess: (data, vars) => {
      const labels = { summary: "Summary", cornell: "Cornell Notes", key_points: "Key Points" } as const;
      setAiOutput({ title: labels[vars.mode as keyof typeof labels], content: data.content });
    },
    onError: (err) => toast.error("AI generation failed: " + err.message),
  });

  const { data: savedNotes, isLoading: notesLoading } = trpc.voice.listNotes.useQuery();

  const resetRecorder = () => {
    setAudioBlob(null);
    setAudioUrl(null);
    setTranscript("");
    setDuration(0);
    setNoteTitle("Voice Note");
    setRecordingState("idle");
  };

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = MediaRecorder.isTypeSupported("audio/webm") ? "audio/webm" : "audio/ogg";
      const recorder = new MediaRecorder(stream, { mimeType });
      chunksRef.current = [];
      recorder.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      recorder.onstop = () => {
        stream.getTracks().forEach(t => t.stop());
        const blob = new Blob(chunksRef.current, { type: mimeType });
        setAudioBlob(blob);
        setAudioUrl(URL.createObjectURL(blob));
        setRecordingState("stopped");
      };
      mediaRecorderRef.current = recorder;
      recorder.start(100);
      setRecordingState("recording");
      durationRef.current = 0;
      setDuration(0);
      timerRef.current = setInterval(() => {
        durationRef.current += 1;
        setDuration(durationRef.current);
      }, 1000);
    } catch (err: any) {
      toast.error("Microphone access denied: " + (err.message ?? ""));
    }
  }, []);

  const stopRecording = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    mediaRecorderRef.current?.stop();
  }, []);

  const togglePlay = () => {
    if (!audioRef.current) return;
    if (isPlaying) { audioRef.current.pause(); setIsPlaying(false); }
    else { audioRef.current.play(); setIsPlaying(true); }
  };

  const handleTranscribe = async () => {
    if (!audioBlob) return;
    setTranscribing(true);
    setRecordingState("processing");
    try {
      const uint8 = new Uint8Array(await audioBlob.arrayBuffer());
      let binary = "";
      for (let i = 0; i < uint8.length; i++) binary += String.fromCharCode(uint8[i]);
      const base64 = btoa(binary);
      const mimeType = audioBlob.type || "audio/webm";
      const { url } = await uploadAudioMut.mutateAsync({ audioData: base64, mimeType });
      const result = await transcribeMut.mutateAsync({ audioUrl: url });
      setTranscript(result.text);
      toast.success("Transcription complete!");
    } catch (err: any) {
      toast.error("Transcription failed: " + (err.message ?? "Unknown error"));
    } finally {
      setTranscribing(false);
      setRecordingState("stopped");
    }
  };

  const handleSaveAudioNote = async () => {
    if (!audioBlob) return;
    setSavingNote(true);
    try {
      const uint8 = new Uint8Array(await audioBlob.arrayBuffer());
      let binary = "";
      for (let i = 0; i < uint8.length; i++) binary += String.fromCharCode(uint8[i]);
      const base64 = btoa(binary);
      const mimeType = audioBlob.type || "audio/webm";
      await saveNoteMut.mutateAsync({
        audioData: base64,
        mimeType,
        title: noteTitle,
        duration: durationRef.current,
        transcript: transcript || undefined,
      });
    } finally {
      setSavingNote(false);
    }
  };

  const convertToFlashcards = async () => {
    if (!transcript.trim()) return;
    setConvertingToFlash(true);
    try {
      await convertToFlashMut.mutateAsync({ documentId: 0, text: transcript.slice(0, 7500), difficulty: "intermediate", style: "application" });
    } finally {
      setConvertingToFlash(false);
    }
  };

  const runTranscriptAI = (mode: "summary" | "cornell" | "key_points") => {
    if (!transcript.trim()) return;
    summarizeMut.mutate({ text: transcript.slice(0, 12000), mode });
  };

  const formatDuration = (s: number) =>
    `${Math.floor(s / 60).toString().padStart(2, "0")}:${(s % 60).toString().padStart(2, "0")}`;

  return (
    <div className="mobile-page p-6 max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div className="animate-slide-up">
        <h1 className="text-2xl font-bold font-serif">Voice Notes</h1>
        <p className="text-muted-foreground text-sm mt-0.5">
          Record audio notes, transcribe with Whisper AI, or save directly
        </p>
      </div>

      {/* Recorder */}
      <div className="study-card p-8 flex flex-col items-center gap-6 animate-fade-in">
        {/* Waveform Visual */}
        <div className={cn("flex items-center gap-1 h-12", recordingState !== "recording" && "opacity-30")}>
          {Array.from({ length: 20 }).map((_, i) => (
            <div
              key={i}
              className={cn("w-1.5 rounded-full bg-primary transition-all", recordingState === "recording" ? "animate-bounce" : "h-2")}
              style={recordingState === "recording" ? {
                height: `${Math.random() * 32 + 8}px`,
                animationDelay: `${i * 0.05}s`,
                animationDuration: `${0.5 + Math.random() * 0.5}s`,
              } : { height: "8px" }}
            />
          ))}
        </div>

        {/* Timer */}
        <div className="text-center">
          <p className="text-4xl font-mono font-bold tracking-widest">{formatDuration(duration)}</p>
          <p className="text-sm text-muted-foreground mt-1">
            {recordingState === "recording"
              ? "Recording..."
              : recordingState === "processing"
              ? "Transcribing..."
              : recordingState === "stopped"
              ? "Recording complete — choose an action below"
              : "Ready to record"}
          </p>
        </div>

        {/* Record / Stop Button */}
        <div className="flex items-center gap-4">
          {recordingState === "idle" && (
            <Button
              size="icon"
              onClick={startRecording}
              className="w-16 h-16 rounded-full bg-red-500 hover:bg-red-600 shadow-lg shadow-red-500/30 transition-all duration-200 hover:scale-105"
            >
              <Mic className="w-7 h-7" />
            </Button>
          )}
          {recordingState === "recording" && (
            <Button
              size="icon"
              onClick={stopRecording}
              className="w-16 h-16 rounded-full bg-red-600 hover:bg-red-700 shadow-lg shadow-red-600/30 animate-pulse-glow"
            >
              <Square className="w-6 h-6" />
            </Button>
          )}
          {recordingState === "processing" && (
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
              <Loader2 className="w-7 h-7 text-primary animate-spin" />
            </div>
          )}
        </div>

        {/* Playback + Actions (shown after recording stops) */}
        {audioUrl && (recordingState === "stopped" || recordingState === "processing") && (
          <div className="w-full space-y-4">
            {/* Audio playback */}
            <div className="flex items-center gap-3">
              <audio ref={audioRef} src={audioUrl} onEnded={() => setIsPlaying(false)} className="hidden" />
              <Button variant="outline" size="sm" onClick={togglePlay} className="gap-1.5">
                {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                {isPlaying ? "Pause" : "Play"}
              </Button>
              <span className="text-xs text-muted-foreground">{formatDuration(duration)}</span>
              <Button
                variant="ghost"
                size="sm"
                onClick={resetRecorder}
                className="gap-1.5 text-muted-foreground ml-auto"
              >
                <Trash2 className="w-3.5 h-3.5" /> Discard
              </Button>
            </div>

            {/* Title input */}
            <div className="flex items-center gap-2">
              <label className="text-xs text-muted-foreground whitespace-nowrap">Note title</label>
              <input
                type="text"
                value={noteTitle}
                onChange={(e) => setNoteTitle(e.target.value)}
                className="flex-1 bg-muted/40 border border-border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
                placeholder="Give this note a title..."
              />
            </div>

            {/* Action buttons */}
            <div className="flex gap-3 flex-wrap">
              <Button
                variant="outline"
                size="sm"
                onClick={handleTranscribe}
                disabled={transcribing || recordingState === "processing"}
                className="gap-1.5 flex-1"
              >
                {transcribing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                Transcribe with Whisper
              </Button>
              <Button
                size="sm"
                onClick={handleSaveAudioNote}
                disabled={savingNote}
                className="gap-1.5 flex-1"
              >
                {savingNote ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                Save as Audio Note
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Transcript (shown after transcription) */}
      {transcript && (
        <div className="study-card p-5 space-y-4 animate-slide-up">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold flex items-center gap-2">
              <FileAudio className="w-4 h-4 text-primary" /> Transcript
            </h3>
            <div className="flex gap-2 flex-wrap justify-end">
              <Button size="sm" variant="outline" onClick={() => runTranscriptAI("summary")} disabled={summarizeMut.isPending} className="gap-1.5">
                {summarizeMut.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />} Summary
              </Button>
              <Button size="sm" variant="outline" onClick={() => runTranscriptAI("cornell")} disabled={summarizeMut.isPending} className="gap-1.5">
                <FileText className="w-3.5 h-3.5" /> Cornell
              </Button>
              <Button size="sm" variant="outline" onClick={() => runTranscriptAI("key_points")} disabled={summarizeMut.isPending} className="gap-1.5">
                <Sparkles className="w-3.5 h-3.5" /> Key Points
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={convertToFlashcards}
                disabled={convertingToFlash}
                className="gap-1.5"
              >
                {convertingToFlash ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Brain className="w-3.5 h-3.5" />}
                Flashcards
              </Button>
            </div>
          </div>
          <div className="bg-muted/40 rounded-xl p-4">
            <p className="text-sm leading-relaxed whitespace-pre-wrap">{transcript}</p>
          </div>
          {aiOutput && (
            <div className="rounded-xl border bg-card p-4 animate-fade-in">
              <h4 className="font-semibold text-sm mb-2">{aiOutput.title}</h4>
              <div className="streamdown-content text-sm"><MarkdownView>{aiOutput.content}</MarkdownView></div>
            </div>
          )}
          <p className="text-xs text-muted-foreground">{transcript.split(" ").length} words · Transcribed with Whisper AI</p>
          <p className="text-xs text-muted-foreground">
            Use "Save as Audio Note" above to save this recording along with its transcript.
          </p>
        </div>
      )}

      {/* Tips */}
      {!transcript && recordingState === "idle" && !audioUrl && (
        <div className="study-card p-5 animate-fade-in">
          <h3 className="font-semibold text-sm mb-3">Tips for best results</h3>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li className="flex items-start gap-2"><span className="text-primary mt-0.5">•</span> Speak clearly and at a moderate pace</li>
            <li className="flex items-start gap-2"><span className="text-primary mt-0.5">•</span> Record in a quiet environment for best transcription accuracy</li>
            <li className="flex items-start gap-2"><span className="text-primary mt-0.5">•</span> After transcription, convert directly to flashcards for instant study materials</li>
            <li className="flex items-start gap-2"><span className="text-primary mt-0.5">•</span> Use "Save as Audio Note" to keep the recording without transcribing</li>
          </ul>
        </div>
      )}

      {/* Saved Notes List */}
      <div className="space-y-3 animate-fade-in">
        <h2 className="text-lg font-semibold">Saved Voice Notes</h2>
        {notesLoading ? (
          <div className="space-y-2">
            {[1, 2].map(i => (
              <div key={i} className="study-card p-4 animate-pulse">
                <div className="h-4 bg-muted rounded w-1/3 mb-2" />
                <div className="h-3 bg-muted rounded w-1/4" />
              </div>
            ))}
          </div>
        ) : !savedNotes?.length ? (
          <EmptyState
            icon={Mic}
            title="Capture your first voice note"
            description="Record a lecture thought, transcribe it, then turn the transcript into summaries, Cornell notes, key points, or flashcards."
          />
        ) : (
          <div className="space-y-2">
            {savedNotes.map((note) => (
              <div key={note.id} className="study-card p-4 flex items-start gap-3 group">
                <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <FileAudio className="w-4 h-4 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">{note.title}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {formatDuration(note.duration)} · {formatDistanceToNow(new Date(note.createdAt), { addSuffix: true })}
                  </p>
                  {note.transcript && (
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-2 leading-relaxed">
                      {note.transcript}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <a
                    href={note.s3Url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-1.5 rounded-lg hover:bg-muted transition-colors"
                    title="Open audio"
                  >
                    <Play className="w-3.5 h-3.5 text-muted-foreground" />
                  </a>
                  <button
                    onClick={() => deleteNoteMut.mutate({ id: note.id })}
                    className="p-1.5 rounded-lg hover:bg-destructive/10 transition-colors"
                    title="Delete"
                  >
                    <Trash2 className="w-3.5 h-3.5 text-muted-foreground hover:text-destructive" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
