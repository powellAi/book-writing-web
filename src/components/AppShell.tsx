import { useEffect, useState } from 'react';
import type { BookWithChapters } from '../types/book';
import * as store from '../data/bookStore';
import ChapterList from './ChapterList';
import ChapterEditor from './chapterEditor';
import ChapterDetailsPanel from './ChapterDetailsPanel';

interface AppShellProps {
  bookId: string;
  onBackToShelf: () => void;
}

type Mode = 'writing' | 'preview';

export default function AppShell({ bookId, onBackToShelf }: AppShellProps) {
  const [book, setBook] = useState<BookWithChapters | null>(null);
  const [activeChapterId, setActiveChapterId] = useState<string | null>(null);
  const [mode, setMode] = useState<Mode>('writing');

  useEffect(() => {
    load();
  }, [bookId]);

  async function load() {
    const loaded = await store.getBookWithChapters(bookId);
    setBook(loaded);
    if (loaded && loaded.chapters.length > 0 && !activeChapterId) {
      setActiveChapterId(loaded.chapters[0].id);
    }
  }

  async function handleCreateChapter() {
    await store.createChapter(bookId, '');
    const refreshed = await store.getBookWithChapters(bookId);
    setBook(refreshed);
    if (refreshed) {
      const newest = refreshed.chapters[refreshed.chapters.length - 1];
      setActiveChapterId(newest.id);
    }
  }

  async function handleRenameChapter(chapterId: string, title: string) {
    await store.renameChapter(bookId, chapterId, title);
    setBook((prev) =>
      prev
        ? { ...prev, chapters: prev.chapters.map((c) => (c.id === chapterId ? { ...c, title } : c)) }
        : prev
    );
  }

  async function handleDeleteChapter(chapterId: string) {
    await store.deleteChapter(bookId, chapterId);
    if (activeChapterId === chapterId) setActiveChapterId(null);
    await load();
  }

  function handleNavigateChapter(direction: 'up' | 'down') {
    if (!book || book.chapters.length === 0) return;
    const currentIndex = book.chapters.findIndex((c) => c.id === activeChapterId);
    if (currentIndex === -1) return;
    const nextIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
    if (nextIndex < 0 || nextIndex >= book.chapters.length) return;
    setActiveChapterId(book.chapters[nextIndex].id);
  }

  async function handleReorderChapter(chapterId: string, toIndex: number) {
    await store.reorderChapter(bookId, chapterId, toIndex);
    await load();
  }

  async function handleSaveChapterContent(chapterId: string, content: unknown, wordCount: number) {
    await store.updateChapterContent(bookId, chapterId, content, wordCount);
    setBook((prev) =>
      prev
        ? { ...prev, chapters: prev.chapters.map((c) => (c.id === chapterId ? { ...c, content, wordCount } : c)) }
        : prev
    );
  }

  async function handleChapterDetailsChange(
    chapterId: string,
    updates: { description?: string; tags?: string[] }
  ) {
    await store.updateChapterDetails(bookId, chapterId, updates);
    setBook((prev) =>
      prev
        ? { ...prev, chapters: prev.chapters.map((c) => (c.id === chapterId ? { ...c, ...updates } : c)) }
        : prev
    );
  }

  async function handleHeadingAlignChange(chapterId: string, align: 'left' | 'center') {
    await store.updateChapterHeadingAlign(bookId, chapterId, align);
    setBook((prev) =>
      prev
        ? {
            ...prev,
            chapters: prev.chapters.map((c) => (c.id === chapterId ? { ...c, headingAlign: align } : c)),
          }
        : prev
    );
  }

  if (!book) {
    return <div className="flex items-center justify-center h-screen text-slate-500">Loading book…</div>;
  }

  const activeChapter = book.chapters.find((c) => c.id === activeChapterId) ?? null;

  return (
    <div className="flex h-screen bg-white">
      <aside className="w-64 shrink-0 bg-slate-900 text-slate-100 flex flex-col p-4">
        <button
          className="text-left text-sm text-slate-300 hover:text-white mb-4"
          onClick={onBackToShelf}
        >
          ← All books
        </button>
        <div className="text-base font-semibold mb-4 truncate">{book.title}</div>
        <div className="flex-1 overflow-y-auto -mx-1 px-1">
          <ChapterList
            chapters={book.chapters}
            activeChapterId={activeChapterId}
            onSelect={setActiveChapterId}
            onCreate={handleCreateChapter}
            onRename={handleRenameChapter}
            onDelete={handleDeleteChapter}
            onNavigate={handleNavigateChapter}
            onReorder={handleReorderChapter}
          />
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="flex items-center justify-between px-4 py-2 border-b border-slate-200">
          <div className="text-sm font-medium text-slate-800 truncate">
            {activeChapter ? activeChapter.title : 'No chapter selected'}
          </div>
          <div className="flex rounded-md border border-slate-200 p-0.5" role="tablist" aria-label="Editor mode">
            <button
              role="tab"
              aria-selected={mode === 'writing'}
              className={
                mode === 'writing'
                  ? 'px-3 py-1 text-xs rounded bg-emerald-600 text-white'
                  : 'px-3 py-1 text-xs rounded text-slate-600 hover:bg-slate-100'
              }
              onClick={() => setMode('writing')}
            >
              Writing
            </button>
            <button
              role="tab"
              aria-selected={mode === 'preview'}
              className={
                mode === 'preview'
                  ? 'px-3 py-1 text-xs rounded bg-emerald-600 text-white'
                  : 'px-3 py-1 text-xs rounded text-slate-600 hover:bg-slate-100'
              }
              onClick={() => setMode('preview')}
            >
              Book preview
            </button>
          </div>
        </header>

        <main className="flex-1 min-h-0 flex">
          {!activeChapter ? (
            <div className="flex-1 flex items-center justify-center text-slate-500 text-sm">
              <p>Select or create a chapter to start writing.</p>
            </div>
          ) : mode === 'writing' ? (
            <>
              <ChapterEditor
                key={activeChapter.id}
                chapter={activeChapter}
                onSave={handleSaveChapterContent}
                onHeadingAlignChange={handleHeadingAlignChange}
              />
              <ChapterDetailsPanel
                key={`${activeChapter.id}-details`}
                chapter={activeChapter}
                onRename={handleRenameChapter}
                onDetailsChange={handleChapterDetailsChange}
              />
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-slate-500 text-sm">
              <p>Book preview mode is not built yet.</p>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}