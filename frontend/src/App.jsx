import React, { useState } from 'react';
import Header from './components/Header.jsx';
import Hero from './components/Hero.jsx';
import QRUpload from './components/QRUpload.jsx';

export default function App() {
  const [activeSection, setActiveSection] = useState('analyze');

  const handleNavigate = (sectionId) => {
    setActiveSection(sectionId);
    const element = document.getElementById(sectionId);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const handleAnalyzeClick = () => {
    setActiveSection('analyze');
    const element = document.getElementById('analyze');
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-zinc-950 text-zinc-100">
      <Header activeSection={activeSection} onNavigate={handleNavigate} />
      <main className="flex-1">
        <Hero onAnalyzeClick={handleAnalyzeClick} />
        <QRUpload />
      </main>
    </div>
  );
}
