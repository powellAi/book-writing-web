import { useState } from 'react';
import { X, Plus } from 'lucide-react';
import type { Chapter } from '../types/book';

interface ChapterDetailsPanelProps {
  chapter: Chapter;
  onRename: (chapterId: string, title: string) => void;
  onDetailsChange: (chapterId: string, updates: { description?: string; tags?: string[] }) => void;
}

export default function ChapterDetailsPanel({ chapter, onRename, onDetailsChange }: ChapterDetailsPanelProps) {
  const [tagDraft, setTagDraft] = useState('');
  const tags = chapter.tags ?? [];

  function addTag() {
    const value = tagDraft.trim();
    if (!value || tags.includes(value)) {
      setTagDraft('');
      return;
    }
    onDetailsChange(chapter.id, { tags: [...tags, value] });
    setTagDraft('');
  }

  function removeTag(tag: string) {
    onDetailsChange(
      chapter.id,
      { tags: tags.filter((t) => t !== tag) }
    );
  }

  return (
    <aside className="w-72 shrink-0 border-l border-slate-200 bg-white p-4 overflow-y-auto">
      <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-4">
        Chapter details
      </h2>

      <label className="block text-xs font-medium text-slate-600 mb-1">Title</label>
      <input
        type="text"
        className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm mb-4 focus:outline-none focus:ring-2 focus:ring-emerald-500"
        value={chapter.title}
        onChange={(e) => onRename(chapter.id, e.target.value)}
      />

      <label className="block text-xs font-medium text-slate-600 mb-1">Description</label>
      <textarea
        className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm mb-4 min-h-20 resize-y focus:outline-none focus:ring-2 focus:ring-emerald-500"
        placeholder="Add a short description…"
        value={chapter.description ?? ''}
        onChange={(e) => onDetailsChange(chapter.id, { description: e.target.value })}
      />

      <label className="block text-xs font-medium text-slate-600 mb-1">Tags</label>
      <div className="flex flex-wrap gap-1.5 mb-2">
        {tags.map((tag) => (
          <span
            key={tag}
            className="inline-flex items-center gap-1 rounded-full bg-slate-100 text-slate-700 text-xs px-2 py-1"
          >
            {tag}
            <button
              type="button"
              onClick={() => removeTag(tag)}
              aria-label={`Remove tag ${tag}`}
              className="text-slate-400 hover:text-slate-700"
            >
              <X size={12} />
            </button>
          </span>
        ))}
      </div>
      <div className="flex gap-1.5">
        <input
          type="text"
          className="flex-1 rounded-md border border-slate-300 px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
          placeholder="Add a tag…"
          value={tagDraft}
          onChange={(e) => setTagDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              addTag();
            }
          }}
        />
        <button
          type="button"
          onClick={addTag}
          aria-label="Add tag"
          className="flex items-center justify-center rounded-md border border-slate-300 px-2 text-slate-600 hover:bg-slate-100"
        >
          <Plus size={14} />
        </button>
      </div>
    </aside>
  );
}