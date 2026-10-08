import React, { useState, useEffect } from 'react';
import SpatialBackground from './components/SpatialBackground.jsx';
import Header from './components/Header.jsx';
import Hero from './components/Hero.jsx';
import DefenseProtocolRibbon from './components/DefenseProtocolRibbon.jsx';
import QRUpload from './components/QRUpload.jsx';
import RiskAssessmentResult from './components/RiskAssessmentResult.jsx';
import Footer from './components/Footer.jsx';

export default function App() {
  const [activeSection, setActiveSection] = useState('analyze');
  const [analysisResult, setAnalysisResult] = useState(null);

  useEffect(() => {
    const sections = ['analyze', 'results'];
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

  const handleAnalysisComplete = (resultData) => {
    setAnalysisResult(resultData);
    // Smoothly transition focus to the verified report
    setTimeout(() => {
      handleNavigate('results');
    }, 300);
  };

  const handleReset = () => {
    setAnalysisResult(null);
  };

  return (
    <div className="relative flex min-h-screen flex-col bg-zinc-950 text-zinc-100 overflow-x-hidden selection:bg-emerald-500/20 selection:text-emerald-300">
      <SpatialBackground />
      <Header activeSection={activeSection} onNavigate={handleNavigate} />
      <main className="relative z-10 flex-1">
        <Hero onAnalyzeClick={handleAnalyzeClick} />
        <DefenseProtocolRibbon />
        <QRUpload
          onAnalysisComplete={handleAnalysisComplete}
          onReset={handleReset}
        />
        <RiskAssessmentResult result={analysisResult} />
      </main>
      <Footer onNavigate={handleNavigate} />
    </div>
  );
}
