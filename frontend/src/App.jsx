import React, { useState } from 'react';
import Header from './components/Header.jsx';

export default function App() {
  const [activeSection, setActiveSection] = useState('analyze');

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col">
      <Header activeSection={activeSection} onNavigate={setActiveSection} />
      <main className="flex-1">
        {/* Subsequent sections (hero, QR upload, pipeline, results) will be implemented in future stages per instructions */}
      </main>
    </div>
  );
}
