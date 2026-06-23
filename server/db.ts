import { eq, desc, and, gte, lte } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import {
  users, documents, flashcardDecks, flashcards, notes, tasks,
  timerSessions, aiOutputs, quizSessions, shareTokens,
  type InsertUser, type Document, type InsertDocument,
} from "../drizzle/schema";

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

// ── Users ──────────────────────────────────────────────────────────────────
import { ENV } from "./_core/env";

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error("User openId is required for upsert");
  const db = await getDb();
  if (!db) return;
  const values: InsertUser = { openId: user.openId };
  const updateSet: Record<string, unknown> = {};
  const textFields = ["name", "email", "loginMethod"] as const;
  textFields.forEach((field) => {
    const value = user[field];
    if (value === undefined) return;
    const normalized = value ?? null;
    values[field] = normalized;
    updateSet[field] = normalized;
  });
  if (user.lastSignedIn !== undefined) {
    values.lastSignedIn = user.lastSignedIn;
    updateSet.lastSignedIn = user.lastSignedIn;
  }
  if (user.role !== undefined) {
    values.role = user.role;
    updateSet.role = user.role;
  } else if (user.openId === ENV.ownerOpenId) {
    values.role = "admin";
    updateSet.role = "admin";
  }
  if (!values.lastSignedIn) values.lastSignedIn = new Date();
  if (Object.keys(updateSet).length === 0) updateSet.lastSignedIn = new Date();
  await db.insert(users).values(values).onDuplicateKeyUpdate({ set: updateSet });
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result[0];
}

// ── Documents ──────────────────────────────────────────────────────────────
export async function createDocument(doc: InsertDocument) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const result = await db.insert(documents).values(doc);
  return result[0];
}

export async function getDocumentsByUser(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(documents).where(eq(documents.userId, userId)).orderBy(desc(documents.createdAt));
}

export async function getDocumentById(id: number, userId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(documents).where(and(eq(documents.id, id), eq(documents.userId, userId))).limit(1);
  return result[0];
}

export async function deleteDocument(id: number, userId: number) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.delete(documents).where(and(eq(documents.id, id), eq(documents.userId, userId)));
}

export async function updateDocumentText(id: number, extractedText: string, wordCount: number) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.update(documents).set({ extractedText, wordCount }).where(eq(documents.id, id));
}

// ── Flashcard Decks ────────────────────────────────────────────────────────
export async function createDeck(userId: number, title: string, documentId?: number) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const result = await db.insert(flashcardDecks).values({ userId, title, documentId });
  return result[0];
}

export async function getDecksByUser(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(flashcardDecks).where(eq(flashcardDecks.userId, userId)).orderBy(desc(flashcardDecks.createdAt));
}

export async function getDeckById(id: number, userId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(flashcardDecks).where(and(eq(flashcardDecks.id, id), eq(flashcardDecks.userId, userId))).limit(1);
  return result[0];
}

// ── Flashcards ─────────────────────────────────────────────────────────────
export async function createFlashcards(cards: { deckId: number; userId: number; question: string; answer: string }[]) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  if (cards.length === 0) return;
  await db.insert(flashcards).values(cards);
}

export async function getFlashcardsByDeck(deckId: number, userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(flashcards).where(and(eq(flashcards.deckId, deckId), eq(flashcards.userId, userId)));
}

export async function updateFlashcardSRS(id: number, interval: number, repetitions: number, easeFactor: number, dueDate: Date) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.update(flashcards).set({ interval, repetitions, easeFactor, dueDate }).where(eq(flashcards.id, id));
}

export async function getDueFlashcards(userId: number) {
  const db = await getDb();
  if (!db) return [];
  const now = new Date();
  return db.select().from(flashcards).where(and(eq(flashcards.userId, userId), lte(flashcards.dueDate, now)));
}

// ── Quiz Sessions ──────────────────────────────────────────────────────────
export async function saveQuizSession(data: {
  userId: number; deckId: number; documentId?: number;
  totalCards: number; knownCount: number; needsWorkCount: number; scorePercent: number;
}) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.insert(quizSessions).values(data);
}

export async function getQuizHistory(userId: number, deckId?: number) {
  const db = await getDb();
  if (!db) return [];
  const conditions = deckId
    ? and(eq(quizSessions.userId, userId), eq(quizSessions.deckId, deckId))
    : eq(quizSessions.userId, userId);
  return db.select().from(quizSessions).where(conditions).orderBy(desc(quizSessions.createdAt)).limit(20);
}

// ── Notes ──────────────────────────────────────────────────────────────────
export async function createNote(data: { userId: number; documentId?: number; title: string; content: string; color?: string }) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const result = await db.insert(notes).values({ ...data, color: data.color ?? "#fef3c7" });
  return result[0];
}

export async function getNotesByUser(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(notes).where(eq(notes.userId, userId)).orderBy(desc(notes.isPinned), desc(notes.updatedAt));
}

export async function updateNote(id: number, userId: number, data: Partial<{ title: string; content: string; color: string; isPinned: boolean }>) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.update(notes).set(data).where(and(eq(notes.id, id), eq(notes.userId, userId)));
}

export async function deleteNote(id: number, userId: number) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.delete(notes).where(and(eq(notes.id, id), eq(notes.userId, userId)));
}

