import React, { useState } from 'react';
import { Exam, Language, DICTIONARY, MODALITIES, PRIORITY_LABELS, ExamStatus } from '../types';
import { Volume2, Play, Check, Users, ShieldAlert, BadgeInfo, Sparkles, Sliders, Activity, BarChart2, Shield, AlertTriangle, RefreshCw } from 'lucide-react';
import MonthlyModalityChart from './MonthlyModalityChart';

// Custom Micro-Markdown parser and beautiful stylized visualizer for report outputs
function SimpleMarkdown({ content }: { content: string }) {
  const lines = content.split('\n');
  
  const parseInlineBold = (text: string) => {
    const parts = text.split('**');
    return parts.map((part, idx) => {
      if (idx % 2 === 1) {
        return <strong key={idx} className="font-bold text-slate-950 bg-slate-100/60 dark:text-white dark:bg-slate-850">{part}</strong>;
      }
      return part;
    });
  };

  return (
    <div className="space-y-2.5 text-[13px] text-slate-700 dark:text-slate-300 leading-relaxed font-sans">
      {lines.map((line, idx) => {
        const trimmed = line.trim();
        if (!trimmed) return <div key={idx} className="h-2"></div>;
        
        if (trimmed.startsWith('###')) {
          return (
            <h4 key={idx} className="text-sm font-bold text-slate-900 dark:text-white pt-3 flex items-center gap-1">
              <span className="w-1.5 h-3 bg-sky-500 rounded-xs"></span>
              {trimmed.replace('###', '').trim()}
            </h4>
          );
        }
        
        if (trimmed.startsWith('####')) {
          return (
            <h5 key={idx} className="text-[13px] font-bold text-slate-800 dark:text-slate-200 pt-2">
              {trimmed.replace('####', '').trim()}
            </h5>
          );
        }

        if (trimmed.startsWith('-') || trimmed.startsWith('*')) {
          const cleanText = trimmed.replace(/^[-*]\s*/, '');
          return (
            <div key={idx} className="flex gap-2 items-start pl-4">
              <span className="text-sky-500 text-xs mt-1.5">•</span>
              <span className="flex-1 text-[13px]">{parseInlineBold(cleanText)}</span>
            </div>
          );
        }

        if (trimmed.startsWith('⚠️')) {
          return (
            <div key={idx} className="bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900/40 p-3 rounded-xl text-rose-800 dark:text-rose-200 text-xs flex items-start gap-2.5 my-2">
              <AlertTriangle className="w-4 h-4 text-rose-600 mt-0.5 shrink-0" />
              <div>{parseInlineBold(line)}</div>
            </div>
          );
        }

        return <p key={idx} className="text-[13px]">{parseInlineBold(trimmed)}</p>;
      })}
    </div>
  );
}

interface TechnicianViewProps {
  lang: Language;
  exams: Exam[];
  onStatusChange: (examId: string, newStatus: ExamStatus) => void;
}

