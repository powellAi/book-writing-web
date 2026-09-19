// Data layer for books and chapters.
//
// IMPORTANT: this is temporary local storage, not real sync.
// Everything saved here lives only in this browser. There is no
// cloud backup yet, and nothing here should claim otherwise.
//
// Every function below is written as if it might one day be async
// (talking to a server), even though today it's synchronous
// localStorage. That means when Firebase is added later, the
// components that call this store won't need to change — only
// this file will.

import type { Book, Chapter, BookWithChapters } from '../types/book';

const BOOKS_KEY = 'book-app:books';
const chaptersKey = (bookId: string) => `book-app:chapters:${bookId}`;

function readJSON<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    // If the stored data is corrupted, don't crash the app —
    // fall back to an empty state instead.
    return fallback;
  }
}

function writeJSON<T>(key: string, value: T): void {
  localStorage.setItem(key, JSON.stringify(value));
}

function newId(): string {
  return crypto.randomUUID();
}

function nowISO(): string {
  return new Date().toISOString();
}

// ---------- Books ----------

export async function listBooks(): Promise<Book[]> {
  const books = readJSON<Book[]>(BOOKS_KEY, []);
  return [...books].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export async function createBook(title: string, author: string): Promise<Book> {
  const books = readJSON<Book[]>(BOOKS_KEY, []);
  const book: Book = {
    id: newId(),
    title: title.trim() || 'Untitled Book',
    author: author.trim(),
    createdAt: nowISO(),
    updatedAt: nowISO(),
  };
  writeJSON(BOOKS_KEY, [...books, book]);
  return book;
}

export async function deleteBook(bookId: string): Promise<void> {
  const books = readJSON<Book[]>(BOOKS_KEY, []);
  writeJSON(BOOKS_KEY, books.filter((b) => b.id !== bookId));
  localStorage.removeItem(chaptersKey(bookId));
}

export async function getBookWithChapters(bookId: string): Promise<BookWithChapters | null> {
  const books = readJSON<Book[]>(BOOKS_KEY, []);
  const book = books.find((b) => b.id === bookId);
  if (!book) return null;
  const chapters = readJSON<Chapter[]>(chaptersKey(bookId), []);
  chapters.sort((a, b) => a.order - b.order);
  return { ...book, chapters };
}

// ---------- Chapters ----------

export async function listChapters(bookId: string): Promise<Chapter[]> {
  const chapters = readJSON<Chapter[]>(chaptersKey(bookId), []);
  return [...chapters].sort((a, b) => a.order - b.order);
}

export async function createChapter(bookId: string, title: string): Promise<Chapter> {
  const chapters = readJSON<Chapter[]>(chaptersKey(bookId), []);
  const chapter: Chapter = {
    id: newId(),
    title: title.trim() || `Chapter ${chapters.length + 1}`,
    order: chapters.length,
    content: null,
    wordCount: 0,
    updatedAt: nowISO(),
    description: '',
    tags: [],
    headingAlign: 'left',
  };
  writeJSON(chaptersKey(bookId), [...chapters, chapter]);
  await touchBook(bookId);
  return chapter;
}

export async function renameChapter(bookId: string, chapterId: string, title: string): Promise<void> {
  const chapters = readJSON<Chapter[]>(chaptersKey(bookId), []);
  const next = chapters.map((c) =>
    c.id === chapterId ? { ...c, title: title.trim() || c.title, updatedAt: nowISO() } : c
  );
  writeJSON(chaptersKey(bookId), next);
  await touchBook(bookId);
}

/**
 * Saves a chapter's editor content (Tiptap/ProseMirror JSON) and its
 * cached word count. Called by the writing editor, debounced, so this
 * runs a few hundred ms after the person stops typing rather than on
 * every keystroke.
 */
export async function updateChapterContent(
  bookId: string,
  chapterId: string,
  content: unknown,
  wordCount: number
): Promise<void> {
  const chapters = readJSON<Chapter[]>(chaptersKey(bookId), []);
  const next = chapters.map((c) =>
    c.id === chapterId ? { ...c, content, wordCount, updatedAt: nowISO() } : c
  );
  writeJSON(chaptersKey(bookId), next);
  await touchBook(bookId);
}

/**
 * Saves the chapter details panel's description and tags. Title is
 * intentionally NOT handled here — it goes through renameChapter,
 * since that's already wired up to the chapter list and is the single
 * source of truth for a chapter's title.
 */
export async function updateChapterDetails(
  bookId: string,
  chapterId: string,
  updates: { description?: string; tags?: string[] }
): Promise<void> {
  const chapters = readJSON<Chapter[]>(chaptersKey(bookId), []);
  const next = chapters.map((c) => (c.id === chapterId ? { ...c, ...updates, updatedAt: nowISO() } : c));
  writeJSON(chaptersKey(bookId), next);
  await touchBook(bookId);
}

/** Sets where the chapter's title heading is displayed above the writing area. */
export async function updateChapterHeadingAlign(
  bookId: string,
  chapterId: string,
  headingAlign: 'left' | 'center'
): Promise<void> {
  const chapters = readJSON<Chapter[]>(chaptersKey(bookId), []);
  const next = chapters.map((c) => (c.id === chapterId ? { ...c, headingAlign, updatedAt: nowISO() } : c));
  writeJSON(chaptersKey(bookId), next);
  await touchBook(bookId);
}

export async function deleteChapter(bookId: string, chapterId: string): Promise<void> {
  const chapters = readJSON<Chapter[]>(chaptersKey(bookId), []);
  const remaining = chapters
    .filter((c) => c.id !== chapterId)
    .sort((a, b) => a.order - b.order)
    .map((c, i) => ({ ...c, order: i }));
  writeJSON(chaptersKey(bookId), remaining);
  await touchBook(bookId);
}

/** Move a chapter to a new position in the order (0-indexed). */
export async function reorderChapter(bookId: string, chapterId: string, toIndex: number): Promise<void> {
  const chapters = readJSON<Chapter[]>(chaptersKey(bookId), []).sort((a, b) => a.order - b.order);
  const fromIndex = chapters.findIndex((c) => c.id === chapterId);
  if (fromIndex === -1) return;
  const [moved] = chapters.splice(fromIndex, 1);
  const clampedIndex = Math.max(0, Math.min(toIndex, chapters.length));
  chapters.splice(clampedIndex, 0, moved);
  const reindexed = chapters.map((c, i) => ({ ...c, order: i }));
  writeJSON(chaptersKey(bookId), reindexed);
  await touchBook(bookId);
}

async function touchBook(bookId: string): Promise<void> {
  const books = readJSON<Book[]>(BOOKS_KEY, []);
  const next = books.map((b) => (b.id === bookId ? { ...b, updatedAt: nowISO() } : b));
  writeJSON(BOOKS_KEY, next);
}