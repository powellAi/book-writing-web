import { useRef, useState } from 'react';
import type { Chapter } from '../types/book';
import './ChapterList.css';

interface ChapterListProps {
  chapters: Chapter[];
  activeChapterId: string | null;
  onSelect: (chapterId: string) => void;
  onCreate: () => void;
  onRename: (chapterId: string, title: string) => void;
  onDelete: (chapterId: string) => void;
  /** Moves the active chapter selection to the previous/next chapter. Does not reorder anything. */
  onNavigate: (direction: 'up' | 'down') => void;
  /** Moves a chapter to a new position in the list (used by the double-tap drag interaction). */
  onReorder: (chapterId: string, toIndex: number) => void;
}

// Max time (ms) between the first tap's pointerdown and a second
// pointerdown on the SAME chapter for it to count as a double tap.
// If the second pointerdown arrives later than this, it's treated as
// a fresh single tap instead. 450ms comfortably covers a normal mouse
// double-click (OS defaults are typically ~400-500ms down-to-down),
// not just a fast touch double-tap.
const DOUBLE_TAP_MS = 450;

export default function ChapterList({
  chapters,
  activeChapterId,
  onSelect,
  onCreate,
  onRename,
  onDelete,
  onNavigate,
  onReorder,
}: ChapterListProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftTitle, setDraftTitle] = useState('');
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

  // --- Double-tap-to-reorder state ---
  // The chapter currently being dragged (null when nothing is being dragged).
  const [dragChapterId, setDragChapterId] = useState<string | null>(null);
  // The index the dragged chapter would land on if dropped right now.
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  // --- Keyboard highlight navigation ---
  // The chapter Up/Down arrows are currently pointing at. Distinct
  // from activeChapterId: moving this with arrow keys does NOT open
  // the chapter — only Enter (or a click) does that.
  const [highlightedId, setHighlightedId] = useState<string | null>(null);
  // Button DOM nodes per chapter, so arrow keys can move real keyboard
  // focus onto the newly-highlighted row (not just move a CSS class).
  const buttonRefs = useRef<Map<string, HTMLButtonElement>>(new Map());

  // Remembers the most recent tap (which chapter, when) so the NEXT
  // pointerdown can check whether it's a double tap on the same
  // chapter and, if so, start dragging immediately.
  const lastTapRef = useRef<{ chapterId: string; time: number } | null>(null);

  // Set to true right after a drag ends, so the click event that the
  // browser fires immediately after pointerup doesn't also select/open
  // the chapter we just finished dragging.
  const suppressNextClickRef = useRef(false);
  // DOM nodes for each chapter row, used to figure out where the
  // pointer is hovering over during a drag.
  const itemRefs = useRef<Map<string, HTMLLIElement>>(new Map());

  function startRename(chapter: Chapter) {
    setEditingId(chapter.id);
    setDraftTitle(chapter.title);
  }

  function commitRename() {
    if (editingId) onRename(editingId, draftTitle);
    setEditingId(null);
  }

  function handlePointerDown(e: React.PointerEvent<HTMLButtonElement>, chapter: Chapter, index: number) {
    // Only the left mouse button / primary touch point starts a drag.
    if (e.button !== undefined && e.button !== 0) return;

    const now = performance.now();
    const last = lastTapRef.current;
    // Same chapter row, tapped again within the time window — that's
    // enough to count as a double tap. No pixel-distance check: the
    // chapter id match already guarantees it's the same row, and a
    // row can be wide, so requiring near-identical coordinates on top
    // of that only made double-tap work in a tiny sliver of the row.
    const isDoubleTap = !!last && last.chapterId === chapter.id && now - last.time <= DOUBLE_TAP_MS;

    if (isDoubleTap) {
      // Second tap landed in time — start dragging right away.
      lastTapRef.current = null;
      setDragChapterId(chapter.id);
      setDragOverIndex(index);
      // Keep receiving pointermove/pointerup on this element even if
      // the pointer moves outside its bounds while dragging.
      e.currentTarget.setPointerCapture?.(e.pointerId);
    } else {
      // First tap (or a tap that came too late) — just remember it
      // and let the click go through normally.
      lastTapRef.current = { chapterId: chapter.id, time: now };
    }
  }

  function handlePointerMove(e: React.PointerEvent<HTMLButtonElement>) {
    if (!dragChapterId) return;

    // Figure out which chapter row the pointer is currently over, by
    // comparing its Y position to the vertical midpoint of each row.
    let nextOverIndex = chapters.length - 1;
    for (let i = 0; i < chapters.length; i++) {
      const el = itemRefs.current.get(chapters[i].id);
      if (!el) continue;
      const rect = el.getBoundingClientRect();
      const midpoint = rect.top + rect.height / 2;
      if (e.clientY < midpoint) {
        nextOverIndex = i;
        break;
      }
    }
    setDragOverIndex(nextOverIndex);
  }

  function endDrag(commit: boolean) {
    if (dragChapterId && commit && dragOverIndex !== null) {
      onReorder(dragChapterId, dragOverIndex);
    }
    if (dragChapterId) {
      // A click event follows pointerup on the same element; swallow
      // just that one so we don't also "open" the chapter we dropped.
      suppressNextClickRef.current = true;
      setTimeout(() => {
        suppressNextClickRef.current = false;
      }, 0);
    }
    setDragChapterId(null);
    setDragOverIndex(null);
  }

  function handlePointerUp() {
    endDrag(true);
  }

  function handlePointerCancel() {
    endDrag(false);
  }

  function handleChapterClick(e: React.MouseEvent, chapterId: string) {
    if (suppressNextClickRef.current) {
      e.preventDefault();
      return;
    }
    // A click both opens the chapter and becomes the starting point
    // for arrow-key navigation.
    setHighlightedId(chapterId);
    onSelect(chapterId);
  }

  function handleChapterKeyDown(e: React.KeyboardEvent<HTMLButtonElement>, chapterId: string) {
    const currentIndex = chapters.findIndex((c) => c.id === (highlightedId ?? chapterId));

    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      const nextIndex = e.key === 'ArrowDown' ? currentIndex + 1 : currentIndex - 1;
      if (nextIndex < 0 || nextIndex >= chapters.length) return;
      const nextChapter = chapters[nextIndex];
      setHighlightedId(nextChapter.id);
      // Move real keyboard focus to the newly-highlighted row so the
      // next arrow press continues from there.
      buttonRefs.current.get(nextChapter.id)?.focus();
      return;
    }

    if (e.key === 'Enter') {
      e.preventDefault();
      onSelect(highlightedId ?? chapterId);
    }
  }

  const activeIndex = chapters.findIndex((c) => c.id === activeChapterId);
  const navUpDisabled = activeIndex <= 0;
  const navDownDisabled = activeIndex === -1 || activeIndex === chapters.length - 1;

  return (
    <div className="chapter-list">
      <div className="chapter-list-header">
        <span>Chapters</span>
        <button className="btn-text" onClick={onCreate}>
          + Add
        </button>
      </div>

      {chapters.length > 0 && (
        <div className="chapter-nav" role="group" aria-label="Chapter navigation">
          <button
            type="button"
            className="btn-text chapter-nav-btn"
            onClick={() => onNavigate('up')}
            disabled={navUpDisabled}
            aria-label="Go to previous chapter"
          >
            ↑ Previous
          </button>
          <button
            type="button"
            className="btn-text chapter-nav-btn"
            onClick={() => onNavigate('down')}
            disabled={navDownDisabled}
            aria-label="Go to next chapter"
          >
            ↓ Next
          </button>
        </div>
      )}

      {chapters.length === 0 ? (
        <p className="chapter-list-empty">No chapters yet.</p>
      ) : (
        <ul>
          {chapters.map((chapter, index) => {
            const isDragging = dragChapterId === chapter.id;
            const isDropTarget = dragChapterId !== null && dragOverIndex === index && !isDragging;
            const isHighlighted = chapter.id === activeChapterId || chapter.id === highlightedId;
            const classNames = [
              'chapter-item',
              isHighlighted ? 'active' : '',
              isDragging ? 'dragging' : '',
              isDropTarget ? 'drag-target' : '',
            ]
              .filter(Boolean)
              .join(' ');

            return (
              <li
                key={chapter.id}
                className={classNames}
                ref={(el) => {
                  if (el) itemRefs.current.set(chapter.id, el);
                  else itemRefs.current.delete(chapter.id);
                }}
              >
                {editingId === chapter.id ? (
                  <input
                    autoFocus
                    className="chapter-rename-input"
                    value={draftTitle}
                    onChange={(e) => setDraftTitle(e.target.value)}
                    onBlur={commitRename}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') commitRename();
                      if (e.key === 'Escape') setEditingId(null);
                    }}
                  />
                ) : (
                  <button
                    type="button"
                    className="chapter-select"
                    ref={(el) => {
                      if (el) buttonRefs.current.set(chapter.id, el);
                      else buttonRefs.current.delete(chapter.id);
                    }}
                    onPointerDown={(e) => handlePointerDown(e, chapter, index)}
                    onPointerMove={handlePointerMove}
                    onPointerUp={handlePointerUp}
                    onPointerCancel={handlePointerCancel}
                    onClick={(e) => handleChapterClick(e, chapter.id)}
                    onKeyDown={(e) => handleChapterKeyDown(e, chapter.id)}
                    title="Click to open. Double-tap to drag and reorder. Use ↑/↓ to move the highlight, Enter to open it."
                  >
                    <span className="chapter-title">{chapter.title}</span>
                    <span className="chapter-word-count">{chapter.wordCount} words</span>
                  </button>
                )}

                <div className="chapter-item-actions">
                  <button className="btn-text" onClick={() => startRename(chapter)}>
                    Rename
                  </button>
                  {pendingDeleteId === chapter.id ? (
                    <>
                      <button className="btn-text btn-danger" onClick={() => onDelete(chapter.id)}>
                        Confirm
                      </button>
                      <button className="btn-text" onClick={() => setPendingDeleteId(null)}>
                        Cancel
                      </button>
                    </>
                  ) : (
                    <button className="btn-text" onClick={() => setPendingDeleteId(chapter.id)}>
                      Delete
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}