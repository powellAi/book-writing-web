import { useEffect, useState } from 'react';
import type { BookWithChapters } from '../types/book';
import * as store from '../data/bookStore';
import ChapterList from './ChapterList';
import ChapterEditor from './chapterEditor';
import './AppShell.css';

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
    await load();
  }

  async function handleDeleteChapter(chapterId: string) {
    await store.deleteChapter(bookId, chapterId);
    if (activeChapterId === chapterId) setActiveChapterId(null);
    await load();
  }

  // Moves which chapter is open (previous/next). This is pure navigation —
  // it only changes local selection state and never touches chapter order
  // or persisted data.
  function handleNavigateChapter(direction: 'up' | 'down') {
    if (!book || book.chapters.length === 0) return;
    const currentIndex = book.chapters.findIndex((c) => c.id === activeChapterId);
    if (currentIndex === -1) return;
    const nextIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
    if (nextIndex < 0 || nextIndex >= book.chapters.length) return;
    setActiveChapterId(book.chapters[nextIndex].id);
  }

  // Actually reorders a chapter's position (used by the double-click
  // arm-then-drag interaction, not by the up/down navigation controls).
  async function handleReorderChapter(chapterId: string, toIndex: number) {
    await store.reorderChapter(bookId, chapterId, toIndex);
    await load();
  }

  // Persists the active chapter's editor content (debounced upstream,
  // in ChapterEditor). Updates local state directly, rather than
  // re-fetching from the store on every save, so the sidebar's word
  // count stays live without an extra localStorage round-trip per edit.
  async function handleSaveChapterContent(chapterId: string, content: unknown, wordCount: number) {
    await store.updateChapterContent(bookId, chapterId, content, wordCount);
    setBook((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        chapters: prev.chapters.map((c) => (c.id === chapterId ? { ...c, content, wordCount } : c)),
      };
    });
  }

  if (!book) {
    return <div className="app-shell-loading">Loading book…</div>;
  }

  const activeChapter = book.chapters.find((c) => c.id === activeChapterId) ?? null;

  return (
    <div className="app-shell">
      <aside className="app-sidebar">
        <button className="btn-text back-to-shelf" onClick={onBackToShelf}>
          ← All books
        </button>
        <div className="app-sidebar-book-title">{book.title}</div>
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
      </aside>

      <div className="app-main">
        <header className="app-toolbar">
          <div className="app-toolbar-title">
            {activeChapter ? activeChapter.title : 'No chapter selected'}
          </div>
          <div className="mode-switch" role="tablist" aria-label="Editor mode">
            <button
              role="tab"
              aria-selected={mode === 'writing'}
              className={mode === 'writing' ? 'mode-btn active' : 'mode-btn'}
              onClick={() => setMode('writing')}
            >
              Writing
            </button>
            <button
              role="tab"
              aria-selected={mode === 'preview'}
              className={mode === 'preview' ? 'mode-btn active' : 'mode-btn'}
              onClick={() => setMode('preview')}
            >
              Book preview
            </button>
          </div>
        </header>

        <main className="app-workspace">
          {!activeChapter ? (
            <div className="workspace-empty">
              <p>Select or create a chapter to start writing.</p>
            </div>
          ) : mode === 'writing' ? (
            <ChapterEditor
              key={activeChapter.id}
              chapter={activeChapter}
              onSave={handleSaveChapterContent}
            />
          ) : (
            <div className="workspace-empty">
              <p>Book preview mode is not built yet.</p>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}