export default function TechnicianView({ lang, exams, onStatusChange }: TechnicianViewProps) {
  const dictionary = DICTIONARY[lang];
  const [selectedModality, setSelectedModality] = useState<string>('ALL');

  // States for live report
  const [aiReport, setAiReport] = useState<string>('');
  const [reportSource, setReportSource] = useState<string>('');
  const [analyzing, setAnalyzing] = useState(false);

  // Track known P1 urgent exams for automatic spoken alert
  const [knownP1Ids, setKnownP1Ids] = useState<string[]>([]);

  // Automatically trigger a bilingual (FR/EN) voice alert when a new P1 exam is registered
  React.useEffect(() => {
    const activeP1Exams = exams.filter(e => e.patientPriority === 'P1' && e.status === 'WAITING');
    if (activeP1Exams.length === 0) return;

    const currentP1Ids = activeP1Exams.map(e => e.id);
    const newP1 = activeP1Exams.find(e => !knownP1Ids.includes(e.id));

    if (newP1) {
      if (knownP1Ids.length > 0) {
        // Create peaceful spoken emergency alert (Bilingual FR/EN)
        const spellPhonetic = (code: string) => code.split('').join(' ');
        const coded = spellPhonetic(newP1.numeroOrdre);
        const textFr = `Alerte! Nouvel examen urgent enregistré de type ${newP1.modalite}. Patient numéro ${coded}, veuillez vous préparer.`;
        const textEn = `Attention! New medical emergency. Urgent patient number ${coded} for ${newP1.modalite === 'IRM' ? 'MRI' : newP1.modalite === 'Radio' ? 'X-Ray' : newP1.modalite}. Please prepare immediately.`;

        if ('speechSynthesis' in window) {
          window.speechSynthesis.cancel();
          const uFr = new SpeechSynthesisUtterance(textFr);
          uFr.lang = 'fr-FR';
          uFr.rate = 0.95;
          const uEn = new SpeechSynthesisUtterance(textEn);
          uEn.lang = 'en-US';
          uEn.rate = 0.95;

          window.speechSynthesis.speak(uFr);
          uFr.onend = () => {
            setTimeout(() => {
              window.speechSynthesis.speak(uEn);
            }, 600);
          };
        }
      }
      setKnownP1Ids(prev => Array.from(new Set([...prev, ...currentP1Ids])));
    } else {
      const allP1Ids = exams.filter(e => e.patientPriority === 'P1').map(e => e.id);
      if (allP1Ids.some(id => !knownP1Ids.includes(id))) {
        setKnownP1Ids(allP1Ids);
      }
    }
  }, [exams, knownP1Ids]);

  // Advanced Voice Synthesis settings
  const [voiceEngine, setVoiceEngine] = useState<'neural' | 'browser'>('neural'); // Modern High-Fidelity Google Neural voices enabled by default!
  const [availableVoices, setAvailableVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [selectedFrVoiceURI, setSelectedFrVoiceURI] = useState<string>('');
  const [selectedEnVoiceURI, setSelectedEnVoiceURI] = useState<string>('');
  const [announcementPitch, setAnnouncementPitch] = useState<number>(1.0); // reassure frequency (0.5 to 2)
  const [announcementRate, setAnnouncementRate] = useState<number>(1.25);   // steady, calm pacing speed (0.5 to 2)

  // Tracking HTML5 Audio streams for Neural engine to manage overlapping or consecutive dual-language calls
  const activeAudioRef = React.useRef<HTMLAudioElement | null>(null);

  // Clean up any playing audio stream when component is unmounted
  React.useEffect(() => {
    return () => {
      if (activeAudioRef.current) {
        activeAudioRef.current.pause();
        activeAudioRef.current = null;
      }
    };
  }, []);

  // Filter available voices based on languages
  const frVoices = availableVoices.filter(v => v.lang.startsWith('fr'));
  const enVoices = availableVoices.filter(v => v.lang.startsWith('en'));

  // Load physical browser voices (handles standard chromium/webkit asynchronous loader)
  React.useEffect(() => {
    if (!('speechSynthesis' in window)) return;

    const loadVoices = () => {
      const voices = window.speechSynthesis.getVoices();
      setAvailableVoices(voices);
      
      // Auto-detect premium, neural, high-fidelity Google/Microsoft/Apple voices
      // Keywords to identify high-quality realistic voices
      const premiumKeywords = ['google', 'natural', 'premium', 'neural', 'encelade', 'enceladus', 'online', 'fizz', 'salli'];
      
      const bestFr = voices.find(v => 
        v.lang.startsWith('fr') && 
        premiumKeywords.some(keyword => v.name.toLowerCase().includes(keyword))
      );
      
      const bestEn = voices.find(v => 
        v.lang.startsWith('en') && 
        premiumKeywords.some(keyword => v.name.toLowerCase().includes(keyword))
      );

      const standardFr = voices.find(v => v.lang.startsWith('fr'));
      const standardEn = voices.find(v => v.lang.startsWith('en'));

      if (bestFr) setSelectedFrVoiceURI(bestFr.voiceURI);
      else if (standardFr) setSelectedFrVoiceURI(standardFr.voiceURI);

      if (bestEn) setSelectedEnVoiceURI(bestEn.voiceURI);
      else if (standardEn) setSelectedEnVoiceURI(standardEn.voiceURI);
    };

    loadVoices();
    if (window.speechSynthesis.onvoiceschanged !== undefined) {
      window.speechSynthesis.onvoiceschanged = loadVoices;
    }
  }, []);

  // Filter exams for this modality
  const rawModalityExams = selectedModality === 'ALL'
    ? exams
    : exams.filter(ex => ex.modalite === selectedModality);

  // Group into Active ones (WAITING, CALLED, IN_PROGRESS) vs Completed (DONE)
  const activeExams = rawModalityExams.filter(e => e.status !== 'DONE');
  const finishedExams = rawModalityExams.filter(e => e.status === 'DONE');

  // FIFO Prioritaire Multimodal sorting formula:
  // 1. By Priority (P1 > P2 > P3 > P4)
  // 2. By heureCreation ASC (FIFO)
  const sortedActiveExams = [...activeExams].sort((a, b) => {
    const priorityScore = { P1: 1, P2: 1, P3: 3, P4: 4 };
    const scoreA = priorityScore[a.patientPriority] || 4;
    const scoreB = priorityScore[b.patientPriority] || 4;

    if (scoreA !== scoreB) {
      return scoreA - scoreB; // lower score = higher priority
    }
    // equal priority, sort by chronological arrival
    return new Date(a.heureCreation).getTime() - new Date(b.heureCreation).getTime();
  });

  const triggerAudioPaging = (numeroOrdre: string, modalite: string, salle: string) => {
    // 1. Spellout phonetic letters/numbers for clear audio in Cameroon
    const spellPhonetic = (code: string, targetLang: 'fr' | 'en') => {
      return code.split('').map(char => {
        if (char === '0') return targetLang === 'fr' ? 'zéro' : 'zero';
        if (char === '1') return targetLang === 'fr' ? 'un' : 'one';
        if (char === '2') return targetLang === 'fr' ? 'deux' : 'two';
        if (char === '3') return targetLang === 'fr' ? 'trois' : 'three';
        if (char === '4') return targetLang === 'fr' ? 'quatre' : 'four';
        if (char === '5') return targetLang === 'fr' ? 'cinq' : 'five';
        if (char === '6') return targetLang === 'fr' ? 'six' : 'six';
        if (char === '7') return targetLang === 'fr' ? 'sept' : 'seven';
        if (char === '8') return targetLang === 'fr' ? 'huit' : 'eight';
        if (char === '9') return targetLang === 'fr' ? 'neuf' : 'nine';
        return char;
      }).join(' ');
    };

    const codeFr = spellPhonetic(numeroOrdre, 'fr');
    const codeEn = spellPhonetic(numeroOrdre, 'en');

    // Cleaned up beautiful modalite / salle labels for natural pronunciation
    const resolvedSalleFr = salle || modalite;
    const resolvedSalleEn = modalite === 'IRM' ? 'MRI' : modalite === 'Echographie' || modalite === 'Échographie' ? 'Ultrasound' : modalite === 'Radio' ? 'X-Ray' : salle || modalite;

    // Fluid medical speech text constructions, warm and supportive
    const textFr = `Attention s'il vous plaît. Numéro ${codeFr}, veuillez vous présenter à la salle ${resolvedSalleFr}.`;
    const textEn = `Attention please. Patient number ${codeEn}, please proceed to the ${resolvedSalleEn} room.`;

    // Private fallback helper utilizing local browser speechSynthesis (in case of Vercel / serverless 404s)
    const playLocalFallback = () => {
      if (!('speechSynthesis' in window)) {
        console.warn("Speech Synthesis not supported in this browser");
        return;
      }
      window.speechSynthesis.cancel();

      const utteranceFr = new SpeechSynthesisUtterance(textFr);
      utteranceFr.lang = 'fr-FR';
      utteranceFr.rate = announcementRate;
      utteranceFr.pitch = announcementPitch;
      const matchedFrVoice = availableVoices.find(v => v.voiceURI === selectedFrVoiceURI);
      if (matchedFrVoice) utteranceFr.voice = matchedFrVoice;

      const utteranceEn = new SpeechSynthesisUtterance(textEn);
      utteranceEn.lang = 'en-US';
      utteranceEn.rate = announcementRate * 0.95;
      utteranceEn.pitch = announcementPitch;
      const matchedEnVoice = availableVoices.find(v => v.voiceURI === selectedEnVoiceURI);
      if (matchedEnVoice) utteranceEn.voice = matchedEnVoice;

      if (lang === 'FR') {
        window.speechSynthesis.speak(utteranceFr);
        utteranceFr.onend = () => {
          setTimeout(() => {
            window.speechSynthesis.speak(utteranceEn);
          }, 600);
        };
      } else {
        window.speechSynthesis.speak(utteranceEn);
        utteranceEn.onend = () => {
          setTimeout(() => {
            window.speechSynthesis.speak(utteranceFr);
          }, 600);
        };
      }
    };

    // ENGINE 1: Modern Neural Voice Engine (Recommended - Premium Cloud HD Audio)
    if (voiceEngine === 'neural') {
      // Clear physical synthesis to prevent speech overlap
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }

      // Stop any existing active HTML5 audio stream immediately
      if (activeAudioRef.current) {
        activeAudioRef.current.pause();
        activeAudioRef.current = null;
      }

      const audioFr = new Audio(`/api/tts?text=${encodeURIComponent(textFr)}&lang=fr`);
      const audioEn = new Audio(`/api/tts?text=${encodeURIComponent(textEn)}&lang=en`);

      // Set playback rates if defined
      audioFr.playbackRate = announcementRate;
      audioEn.playbackRate = announcementRate * 0.95;

      let fallbackTriggered = false;
      const triggerFallbackOnce = (errorMsg: any) => {
        if (!fallbackTriggered) {
          fallbackTriggered = true;
          console.warn("Neural TTS server error/404 detected (commonly on Vercel static deployments). Falling back to browser SpeechSynthesis.", errorMsg);
          playLocalFallback();
        }
      };

      // Set fallback error listeners for 404 / network failures (e.g. on Vercel deployment)
      audioFr.onerror = () => triggerFallbackOnce("audioFr load/codec issue");
      audioEn.onerror = () => triggerFallbackOnce("audioEn load/codec issue");

      if (lang === 'FR') {
        activeAudioRef.current = audioFr;
        audioFr.play().catch(err => {
          console.warn("Google Neural TTS Playback failed:", err);
          triggerFallbackOnce(err);
        });
        audioFr.onended = () => {
          setTimeout(() => {
            activeAudioRef.current = audioEn;
            audioEn.play().catch(err => {
              console.warn("Google Neural TTS Playback failed:", err);
              triggerFallbackOnce(err);
            });
          }, 600);
        };
      } else {
        activeAudioRef.current = audioEn;
        audioEn.play().catch(err => {
          console.warn("Google Neural TTS Playback failed:", err);
          triggerFallbackOnce(err);
        });
        audioEn.onended = () => {
          setTimeout(() => {
            activeAudioRef.current = audioFr;
            audioFr.play().catch(err => {
              console.warn("Google Neural TTS Playback failed:", err);
              triggerFallbackOnce(err);
            });
          }, 600);
        };
      }
      return;
    }

    // ENGINE 2: Classic / Legacy Local Web SpeechSynthesis
    if (!('speechSynthesis' in window)) {
      console.warn("Speech Synthesis not supported in this browser");
      return;
    }

    window.speechSynthesis.cancel();

    const utteranceFr = new SpeechSynthesisUtterance(textFr);
    utteranceFr.lang = 'fr-FR';
    utteranceFr.rate = announcementRate;
    utteranceFr.pitch = announcementPitch;

    const matchedFrVoice = availableVoices.find(v => v.voiceURI === selectedFrVoiceURI);
    if (matchedFrVoice) {
      utteranceFr.voice = matchedFrVoice;
    }

    const utteranceEn = new SpeechSynthesisUtterance(textEn);
    utteranceEn.lang = 'en-US';
    utteranceEn.rate = announcementRate * 0.95;
    utteranceEn.pitch = announcementPitch;

    const matchedEnVoice = availableVoices.find(v => v.voiceURI === selectedEnVoiceURI);
    if (matchedEnVoice) {
      utteranceEn.voice = matchedEnVoice;
    }

    if (lang === 'FR') {
      window.speechSynthesis.speak(utteranceFr);
      utteranceFr.onend = () => {
        setTimeout(() => {
          window.speechSynthesis.speak(utteranceEn);
        }, 600);
      };
    } else {
      window.speechSynthesis.speak(utteranceEn);
      utteranceEn.onend = () => {
        setTimeout(() => {
          window.speechSynthesis.speak(utteranceFr);
        }, 600);
      };
    }
  };

  const playTestSpeech = (testLang: 'FR' | 'EN') => {
    const sampleText = testLang === 'FR'
      ? "Annonce de test. Numéro I 0 2, veuillez vous présenter à l'IRM."
      : "Test announcement. Number I zero two, please proceed to the MRI.";

    const playLocalTestFallback = () => {
      if (!('speechSynthesis' in window)) return;
      window.speechSynthesis.cancel();

      const utterance = new SpeechSynthesisUtterance(sampleText);
      utterance.lang = testLang === 'FR' ? 'fr-FR' : 'en-US';
      utterance.rate = announcementRate;
      utterance.pitch = announcementPitch;

      const matchedVoice = availableVoices.find(
        v => v.voiceURI === (testLang === 'FR' ? selectedFrVoiceURI : selectedEnVoiceURI)
      );
      if (matchedVoice) {
        utterance.voice = matchedVoice;
      }
      
      window.speechSynthesis.speak(utterance);
    };

    if (voiceEngine === 'neural') {
      if (activeAudioRef.current) {
        activeAudioRef.current.pause();
      }
      const audio = new Audio(`/api/tts?text=${encodeURIComponent(sampleText)}&lang=${testLang === 'FR' ? 'fr' : 'en'}`);
      audio.playbackRate = announcementRate;
      activeAudioRef.current = audio;
      
      let fallbackTriggered = false;
      const triggerFallback = (err: any) => {
        if (!fallbackTriggered) {
          fallbackTriggered = true;
          console.warn("Neural TTS Test failed, falling back to local SpeechSynthesis:", err);
          playLocalTestFallback();
        }
      };
      
      audio.onerror = () => triggerFallback("audio error event");
      audio.play().catch(err => {
        console.warn("Neural TTS Test Playback failed:", err);
        triggerFallback(err);
      });
      return;
    }

    if (!('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(sampleText);
    utterance.lang = testLang === 'FR' ? 'fr-FR' : 'en-US';
    utterance.rate = announcementRate;
    utterance.pitch = announcementPitch;

    const matchedVoice = availableVoices.find(
      v => v.voiceURI === (testLang === 'FR' ? selectedFrVoiceURI : selectedEnVoiceURI)
    );
    if (matchedVoice) {
      utterance.voice = matchedVoice;
    }
    
    window.speechSynthesis.speak(utterance);
  };

  const handleActionClick = async (examId: string, currentStatus: ExamStatus) => {
    let nextStatus: ExamStatus = 'WAITING';
    if (currentStatus === 'WAITING') nextStatus = 'CALLED';
    else if (currentStatus === 'CALLED') nextStatus = 'IN_PROGRESS';
    else if (currentStatus === 'IN_PROGRESS') nextStatus = 'DONE';

    const performLocalStatusChange = () => {
      onStatusChange(examId, nextStatus);
      if (nextStatus === 'CALLED') {
        const updatedExam = exams.find(e => e.id === examId);
        if (updatedExam) {
          const examModality = updatedExam.modalite;
          const currentModObj = MODALITIES.find(m => m.id === examModality);
          triggerAudioPaging(
            updatedExam.numeroOrdre, 
            examModality, 
            currentModObj ? currentModObj.salle : 'Examen'
          );
        }
      }
    };

    try {
      const response = await fetch('/api/exams/status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ examId, status: nextStatus, lang })
      });

      if (response.ok) {
        onStatusChange(examId, nextStatus);
        
        // Trigger speech when called
        if (nextStatus === 'CALLED') {
          const updatedExam = exams.find(e => e.id === examId);
          if (updatedExam) {
            const examModality = updatedExam.modalite;
            const currentModObj = MODALITIES.find(m => m.id === examModality);
            triggerAudioPaging(
              updatedExam.numeroOrdre, 
              examModality, 
              currentModObj ? currentModObj.salle : 'Examen'
            );
          }
        }
      } else {
        console.warn("Backend server returned error, updating locally");
        performLocalStatusChange();
      }
    } catch (err) {
      console.warn("Network issue, updating status locally:", err);
      performLocalStatusChange();
    }
  };

  const handleManualPage = (numero: string, examModality: string) => {
    const currentModObj = MODALITIES.find(m => m.id === examModality);
    triggerAudioPaging(numero, examModality, currentModObj ? currentModObj.salle : 'Examen');
  };

  const getStatusColor = (status: ExamStatus) => {
    switch (status) {
      case 'WAITING':
        return 'bg-rose-50 border border-rose-200 text-rose-700 font-semibold';
      case 'CALLED':
        return 'bg-amber-50 border border-amber-200 text-amber-700 font-semibold';
      case 'IN_PROGRESS':
        return 'bg-sky-50 border border-sky-200 text-sky-700 font-semibold animate-pulse';
      case 'DONE':
        return 'bg-emerald-50 border border-emerald-200 text-emerald-700 font-semibold';
      default:
        return 'bg-slate-100 text-slate-700';
    }
  };

  const getPriorityBadgeClass = (p: string) => {
    switch (p) {
      case 'P1':
      case 'P2': return 'text-white font-bold animate-badge-pulse-red';
      case 'P3': return 'bg-sky-500 text-white font-medium';
      default: return 'bg-slate-100 text-slate-700 border border-slate-200 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-355';
    }
  };

  const kpiTotalExams = exams.length;
  const kpiWaitingExams = exams.filter(e => e.status === 'WAITING' || e.status === 'CALLED');
  const kpiFinishedExams = exams.filter(e => e.status === 'DONE');

  const calculateAverageWait = () => {
    const doneWithTimes = exams.filter(e => e.status === 'DONE' && e.heureAppel && e.heureCreation);
    if (doneWithTimes.length === 0) {
      return kpiWaitingExams.length > 5 ? '45 mins' : '15 mins';
    }

    let totalDiffMs = 0;
    doneWithTimes.forEach(ex => {
      const diff = new Date(ex.heureAppel!).getTime() - new Date(ex.heureCreation).getTime();
      totalDiffMs += diff;
    });

    const averageMins = Math.round((totalDiffMs / doneWithTimes.length) / 60000);
    return `${Math.max(3, averageMins)} mins`;
  };

  const getModalityCounts = () => {
    const counts: Record<string, { total: number; waiting: number; finished: number }> = {};
    MODALITIES.forEach(mod => {
      counts[mod.id] = { total: 0, waiting: 0, finished: 0 };
    });
    exams.forEach(ex => {
      if (counts[ex.modalite]) {
        counts[ex.modalite].total++;
        if (ex.status === 'WAITING' || ex.status === 'CALLED' || ex.status === 'IN_PROGRESS') {
          counts[ex.modalite].waiting++;
        } else if (ex.status === 'DONE') {
          counts[ex.modalite].finished++;
        }
      }
    });
    return counts;
  };

  const modalityCounts = getModalityCounts();

  const handleRunAiAnalysis = async () => {
    setAnalyzing(true);
    
    const runLocalHeuristicsReport = () => {
      const isFr = lang === 'FR';
      const waitingExams = exams.filter(e => e.status === 'WAITING' || e.status === 'CALLED' || e.status === 'IN_PROGRESS');
      const completedExams = exams.filter(e => e.status === 'DONE');
      
      const queueByModality: Record<string, number> = {};
      const priorityCounts: Record<string, number> = { P1: 0, P2: 0, P3: 0, P4: 0 };
      
      waitingExams.forEach(ex => {
        queueByModality[ex.modalite] = (queueByModality[ex.modalite] || 0) + 1;
        priorityCounts[ex.patientPriority] = (priorityCounts[ex.patientPriority] || 0) + 1;
      });

      const topModality = Object.entries(queueByModality).reduce((a, b) => a[1] > b[1] ? a : b, ['Aucun', 0]);

      let reportText = "";
      if (isFr) {
        const urgencyWarning = priorityCounts.P1 > 0 
          ? `⚠️ **ALERTE URGENCE** : Il y a ${priorityCounts.P1} urgence(s) vitale(s) (P1) en cours. L'algorithme a automatiquement suspendu la file d'attente d'arrivée normale pour ces modalités.`
          : `✅ **STATUT URGENCE** : Aucune urgence vitale P1 en attente.`;

        reportText = `### 📊 Rapport d'Analyse Opérationnelle Locale (Heuristique d'Établissement)

${urgencyWarning}

#### 1. Diagnostic de Fluidité & Temps d'Attente Estimés
- **Scanner** : ~${Math.max(15, (queueByModality['Scanner'] || 0) * 20)} minutes d'attente.
- **IRM** : ~${Math.max(20, (queueByModality['IRM'] || 0) * 35)} minutes d'attente.
- **Échographie / Radio** : ~${Math.max(10, (queueByModality['Échographie'] || 0) * 15)} minutes d'attente.
- **Statut Général** : **${waitingExams.length > 5 ? "Surcharge Modérée à Douala" : "Activité Fluide et Maîtrisée"}**

#### 2. Goulot d'Étranglement Principal
- ${topModality[0] !== 'Aucun' && topModality[1] > 0 ? `**Modalité encombrée** : **${topModality[0]}** avec **${topModality[1]}** examens actifs.` : `**Aucun goulot d'étranglement majeur** détecté actuellement.`}
- *Note* : L'IRM et le Scanner restent les plus critiques en raison du temps technique d'acquisition machine (environ 30 min par patient).

#### 3. Recommandations Pratiques pour le Directeur d'Imagerie de Douala
- **Routage Patient** : Orientez temporairement les nouveaux patients vers les examens rapides (Panoramique, Échographie) si possible.
- **Bilinguisme local** : Les alertes vocales en français et anglais ont été adaptées pour fluidifier l'appel des patients n'ayant pas compris les signaux visuels.
- **Optimisation des Effectifs** : Transférer un technicien vers le secteur **${topModality[0] !== 'Aucun' && topModality[0] !== 'None' ? topModality[0] : "Scanner"}** pour accélérer le débit.
`;
      } else {
        const urgencyWarning = priorityCounts.P1 > 0
          ? `⚠️ **EMERGENCY REPORT** : ${priorityCounts.P1} active critical case(s) (P1) pending. The prioritizer is overriding default FIFO files automatically.`
          : `✅ **EMERGENCY STATUS** : No critical P1 cases pending.`;

        reportText = `### 📊 Operational Assessment Report (Local Heuristics Engine)

${urgencyWarning}

#### 1. Fluidity Status & Estimated Wait Times
- **CT Scanner** : ~${Math.max(15, (queueByModality['Scanner'] || 0) * 20)} minutes estimated delay.
- **MRI** : ~${Math.max(20, (queueByModality['IRM'] || 0) * 35)} minutes estimated delay.
- **Ultrasound / X-Ray** : ~${Math.max(10, (queueByModality['Échographie'] || 0) * 15)} minutes estimated delay.
- **General Assessment** : **${waitingExams.length > 5 ? "Moderately Overloaded Flow" : "Fluid Operations"}**

#### 2. Bottleneck Detection
- ${topModality[0] !== 'Aucun' && topModality[0] !== 'None' && topModality[1] > 0 ? `**Heaviest bottleneck** : **${topModality[0]}** with **${topModality[1]}** active patients.` : `**No major queues** detected on modalities right now.`}
- *Insight*: Scanner/MRI machines have high technical overhead (30 mins average), causing faster stack-up compared to ultrasound.

#### 3. Actionable Douala Hospital Directives
- **Staff Reallocation**: Recommend shifting standard clinical technicians from low-demand sectors to **${topModality[0] !== 'Aucun' && topModality[0] !== 'None' ? topModality[0] : "Scanner"}**.
- **Bilingual Announcements**: Verify that dual voice alerts (EN/FR) are active on the waiting screen to assist patients from all regions.
`;
      }
      setAiReport(reportText);
      setReportSource("Local Analyzer");
    };

    try {
      const response = await fetch('/api/gemini/predict', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lang })
      });

      if (response.ok) {
        const data = await response.json();
        setAiReport(data.report);
        setReportSource(data.source);
      } else {
        console.warn("Backend Gemini AI prediction endpoint returned error, compiling local Operational Assessment Report instead.");
        runLocalHeuristicsReport();
      }
    } catch (err) {
      console.warn("Network offline, compiling local Operational Assessment Report instead:", err);
      runLocalHeuristicsReport();
    } finally {
      setAnalyzing(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Modality workstation selectors */}
      <div className="bg-slate-800 rounded-2xl p-5 text-white flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-bold tracking-tight">{dictionary.modalitySelect}</h2>
          <p className="text-slate-400 text-xs">Simulateur d'écran clinique de spécialité</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {/* Tous / All button */}
          <button
            onClick={() => setSelectedModality('ALL')}
            className={`px-4 py-2 rounded-xl text-xs font-semibold cursor-pointer transition-all duration-150 flex items-center gap-2 ${
              selectedModality === 'ALL'
                ? 'bg-white text-slate-900 shadow-md ring-1 ring-slate-200/80'
                : 'bg-slate-700 text-slate-200 hover:bg-slate-600 hover:text-white'
            }`}
          >
            <span>{lang === 'FR' ? 'Tous' : 'All'}</span>
            <span className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold ${
              selectedModality === 'ALL' ? 'bg-slate-900 text-white' : 'bg-slate-800 text-slate-400'
            }`}>
              {exams.filter(e => e.status !== 'DONE').length} / {exams.length}
            </span>
          </button>

          {MODALITIES.map((mod) => {
            const stats = modalityCounts[mod.id] || { total: 0, waiting: 0, finished: 0 };
            return (
              <button
                key={mod.id}
                onClick={() => setSelectedModality(mod.id)}
                className={`px-4 py-2 rounded-xl text-xs font-semibold cursor-pointer transition-all duration-150 flex items-center gap-2 ${
                  selectedModality === mod.id
                    ? 'bg-white text-slate-900 shadow-md ring-1 ring-slate-200/80'
                    : 'bg-slate-700 text-slate-200 hover:bg-slate-600 hover:text-white'
                }`}
              >
                <span>{mod.nom}</span>
                <span className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold ${
                  selectedModality === mod.id ? 'bg-slate-900 text-white' : 'bg-slate-800 text-slate-400'
                }`}>
                  {stats.waiting} / {stats.total}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Active patients queue table - full width */}
      <div className="bg-white border border-slate-100 rounded-3xl shadow-xs p-6 md:p-8">
        <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-5">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-rose-50 text-rose-600 rounded-xl">
              <Users className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-sm md:text-base uppercase tracking-tight">
                {selectedModality === 'ALL' ? (lang === 'FR' ? 'Toutes les Modalités' : 'All Modalities') : selectedModality} — {dictionary.activeQueue}
              </h3>
              <p className="text-xs text-slate-400 font-medium mt-0.5">
                {lang === 'FR' ? 'Trié par Algorithme FIFO Prioritaire (Réinitialisation quotidienne)' : 'Sorted via FIFO Priority Formula (Daily Reset)'}
              </p>
            </div>
          </div>
          <span className="bg-slate-100 text-slate-800 px-3 py-1 rounded-xl text-xs font-extrabold font-mono flex items-center gap-1">
            <span>{sortedActiveExams.length} {lang === 'FR' ? 'En file' : 'Pending'}</span>
            <span className="text-slate-400">/</span>
            <span className="text-slate-500">{rawModalityExams.length} {lang === 'FR' ? 'Total journalier' : 'Daily total'}</span>
          </span>
        </div>

        {sortedActiveExams.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-100 text-slate-450 text-[10px] md:text-xs font-bold uppercase tracking-wider">
                  <th className="pb-3 pl-3">{dictionary.colOrder}</th>
                  <th className="pb-3">{dictionary.colPatient}</th>
                  <th className="pb-3">{lang === 'FR' ? 'Modalité' : 'Modality'}</th>
                  <th className="pb-3">{dictionary.colPriority}</th>
                  <th className="pb-3">{dictionary.colStatus}</th>
                  <th className="pb-3 text-right pr-3">{dictionary.colActions}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {sortedActiveExams.map((ex, index) => {
                  const isUrgent = ex.patientPriority === 'P1' || ex.patientPriority === 'P2';
                  const queueNumText = ex.patientPriority === 'P1' ? '🚨 P1' : ex.patientPriority === 'P2' ? '🚨 P2' : `${index + 1}`;
                  const isNotDone = ex.status === 'WAITING'; // ce qui n'a pas encore été fait (en attente)
                  
                  let blinkClass = 'border-l-4 border-transparent';
                  if (isUrgent) {
                    blinkClass = 'bg-rose-500/[0.04] dark:bg-rose-950/20 border-l-4 border-rose-600 animate-border-blink-red';
                  } else if (isNotDone) {
                    blinkClass = 'bg-amber-500/[0.02] dark:bg-amber-950/10 border-l-4 border-amber-400';
                  }

                  return (
                    <tr 
                      key={ex.id} 
                      className={`hover:bg-slate-100/60 transition-colors duration-100 ${blinkClass}`}
                    >
                      <td className="py-4 pl-3 font-mono font-bold text-slate-900 group">
                        <span className="text-sky-600 font-sans font-normal text-xs mr-2">{queueNumText}</span>
                        {ex.numeroOrdre}
                      </td>
                      <td className="py-4">
                        <p className="font-semibold text-slate-800">{ex.patientNom}</p>
                        <p className="text-[10px] text-slate-400">
                          Arr: {new Date(ex.heureCreation).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </td>
                      <td className="py-4">
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-900 text-white uppercase tracking-wider">
                          {ex.modalite}
                        </span>
                      </td>
                      <td className="py-4">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${getPriorityBadgeClass(ex.patientPriority)}`}>
                          {PRIORITY_LABELS[lang][ex.patientPriority].split(' ')[1]}
                        </span>
                      </td>
                      <td className="py-4">
                        <span className={`px-2.5 py-1 rounded-full text-xs ${getStatusColor(ex.status)}`}>
                          {dictionary[`status${ex.status}` as keyof typeof dictionary]}
                        </span>
                      </td>
                      <td className="py-4 text-right pr-3">
                        <div className="flex gap-2 justify-end">
                          {/* Call button */}
                          {ex.status === 'WAITING' && (
                            <button
                              onClick={() => handleActionClick(ex.id, 'WAITING')}
                              className="bg-amber-500 hover:bg-amber-600 text-white rounded-lg px-3 py-1.5 text-xs font-semibold flex items-center gap-1 cursor-pointer"
                            >
                              <Volume2 className="w-3.5 h-3.5" />
                              {dictionary.btnCall}
                            </button>
                          )}

                          {/* Status controls of active examinations */}
                          {ex.status === 'CALLED' && (
                            <>
                              <button
                                onClick={() => handleManualPage(ex.numeroOrdre, ex.modalite)}
                                title="Repeat vocal announce"
                                className="bg-amber-100 hover:bg-amber-200 text-amber-800 rounded-lg p-1.5 cursor-pointer"
                              >
                                <Volume2 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => handleActionClick(ex.id, 'CALLED')}
                                className="bg-sky-600 hover:bg-sky-700 text-white rounded-lg px-3 py-1.5 text-xs font-semibold flex items-center gap-1 cursor-pointer"
                              >
                                <Play className="w-3.5 h-3.5" />
                                {dictionary.btnStart}
                              </button>
                            </>
                          )}

                          {ex.status === 'IN_PROGRESS' && (
                            <div className="flex gap-1.5 justify-end">
                              <button
                                onClick={() => handleManualPage(ex.numeroOrdre, ex.modalite)}
                                title={lang === 'FR' ? 'Rappeler le patient' : 'Recall Patient'}
                                className="bg-indigo-100 hover:bg-indigo-200 text-indigo-900 border border-indigo-200 rounded-lg p-1.5 cursor-pointer flex items-center justify-center transition-all shadow-xs"
                              >
                                <Volume2 className="w-3.5 h-3.5 animate-pulse" />
                              </button>
                              <button
                                onClick={() => handleActionClick(ex.id, 'IN_PROGRESS')}
                                className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg px-3 py-1.5 text-xs font-semibold flex items-center gap-1 cursor-pointer transition-all"
                              >
                                <Check className="w-3.5 h-3.5" />
                                {dictionary.btnFinish}
                              </button>
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="py-12 text-center border border-dashed border-slate-200 rounded-xl bg-slate-50/30 text-slate-400">
            <Users className="w-8 h-8 mx-auto mb-2 text-slate-300" />
            <p className="text-sm">{dictionary.noPatients}</p>
            <p className="text-xs text-slate-500 mt-1">
              {lang === 'FR' ? 'Quand les patients de la réception ont cette modalité, ils apparaissent ici.' : 'Fresh patients selecting this department will stack up here.'}
            </p>
          </div>
        )}
      </div>

      {/* ================== GENERAL HEALTH & CONGESTION STATISTICS (Brought back to Service Imagerie) ================== */}
      <div className="border-t border-slate-100 pt-8 mt-10 space-y-6">

        {/* Live Monthly Modality historical chart (custom SVG vector) */}
        <div className="w-full">
          <MonthlyModalityChart lang={lang} exams={exams} />
        </div>
      </div>
    </div>
  );
}
