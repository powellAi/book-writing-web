import { useEffect, useRef, useState } from 'react';
import { useEditor, EditorContent, type Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import TextAlign from '@tiptap/extension-text-align';
import Link from '@tiptap/extension-link';
import Image from '@tiptap/extension-image';
import Placeholder from '@tiptap/extension-placeholder';
import {
  Bold,
  Italic,
  Underline as UnderlineIcon,
  Heading1,
  Heading2,
  Heading3,
  Pilcrow,
  List,
  ListOrdered,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Link as LinkIcon,
  Image as ImageIcon,
  Undo2,
  Redo2,
} from 'lucide-react';
import type { Chapter } from '../types/book';
import './ChapterEditor.css';

interface ChapterEditorProps {
  chapter: Chapter;
  /**
   * Called (debounced, a few hundred ms after typing stops) with the
   * chapter's latest content and word count, so the parent can persist
   * it via bookStore. May return a promise; the "Saved" indicator
   * waits for it before flipping from "Saving…" to "Saved".
   */
  onSave: (chapterId: string, content: unknown, wordCount: number) => void | Promise<void>;
  /** Called when the person toggles the heading's left/center position. */
  onHeadingAlignChange: (chapterId: string, align: 'left' | 'center') => void;
}

// How long to wait after the last keystroke before saving.
const SAVE_DEBOUNCE_MS = 400;

function countWords(editor: Editor): number {
  const text = editor.getText().trim();
  if (!text) return 0;
  return text.split(/\s+/).length;
}

function ToolbarButton({
  active,
  onClick,
  label,
  children,
}: {
  active?: boolean;
  onClick: () => void;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className={
        active
          ? 'inline-flex items-center justify-center h-8 w-8 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200'
          : 'inline-flex items-center justify-center h-8 w-8 rounded-md text-slate-600 hover:bg-slate-100 border border-transparent'
      }
    >
      {children}
    </button>
  );
}

function ToolbarDivider() {
  return <span className="w-px self-stretch bg-slate-200 mx-1" />;
}

export default function ChapterEditor({ chapter, onSave, onHeadingAlignChange }: ChapterEditorProps) {
  const pendingRef = useRef<{ content: unknown; wordCount: number } | null>(null);
  const saveTimerRef = useRef<number | null>(null);
  const [status, setStatus] = useState<'saved' | 'saving'>('saved');
  const [wordCount, setWordCount] = useState(chapter.wordCount);
  const headingAlign = chapter.headingAlign ?? 'left';

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit,
      Underline,
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      Link.configure({ openOnClick: false }),
      Image,
      Placeholder.configure({ placeholder: 'Start writing your story…' }),
    ],
    content: (chapter.content as never) ?? '',
    onUpdate: ({ editor }) => {
      const content = editor.getJSON();
      const nextWordCount = countWords(editor);
      setWordCount(nextWordCount);
      setStatus('saving');
      pendingRef.current = { content, wordCount: nextWordCount };

      if (saveTimerRef.current !== null) {
        window.clearTimeout(saveTimerRef.current);
      }
      saveTimerRef.current = window.setTimeout(() => {
        flush();
        saveTimerRef.current = null;
      }, SAVE_DEBOUNCE_MS);
    },
  });

  function flush() {
    if (!pendingRef.current) return;
    const { content, wordCount } = pendingRef.current;
    pendingRef.current = null;
    Promise.resolve(onSave(chapter.id, content, wordCount)).then(() => setStatus('saved'));
  }

  // Flush immediately on unmount (chapter switch) so the last
  // debounce window's worth of typing isn't lost.
  useEffect(() => {
    return () => {
      if (saveTimerRef.current !== null) {
        window.clearTimeout(saveTimerRef.current);
      }
      flush();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chapter.id]);

  // Also flush on a hard refresh/tab close.
  useEffect(() => {
    window.addEventListener('beforeunload', flush);
    return () => window.removeEventListener('beforeunload', flush);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chapter.id]);

  function addLink() {
    if (!editor) return;
    const url = window.prompt('Link URL');
    if (!url) return;
    editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
  }

  function addImage() {
    if (!editor) return;
    const url = window.prompt('Image URL');
    if (!url) return;
    editor.chain().focus().setImage({ src: url }).run();
  }

  if (!editor) return null;

  return (
    <div className="flex flex-col h-full bg-white">
      {/* Status bar: word count + saved indicator, plus the heading
          alignment toggle for the title displayed below. */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-slate-200 text-xs text-slate-500">
        <div className="flex items-center gap-1">
          <span className="mr-2">Title position:</span>
          <ToolbarButton
            label="Title on the left"
            active={headingAlign === 'left'}
            onClick={() => onHeadingAlignChange(chapter.id, 'left')}
          >
            <AlignLeft size={16} />
          </ToolbarButton>
          <ToolbarButton
            label="Title centered"
            active={headingAlign === 'center'}
            onClick={() => onHeadingAlignChange(chapter.id, 'center')}
          >
            <AlignCenter size={16} />
          </ToolbarButton>
        </div>
        <div className="flex items-center gap-3">
          <span>{wordCount} words</span>
          <span className={status === 'saved' ? 'text-emerald-600' : 'text-slate-400'}>
            {status === 'saved' ? '● Saved' : 'Saving…'}
          </span>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-0.5 px-3 py-2 border-b border-slate-200">
        <ToolbarButton label="Undo" onClick={() => editor.chain().focus().undo().run()}>
          <Undo2 size={16} />
        </ToolbarButton>
        <ToolbarButton label="Redo" onClick={() => editor.chain().focus().redo().run()}>
          <Redo2 size={16} />
        </ToolbarButton>
        <ToolbarDivider />
        <ToolbarButton
          label="Bold"
          active={editor.isActive('bold')}
          onClick={() => editor.chain().focus().toggleBold().run()}
        >
          <Bold size={16} />
        </ToolbarButton>
        <ToolbarButton
          label="Italic"
          active={editor.isActive('italic')}
          onClick={() => editor.chain().focus().toggleItalic().run()}
        >
          <Italic size={16} />
        </ToolbarButton>
        <ToolbarButton
          label="Underline"
          active={editor.isActive('underline')}
          onClick={() => editor.chain().focus().toggleUnderline().run()}
        >
          <UnderlineIcon size={16} />
        </ToolbarButton>
        <ToolbarDivider />
        <ToolbarButton
          label="Paragraph"
          active={editor.isActive('paragraph')}
          onClick={() => editor.chain().focus().setParagraph().run()}
        >
          <Pilcrow size={16} />
        </ToolbarButton>
        <ToolbarButton
          label="Heading 1"
          active={editor.isActive('heading', { level: 1 })}
          onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
        >
          <Heading1 size={16} />
        </ToolbarButton>
        <ToolbarButton
          label="Heading 2"
          active={editor.isActive('heading', { level: 2 })}
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
        >
          <Heading2 size={16} />
        </ToolbarButton>
        <ToolbarButton
          label="Heading 3"
          active={editor.isActive('heading', { level: 3 })}
          onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
        >
          <Heading3 size={16} />
        </ToolbarButton>
        <ToolbarDivider />
        <ToolbarButton
          label="Bullet list"
          active={editor.isActive('bulletList')}
          onClick={() => editor.chain().focus().toggleBulletList().run()}
        >
          <List size={16} />
        </ToolbarButton>
        <ToolbarButton
          label="Numbered list"
          active={editor.isActive('orderedList')}
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
        >
          <ListOrdered size={16} />
        </ToolbarButton>
        <ToolbarDivider />
        <ToolbarButton
          label="Align left"
          active={editor.isActive({ textAlign: 'left' })}
          onClick={() => editor.chain().focus().setTextAlign('left').run()}
        >
          <AlignLeft size={16} />
        </ToolbarButton>
        <ToolbarButton
          label="Align center"
          active={editor.isActive({ textAlign: 'center' })}
          onClick={() => editor.chain().focus().setTextAlign('center').run()}
        >
          <AlignCenter size={16} />
        </ToolbarButton>
        <ToolbarButton
          label="Align right"
          active={editor.isActive({ textAlign: 'right' })}
          onClick={() => editor.chain().focus().setTextAlign('right').run()}
        >
          <AlignRight size={16} />
        </ToolbarButton>
        <ToolbarDivider />
        <ToolbarButton label="Add link" active={editor.isActive('link')} onClick={addLink}>
          <LinkIcon size={16} />
        </ToolbarButton>
        <ToolbarButton label="Add image" onClick={addImage}>
          <ImageIcon size={16} />
        </ToolbarButton>
      </div>

      <div className="flex-1 overflow-y-auto px-8 py-6">
        <h1
          className={
            headingAlign === 'center'
              ? 'text-2xl font-bold text-slate-900 mb-4 text-center'
              : 'text-2xl font-bold text-slate-900 mb-4 text-left'
          }
        >
          {chapter.title}
        </h1>
        <EditorContent className="chapter-editor-content" editor={editor} />
      </div>
    </div>
  );
}