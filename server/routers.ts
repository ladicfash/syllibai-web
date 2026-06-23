import { z } from "zod";
import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import { invokeLLM } from "./_core/llm";
import { transcribeAudio } from "./_core/voiceTranscription";
import { storagePut } from "./storage";
import { getDb } from "./db";
import {
  upsertUser, getUserByOpenId,
  createDocument, getDocumentsByUser, getDocumentById, deleteDocument, updateDocumentText,
  createDeck, getDecksByUser, getDeckById,
  createFlashcards, getFlashcardsByDeck, updateFlashcardSRS, getDueFlashcards,
  saveQuizSession, getQuizHistory,
  createNote, getNotesByUser, updateNote, deleteNote, getNotesByIds,
  createTask, getTasksByUser, updateTask, deleteTask,
  saveTimerSession, getTimerHistory,
  saveAiOutput, getAiOutput,
  createShareToken, getShareToken,
  publishDeck, publishNote,
  getPublicDecks, getPublicNotes,
  getDeckBySlug, getNoteBySlug, getPublicCardsByDeck,
} from "./db";
import { nanoid } from "nanoid";
import { docxToText, docxToHtml, textToDocx, imageToPdf, textToPdf } from "./conversion";
import { PDFParse } from "pdf-parse";

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

  // ── AI Tools ─────────────────────────────────────────────────────────────
  ai: router({
    generateFlashcards: protectedProcedure.input(z.object({
      documentId: z.number(),
      text: z.string().max(8000),
    })).mutation(async ({ ctx, input }) => {
      const raw = await callAI(
        "You are an expert study assistant. Generate 10-15 high-quality flashcards from the provided text. Return a JSON array of objects with 'question' and 'answer' fields. Questions should test understanding, not just recall. Answers should be concise but complete.",
        input.text,
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
      const cards = parsed.cards as { question: string; answer: string }[];
      // Create deck and save cards
      await createDeck(ctx.user.id, "Generated Flashcards", input.documentId);
      const decks = await getDecksByUser(ctx.user.id);
      const deck = decks[0];
      await createFlashcards(cards.map((c) => ({ deckId: deck.id, userId: ctx.user.id, ...c })));
      await saveAiOutput(ctx.user.id, input.documentId, "flashcards", JSON.stringify(cards));
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
      await saveAiOutput(ctx.user.id, input.documentId, "cornell_notes", content);
      return { content };
    }),

    generateMindMap: protectedProcedure.input(z.object({
      documentId: z.number(),
      text: z.string().max(8000),
    })).mutation(async ({ ctx, input }) => {
      const content = await callAI(
        `You are an expert study assistant. Create a Mermaid.js mindmap diagram from the provided text. 
Rules:
- Output ONLY the raw Mermaid code, no markdown fences, no explanation
- Start with: mindmap
- Use proper indentation for hierarchy
- Keep node labels under 50 characters
- Use double quotes for labels with special characters
- Create 3-4 levels of hierarchy
- Include 5-8 main branches
Example format:
mindmap
  root((Main Topic))
    Branch1
      SubTopic1
      SubTopic2
    Branch2
      SubTopic3`,
        input.text
      );
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
      await saveAiOutput(ctx.user.id, input.documentId, "key_points", content);
      return { content };
    }),

    generateStudyPlan: protectedProcedure.input(z.object({
      documentId: z.number(),
      text: z.string().max(8000),
    })).mutation(async ({ ctx, input }) => {
      const content = await callAI(
        "You are an expert academic advisor. Analyze the provided text (likely a syllabus or course document) and create a detailed study plan. Include: detected deadlines and assignments, a week-by-week study schedule, recommended resources, and practice questions. Format as structured markdown.",
        input.text
      );
      await saveAiOutput(ctx.user.id, input.documentId, "study_plan", content);
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
      domain: z.enum(["medical", "finance", "coding", "history"]),
      scenario: z.string().max(2000),
      userResponse: z.string().max(2000).optional(),
      conversationHistory: z.array(z.object({ role: z.enum(["user", "assistant"]), content: z.string() })).optional(),
    })).mutation(async ({ ctx, input }) => {
      const domainPrompts: Record<string, string> = {
        medical: "You are a medical simulation instructor. Present realistic clinical scenarios where the student must make diagnostic and treatment decisions. Provide feedback on their reasoning, mention what a real clinician would consider, and explain consequences of different choices. Be educational but realistic.",
        finance: "You are a financial simulation instructor. Present realistic market scenarios, investment decisions, or financial planning situations. Guide the student through analysis frameworks, risk assessment, and decision-making. Explain real-world implications.",
        coding: "You are a senior software engineer running a technical interview simulation. Present coding problems, system design challenges, or debugging scenarios. Evaluate the student's approach, suggest improvements, and explain best practices.",
        history: "You are a historical simulation guide. Present 'what if' scenarios where historical facts are altered. Help the student analyze cause-and-effect relationships, explore alternative outcomes, and understand historical forces. Be academically rigorous.",
      };
      const messages: any[] = [{ role: "system", content: domainPrompts[input.domain] }];
      if (input.conversationHistory) messages.push(...input.conversationHistory);
      messages.push({ role: "user", content: input.userResponse ?? `Start a new ${input.domain} simulation scenario: ${input.scenario}` });
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
      const result = await transcribeAudio({ audioUrl: input.audioUrl, language: input.language });
      if ('error' in result) throw new Error(result.error);
      return { text: result.text };
    }),

    uploadAudio: protectedProcedure.input(z.object({
      audioData: z.string(), // base64
      mimeType: z.string(),
    })).mutation(async ({ ctx, input }) => {
      const buffer = Buffer.from(input.audioData, "base64");
      const fileKey = `${ctx.user.id}/audio/${nanoid()}.webm`;
      const { url } = await storagePut(fileKey, buffer, input.mimeType);
      return { url };
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
});

export type AppRouter = typeof appRouter;
