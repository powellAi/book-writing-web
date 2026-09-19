// Shared data shapes for the whole app.
// The editor, the future page-preview, and the future PDF export
// all read and write these same shapes — there is no separate
// "preview copy" of a chapter's text anywhere.

/** A single chapter inside a book. */
export interface Chapter {
  id: string;
  title: string;
  /** Determines chapter order within the book; lower comes first. */
  order: number;
  /**
   * The chapter's text, stored as Tiptap/ProseMirror JSON.
   * `null` means the chapter has no content yet (a fresh chapter).
   * We use `unknown` here rather than importing Tiptap's JSON type,
   * to keep this file free of editor-library dependencies — the
   * data layer shouldn't need to know about the editor's internals.
   */
  content: unknown | null;
  /** Cached word count so the bookshelf/sidebar can show totals
   *  without loading and walking every chapter's content. */
  wordCount: number;
  updatedAt: string; // ISO timestamp
}

/** A book on the shelf. */
export interface Book {
  id: string;
  title: string;
  author: string;
  createdAt: string; // ISO timestamp
  updatedAt: string; // ISO timestamp
}

/** A book bundled with its chapters — what the editor screen works with. */
export interface BookWithChapters extends Book {
  chapters: Chapter[];
}
