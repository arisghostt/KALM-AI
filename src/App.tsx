import React, { useEffect, useState } from 'react';
import { Patient, Exam, CallRecord, Language, DICTIONARY, MODALITIES, SAMPLE_PATIENTS, SAMPLE_EXAMS, SAMPLE_CALLS } from './types';
import ReceptionView from './components/ReceptionView';
import TechnicianView from './components/TechnicianView';
import WaitingRoomView from './components/WaitingRoomView';
import DashboardView from './components/DashboardView';
import GeneralPageView from './components/GeneralPageView';
import { Activity, Server, Languages, RefreshCcw, Layout, Monitor, HelpCircle, HardDrive, Menu, X, ChevronDown, Sun, Moon } from 'lucide-react';

export default function App() {
  const [lang, setLang] = useState<Language>('FR');
  const [activeTab, setActiveTab] = useState<'general' | 'reception' | 'technician' | 'dashboard'>('general');
  const [menuOpen, setMenuOpen] = useState<boolean>(false);
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    try {
      return localStorage.getItem('kalm_theme') === 'dark' ? 'dark' : 'light';
    } catch {
      return 'light';
    }
  });
  
  // App states synchronised with Express Server API
  const [patients, setPatients] = useState<Patient[]>(() => {
    try {
      const saved = localStorage.getItem('kalm_patients');
      return saved ? JSON.parse(saved) : SAMPLE_PATIENTS;
    } catch {
      return SAMPLE_PATIENTS;
    }
  });
  const [exams, setExams] = useState<Exam[]>(() => {
    try {
      const saved = localStorage.getItem('kalm_exams');
      return saved ? JSON.parse(saved) : SAMPLE_EXAMS;
    } catch {
      return SAMPLE_EXAMS;
    }
  });
  const [calls, setCalls] = useState<CallRecord[]>(() => {
    try {
      const saved = localStorage.getItem('kalm_calls');
      return saved ? JSON.parse(saved) : SAMPLE_CALLS;
    } catch {
      return SAMPLE_CALLS;
    }
  });
  
  // UI preferences
  const [pollingActive, setPollingActive] = useState<boolean>(true);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const dictionary = DICTIONARY[lang];

  // Fetch full state from backend
  const fetchState = async () => {
    try {
      const res = await fetch('/api/state');
      if (res.ok) {
        const data = await res.json();
        setPatients(data.patients);
        setExams(data.exams);
        setCalls(data.calls);
        try {
          localStorage.setItem('kalm_patients', JSON.stringify(data.patients));
          localStorage.setItem('kalm_exams', JSON.stringify(data.exams));
          localStorage.setItem('kalm_calls', JSON.stringify(data.calls));
        } catch {
          // localStorage fails gracefully if disabled
        }
      } else {
        console.warn("Backend server not ok", res.status);
      }
    } catch (err) {
      console.warn("Local polling server connection offline", err);
    } finally {
      setIsLoading(false);
    }
  };

  // Sync state periodically
  useEffect(() => {
    fetchState();
    
    let interval: any = null;
    if (pollingActive) {
      interval = setInterval(() => {
        fetchState();
      }, 2000); // Poll local memory state every 2 seconds
    }
    
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [pollingActive]);

  const handlePatientRegistered = (newPatient: Patient, newExams: Exam[]) => {
    // Add locally immediately, will be formalised by the interval poll anyway
    const updatedPatients = [...patients, newPatient];
    const updatedExams = [...exams, ...newExams];
    setPatients(updatedPatients);
    setExams(updatedExams);
    try {
      localStorage.setItem('kalm_patients', JSON.stringify(updatedPatients));
      localStorage.setItem('kalm_exams', JSON.stringify(updatedExams));
    } catch {}
  };

  const handleExamStatusChange = (examId: string, nextStatus: any) => {
    let updatedExams: Exam[] = [];
    setExams(prev => {
      updatedExams = prev.map(ex => {
        if (ex.id === examId) {
          return {
            ...ex,
            status: nextStatus,
            heureAppel: nextStatus === 'CALLED' ? new Date().toISOString() : ex.heureAppel,
            heureFin: nextStatus === 'DONE' ? new Date().toISOString() : ex.heureFin
          };
        }
        return ex;
      });
      try {
        localStorage.setItem('kalm_exams', JSON.stringify(updatedExams));
      } catch {}
      return updatedExams;
    });

    if (nextStatus === 'CALLED') {
      const calledExam = exams.find(e => e.id === examId);
      if (calledExam) {
        const modObj = MODALITIES.find(m => m.id === calledExam.modalite);
        const newCall: CallRecord = {
          id: `call_${Date.now()}`,
          numeroOrdre: calledExam.numeroOrdre,
          patientNom: calledExam.patientNom,
          modalite: calledExam.modalite,
          salle: modObj ? modObj.salle : "Salle d'examen",
          lang,
          heureAppel: new Date().toISOString()
        };
        setCalls(prev => {
          const nextCalls = [newCall, ...prev].slice(0, 30);
          try {
            localStorage.setItem('kalm_calls', JSON.stringify(nextCalls));
          } catch {}
          return nextCalls;
        });
      }
    }

    // Pull active calls updates immediately
    fetchState();
  };

  const handleResetData = async () => {
    if (!window.confirm(dictionary.clearConfirm)) return;
    
    try {
      const res = await fetch('/api/state/reset', { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        setPatients(data.patients);
        setExams(data.exams);
        setCalls(data.calls);
      }
    } catch (err) {
      console.error(err);
      alert('Could not contact server to register database reset.');
    }
  };

  return (
    <div className={`min-h-screen flex flex-col font-sans transition-colors duration-200 selection:bg-slate-900/10 selection:text-slate-900 ${
      theme === 'dark' ? 'dark bg-slate-950 text-slate-100' : 'bg-slate-100 text-slate-800'
    }`}>
      
      {/* 1. Header Bar */}
      <header className={`sticky top-0 z-40 border-b px-4 py-3.5 md:px-6 shadow-xs transition-colors duration-150 ${
        theme === 'dark' ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white border-slate-200'
      }`}>
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className={`font-black px-3 py-1 text-xl tracking-tighter leading-none select-none transition-colors border-2 ${
              theme === 'dark' ? 'text-slate-950 bg-white border-white' : 'text-white bg-slate-950 border-slate-950'
            }`}>
              KALM
            </div>
            <div>
              <h1 className={`text-sm md:text-base font-black tracking-tight uppercase transition-colors ${
                theme === 'dark' ? 'text-white' : 'text-slate-950'
              }`}>
                KALM IMAGERIE
              </h1>
              <p className={`text-[10px] md:text-xs font-semibold uppercase tracking-wide transition-colors ${
                theme === 'dark' ? 'text-slate-400' : 'text-slate-500'
              }`}>
                {dictionary.tagline}
              </p>
            </div>
          </div>

          <div className="flex items-center flex-wrap gap-2">
            {/* Theme Trigger Button */}
            <button
              onClick={() => {
                const nextTheme = theme === 'dark' ? 'light' : 'dark';
                setTheme(nextTheme);
                localStorage.setItem('kalm_theme', nextTheme);
              }}
              className={`flex items-center justify-center p-2 rounded-xl border transition duration-150 cursor-pointer shadow-xs ${
                theme === 'dark'
                  ? 'bg-slate-800 hover:bg-slate-750 text-amber-400 border-slate-700'
                  : 'bg-slate-50 hover:bg-slate-100 text-slate-500 hover:text-slate-800 border-slate-200'
              }`}
              title={theme === 'dark' ? 'Activer mode clair' : 'Activer mode sombre'}
            >
              {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>

            {/* Hamburger Dropdown Menu */}
            <div className="relative">
              <button
                onClick={() => setMenuOpen(!menuOpen)}
                className={`flex items-center justify-center p-2.5 rounded-xl transition duration-150 cursor-pointer shadow-md border ${
                  theme === 'dark'
                    ? 'bg-white hover:bg-neutral-100 text-slate-950 border-white'
                    : 'bg-black hover:bg-neutral-900 text-white border-neutral-800'
                }`}
                title={lang === 'FR' ? 'Menu de Navigation' : 'Navigation Menu'}
              >
                {menuOpen ? <X className="w-4 h-4 text-white dark:text-slate-950" /> : <Menu className="w-4 h-4 text-white dark:text-slate-950" />}
              </button>

              {menuOpen && (
                <>
                  {/* Backdrop overlay */}
                  <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />
                  <div className={`absolute right-0 mt-2 w-64 border rounded-2xl shadow-2xl z-50 overflow-hidden py-2 animate-in fade-in slide-in-from-top-3 duration-150 ${
                    theme === 'dark' ? 'bg-slate-900 border-slate-800' : 'bg-black border-neutral-800'
                  }`}>
                    <div className={`px-4 py-2.5 border-b ${theme === 'dark' ? 'border-slate-800/60' : 'border-neutral-900'}`}>
                      <p className={`text-[9px] uppercase font-mono font-bold tracking-[0.2em] ${
                        theme === 'dark' ? 'text-slate-400' : 'text-neutral-500'
                      }`}>
                        {lang === 'FR' ? 'NAVIGATION CLINIQUE' : 'CLINICAL NAVIGATION'}
                      </p>
                    </div>
                    {[
                      { id: 'general', label: lang === 'FR' ? 'Page Générale' : 'General Page', icon: '🏠' },
                      { id: 'reception', label: lang === 'FR' ? 'Accueil & Réception' : 'Reception & Admission', icon: '📋' },
                      { id: 'technician', label: lang === 'FR' ? 'Service Imagerie' : 'Imaging Stations', icon: '⚡' },
                      { id: 'dashboard', label: lang === 'FR' ? 'Tableau de Bord & IA' : 'Stats & Smart AI', icon: '📊' }
                    ].map((item) => (
                      <button
                        key={item.id}
                        onClick={() => {
                          setActiveTab(item.id as any);
                          setMenuOpen(false);
                        }}
                        className={`w-full text-left px-4 py-3 text-xs font-semibold flex items-center justify-between border-l-4 transition-all ${
                          activeTab === item.id
                            ? (theme === 'dark' ? 'bg-slate-800/80 text-white border-white font-bold' : 'bg-neutral-900 text-white border-white font-bold')
                            : (theme === 'dark' ? 'text-slate-300 hover:text-white hover:bg-slate-800/40 border-transparent' : 'text-neutral-400 hover:text-white hover:bg-neutral-900/40 border-transparent')
                        }`}
                      >
                        <span className="flex items-center gap-2">
                          <span className="opacity-95 text-xs">{item.icon}</span>
                          <span>{item.label}</span>
                        </span>
                        {activeTab === item.id && (
                          <span className="w-1.5 h-1.5 bg-white rounded-full"></span>
                        )}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>

            {/* Language switch */}
            <div className={`flex items-center gap-1 p-1 rounded-xl border transition-colors ${
              theme === 'dark' ? 'bg-slate-800/40 border-slate-700' : 'bg-slate-100 border-slate-200'
            }`}>
              <button
                onClick={() => setLang('FR')}
                className={`px-2.5 py-1 text-xs font-bold rounded-lg transition-colors cursor-pointer ${
                  lang === 'FR' 
                    ? (theme === 'dark' ? 'bg-slate-700 text-white shadow-xs' : 'bg-white text-slate-900 shadow-xs') 
                    : (theme === 'dark' ? 'text-slate-400 hover:text-slate-200' : 'text-slate-500 hover:text-slate-800')
                }`}
              >
                🇫🇷 FR
              </button>
              <button
                onClick={() => setLang('EN')}
                className={`px-2.5 py-1 text-xs font-bold rounded-lg transition-colors cursor-pointer ${
                  lang === 'EN' 
                    ? (theme === 'dark' ? 'bg-slate-700 text-white shadow-xs' : 'bg-white text-slate-900 shadow-xs') 
                    : (theme === 'dark' ? 'text-slate-400 hover:text-slate-200' : 'text-slate-500 hover:text-slate-800')
                }`}
              >
                🇬🇧 EN
              </button>
            </div>

            {/* Reset button */}
            <button
              onClick={handleResetData}
              className={`p-1 px-2 border rounded-xl transition duration-150 cursor-pointer ${
                theme === 'dark'
                  ? 'border-slate-750 bg-slate-800/40 hover:bg-rose-950/40 hover:text-rose-400 hover:border-rose-800 text-slate-400'
                  : 'border-slate-205 hover:bg-rose-50 hover:text-rose-600 hover:border-rose-200 text-slate-500'
              }`}
              title={dictionary.resetBtn}
            >
              <RefreshCcw className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* 2. Main Space Container */}
      <main className={`flex-1 w-full flex flex-col ${activeTab === 'general' ? 'max-w-none p-0 bg-slate-950' : 'max-w-7xl mx-auto p-4 md:p-6 lg:py-8'}`}>
        
        {/* Loading Indicator */}
        {isLoading ? (
          <div className="h-96 flex flex-col items-center justify-center text-slate-400">
            <Activity className="w-10 h-10 animate-spin text-sky-600 mb-2" />
            <p className="text-sm font-semibold">{lang === 'FR' ? "Démarrage du réseau d'imagerie..." : "Establishing local imaging network..."}</p>
          </div>
        ) : (
          /* ================== STANDARD FULL SCREEN VIEW MODE ================== */
          <div className="flex-1 flex flex-col">
            
            {/* View Render */}
            {activeTab === 'general' ? (
              <GeneralPageView 
                lang={lang} 
                exams={exams} 
                calls={calls} 
              />
            ) : (
              <div className={`transition-all duration-200 animate-fade-in rounded-3xl border p-6 md:p-8 shadow-xs ${
                theme === 'dark' ? 'bg-slate-900 border-slate-800 text-slate-100' : 'bg-white border-slate-100 text-slate-800'
              }`}>
                {activeTab === 'reception' && (
                  <ReceptionView 
                    lang={lang} 
                    patients={patients} 
                    exams={exams} 
                    onPatientRegistered={handlePatientRegistered} 
                  />
                )}
                {activeTab === 'technician' && (
                  <TechnicianView 
                    lang={lang} 
                    exams={exams} 
                    onStatusChange={handleExamStatusChange} 
                  />
                )}
                {activeTab === 'dashboard' && (
                  <DashboardView 
                    lang={lang} 
                    exams={exams} 
                    calls={calls}
                    onNavigateToTab={setActiveTab}
                  />
                )}
              </div>
            )}

          </div>
        )}
      </main>

      {/* 3. Footer Bar */}
      <footer className="bg-slate-900 text-white border-t border-slate-800 p-4 md:p-6 text-xs mt-12">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-4 text-slate-400">
          
          <div className="flex items-center gap-2">
            <Server className="w-4 h-4 text-[#00E5FF] animate-pulse" />
            <span>{dictionary.serverConnected}</span>
          </div>

          <div className="flex items-center gap-4 flex-wrap text-[10px] md:text-xs">
            <span className="flex items-center gap-1">
              <HardDrive className="w-3.5 h-3.5" />
              <span><b>{lang === 'FR' ? 'Algorithme' : 'Scheduling'}:</b> Prioritaire Multimodal FIFO (P1-P4)</span>
            </span>
            <span>|</span>
            <span>&copy; 2026 Douala Medical Imaging Systems.</span>
          </div>

        </div>
      </footer>

    </div>
  );
}
