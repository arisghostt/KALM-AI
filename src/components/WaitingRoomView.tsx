import React, { useEffect, useState, useRef } from 'react';
import { CallRecord, Language, DICTIONARY, Exam } from '../types';
import { Tv, History, Bell, VolumeX, Volume2, ShieldAlert } from 'lucide-react';

interface WaitingRoomViewProps {
  lang: Language;
  calls: CallRecord[];
  exams?: Exam[];
}

export default function WaitingRoomView({ lang, calls, exams = [] }: WaitingRoomViewProps) {
  const dictionary = DICTIONARY[lang];
  const lastCallIdRef = useRef<string | null>(null);
  
  // Sound enablement state
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [flashActive, setFlashActive] = useState(false);

  // Grab current called patient (latest overall call)
  const currentCall = calls[0];
  const previousCalls = calls.slice(1, 5); // display next 4 in history

  // helper to find priority of a call from exams list
  const getCallPriority = (numeroOrdre: string) => {
    const foundExam = exams.find(e => e.numeroOrdre === numeroOrdre);
    return foundExam ? foundExam.patientPriority : 'P4';
  };

  // Trigger synth physical chime when a new call is received
  useEffect(() => {
    if (!currentCall) return;
    
    // Check if this is a fresh call
    if (lastCallIdRef.current !== currentCall.id) {
      lastCallIdRef.current = currentCall.id;
      
      // Flash screen animation
      setFlashActive(true);
      const timer = setTimeout(() => setFlashActive(false), 4000);
      
      // Play hospital chime sound (Web Audio API)
      if (soundEnabled) {
        try {
          playHospitalChime();
        } catch (err) {
          console.error("Audio chime failed to play", err);
        }
      }

      return () => clearTimeout(timer);
    }
  }, [currentCall, soundEnabled]);

  // Standard dual-tone medical hospital synth pager chime
  const playHospitalChime = () => {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    
    const ctx = new AudioContextClass();
    
    // First tone (G5)
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.frequency.setValueAtTime(783.99, ctx.currentTime); // G5 frequency
    gain1.gain.setValueAtTime(0.3, ctx.currentTime);
    gain1.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.6);
    osc1.start(ctx.currentTime);
    osc1.stop(ctx.currentTime + 0.6);

    // Second tone (E5) delayed
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.frequency.setValueAtTime(659.25, ctx.currentTime + 0.25); // E5 frequency
    gain2.gain.setValueAtTime(0.3, ctx.currentTime + 0.25);
    gain2.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.85);
    osc2.start(ctx.currentTime + 0.25);
    osc2.stop(ctx.currentTime + 0.85);
  };

  return (
    <div className={`space-y-6 transition-all duration-300 ${flashActive ? 'bg-amber-50/20' : ''}`}>
      {/* Sound Controller bar */}
      <div className="flex justify-between items-center bg-slate-100 dark:bg-slate-800 hover:bg-slate-200/70 dark:hover:bg-slate-750 p-3 px-4 rounded-xl text-slate-750 dark:text-slate-250 text-xs transition duration-150">
        <div className="flex items-center gap-2">
          <Bell className="w-4 h-4 text-amber-500 animate-bounce" />
          <span>
            {lang === 'FR' 
              ? "🔊 Mode Télévision : Les appels émettent un carillon et une annonce vocale automatique."
              : "🔊 Television Mode: Incoming calls trigger a dual-tone chime and automatic voice call."}
          </span>
        </div>
        <button
          onClick={() => setSoundEnabled(!soundEnabled)}
          className={`flex items-center gap-1.5 py-1 px-3 rounded-lg font-bold cursor-pointer transition-colors ${
            soundEnabled ? 'bg-emerald-600 text-white' : 'bg-rose-600 text-white'
          }`}
        >
          {soundEnabled ? (
            <>
              <Volume2 className="w-3.5 h-3.5" />
              Chime On
            </>
          ) : (
            <>
              <VolumeX className="w-3.5 h-3.5" />
              Chime Off
            </>
          )}
        </button>
      </div>

      {/* Main TV Frame Screen */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 bg-slate-950 text-white rounded-3xl p-6 lg:p-8 relative overflow-hidden border-8 border-slate-900 shadow-2xl">
        {/* Subtle grid hospital backlines mockup */}
        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.01)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.01)_1px,transparent_1px)] bg-[size:30px_30px] pointer-events-none"></div>

        {/* Left 2 Cols: Main display panel */}
        <div className="xl:col-span-2 flex flex-col justify-between min-h-[420px] relative z-10">
          <div className="flex items-center gap-2 border-b border-white/10 pb-4">
            <Tv className="w-5 h-5 text-red-500 animate-pulse" />
            <h2 className="text-sm font-bold tracking-widest text-[#00E5FF] uppercase">
              {lang === 'FR' ? 'AFFICHAGE SALLE D\'ATTENTE' : 'WAITING AREA CENTRAL TV'}
            </h2>
            <div className="ml-auto flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-ping"></span>
              <span className="text-[10px] font-mono font-semibold text-slate-400">DOUALA CENTRAL NETWORK</span>
            </div>
          </div>

          {currentCall ? (() => {
            const isCallUrgent = getCallPriority(currentCall.numeroOrdre) === 'P1' || getCallPriority(currentCall.numeroOrdre) === 'P2';
            return (
              <div className="my-auto py-8 text-center space-y-4">
                <p className="text-slate-400 text-xs md:text-sm font-bold tracking-widest uppercase flex items-center justify-center gap-2">
                  {isCallUrgent && <span className="w-2 h-2 bg-red-500 rounded-full animate-ping"></span>}
                  <span>{dictionary.callingNow} / {lang === 'FR' ? 'EN COURS D\'APPEL' : 'PATIENT IS CALLED'}</span>
                </p>
                
                <div className={`inline-block px-12 py-6 rounded-3xl transition-all duration-300 ${
                  isCallUrgent
                    ? 'border-4 border-red-500 bg-red-950/40 animate-border-blink-red shadow-[0_0_50px_rgba(239,68,68,0.55)] scale-105'
                    : flashActive 
                      ? 'bg-amber-500 text-slate-950 scale-105 shadow-[0_0_50px_rgba(245,158,11,0.6)]' 
                      : 'bg-white/5 border border-white/10 shadow-[0_0_30px_rgba(0,229,255,0.1)]'
                }`}>
                  <p className={`text-7xl md:text-8xl font-black font-sans tracking-wide transition-all ${
                    isCallUrgent
                      ? 'text-red-500'
                      : flashActive ? 'text-slate-950' : 'text-[#00E5FF]'
                  }`}>
                    {currentCall.numeroOrdre}
                  </p>
                  <p className={`text-lg font-mono font-bold tracking-widest uppercase mt-1 ${
                    isCallUrgent
                      ? 'text-red-400 animate-pulse'
                      : flashActive ? 'text-slate-900' : 'text-slate-300'
                  }`}>
                    {currentCall.modalite}
                  </p>
                </div>

                {isCallUrgent ? (
                  <div className="flex flex-col items-center gap-1">
                    <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-red-600/25 border border-red-500/60 rounded-full text-xs font-black text-red-500 animate-pulse uppercase tracking-wider mx-auto">
                      <span className="w-2 h-2 bg-red-600 rounded-full animate-ping"></span>
                      <span>{lang === 'FR' ? '🚨 URGENCE - PRIORITÉ ABSOLUE' : '🚨 EMERGENCY - ABSOLUTE PRIORITY'}</span>
                    </div>
                  </div>
                ) : null}

                <div className="space-y-1 pt-2">
                  <p className="text-xl md:text-2xl font-bold font-sans text-slate-100 uppercase tracking-widest">
                    {lang === 'FR' ? 'PATIENT ATTENDU' : 'PATIENT EXPECTED'}
                  </p>
                  <p className="text-sm md:text-base text-slate-400">
                    {dictionary.proceedTo} <b className="text-white underline font-semibold">{currentCall.salle}</b>
                  </p>
                </div>
              </div>
            );
          })() : (
            <div className="my-auto py-12 text-center text-slate-500">
              <p className="text-3xl font-extrabold pb-2">---</p>
              <p className="text-sm font-mono uppercase tracking-widest">{dictionary.screenWaitingMsg}</p>
            </div>
          )}

          <div className="border-t border-white/5 pt-4 text-center">
            <p className="text-slate-500 text-[11px] font-mono tracking-widest uppercase animate-pulse">
              {lang === 'FR' ? '★ SYSTEME D\'APPEL AUDIO SECURISE MULTILINGUE' : '★ MULTILINGUAL AUDIO ASSISTED QUEUE SCREEN'}
            </p>
          </div>
        </div>

        {/* Right 1 Col: Scrolling history */}
        <div className="bg-white/5 border border-white/10 rounded-2xl p-5 flex flex-col justify-between relative z-10">
          <div>
            <h3 className="text-xs font-bold font-mono tracking-wide mb-4 text-[#00E5FF] flex items-center gap-1.5 border-b border-white/5 pb-2">
              <History className="w-3.5 h-3.5" />
              {dictionary.recentCalls}
            </h3>

            <div className="space-y-2.5">
              {previousCalls.length > 0 ? (
                previousCalls.map((c) => {
                  const isHistUrgent = getCallPriority(c.numeroOrdre) === 'P1' || getCallPriority(c.numeroOrdre) === 'P2';
                  return (
                    <div 
                      key={c.id} 
                      className={`rounded-xl p-3 flex justify-between items-center transition duration-155 border ${
                        isHistUrgent
                          ? 'bg-red-950/20 border-red-650 animate-border-blink-red'
                          : 'bg-white/[0.03] border-white/5 hover:bg-white/[0.06]'
                      }`}
                    >
                      <div>
                        <div className="flex items-center gap-1.5">
                          <p className={`font-mono text-base font-bold ${isHistUrgent ? 'text-red-400' : 'text-slate-100'}`}>
                            {c.numeroOrdre}
                          </p>
                          {isHistUrgent && (
                            <span className="bg-red-600 text-white text-[8px] font-extrabold px-1.5 py-0.5 rounded-sm animate-pulse tracking-wider uppercase shrink-0">
                              {lang === 'FR' ? 'URG' : 'EMERG'}
                            </span>
                          )}
                        </div>
                        <p className="text-[10px] text-slate-400 uppercase">{c.modalite}</p>
                      </div>
                      <div className="text-right">
                        <p className={`text-xs font-bold ${isHistUrgent ? 'text-red-400' : 'text-[#00E5FF]'}`}>{c.salle}</p>
                        <p className="text-[9px] text-slate-400 uppercase">{lang === 'FR' ? 'Appelé' : 'Called'}</p>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="h-60 flex flex-col items-center justify-center text-slate-600 text-center text-xs">
                  <p className="font-semibold">---</p>
                  <p className="text-[10px] uppercase mt-1">No call history</p>
                </div>
              )}
            </div>
          </div>

          <div className="pt-4 border-t border-white/5 mt-4 text-[10px] text-slate-500">
            <p className="font-bold flex items-center gap-1 text-[#00E5FF]/80">
              <ShieldAlert className="w-3 h-3 text-[#00E5FF]" />
              {lang === 'FR' ? 'Règle FIFO Multimodale' : 'Multimodal Routing'}:
            </p>
            <p className="text-[9px] text-slate-400 mt-1 leading-normal">
              {lang === 'FR' 
                ? 'Les files avancent de manière indépendante. Aucun médecin de spécialité ne reste inerte.'
                : 'Queues process concurrently. No physician or scanner sits empty waiting for double slots.'}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
