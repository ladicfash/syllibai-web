import { z } from "zod";
import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import { invokeLLM } from "./_core/llm";
import { transcribeAudio } from "./_core/voiceTranscription";
import { storagePut, storageGetSignedUrl } from "./storage";
import { getDb } from "./db";
import {
  upsertUser, getUserByOpenId,
  createDocument, getDocumentsByUser, getDocumentById, deleteDocument, updateDocumentText,
  createSourceItem, getSourceItemsByUser,
  createDeck, getDecksByUser, getDeckById,
  createFlashcards, getFlashcardsByDeck, getFlashcardById, updateFlashcardContent, updateFlashcardSRS, getDueFlashcards,
  saveQuizSession, getQuizHistory,
  createNote, getNotesByUser, updateNote, deleteNote, getNotesByIds,
  createTask, getTasksByUser, updateTask, deleteTask,
  saveTimerSession, getTimerHistory,
  saveAiOutput, getAiOutput,
  createShareToken, getShareToken,
  publishDeck, publishNote,
  getPublicDecks, getPublicNotes,
  getDeckBySlug, getNoteBySlug, getPublicCardsByDeck,
  getUserSettings, upsertUserSettings,
  createVoiceNote, getVoiceNotesByUser, updateVoiceNoteTranscript, deleteVoiceNote,
  createVideoNote, getVideoNotesByUser, countVideoNotesByUser, updateVideoNoteTranscript, deleteVideoNote,
  createNoteFolder, getNoteFoldersByUser, updateNoteFolder, deleteNoteFolder, moveNoteToFolder,
} from "./db";
import { nanoid } from "nanoid";
import { docxToText, docxToHtml, textToDocx, imageToPdf, textToPdf } from "./conversion";
import { PDFParse } from "pdf-parse";
import { sendDeadlineReminder } from "./email";
import { sendDeadlinePushNotifications } from "./webpush";
import { academicSourceIds, getDoiOpenAccessItem, getSourceItem, listSourceCapabilities, makePracticePrompt, searchSources, sourceSafetyPolicy } from "./sources";

// ── Helpers ────────────────────────────────────────────────────────────────
async function callAI(systemPrompt: string, userContent: string, jsonSchema?: object): Promise<string> {
  const opts: any = {
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userContent },
    ],
  };
  if (jsonSchema) {
    opts.response_format = { type: "json_schema", json_schema: { name: "response", strict: true, schema: jsonSchema } };
  }
  const res = await invokeLLM(opts);
  const content = res.choices[0].message.content;
return (typeof content === 'string' ? content.trim() : JSON.stringify(content)) ?? "";
}

type FlashcardDifficulty = "beginner" | "intermediate" | "advanced";
type FlashcardStyle = "recall" | "application" | "exam";

function flashcardInstruction(difficulty: FlashcardDifficulty = "intermediate", style: FlashcardStyle = "application", count = 12) {
  const difficultyGuide: Record<FlashcardDifficulty, string> = {
    beginner: "Beginner: use clear definitions, direct recall, simple language, and foundational concepts.",
    intermediate: "Intermediate: mix recall with explanation, connections between ideas, and common examples.",
    advanced: "Advanced: emphasize application, edge cases, comparisons, mechanisms, clinical/legal/research reasoning where relevant, and higher-order analysis.",
  };
  const styleGuide: Record<FlashcardStyle, string> = {
    recall: "Mostly concise recall Q/A cards.",
    application: "Mostly application and understanding cards that test why/how, not just facts.",
    exam: "Mostly exam-style prompts with concise answer explanations. Use original wording only.",
  };
  return `Generate exactly ${count} high-quality flashcards. ${difficultyGuide[difficulty]} ${styleGuide[style]} Return JSON only.`;
}

async function getCombinedDocumentText(userId: number, documentIds: number[], maxChars = 12000) {
  const uniqueIds = Array.from(new Set(documentIds)).slice(0, 8);
  const docs = (await Promise.all(uniqueIds.map((id) => getDocumentById(id, userId)))).filter(Boolean) as any[];
  if (docs.length === 0) throw new Error("No readable documents selected");
  const chunks: string[] = [];
  let used = 0;
  for (const doc of docs) {
    const raw = doc.extractedText ?? "";
    if (!raw.trim()) continue;
    const header = `\n\n[Document: ${doc.originalName}]\n`;
    const remaining = maxChars - used - header.length;
    if (remaining <= 0) break;
    const slice = raw.slice(0, remaining);
    chunks.push(header + slice);
    used += header.length + slice.length;
  }
  const text = chunks.join("\n").trim();
  if (!text) throw new Error("Selected documents do not have extracted text");
  return { text, docs };
}

function parseFlashcards(text: string): { question: string; answer: string }[] {
  const cards: { question: string; answer: string }[] = [];
  // Try JSON first
  try {
    const parsed = JSON.parse(text);
    if (Array.isArray(parsed)) return parsed;
  } catch {}
  // Robust regex: Q/A pairs with various numbering styles
  const qPattern = /(?:^|\n)\s*(?:\*{0,2})(?:Q\d*|Question\s*\d*)\s*[:\.]?\s*\*{0,2}\s*(.+?)(?=\n\s*(?:A\d*|Answer)|\n\n|$)/gi;
  const aPattern = /(?:^|\n)\s*(?:\*{0,2})(?:A\d*|Answer\s*\d*)\s*[:\.]?\s*\*{0,2}\s*(.+?)(?=\n\s*(?:Q\d*|Question)|\n\n|$)/gi;
  const questions: string[] = [];
  const answers: string[] = [];
  let m;
  while ((m = qPattern.exec(text)) !== null) questions.push(m[1].trim());
  while ((m = aPattern.exec(text)) !== null) answers.push(m[1].trim());
  for (let i = 0; i < Math.min(questions.length, answers.length); i++) {
    if (questions[i] && answers[i]) cards.push({ question: questions[i], answer: answers[i] });
  }
  return cards;
}

// SM-2 spaced repetition algorithm
function sm2(card: { interval: number; repetitions: number; easeFactor: number }, quality: number) {
  // quality: 0-5 (0=blackout, 5=perfect)
  let { interval, repetitions, easeFactor } = card;
  if (quality >= 3) {
    if (repetitions === 0) interval = 1;
    else if (repetitions === 1) interval = 6;
    else interval = Math.round(interval * easeFactor);
    repetitions += 1;
  } else {
    repetitions = 0;
    interval = 1;
  }
  easeFactor = Math.max(1.3, easeFactor + 0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02));
  const dueDate = new Date();
  dueDate.setDate(dueDate.getDate() + interval);
  return { interval, repetitions, easeFactor, dueDate };
}