export async function getNotesByIds(ids: number[], userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(notes).where(eq(notes.userId, userId));
}

// ── Tasks ──────────────────────────────────────────────────────────────────
export async function createTask(data: {
  userId: number; documentId?: number; title: string; description?: string;
  dueDate?: Date; priority?: "low" | "medium" | "high"; type?: "assignment" | "exam" | "reading" | "other";
}) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.insert(tasks).values(data);
}

export async function getTasksByUser(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(tasks).where(eq(tasks.userId, userId)).orderBy(tasks.dueDate, desc(tasks.createdAt));
}

export async function updateTask(id: number, userId: number, data: Partial<{
  title: string; description: string; dueDate: Date;
  priority: "low" | "medium" | "high"; status: "todo" | "in_progress" | "done";
  type: "assignment" | "exam" | "reading" | "other";
}>) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.update(tasks).set(data).where(and(eq(tasks.id, id), eq(tasks.userId, userId)));
}

export async function deleteTask(id: number, userId: number) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.delete(tasks).where(and(eq(tasks.id, id), eq(tasks.userId, userId)));
}

// ── Timer Sessions ─────────────────────────────────────────────────────────
export async function saveTimerSession(userId: number, sessionType: "work" | "short_break" | "long_break", durationMinutes: number) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.insert(timerSessions).values({ userId, sessionType, durationMinutes });
}

export async function getTimerHistory(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(timerSessions).where(eq(timerSessions.userId, userId)).orderBy(desc(timerSessions.createdAt)).limit(50);
}

// ── AI Outputs ─────────────────────────────────────────────────────────────
export async function saveAiOutput(userId: number, documentId: number, outputType: string, content: string) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.insert(aiOutputs).values({ userId, documentId, outputType: outputType as any, content });
}

export async function getAiOutput(userId: number, documentId: number, outputType: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(aiOutputs)
    .where(and(eq(aiOutputs.userId, userId), eq(aiOutputs.documentId, documentId), eq(aiOutputs.outputType, outputType as any)))
    .orderBy(desc(aiOutputs.createdAt)).limit(1);
  return result[0];
}

// ── Share Tokens ───────────────────────────────────────────────────────────
export async function createShareToken(data: {
  userId: number; token: string; noteIds: string;
  recipientEmail?: string; recipientPhone?: string; expiresAt: Date;
}) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.insert(shareTokens).values(data);
}

export async function getShareToken(token: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(shareTokens).where(eq(shareTokens.token, token)).limit(1);
  return result[0];
}

// ── Public Explore / Sharing ───────────────────────────────────────────────
export async function publishDeck(deckId: number, userId: number, opts: {
  isPublic: boolean; description?: string; subject?: string; shareSlug: string;
}) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.update(flashcardDecks)
    .set({ isPublic: opts.isPublic, description: opts.description, subject: opts.subject, shareSlug: opts.shareSlug })
    .where(and(eq(flashcardDecks.id, deckId), eq(flashcardDecks.userId, userId)));
}

export async function publishNote(noteId: number, userId: number, opts: {
  isPublic: boolean; subject?: string; shareSlug: string;
}) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.update(notes)
    .set({ isPublic: opts.isPublic, subject: opts.subject, shareSlug: opts.shareSlug })
    .where(and(eq(notes.id, noteId), eq(notes.userId, userId)));
}

export async function getPublicDecks(limit = 40, subject?: string) {
  const db = await getDb();
  if (!db) return [];
  const query = db.select({
    id: flashcardDecks.id,
    title: flashcardDecks.title,
    description: flashcardDecks.description,
    subject: flashcardDecks.subject,
    cardCount: flashcardDecks.cardCount,
    shareSlug: flashcardDecks.shareSlug,
    createdAt: flashcardDecks.createdAt,
    authorName: users.name,
  })
    .from(flashcardDecks)
    .leftJoin(users, eq(flashcardDecks.userId, users.id))
    .where(eq(flashcardDecks.isPublic, true))
    .orderBy(desc(flashcardDecks.createdAt))
    .limit(limit);
  return query;
}

export async function getPublicNotes(limit = 40, subject?: string) {
  const db = await getDb();
  if (!db) return [];
  return db.select({
    id: notes.id,
    title: notes.title,
    subject: notes.subject,
    shareSlug: notes.shareSlug,
    color: notes.color,
    createdAt: notes.createdAt,
    authorName: users.name,
    // Truncated preview — first 200 chars
    preview: notes.content,
  })
    .from(notes)
    .leftJoin(users, eq(notes.userId, users.id))
    .where(eq(notes.isPublic, true))
    .orderBy(desc(notes.createdAt))
    .limit(limit);
}

export async function getDeckBySlug(slug: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(flashcardDecks)
    .where(and(eq(flashcardDecks.shareSlug, slug), eq(flashcardDecks.isPublic, true))).limit(1);
  return result[0];
}

export async function getNoteBySlug(slug: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(notes)
    .where(and(eq(notes.shareSlug, slug), eq(notes.isPublic, true))).limit(1);
  return result[0];
}

export async function getPublicCardsByDeck(deckId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(flashcards).where(eq(flashcards.deckId, deckId));
}
