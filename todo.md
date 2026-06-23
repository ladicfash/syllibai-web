# SyllibAI — Project TODO

## Phase 1: Schema & Backend
- [x] Database schema: users, documents, flashcards, quiz_sessions, quiz_scores, notes, tasks, timer_sessions, spaced_repetition_cards, share_tokens
- [x] Server routers: documents, ai, quiz, notes, tasks, timer, spaced-repetition, share, voice
- [x] S3 file upload endpoint (multipart, multi-file)
- [x] LLM integration: flashcards, Cornell notes, mind map, timeline, flowchart, key points, study plan, deadlines, simulation
- [x] Voice transcription endpoint (Whisper)
- [x] File conversion utilities (PDF↔DOCX, image→PDF) via server-side npm packages

## Phase 2: Landing Page & Auth
- [x] Polished landing page with hero, features grid, quote footer
- [x] Login/signup flow via Manus OAuth
- [x] Dark/light mode toggle (persisted)
- [x] Sidebar dashboard layout with responsive mobile drawer

## Phase 3: File Library
- [x] Multi-file drag-and-drop upload UI
- [x] S3-backed document storage with metadata in DB
- [x] File preview: PDF viewer (iframe), image preview, text preview
- [x] Document library with selection, search, and delete
- [x] File conversion: DOCX→PDF, TXT→PDF, TXT→DOCX, image→PDF (JPEG/PNG), with convert modal UI

## Phase 4: AI Study Tools
- [x] Flashcard generator with flip-card UI
- [x] Cornell notes (study guide) rendered as formatted HTML
- [x] Mind map rendered visually with Mermaid.js
- [x] Timeline rendered visually with Mermaid.js
- [x] Flowchart rendered visually with Mermaid.js
- [x] Key points extractor
- [x] Read-aloud TTS using Web Speech API
- [x] Interactive quiz mode (via flashcard session with scoring)
- [x] Per-deck quiz history

## Phase 5: Timer & Planner
- [x] Pomodoro / study timer with customizable intervals
- [x] Timer session history
- [x] Sound alerts for timer
- [x] Assignment/exam planner with AI deadline detection from docs
- [x] Calendar view for tasks and deadlines
- [x] Manual task entry with priority and due date

## Phase 6: Advanced Features
- [x] Inline notes (mobile + desktop) with color coding and pinning
- [x] Share/send: select specific notes → generate share link → send to email/phone
- [x] Spaced repetition system (SM-2 algorithm)
- [x] Simulation environments: medical, finance, coding, history
- [x] Voice notes: record → Whisper transcription → flashcards/content

## Phase 7: Polish & QA
- [x] Advanced CSS animations and micro-interactions
- [x] Fully responsive design (mobile-first)
- [x] Dark/light mode for all components
- [x] Empty states and loading skeletons
- [x] Error handling and toast notifications
- [x] Vitest unit tests for server routes (8 tests passing)
- [x] Final checkpoint and delivery
