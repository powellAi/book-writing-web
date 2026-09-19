import { useState } from 'react';
import Bookshelf from './components/Bookshelf';
import AppShell from './components/AppShell';

export default function App() {
  const [openBookId, setOpenBookId] = useState<string | null>(null);

  if (openBookId) {
    return <AppShell bookId={openBookId} onBackToShelf={() => setOpenBookId(null)} />;
  }

  return <Bookshelf onOpenBook={setOpenBookId} />;
}
