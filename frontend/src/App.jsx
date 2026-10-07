import React, { useState, useEffect } from 'react';
import Header from './components/Header.jsx';
import Hero from './components/Hero.jsx';
import QRUpload from './components/QRUpload.jsx';
import PipelineVisualization from './components/PipelineVisualization.jsx';
import RiskAssessmentResult from './components/RiskAssessmentResult.jsx';
import ResearchContext from './components/ResearchContext.jsx';
import Footer from './components/Footer.jsx';

export default function App() {
  const [activeSection, setActiveSection] = useState('analyze');

  useEffect(() => {
    const sections = ['analyze', 'how-it-works', 'research'];
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setActiveSection(entry.target.id);
          }
        });
      },
      {
        rootMargin: '-20% 0px -60% 0px',
        threshold: 0,
      }
    );

    sections.forEach((id) => {
      const element = document.getElementById(id);
      if (element) observer.observe(element);
    });

    const handleScroll = () => {
      if (window.scrollY < 200) {
        setActiveSection('analyze');
      }
    };
    window.addEventListener('scroll', handleScroll, { passive: true });

    return () => {
      observer.disconnect();
      window.removeEventListener('scroll', handleScroll);
    };
  }, []);

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
        <PipelineVisualization />
        <RiskAssessmentResult />
        <ResearchContext />
      </main>
      <Footer onNavigate={handleNavigate} />
    </div>
  );
}