// ── Router ─────────────────────────────────────────────────────────────────
export const appRouter = router({
  system: systemRouter,

  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    acceptTerms: protectedProcedure.input(z.object({
      version: z.string().default("1.0"),
    })).mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");
      const { eq } = await import("drizzle-orm");
      const { users: usersTable } = await import("../drizzle/schema");
      await db.update(usersTable)
        .set({ acceptedTermsAt: new Date(), termsVersion: input.version })
        .where(eq(usersTable.id, ctx.user.id));
      return { success: true };
    }),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),

  // ── Documents ────────────────────────────────────────────────────────────
  documents: router({
    list: protectedProcedure.query(({ ctx }) => getDocumentsByUser(ctx.user.id)),

    get: protectedProcedure.input(z.object({ id: z.number() })).query(({ ctx, input }) =>
      getDocumentById(input.id, ctx.user.id)
    ),

    upload: protectedProcedure.input(z.object({
      filename: z.string(),
      originalName: z.string(),
      mimeType: z.string(),
      fileSize: z.number(),
      fileData: z.string(), // base64
    })).mutation(async ({ ctx, input }) => {
      const buffer = Buffer.from(input.fileData, "base64");
      const fileKey = `${ctx.user.id}/docs/${nanoid()}-${input.filename}`;
      const { url } = await storagePut(fileKey, buffer, input.mimeType);

      // Auto-extract text based on file type
      let extractedText = "";
      let wordCount = 0;
      try {
        if (input.mimeType === "application/pdf") {
          const parser = new PDFParse({ data: buffer, verbosity: 0 });
          const result = await parser.getText();
          extractedText = result.text.trim();
          wordCount = extractedText.split(/\s+/).filter(Boolean).length;
          await parser.destroy();
        } else if (
          input.mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
          input.mimeType === "application/msword"
        ) {
          extractedText = await docxToText(buffer);
          wordCount = extractedText.split(/\s+/).filter(Boolean).length;
        } else if (input.mimeType === "text/plain") {
          extractedText = buffer.toString("utf-8");
          wordCount = extractedText.split(/\s+/).filter(Boolean).length;
        }
      } catch (err) {
        console.warn("[Upload] Text extraction failed:", err);
      }

      const result = await createDocument({
        userId: ctx.user.id,
        filename: input.filename,
        originalName: input.originalName,
        mimeType: input.mimeType,
        fileKey,
        fileUrl: url,
        fileSize: input.fileSize,
        extractedText: extractedText || undefined,
        wordCount: wordCount || undefined,
      });
      return { success: true, url, fileKey, extractedText, wordCount };
    }),

    updateText: protectedProcedure.input(z.object({
      id: z.number(),
      extractedText: z.string(),
      wordCount: z.number(),
    })).mutation(async ({ ctx, input }) => {
      await updateDocumentText(input.id, input.extractedText, input.wordCount);
      return { success: true };
    }),

    delete: protectedProcedure.input(z.object({ id: z.number() })).mutation(async ({ ctx, input }) => {
      await deleteDocument(input.id, ctx.user.id);
      return { success: true };
    }),

    // ── Image OCR ──────────────────────────────────────────────────────────
    ocr: protectedProcedure.input(z.object({
      documentId: z.number(),
      fileKey: z.string(),
    })).mutation(async ({ ctx, input }) => {
      // Get a signed URL so the LLM vision model can fetch the image
      const { storageGetSignedUrl } = await import('./storage');
      const imageUrl = await storageGetSignedUrl(input.fileKey);

      const res = await invokeLLM({
        messages: [
          {
            role: "system",
            content: "You are an expert OCR assistant. Extract ALL text from the provided image exactly as it appears, preserving structure, line breaks, headings, and lists. Do not summarize or interpret — output the raw text only.",
          },
          {
            role: "user",
            content: [
              {
                type: "image_url",
                image_url: { url: imageUrl, detail: "high" },
              },
              { type: "text", text: "Extract all text from this image." },
            ],
          },
        ],
      });

      const extractedText = (typeof res.choices[0].message.content === "string"
        ? res.choices[0].message.content
        : JSON.stringify(res.choices[0].message.content)
      ).trim();

      const wordCount = extractedText.split(/\s+/).filter(Boolean).length;
      await updateDocumentText(input.documentId, extractedText, wordCount);

      return { extractedText, wordCount };
    }),

    // ── File Conversion ────────────────────────────────────────────────────
    convert: protectedProcedure.input(z.object({
      fileData: z.string(), // base64
      mimeType: z.string(),
      originalName: z.string(),
      targetFormat: z.enum(["pdf", "docx", "txt"]),
    })).mutation(async ({ ctx, input }) => {
      const buffer = Buffer.from(input.fileData, "base64");
      let outputBuffer: Buffer;
      let outputMime: string;
      let outputExt: string;

      const src = input.mimeType;
      const target = input.targetFormat;

      if (src === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" && target === "pdf") {
        // DOCX → PDF: extract text then render to PDF
        const text = await docxToText(buffer);
        const baseName = input.originalName.replace(/\.docx$/i, "");
        outputBuffer = await textToPdf(text, baseName);
        outputMime = "application/pdf";
        outputExt = "pdf";
      } else if (src === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" && target === "txt") {
        // DOCX → TXT
        const text = await docxToText(buffer);
        outputBuffer = Buffer.from(text, "utf-8");
        outputMime = "text/plain";
        outputExt = "txt";
      } else if ((src === "image/jpeg" || src === "image/jpg" || src === "image/png") && target === "pdf") {
        // Image → PDF
        outputBuffer = await imageToPdf(buffer, src);
        outputMime = "application/pdf";
        outputExt = "pdf";
      } else if (src === "text/plain" && target === "docx") {
        // TXT → DOCX
        const text = buffer.toString("utf-8");
        outputBuffer = await textToDocx(text, input.originalName.replace(/\.txt$/i, ""));
        outputMime = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
        outputExt = "docx";
      } else if (src === "text/plain" && target === "pdf") {
        // TXT → PDF
        const text = buffer.toString("utf-8");
        outputBuffer = await textToPdf(text, input.originalName.replace(/\.txt$/i, ""));
        outputMime = "application/pdf";
        outputExt = "pdf";
      } else {
        throw new Error(`Conversion from ${src} to ${target} is not supported.`);
      }

      // Upload converted file to S3
      const baseName = input.originalName.replace(/\.[^.]+$/, "");
      const outputFilename = `${baseName}_converted.${outputExt}`;
      const fileKey = `${ctx.user.id}/converted/${nanoid()}-${outputFilename}`;
      const { url } = await storagePut(fileKey, outputBuffer, outputMime);

      return {
        url,
        filename: outputFilename,
        mimeType: outputMime,
        size: outputBuffer.length,
      };
    }),
  }),

  // ── Source Hub: public/open academic + legal databases ───────────────────
  sources: router({
    policy: protectedProcedure.query(() => sourceSafetyPolicy),

    capabilities: protectedProcedure.query(() => listSourceCapabilities()),

    imported: protectedProcedure.query(({ ctx }) => getSourceItemsByUser(ctx.user.id)),

    search: protectedProcedure.input(z.object({
      query: z.string().min(2).max(300),
      source: z.enum(academicSourceIds).optional(),
      field: z.enum(["medicine", "law", "general", "all"]).default("all"),
      limit: z.number().min(1).max(25).default(12),
    })).query(async ({ input }) => searchSources(input)),

    preview: protectedProcedure.input(z.object({
      source: z.enum(academicSourceIds),
      externalId: z.string().min(1).max(255),
    })).query(async ({ input }) => getSourceItem(input.source, input.externalId)),

    doiOpenAccess: protectedProcedure.input(z.object({
      doi: z.string().min(5).max(255),
    })).query(async ({ input }) => getDoiOpenAccessItem(input.doi)),

    importDoi: protectedProcedure.input(z.object({
      doi: z.string().min(5).max(255),
    })).mutation(async ({ ctx, input }) => {
      const item = await getDoiOpenAccessItem(input.doi);
      const safeTitle = item.title.replace(/[^a-z0-9 _.-]/gi, "").slice(0, 120) || `doi-${input.doi}`;
      const importedText = item.importedText.slice(0, 60000);
      const wordCount = importedText.split(/\s+/).filter(Boolean).length;

      const inserted = await createDocument({
        userId: ctx.user.id,
        filename: `${safeTitle}.txt`,
        originalName: `doi:${input.doi}`,
        mimeType: "text/plain",
        fileKey: `source://doi/${input.doi}`,
        fileUrl: item.fullTextUrl ?? item.url ?? `https://doi.org/${input.doi}`,
        fileSize: Buffer.byteLength(importedText, "utf8"),
        extractedText: importedText,
        wordCount,
      });
      const documentId = (inserted as any)?.insertId as number | undefined;

      await createSourceItem({
        userId: ctx.user.id,
        source: "doi",
        externalId: input.doi,
        title: item.title,
        abstract: item.abstract,
        url: item.url,
        authorsJson: item.authors ?? [],
        license: item.license,
        contentType: item.contentType,
        importedDocumentId: documentId,
        metadataJson: { ...item.metadata, citation: item.citation, tags: item.tags, isOpenAccess: item.isOpenAccess, fullTextUrl: item.fullTextUrl, licenseConfidence: item.licenseConfidence },
      });

      return { success: true, documentId, item };
    }),

    import: protectedProcedure.input(z.object({
      source: z.enum(academicSourceIds),
      externalId: z.string().min(1).max(255),
    })).mutation(async ({ ctx, input }) => {
      const item = await getSourceItem(input.source, input.externalId);
      const safeTitle = item.title.replace(/[^a-z0-9 _.-]/gi, "").slice(0, 120) || `${item.source}-${item.externalId}`;
      const importedText = item.importedText.slice(0, 60000);
      const wordCount = importedText.split(/\s+/).filter(Boolean).length;

      const inserted = await createDocument({
        userId: ctx.user.id,
        filename: `${safeTitle}.txt`,
        originalName: `${item.source}:${item.externalId}`,
        mimeType: "text/plain",
        fileKey: `source://${item.source}/${item.externalId}`,
        fileUrl: item.url ?? `source://${item.source}/${item.externalId}`,
        fileSize: Buffer.byteLength(importedText, "utf8"),
        extractedText: importedText,
        wordCount,
      });
      const documentId = (inserted as any)?.insertId as number | undefined;

      await createSourceItem({
        userId: ctx.user.id,
        source: item.source,
        externalId: item.externalId,
        title: item.title,
        abstract: item.abstract,
        url: item.url,
        authorsJson: item.authors ?? [],
        license: item.license,
        contentType: item.contentType,
        importedDocumentId: documentId,
        metadataJson: { ...item.metadata, citation: item.citation, tags: item.tags, isOpenAccess: item.isOpenAccess, fullTextUrl: item.fullTextUrl, licenseConfidence: item.licenseConfidence },
      });

      return { success: true, documentId, item };
    }),

    generateStudyAid: protectedProcedure.input(z.object({
      source: z.enum(academicSourceIds),
      externalId: z.string().min(1).max(255),
      kind: z.enum(["medical", "law", "research"]),
      saveAsNote: z.boolean().default(false),
    })).mutation(async ({ ctx, input }) => {
      const item = await getSourceItem(input.source, input.externalId);
      const prompt = makePracticePrompt(input.kind, item.importedText.slice(0, 8000));
      const content = await callAI(
        "You create original academic study aids from lawful public/open source material. Never copy proprietary question banks or imply official affiliation with UWorld, NBME, AMBOSS, NCBE, BARBRI, Themis, or similar vendors.",
        prompt
      );
      let noteId: number | undefined;
      if (input.saveAsNote) {
        const inserted = await createNote({
          userId: ctx.user.id,
          title: `${input.kind === "medical" ? "USMLE-style" : input.kind === "law" ? "Law-style" : "Research"} study aid: ${item.title.slice(0, 80)}`,
          content: `${content}\n\n---\nSource: ${item.url ?? item.title}\nCitation: ${item.citation.apa}`,
          color: "#dbeafe",
        });
        noteId = (inserted as any)?.insertId as number | undefined;
      }
      return { content, noteId, citation: item.citation };
    }),
  }),

  // ── AI Tools ─────────────────────────────────────────────────────────────
  ai: router({
    generateFlashcards: protectedProcedure.input(z.object({
      documentId: z.number().optional(),
      documentIds: z.array(z.number()).max(8).optional(),
      text: z.string().max(12000).optional(),
      difficulty: z.enum(["beginner", "intermediate", "advanced"]).default("intermediate"),
      style: z.enum(["recall", "application", "exam"]).default("application"),
      count: z.number().min(5).max(30).default(12),
    })).mutation(async ({ ctx, input }) => {
      let text = input.text;
      let docId = input.documentId && input.documentId > 0 ? input.documentId : undefined;
      let deckTitle = "Generated Flashcards";
      if (!text && input.documentIds?.length) {
        const combined = await getCombinedDocumentText(ctx.user.id, input.documentIds, 12000);
        text = combined.text;
        docId = combined.docs.length === 1 ? combined.docs[0].id : undefined;
        deckTitle = combined.docs.length > 1 ? `Combined Flashcards (${combined.docs.length} docs)` : `Flashcards — ${combined.docs[0].originalName}`;
      }
      if (!text?.trim()) throw new Error("No source text provided for flashcard generation");
      const raw = await callAI(
        `You are an expert study assistant. ${flashcardInstruction(input.difficulty, input.style, input.count)} Cards should test understanding and be accurate to the source. Answers should be concise but complete.`,
        text.slice(0, 12000),
        {
          type: "object",
          properties: {
            cards: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  question: { type: "string" },
                  answer: { type: "string" },
                },
                required: ["question", "answer"],
                additionalProperties: false,
              },
            },
          },
          required: ["cards"],
          additionalProperties: false,
        }
      );
      const parsed = JSON.parse(raw);
      const cards = (parsed.cards as { question: string; answer: string }[]).slice(0, input.count);
      await createDeck(ctx.user.id, deckTitle, docId);
      const decks = await getDecksByUser(ctx.user.id);
      const deck = decks[0];
      await createFlashcards(cards.map((c) => ({ deckId: deck.id, userId: ctx.user.id, ...c })));
      // Only save AI output when linked to a real document
      if (docId) await saveAiOutput(ctx.user.id, docId, "flashcards", JSON.stringify(cards));
      return { deckId: deck.id, cards };
    }),

    generateCornellNotes: protectedProcedure.input(z.object({
      documentId: z.number(),
      text: z.string().max(8000),
    })).mutation(async ({ ctx, input }) => {
      const content = await callAI(
        "You are an expert study assistant. Create detailed Cornell-style notes from the provided text. Format as markdown with these sections: ## Cue Column (key terms/questions as a bullet list), ## Notes Column (organized information, definitions, examples), ## Summary (2-3 sentence synthesis). Make it comprehensive and study-ready.",
        input.text
      );
      if (input.documentId > 0) await saveAiOutput(ctx.user.id, input.documentId, "cornell_notes", content);
      return { content };
    }),

    generateMindMap: protectedProcedure.input(z.object({
      documentId: z.number(),
      text: z.string().max(8000),
    })).mutation(async ({ ctx, input }) => {
      const raw = await callAI(
        `You are an expert study assistant. Create a Mermaid.js mindmap diagram from the provided text.
CRITICAL RULES — violating any of these will break the diagram:
- Output ONLY raw Mermaid code, no markdown fences, no explanation, no comments
- First line must be exactly: mindmap
- Second line must be the root node: root((Topic))
- Use ONLY plain text in node labels — absolutely NO parentheses (), NO commas, NO quotes, NO colons, NO special characters
- Replace commas with spaces, parentheses with spaces, colons with dashes
- Keep each label under 40 characters
- Use 2-space indentation for each level
- Create 3-4 levels of hierarchy
- Include 5-8 main branches
BAD example (DO NOT do this): SubTopic(Jira, Monday.com)
GOOD example: SubTopic Jira Monday
Example format:
mindmap
  root((Main Topic))
    Branch One
      SubTopic A
      SubTopic B
    Branch Two
      SubTopic C`,
        input.text
      );
      // Server-side sanitization: strip chars that break Mermaid mindmap parser
      const content = raw
        .replace(/```mermaid\n?/g, "").replace(/```\n?/g, "").trim()
        .split("\n")
        .map((line) => {
          // Only sanitize non-root lines (lines with node labels after indentation)
          const indent = line.match(/^(\s*)/)?.[1] ?? "";
          const label = line.slice(indent.length);
          // Skip diagram keyword lines
          if (label === "mindmap" || label.startsWith("root(")) return line;
          // Remove parentheses content that isn't a valid Mermaid shape
          // Keep ((text)) and [text] and {text} shapes but strip bare parens
          const sanitized = label
            .replace(/\((?![([{])/g, " ")  // opening paren not followed by shape char
            .replace(/(?<![)\]}])\)/g, " ") // closing paren not preceded by shape char
            .replace(/,/g, " ")             // commas → spaces
            .replace(/"/g, "")              // remove stray quotes
            .replace(/:/g, " -")            // colons → dash
            .replace(/  +/g, " ")          // collapse multiple spaces
            .trim();
          return indent + sanitized;
        })
        .join("\n");
      await saveAiOutput(ctx.user.id, input.documentId, "mind_map", content);
      return { content };
    }),

    generateTimeline: protectedProcedure.input(z.object({
      documentId: z.number(),
      text: z.string().max(8000),
    })).mutation(async ({ ctx, input }) => {
      const content = await callAI(
        `You are an expert study assistant. Create a Mermaid.js timeline diagram from the provided text.
Rules:
- Output ONLY the raw Mermaid code, no markdown fences, no explanation
- Start with: timeline
- Include a title
- Format: YEAR/DATE : Event description
- Keep descriptions under 60 characters
- Include 6-12 events
Example:
timeline
    title History of Events
    2020 : First event happened
    2021 : Second event occurred`,
        input.text
      );
      await saveAiOutput(ctx.user.id, input.documentId, "timeline", content);
      return { content };
    }),

    generateFlowchart: protectedProcedure.input(z.object({
      documentId: z.number(),
      text: z.string().max(8000),
    })).mutation(async ({ ctx, input }) => {
      const content = await callAI(
        `You are an expert study assistant. Create a Mermaid.js flowchart from the provided text showing the main process or concept flow.
Rules:
- Output ONLY the raw Mermaid code, no markdown fences, no explanation
- Start with: flowchart TD
- Use descriptive node IDs
- Keep labels under 40 characters
- Use --> for connections, -- label --> for labeled connections
- Include decision nodes with {}, process nodes with [], and terminal nodes with ([])
Example:
flowchart TD
    A([Start]) --> B[Process Step]
    B --> C{Decision?}
    C -->|Yes| D[Action A]
    C -->|No| E[Action B]`,
        input.text
      );
      await saveAiOutput(ctx.user.id, input.documentId, "flowchart", content);
      return { content };
    }),

    generateKeyPoints: protectedProcedure.input(z.object({
      documentId: z.number(),
      text: z.string().max(8000),
    })).mutation(async ({ ctx, input }) => {
      const content = await callAI(
        "You are an expert study assistant. Extract the 7-10 most important key points from the provided text. Format as a numbered markdown list. Each point should be a complete, standalone insight that captures essential knowledge. Start each point with a bold concept name.",
        input.text
      );
      if (input.documentId > 0) await saveAiOutput(ctx.user.id, input.documentId, "key_points", content);
      return { content };
    }),

    summarizeText: protectedProcedure.input(z.object({
      text: z.string().min(20).max(12000),
      mode: z.enum(["summary", "cornell", "key_points"]).default("summary"),
    })).mutation(async ({ input }) => {
      const prompts = {
        summary: "Create a clear study summary from this transcript/content. Include a short overview, major concepts, and what to review next. Format in markdown.",
        cornell: "Create Cornell-style notes from this transcript/content with Cue Column, Notes Column, and Summary sections. Format in markdown.",
        key_points: "Extract the most important key points from this transcript/content as a numbered markdown list with bold concept names.",
      } as const;
      const content = await callAI("You are an expert study assistant for voice/video lecture transcripts.", `${prompts[input.mode]}\n\n${input.text.slice(0, 12000)}`);
      return { content };
    }),

    generateStudyTemplate: protectedProcedure.input(z.object({
      documentIds: z.array(z.number()).min(1).max(8),
      template: z.enum(["key_points", "cornell", "exam_review", "practice_quiz", "study_guide", "glossary", "concept_outline", "weak_spots"]),
      depth: z.enum(["concise", "standard", "deep"]).default("deep"),
      examType: z.string().max(80).optional(),
      instructions: z.string().max(1200).optional(),
    })).mutation(async ({ ctx, input }) => {
      const { text, docs } = await getCombinedDocumentText(ctx.user.id, input.documentIds, 18000);
      const templatePrompts: Record<string, string> = {
        key_points: `Create an advanced high-yield key points brief. Do NOT make a basic list. Group insights by theme, include why each point matters, common traps/misconceptions, and short source-backed evidence snippets.`,
        cornell: `Create premium Cornell notes with Cue Column, Deep Notes, Synthesis, Memory Hooks, Exam Angles, and Quick Self-Test sections.`,
        exam_review: `Create an exam-ready review sheet with high-yield concepts, must-know distinctions, likely question angles, common mistakes, mini practice prompts, and a final cram checklist.`,
        practice_quiz: `Create an original practice quiz. Include mixed difficulty multiple-choice and short-answer questions, answer key, explanations, and why wrong choices are tempting. Do not copy proprietary questions.`,
        study_guide: `Create a complete study guide with learning objectives, topic hierarchy, explanations, examples, summary tables, practice tasks, and a 30/60/90 minute study plan.`,
        glossary: `Create a smart glossary of key terms. For each term include definition, plain-English explanation, why it matters, related terms, and a quick recall question.`,
        concept_outline: `Create a structured concept outline with hierarchy, dependencies, relationships, comparison tables, and what to learn first/next.`,
        weak_spots: `Create a weak-spot diagnostic: identify concepts students are likely to misunderstand, explain warning signs, give corrective drills, and provide targeted practice questions.`,
      };
      const depthRules = {
        concise: "Be efficient but still structured. Prioritize clarity and fast review.",
        standard: "Balance detail and readability. Include examples and study actions.",
        deep: "Go deep. Add advanced synthesis, nuanced distinctions, misconceptions, and exam/reasoning angles.",
      } as const;
      const content = await callAI(
        "You are syllabAI's advanced academic study-material designer. Produce polished, structured, high-signal study materials grounded in the selected document text. Use markdown with tables where helpful. Be specific to the source. Avoid generic filler.",
        `TEMPLATE: ${input.template}\nDEPTH: ${input.depth} — ${depthRules[input.depth]}\nEXAM/COURSE CONTEXT: ${input.examType || "General academic study"}\nUSER INSTRUCTIONS: ${input.instructions || "None"}\nDOCUMENTS: ${docs.map((d: any) => d.originalName).join(", ")}\n\n${templatePrompts[input.template]}\n\nSOURCE TEXT:\n${text}`
      );
      return { content, sources: docs.map((d: any) => ({ id: d.id, name: d.originalName })) };
    }),

    chatWithDocuments: protectedProcedure.input(z.object({
      documentIds: z.array(z.number()).min(1).max(6),
      messages: z.array(z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string().max(3000),
      })).min(1).max(12),
    })).mutation(async ({ ctx, input }) => {
      const { text, docs } = await getCombinedDocumentText(ctx.user.id, input.documentIds, 18000);
      const messages = [
        {
          role: "system",
          content: `You are syllabAI's document Q&A assistant. Answer using ONLY the provided document text. If the answer is not supported by the documents, say you cannot find it in the selected documents. Cite the document name and include short supporting quotes when helpful. Be concise, accurate, and study-focused.\n\nSelected documents: ${docs.map((d: any) => d.originalName).join(", ")}\n\n${text}`,
        },
        ...input.messages,
      ];
      const res = await invokeLLM({ messages: messages as any });
      const content = res.choices[0].message.content;
      return { response: (typeof content === "string" ? content.trim() : JSON.stringify(content)) ?? "" };
    }),

    generateStudyPlan: protectedProcedure.input(z.object({
      documentId: z.number().optional(),
      documentIds: z.array(z.number()).max(8).optional(),
      text: z.string().max(12000).optional(),
    })).mutation(async ({ ctx, input }) => {
      let text = input.text;
      let docId = input.documentId && input.documentId > 0 ? input.documentId : undefined;
      if (!text && input.documentIds?.length) {
        const combined = await getCombinedDocumentText(ctx.user.id, input.documentIds, 12000);
        text = combined.text;
        docId = combined.docs.length === 1 ? combined.docs[0].id : undefined;
      }
      if (!text?.trim()) throw new Error("No source text provided for study plan generation");
      const content = await callAI(
        "You are an expert academic advisor. Analyze the provided text and create a detailed unified study plan. Include detected deadlines/assignments if present, a week-by-week or day-by-day schedule, recommended study actions, priority topics, and practice questions. If multiple documents are provided, synthesize them into one coherent plan. Format as structured markdown.",
        text.slice(0, 12000)
      );
      if (docId) await saveAiOutput(ctx.user.id, docId, "study_plan", content);
      return { content };
    }),

    detectDeadlines: protectedProcedure.input(z.object({
      documentId: z.number(),
      text: z.string().max(8000),
    })).mutation(async ({ ctx, input }) => {
      const raw = await callAI(
        "You are an expert at extracting academic deadlines. Extract all assignments, exams, quizzes, and deadlines from the text. Return a JSON array.",
        input.text,
        {
          type: "object",
          properties: {
            deadlines: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  title: { type: "string" },
                  date: { type: "string" },
                  type: { type: "string", enum: ["assignment", "exam", "reading", "other"] },
                  description: { type: "string" },
                },
                required: ["title", "date", "type", "description"],
                additionalProperties: false,
              },
            },
          },
          required: ["deadlines"],
          additionalProperties: false,
        }
      );
            const parsed = JSON.parse(raw);
      return { deadlines: parsed.deadlines };
    }),
    parseSyllabus: protectedProcedure.input(z.object({
      fileBase64: z.string(),
      filename: z.string(),
      mimeType: z.string(),
    })).mutation(async ({ ctx, input }) => {
      // Decode and extract text
      const buffer = Buffer.from(input.fileBase64, "base64");
      let extractedText = "";
      try {
        if (input.mimeType === "application/pdf") {
          const parser = new PDFParse({ data: buffer, verbosity: 0 });
          const result = await parser.getText();
          extractedText = result.text.trim();
          await parser.destroy();
        } else if (
          input.mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
          input.mimeType === "application/msword"
        ) {
          extractedText = await docxToText(buffer);
        } else if (input.mimeType === "text/plain") {
          extractedText = buffer.toString("utf-8");
        } else {
          throw new Error("Unsupported file type for syllabus parsing");
        }
      } catch (err) {
        throw new Error("Could not extract text from this file. Please upload a PDF, DOCX, or TXT syllabus.");
      }
      if (!extractedText || extractedText.length < 50) {
        throw new Error("The file appears to be empty or contains no readable text.");
      }
      // AI extraction of deadlines + course info
      const raw = await callAI(
        `You are an expert academic advisor specializing in syllabus analysis. Extract ALL deadlines, assignments, exams, quizzes, projects, readings, and important dates from this syllabus. Also extract the course name and instructor if present. Be thorough — include every item with a date or due date. For dates without a year, assume the current or upcoming academic year. Return a JSON object.`,
        extractedText.slice(0, 6000),
        {
          type: "object",
          properties: {
            courseName: { type: "string" },
            instructor: { type: "string" },
            deadlines: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  title: { type: "string" },
                  date: { type: "string" },
                  type: { type: "string", enum: ["assignment", "exam", "reading", "other"] },
                  description: { type: "string" },
                  priority: { type: "string", enum: ["low", "medium", "high"] },
                },
                required: ["title", "date", "type", "description", "priority"],
                additionalProperties: false,
              },
            },
          },
          required: ["courseName", "instructor", "deadlines"],
          additionalProperties: false,
        }
      );
      const parsed = JSON.parse(raw);
      return {
        courseName: parsed.courseName,
        instructor: parsed.instructor,
        deadlines: parsed.deadlines,
        wordCount: extractedText.split(/\s+/).filter(Boolean).length,
      };
    }),
    simulation: protectedProcedure.input(z.object({
      domain: z.enum(["medical", "finance", "coding", "history", "custom"]),
      customDomain: z.string().max(120).optional(),
      difficulty: z.enum(["beginner", "intermediate", "advanced"]).default("intermediate"),
      mode: z.enum(["guided", "branching", "interview"]).default("branching"),
      scenario: z.string().max(2000),
      userResponse: z.string().max(2500).optional(),
      conversationHistory: z.array(z.object({ role: z.enum(["user", "assistant"]), content: z.string() })).optional(),
    })).mutation(async ({ ctx, input }) => {
      const domainPrompts: Record<string, string> = {
        medical: "You are a medical simulation instructor. Run realistic original clinical scenarios for education. Ask for history, exam, tests, differential diagnosis, and management decisions. Do not provide real medical advice; keep it educational and include safety caveats when needed.",
        finance: "You are a finance simulation instructor. Run realistic investment, budgeting, market, or portfolio decision scenarios. Explain risk, assumptions, tradeoffs, and consequences. Do not provide personalized financial advice; keep it educational.",
        coding: "You are a senior software engineer running a technical interview and system design simulator. Evaluate reasoning, ask clarifying questions, discuss tradeoffs, and give implementation feedback.",
        history: "You are a historical simulation guide. Run rigorous what-if or decision scenarios grounded in historical context. Focus on causality, evidence, tradeoffs, and downstream consequences.",
        custom: `You are an expert simulation instructor for ${input.customDomain || "a custom subject"}. Create role-aware educational scenarios with decisions, feedback, and consequences.`,
      };
      const modeRules: Record<string, string> = {
        guided: "GUIDED COACH MODE: Ask one focused question at a time. Give hints if the learner struggles. Explain after each learner response.",
        branching: "BRANCHING MODE: Present a scenario, then offer 3-4 labeled choices (A/B/C/D). After the learner chooses, show consequences, feedback, and the next decision point.",
        interview: "INTERVIEW MODE: Ask probing questions, evaluate the learner's answer, score reasoning qualitatively, and escalate difficulty gradually.",
      };
      const difficultyRules: Record<string, string> = {
        beginner: "Beginner difficulty: define terms, keep cognitive load manageable, and give supportive hints.",
        intermediate: "Intermediate difficulty: require applied reasoning, prioritization, and explanation of tradeoffs.",
        advanced: "Advanced difficulty: include ambiguity, edge cases, competing priorities, and require expert-level reasoning.",
      };
      const systemPrompt = `${domainPrompts[input.domain]}\n${modeRules[input.mode]}\n${difficultyRules[input.difficulty]}\n\nFormatting rules:\n- Use markdown.\n- Keep each turn interactive; do not solve the whole scenario at once.\n- Include sections when useful: Situation, Available Information, Decision Point, Options, Feedback, Consequences, Next Step.\n- If offering choices, label them clearly A, B, C, D.\n- Track learner reasoning and give actionable feedback.\n- Never copy proprietary exam/question-bank content; create original scenarios.`;
      const messages: any[] = [{ role: "system", content: systemPrompt }];
      if (input.conversationHistory) messages.push(...input.conversationHistory.slice(-10));
      messages.push({ role: "user", content: input.userResponse ?? `Start a new ${input.domain === "custom" ? input.customDomain || "custom" : input.domain} simulation: ${input.scenario}` });
      const res = await invokeLLM({ messages });
      const simContent = res.choices[0].message.content;
return { response: (typeof simContent === 'string' ? simContent.trim() : JSON.stringify(simContent)) ?? "" };
    }),
  }),

  // ── Flashcard Decks ───────────────────────────────────────────────────────
  decks: router({
    list: protectedProcedure.query(({ ctx }) => getDecksByUser(ctx.user.id)),

    get: protectedProcedure.input(z.object({ id: z.number() })).query(({ ctx, input }) =>
      getDeckById(input.id, ctx.user.id)
    ),

    create: protectedProcedure.input(z.object({
      title: z.string(),
      documentId: z.number().optional(),
      cards: z.array(z.object({ question: z.string(), answer: z.string() })),
    })).mutation(async ({ ctx, input }) => {
      await createDeck(ctx.user.id, input.title, input.documentId);
      const decks = await getDecksByUser(ctx.user.id);
      const deck = decks[0];
      await createFlashcards(input.cards.map((c) => ({ deckId: deck.id, userId: ctx.user.id, ...c })));
      return { deckId: deck.id };
    }),

    cards: protectedProcedure.input(z.object({ deckId: z.number() })).query(({ ctx, input }) =>
      getFlashcardsByDeck(input.deckId, ctx.user.id)
    ),

    regenerateCard: protectedProcedure.input(z.object({
      cardId: z.number(),
      feedback: z.string().max(1000).optional(),
      difficulty: z.enum(["beginner", "intermediate", "advanced"]).default("intermediate"),
    })).mutation(async ({ ctx, input }) => {
      const card = await getFlashcardById(input.cardId, ctx.user.id);
      if (!card) throw new Error("Flashcard not found");
      const raw = await callAI(
        `You rewrite flawed flashcards. Create exactly one improved flashcard at ${input.difficulty} difficulty. Keep it accurate, concise, and study-focused. Return JSON only.`,
        `Original question: ${card.question}\nOriginal answer: ${card.answer}\nUser feedback: ${input.feedback || "Improve clarity and educational value."}`,
        {
          type: "object",
          properties: {
            question: { type: "string" },
            answer: { type: "string" },
          },
          required: ["question", "answer"],
          additionalProperties: false,
        }
      );
      const parsed = JSON.parse(raw) as { question: string; answer: string };
      await updateFlashcardContent(card.id, ctx.user.id, parsed.question, parsed.answer);
      return parsed;
    }),

    dueCards: protectedProcedure.query(({ ctx }) => getDueFlashcards(ctx.user.id)),

    reviewCard: protectedProcedure.input(z.object({
      cardId: z.number(),
      quality: z.number().min(0).max(5),
      currentInterval: z.number(),
      currentRepetitions: z.number(),
      currentEaseFactor: z.number(),
    })).mutation(async ({ ctx, input }) => {
      const { interval, repetitions, easeFactor, dueDate } = sm2(
        { interval: input.currentInterval, repetitions: input.currentRepetitions, easeFactor: input.currentEaseFactor },
        input.quality
      );
      await updateFlashcardSRS(input.cardId, interval, repetitions, easeFactor, dueDate);
      return { interval, repetitions, easeFactor, dueDate };
    }),

    saveQuizResult: protectedProcedure.input(z.object({
      deckId: z.number(),
      documentId: z.number().optional(),
      totalCards: z.number(),
      knownCount: z.number(),
      needsWorkCount: z.number(),
      scorePercent: z.number(),
    })).mutation(async ({ ctx, input }) => {
      await saveQuizSession({ userId: ctx.user.id, ...input });
      return { success: true };
    }),

    quizHistory: protectedProcedure.input(z.object({ deckId: z.number().optional() })).query(({ ctx, input }) =>
      getQuizHistory(ctx.user.id, input.deckId)
    ),
  }),

  // ── Notes ─────────────────────────────────────────────────────────────────
  notes: router({
    list: protectedProcedure.query(({ ctx }) => getNotesByUser(ctx.user.id)),

        create: protectedProcedure.input(z.object({
      title: z.string().default("Untitled Note"),
      content: z.string(),
      color: z.string().optional(),
      documentId: z.number().optional(),
      folderId: z.number().optional(),
    })).mutation(async ({ ctx, input }) => {
      await createNote({ userId: ctx.user.id, ...input });
      return { success: true };
    }),
    update: protectedProcedure.input(z.object({
      id: z.number(),
      title: z.string().optional(),
      content: z.string().optional(),
      color: z.string().optional(),
      isPinned: z.boolean().optional(),
      folderId: z.number().nullable().optional(),
    })).mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      await updateNote(id, ctx.user.id, data);
      return { success: true };
    }),

    delete: protectedProcedure.input(z.object({ id: z.number() })).mutation(async ({ ctx, input }) => {
      await deleteNote(input.id, ctx.user.id);
      return { success: true };
    }),

    share: protectedProcedure.input(z.object({
      noteIds: z.array(z.number()),
      recipientEmail: z.string().email().optional(),
      recipientPhone: z.string().optional(),
    })).mutation(async ({ ctx, input }) => {
      const token = nanoid(32);
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7);
      await createShareToken({
        userId: ctx.user.id,
        token,
        noteIds: JSON.stringify(input.noteIds),
        recipientEmail: input.recipientEmail,
        recipientPhone: input.recipientPhone,
        expiresAt,
      });
      return { token, shareUrl: `/share/${token}` };
    }),
  }),

  // ── Tasks ─────────────────────────────────────────────────────────────────
  // ── Note Folders ──────────────────────────────────────────────────────────
  folders: router({
    list: protectedProcedure.query(({ ctx }) => getNoteFoldersByUser(ctx.user.id)),
    create: protectedProcedure.input(z.object({
      name: z.string().min(1).max(256),
      color: z.string().optional(),
    })).mutation(async ({ ctx, input }) => {
      const id = await createNoteFolder(ctx.user.id, input.name, input.color);
      return { success: true, id };
    }),
    update: protectedProcedure.input(z.object({
      id: z.number(),
      name: z.string().optional(),
      color: z.string().optional(),
      isPinned: z.boolean().optional(),
    })).mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      await updateNoteFolder(id, ctx.user.id, data);
      return { success: true };
    }),
    delete: protectedProcedure.input(z.object({ id: z.number() })).mutation(async ({ ctx, input }) => {
      await deleteNoteFolder(input.id, ctx.user.id);
      return { success: true };
    }),
    moveNote: protectedProcedure.input(z.object({
      noteId: z.number(),
      folderId: z.number().nullable(),
    })).mutation(async ({ ctx, input }) => {
      await moveNoteToFolder(input.noteId, ctx.user.id, input.folderId);
      return { success: true };
    }),
  }),
  tasks: router({
    list: protectedProcedure.query(({ ctx }) => getTasksByUser(ctx.user.id)),

    create: protectedProcedure.input(z.object({
      title: z.string(),
      description: z.string().optional(),
      dueDate: z.string().optional(),
      priority: z.enum(["low", "medium", "high"]).optional(),
      type: z.enum(["assignment", "exam", "reading", "other"]).optional(),
      documentId: z.number().optional(),
    })).mutation(async ({ ctx, input }) => {
      await createTask({
        userId: ctx.user.id,
        title: input.title,
        description: input.description,
        dueDate: input.dueDate ? new Date(input.dueDate) : undefined,
        priority: input.priority,
        type: input.type,
        documentId: input.documentId,
      });
      return { success: true };
    }),

    update: protectedProcedure.input(z.object({
      id: z.number(),
      title: z.string().optional(),
      description: z.string().optional(),
      dueDate: z.string().optional(),
      priority: z.enum(["low", "medium", "high"]).optional(),
      status: z.enum(["todo", "in_progress", "done"]).optional(),
      type: z.enum(["assignment", "exam", "reading", "other"]).optional(),
    })).mutation(async ({ ctx, input }) => {
      const { id, dueDate, ...rest } = input;
      await updateTask(id, ctx.user.id, { ...rest, dueDate: dueDate ? new Date(dueDate) : undefined });
      return { success: true };
    }),

        delete: protectedProcedure.input(z.object({ id: z.number() })).mutation(async ({ ctx, input }) => {
      await deleteTask(input.id, ctx.user.id);
      return { success: true };
    }),
    bulkCreate: protectedProcedure.input(z.object({
      tasks: z.array(z.object({
        title: z.string(),
        description: z.string().optional(),
        dueDate: z.string().optional(),
        priority: z.enum(["low", "medium", "high"]).optional(),
        type: z.enum(["assignment", "exam", "reading", "other"]).optional(),
        documentId: z.number().optional(),
      })),
    })).mutation(async ({ ctx, input }) => {
      for (const task of input.tasks) {
        await createTask({
          userId: ctx.user.id,
          title: task.title,
          description: task.description,
          dueDate: task.dueDate ? new Date(task.dueDate) : undefined,
          priority: task.priority ?? "medium",
          type: task.type ?? "other",
          documentId: task.documentId,
        });
      }
      return { success: true, count: input.tasks.length };
    }),
  }),
  // ── Timer ─────────────────────────────────────────────────────────────────
  timer: router({
    saveSession: protectedProcedure.input(z.object({
      sessionType: z.enum(["work", "short_break", "long_break"]),
      durationMinutes: z.number(),
    })).mutation(async ({ ctx, input }) => {
      await saveTimerSession(ctx.user.id, input.sessionType, input.durationMinutes);
      return { success: true };
    }),

    history: protectedProcedure.query(({ ctx }) => getTimerHistory(ctx.user.id)),
  }),

  // ── Voice ─────────────────────────────────────────────────────────────────
  voice: router({
    transcribe: protectedProcedure.input(z.object({
      audioUrl: z.string(),
      language: z.string().optional(),
    })).mutation(async ({ ctx, input }) => {
      // /manus-storage/<key> is a relative proxy path — resolve to a presigned S3 URL
      let resolvedUrl = input.audioUrl;
      if (input.audioUrl.startsWith("/manus-storage/")) {
        const relKey = input.audioUrl.replace(/^\/manus-storage\//, "");
        resolvedUrl = await storageGetSignedUrl(relKey);
      }
      const result = await transcribeAudio({ audioUrl: resolvedUrl, language: input.language });
      if ('error' in result) throw new Error(result.error);
      return { text: result.text };
    }),

    uploadAudio: protectedProcedure.input(z.object({
      audioData: z.string(), // base64
      mimeType: z.string(),
    })).mutation(async ({ ctx, input }) => {
      const buffer = Buffer.from(input.audioData, "base64");
      const ext = input.mimeType.includes("ogg") ? "ogg" : input.mimeType.includes("mp4") ? "mp4" : "webm";
      const fileKey = `${ctx.user.id}/audio/${nanoid()}.${ext}`;
      const { url } = await storagePut(fileKey, buffer, input.mimeType);
      return { url, fileKey };
    }),

    saveNote: protectedProcedure.input(z.object({
      audioData: z.string(), // base64
      mimeType: z.string(),
      title: z.string().default("Voice Note"),
      duration: z.number().default(0),
      transcript: z.string().optional(),
    })).mutation(async ({ ctx, input }) => {
      const buffer = Buffer.from(input.audioData, "base64");
      const ext = input.mimeType.includes("ogg") ? "ogg" : input.mimeType.includes("mp4") ? "mp4" : "webm";
      const fileKey = `${ctx.user.id}/voice-notes/${nanoid()}.${ext}`;
      const { url } = await storagePut(fileKey, buffer, input.mimeType);
      await createVoiceNote({
        userId: ctx.user.id,
        title: input.title,
        s3Key: fileKey,
        s3Url: url,
        duration: input.duration,
        transcript: input.transcript,
      });
      return { success: true };
    }),

    listNotes: protectedProcedure.query(async ({ ctx }) => {
      return getVoiceNotesByUser(ctx.user.id);
    }),

    deleteNote: protectedProcedure.input(z.object({ id: z.number() })).mutation(async ({ ctx, input }) => {
      await deleteVoiceNote(input.id, ctx.user.id);
      return { success: true };
    }),

    updateTranscript: protectedProcedure.input(z.object({
      id: z.number(),
      transcript: z.string(),
    })).mutation(async ({ ctx, input }) => {
      await updateVoiceNoteTranscript(input.id, ctx.user.id, input.transcript);
      return { success: true };
    }),
  }),

  // ── Video Notes ───────────────────────────────────────────────────────────
  videoNotes: router({
    upload: protectedProcedure.input(z.object({
      videoData: z.string(), // base64
      mimeType: z.string(),
      title: z.string().default("Video Note"),
      duration: z.number().default(0),
    })).mutation(async ({ ctx, input }) => {
      const count = await countVideoNotesByUser(ctx.user.id);
      if (count >= 20) throw new Error("Video storage limit reached (20 videos maximum)");
      const ext = input.mimeType.includes("mp4") ? "mp4" : input.mimeType.includes("mov") ? "mov" : "webm";
      const fileKey = `${ctx.user.id}/video-notes/${nanoid()}.${ext}`;
      const buffer = Buffer.from(input.videoData, "base64");
      const { url } = await storagePut(fileKey, buffer, input.mimeType);
      await createVideoNote({
        userId: ctx.user.id,
        title: input.title,
        s3Key: fileKey,
        s3Url: url,
        duration: input.duration,
        videoMimeType: input.mimeType,
      });
      return { success: true, url };
    }),

    list: protectedProcedure.query(async ({ ctx }) => {
      return getVideoNotesByUser(ctx.user.id);
    }),

    delete: protectedProcedure.input(z.object({ id: z.number() })).mutation(async ({ ctx, input }) => {
      await deleteVideoNote(input.id, ctx.user.id);
      return { success: true };
    }),

    transcribe: protectedProcedure.input(z.object({
      id: z.number(),
      audioUrl: z.string(),
      language: z.string().optional(),
    })).mutation(async ({ ctx, input }) => {
      // /manus-storage/<key> is a relative proxy path — resolve to a presigned S3 URL
      let resolvedUrl = input.audioUrl;
      if (input.audioUrl.startsWith("/manus-storage/")) {
        const relKey = input.audioUrl.replace(/^\/manus-storage\//, "");
        resolvedUrl = await storageGetSignedUrl(relKey);
      }
      const result = await transcribeAudio({ audioUrl: resolvedUrl, language: input.language });
      if ('error' in result) throw new Error(result.error);
      await updateVideoNoteTranscript(input.id, ctx.user.id, result.text);
      return { text: result.text };
    }),
  }),
  // ── Share ─────────────────────────────────────────────────────────────────
  share: router({
    getShared: publicProcedure.input(z.object({ token: z.string() })).query(async ({ input }) => {
      const shareToken = await getShareToken(input.token);
      if (!shareToken) throw new Error("Share link not found or expired");
      if (new Date() > shareToken.expiresAt) throw new Error("Share link has expired");
      const noteIds = JSON.parse(shareToken.noteIds) as number[];
      const allNotes = await getNotesByIds(noteIds, shareToken.userId);
      return { notes: allNotes.filter((n) => noteIds.includes(n.id)) };
    }),
    publishDeck: protectedProcedure.input(z.object({
      deckId: z.number(),
      isPublic: z.boolean(),
      description: z.string().optional(),
      subject: z.string().optional(),
    })).mutation(async ({ ctx, input }) => {
      const slug = `deck-${input.deckId}-${Math.random().toString(36).slice(2, 8)}`;
      await publishDeck(input.deckId, ctx.user.id, { ...input, shareSlug: slug });
      return { slug };
    }),
    publishNote: protectedProcedure.input(z.object({
      noteId: z.number(),
      isPublic: z.boolean(),
      subject: z.string().optional(),
    })).mutation(async ({ ctx, input }) => {
      const slug = `note-${input.noteId}-${Math.random().toString(36).slice(2, 8)}`;
      await publishNote(input.noteId, ctx.user.id, { ...input, shareSlug: slug });
      return { slug };
    }),
  }),

  explore: router({
    decks: publicProcedure.input(z.object({ subject: z.string().optional() }).optional()).query(async ({ input }) => {
      return getPublicDecks(40, input?.subject);
    }),
    notes: publicProcedure.input(z.object({ subject: z.string().optional() }).optional()).query(async ({ input }) => {
      return getPublicNotes(40, input?.subject);
    }),
    deckBySlug: publicProcedure.input(z.object({ slug: z.string() })).query(async ({ input }) => {
      const deck = await getDeckBySlug(input.slug);
      if (!deck) throw new Error("Study set not found");
      return deck;
    }),
    noteBySlug: publicProcedure.input(z.object({ slug: z.string() })).query(async ({ input }) => {
      const note = await getNoteBySlug(input.slug);
      if (!note) throw new Error("Note not found");
      return note;
    }),
    deckCards: publicProcedure.input(z.object({ deckId: z.number() })).query(async ({ ctx, input }) => {
      // Logged-out users get first 3 cards only (Quizlet-style gating)
      const cards = await getPublicCardsByDeck(input.deckId);
      if (!ctx.user) return { cards: cards.slice(0, 3), locked: cards.length > 3, total: cards.length };
      return { cards, locked: false, total: cards.length };
    }),
  }),
  settings: router({
    get: protectedProcedure.query(async ({ ctx }) => {
      return getUserSettings(ctx.user.id);
    }),
    save: protectedProcedure
      .input(z.object({
        notificationEmail: z.string().email().optional().or(z.literal("")),
        notificationPhone: z.string().optional(),
        notifyFrequency: z.enum(["every_hour", "24_hours_before", "as_approaching", "every_few_days", "disabled"]).optional(),
        notifyEnabled: z.boolean().optional(),
        shareDeadlinesEnabled: z.boolean().optional(),
        shareDeadlinesRecipients: z.string().optional(), // JSON string
        displayName: z.string().max(128).optional(),
        bio: z.string().max(500).optional(),
        accentColor: z.string().max(16).optional().nullable(),
      }))
      .mutation(async ({ ctx, input }) => {
        await upsertUserSettings(ctx.user.id, input);
        return { success: true };
      }),
    // ── Push Subscription Management ──────────────────────────────────────
    subscribePush: protectedProcedure
      .input(z.object({
        endpoint: z.string(),
        p256dh: z.string(),
        auth: z.string(),
      }))
      .mutation(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) throw new Error("Database unavailable");
        const { pushSubscriptions } = await import("../drizzle/schema");
        const { eq, and } = await import("drizzle-orm");
        // Upsert by endpoint (replace if already exists for this user)
        const existing = await db.select().from(pushSubscriptions)
          .where(and(eq(pushSubscriptions.userId, ctx.user.id), eq(pushSubscriptions.endpoint, input.endpoint)))
          .limit(1);
        if (existing.length > 0) {
          await db.update(pushSubscriptions)
            .set({ p256dh: input.p256dh, auth: input.auth })
            .where(eq(pushSubscriptions.id, existing[0].id));
        } else {
          await db.insert(pushSubscriptions).values({
            userId: ctx.user.id,
            endpoint: input.endpoint,
            p256dh: input.p256dh,
            auth: input.auth,
          });
        }
        return { success: true };
      }),

    unsubscribePush: protectedProcedure
      .input(z.object({ endpoint: z.string() }))
      .mutation(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) throw new Error("Database unavailable");
        const { pushSubscriptions } = await import("../drizzle/schema");
        const { eq, and } = await import("drizzle-orm");
        await db.delete(pushSubscriptions)
          .where(and(eq(pushSubscriptions.userId, ctx.user.id), eq(pushSubscriptions.endpoint, input.endpoint)));
        return { success: true };
      }),

    // Send deadline reminders now (called by heartbeat or manually)
    sendDeadlineNotifications: protectedProcedure.mutation(async ({ ctx }) => {
      const settings = await getUserSettings(ctx.user.id);
      if (!settings?.notifyEnabled) return { sent: 0 };

      // Get upcoming tasks (due within next 3 days)
      const tasks = await getTasksByUser(ctx.user.id);
      const now = Date.now();
      const threeDays = 3 * 24 * 60 * 60 * 1000;
      const upcoming = tasks.filter(
        (t) => t.dueDate && t.status !== "done" && Number(t.dueDate) > now && Number(t.dueDate) - now <= threeDays
      );
      if (upcoming.length === 0) return { sent: 0 };

      const deadlines = upcoming.map((t) => ({
        title: t.title,
        dueDate: Number(t.dueDate),
        subject: t.type,
        priority: t.priority,
      }));

      let sent = 0;

      // Email
      if (settings.notificationEmail) {
        try {
          await sendDeadlineReminder({
            toEmail: settings.notificationEmail,
            toName: settings.displayName ?? ctx.user.name ?? "Student",
            deadlines,
          });
          sent++;
        } catch (err) {
          console.error("[Notifications] Email send failed:", err);
        }
      }

      // Push
      const db = await getDb();
      if (db) {
        const { pushSubscriptions } = await import("../drizzle/schema");
        const { eq } = await import("drizzle-orm");
        const subs = await db.select().from(pushSubscriptions).where(eq(pushSubscriptions.userId, ctx.user.id));
        if (subs.length > 0) {
          try {
            await sendDeadlinePushNotifications(
              subs.map((s) => ({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } })),
              deadlines
            );
            sent++;
          } catch (err) {
            console.error("[Notifications] Push send failed:", err);
          }
        }
      }

      return { sent };
    }),

    deactivate: protectedProcedure.mutation(async ({ ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");
      const { userSettings } = await import("../drizzle/schema");
      const { eq } = await import("drizzle-orm");
      await db.insert(userSettings).values({
        userId: ctx.user.id,
        isDeactivated: true,
        deactivatedAt: new Date(),
      }).onDuplicateKeyUpdate({
        set: { isDeactivated: true, deactivatedAt: new Date() },
      });
      // Clear session cookie
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true };
    }),
  }),
});

export type AppRouter = typeof appRouter;
