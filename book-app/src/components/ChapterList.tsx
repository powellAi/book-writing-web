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
  /** Moves a chapter to a new position in the list (used by the long-press drag interaction). */
  onReorder: (chapterId: string, toIndex: number) => void;
}

// How long (ms) a chapter must be pressed and held before it starts
// dragging. Short presses/clicks below this duration are treated as
// a normal "open this chapter" click, same as before.
const LONG_PRESS_MS = 450;

// If the pointer moves more than this many pixels before the long-press
// timer fires, we cancel the drag — the person is probably scrolling
// or just clicking, not trying to pick the chapter up.
const MOVE_CANCEL_THRESHOLD_PX = 8;

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

  // --- Long-press-to-reorder state ---
  // The chapter currently being dragged (null when nothing is being dragged).
  const [dragChapterId, setDragChapterId] = useState<string | null>(null);
  // The index the dragged chapter would land on if dropped right now.
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  const longPressTimerRef = useRef<number | null>(null);
  const pointerStartRef = useRef<{ x: number; y: number } | null>(null);
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

  function clearLongPressTimer() {
    if (longPressTimerRef.current !== null) {
      window.clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  }

  function handlePointerDown(e: React.PointerEvent<HTMLButtonElement>, chapter: Chapter, index: number) {
    // Only the left mouse button / primary touch point starts a drag.
    if (e.button !== undefined && e.button !== 0) return;

    pointerStartRef.current = { x: e.clientX, y: e.clientY };
    const pointerId = e.pointerId;
    const targetEl = e.currentTarget;

    clearLongPressTimer();
    longPressTimerRef.current = window.setTimeout(() => {
      setDragChapterId(chapter.id);
      setDragOverIndex(index);
      // Keep receiving pointermove/pointerup on this element even if
      // the pointer moves outside its bounds while dragging.
      targetEl.setPointerCapture?.(pointerId);
    }, LONG_PRESS_MS);
  }

  function handlePointerMove(e: React.PointerEvent<HTMLButtonElement>) {
    // If we're still waiting to see whether this is a long press,
    // cancel it if the pointer has moved too far (this was a click
    // or a scroll, not a press-and-hold).
    if (longPressTimerRef.current !== null && pointerStartRef.current) {
      const dx = e.clientX - pointerStartRef.current.x;
      const dy = e.clientY - pointerStartRef.current.y;
      if (Math.hypot(dx, dy) > MOVE_CANCEL_THRESHOLD_PX) {
        clearLongPressTimer();
      }
    }

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
    clearLongPressTimer();
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
    pointerStartRef.current = null;
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
    onSelect(chapterId);
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
            const classNames = [
              'chapter-item',
              chapter.id === activeChapterId ? 'active' : '',
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
                    onPointerDown={(e) => handlePointerDown(e, chapter, index)}
                    onPointerMove={handlePointerMove}
                    onPointerUp={handlePointerUp}
                    onPointerCancel={handlePointerCancel}
                    onClick={(e) => handleChapterClick(e, chapter.id)}
                    title="Click to open. Press and hold to drag and reorder."
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
