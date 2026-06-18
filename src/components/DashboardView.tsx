import React from 'react';
import { Exam, Language, CallRecord } from '../types';
import WaitingRoomView from './WaitingRoomView';

interface DashboardViewProps {
  lang: Language;
  exams: Exam[];
  calls: CallRecord[];
  onNavigateToTab?: (tab: string) => void;
}

export default function DashboardView({ lang, exams, calls, onNavigateToTab }: DashboardViewProps) {
  return (
    <div className="space-y-6 animate-fade-in">
      
      {/* Unified Live TV Display Panel (Black and White Inspired) */}
      <div className="bg-white border border-slate-200 p-6 md:p-8 rounded-3xl shadow-sm space-y-6">
        <div className="border-b border-slate-100 pb-4">
          <h3 className="text-base font-bold text-slate-900 uppercase">
            {lang === 'FR' ? "Affichage TV — Salle d'Attente" : 'Waiting Room TV Broadcast'}
          </h3>
          <p className="text-xs text-slate-400 font-medium font-sans">
            {lang === 'FR' 
              ? "Le moniteur synchronisé diffuse les numéros de passage en temps réel pour l'orientation bilingue des patients."
              : "The synchronized monitor broadcasts queue numbers in real-time for bilingual patient guidance."}
          </p>
        </div>

        <WaitingRoomView lang={lang} calls={calls} exams={exams} />
      </div>

    </div>
  );
}

