import { useEffect, useRef } from 'react';
import { useEditor, EditorContent, type Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import type { Chapter } from '../types/book';
import './ChapterEditor.css';

interface ChapterEditorProps {
  chapter: Chapter;
  /**
   * Called (debounced, a few hundred ms after typing stops) with the
   * chapter's latest content and word count, so the parent can persist
   * it via bookStore. Also called once immediately when this editor
   * unmounts — e.g. the person switches to a different chapter —
   * so nothing typed in the last debounce window is lost.
   */
  onSave: (chapterId: string, content: unknown, wordCount: number) => void;
}

// How long to wait after the last keystroke before saving. Short
// enough that a refresh moments after typing won't lose anything
// noticeable, long enough that we're not writing to localStorage on
// every keypress.
const SAVE_DEBOUNCE_MS = 400;

function countWords(editor: Editor): number {
  const text = editor.getText().trim();
  if (!text) return 0;
  return text.split(/\s+/).length;
}

export default function ChapterEditor({ chapter, onSave }: ChapterEditorProps) {
  // Holds the latest not-yet-saved content/wordCount, so it can be
  // flushed immediately on unmount without waiting for the debounce
  // timer to fire on its own.
  const pendingRef = useRef<{ content: unknown; wordCount: number } | null>(null);
  const saveTimerRef = useRef<number | null>(null);

  const editor = useEditor({
    // Avoids a Tiptap SSR-hydration console warning. This app has no
    // SSR, but the flag is Tiptap's own recommended default.
    immediatelyRender: false,
    extensions: [StarterKit],
    content: (chapter.content as never) ?? '',
    onUpdate: ({ editor }) => {
      const content = editor.getJSON();
      const wordCount = countWords(editor);
      pendingRef.current = { content, wordCount };

      if (saveTimerRef.current !== null) {
        window.clearTimeout(saveTimerRef.current);
      }
      saveTimerRef.current = window.setTimeout(() => {
        if (pendingRef.current) {
          onSave(chapter.id, pendingRef.current.content, pendingRef.current.wordCount);
          pendingRef.current = null;
        }
        saveTimerRef.current = null;
      }, SAVE_DEBOUNCE_MS);
    },
  });

  // Flush any unsaved edit immediately when this editor unmounts. The
  // parent mounts a fresh ChapterEditor per chapter (keyed by
  // chapter.id), so this fires exactly when the person switches away
  // from this chapter — without it, the last debounce window's worth
  // of typing would be silently dropped.
  useEffect(() => {
    return () => {
      if (saveTimerRef.current !== null) {
        window.clearTimeout(saveTimerRef.current);
      }
      if (pendingRef.current) {
        onSave(chapter.id, pendingRef.current.content, pendingRef.current.wordCount);
        pendingRef.current = null;
      }
    };
    // Intentionally only re-runs if the chapter identity changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chapter.id]);

  // Also flush on a hard refresh/tab close, so a very recent edit
  // isn't lost to the debounce window.
  useEffect(() => {
    function flushOnUnload() {
      if (pendingRef.current) {
        onSave(chapter.id, pendingRef.current.content, pendingRef.current.wordCount);
        pendingRef.current = null;
      }
    }
    window.addEventListener('beforeunload', flushOnUnload);
    return () => window.removeEventListener('beforeunload', flushOnUnload);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chapter.id]);

  if (!editor) return null;

  return (
    <div className="chapter-editor">
      <div className="chapter-editor-toolbar" role="toolbar" aria-label="Formatting">
        <button
          type="button"
          className={editor.isActive('bold') ? 'editor-btn active' : 'editor-btn'}
          onClick={() => editor.chain().focus().toggleBold().run()}
          aria-label="Bold"
        >
          B
        </button>
        <button
          type="button"
          className={editor.isActive('italic') ? 'editor-btn active' : 'editor-btn'}
          onClick={() => editor.chain().focus().toggleItalic().run()}
          aria-label="Italic"
        >
          I
        </button>
        <span className="editor-toolbar-divider" />
        <button
          type="button"
          className={editor.isActive('heading', { level: 1 }) ? 'editor-btn active' : 'editor-btn'}
          onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
          aria-label="Heading 1"
        >
          H1
        </button>
        <button
          type="button"
          className={editor.isActive('heading', { level: 2 }) ? 'editor-btn active' : 'editor-btn'}
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          aria-label="Heading 2"
        >
          H2
        </button>
        <button
          type="button"
          className={editor.isActive('paragraph') ? 'editor-btn active' : 'editor-btn'}
          onClick={() => editor.chain().focus().setParagraph().run()}
          aria-label="Paragraph"
        >
          P
        </button>
        <span className="editor-toolbar-divider" />
        <button
          type="button"
          className={editor.isActive('bulletList') ? 'editor-btn active' : 'editor-btn'}
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          aria-label="Bullet list"
        >
          • List
        </button>
      </div>

      <EditorContent className="chapter-editor-content" editor={editor} />
    </div>
  );
}