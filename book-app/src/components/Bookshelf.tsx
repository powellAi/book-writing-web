import { useEffect, useState } from 'react';
import type { Book } from '../types/book';
import * as store from '../data/bookStore';
import './Bookshelf.css';

interface BookshelfProps {
  onOpenBook: (bookId: string) => void;
}

export default function Bookshelf({ onOpenBook }: BookshelfProps) {
  const [books, setBooks] = useState<Book[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNewBookForm, setShowNewBookForm] = useState(false);
  const [title, setTitle] = useState('');
  const [author, setAuthor] = useState('');
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

  useEffect(() => {
    refresh();
  }, []);

  async function refresh() {
    setLoading(true);
    setBooks(await store.listBooks());
    setLoading(false);
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    const book = await store.createBook(title, author);
    setTitle('');
    setAuthor('');
    setShowNewBookForm(false);
    await refresh();
    onOpenBook(book.id);
  }

  async function handleDelete(bookId: string) {
    await store.deleteBook(bookId);
    setPendingDeleteId(null);
    await refresh();
  }

  return (
    <div className="bookshelf">
      <header className="bookshelf-header">
        <h1>Your books</h1>
        <button className="btn btn-primary" onClick={() => setShowNewBookForm(true)}>
          New book
        </button>
      </header>

      {showNewBookForm && (
        <form className="new-book-form" onSubmit={handleCreate}>
          <label>
            Title
            <input
              autoFocus
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="The book's title"
            />
          </label>
          <label>
            Author
            <input
              value={author}
              onChange={(e) => setAuthor(e.target.value)}
              placeholder="Your name"
            />
          </label>
          <div className="new-book-form-actions">
            <button type="button" className="btn btn-text" onClick={() => setShowNewBookForm(false)}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={!title.trim()}>
              Create book
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <p className="bookshelf-empty">Loading your books…</p>
      ) : books.length === 0 ? (
        <div className="bookshelf-empty">
          <p>No books yet. Start your first one.</p>
        </div>
      ) : (
        <ul className="book-grid">
          {books.map((book) => (
            <li key={book.id} className="book-card">
              <button className="book-card-open" onClick={() => onOpenBook(book.id)}>
                <span className="book-card-title">{book.title}</span>
                <span className="book-card-author">{book.author || 'No author set'}</span>
              </button>

              {pendingDeleteId === book.id ? (
                <div className="book-card-confirm">
                  <span>Delete this book?</span>
                  <button className="btn-text" onClick={() => setPendingDeleteId(null)}>
                    Cancel
                  </button>
                  <button className="btn-text btn-danger" onClick={() => handleDelete(book.id)}>
                    Delete
                  </button>
                </div>
              ) : (
                <button className="btn-text book-card-delete" onClick={() => setPendingDeleteId(book.id)}>
                  Delete
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
